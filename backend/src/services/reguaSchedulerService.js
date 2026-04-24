/**
 * Scheduler de reguas — tick a cada 1 minuto.
 *
 * Diferente do anterior (1x/dia), agora cada etapa dispara no SEU horario.
 * A cada tick, o scheduler:
 *   1. Busca reguas ativas + etapas ativas
 *   2. Para cada etapa cujo horario cai na janela [agora, agora+5min]
 *      e que nao rodou hoje (ultimaExecucaoEm != hoje BRT):
 *        - Consulta a segmentacao DO MOMENTO (dados frescos)
 *        - Enqueua DisparoMensagem para cada titulo elegivel
 *        - Marca etapa.ultimaExecucaoEm = agora
 *
 * Idempotencia: unique (etapaReguaId, pessoaCodigo, contaReceberCodigo) no banco
 * e jaRodouHoje() como primeira barreira.
 */

import { prisma } from '../config/database.js';
import { buildSegmentacaoQuery } from './segmentacaoQueryBuilder.js';
import { resolverVariaveis } from './reguaExecutorService.js';

// ----- Helpers de tempo BRT (UTC-3) -----

function agoraBRT() {
  const d = new Date();
  return new Date(d.getTime() - 3 * 60 * 60 * 1000);
}

function chaveBRTDia(d) {
  const brt = new Date(new Date(d).getTime() - 3 * 60 * 60 * 1000);
  return brt.toISOString().slice(0, 10);
}

function minutosBRTAgora() {
  const d = agoraBRT();
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function parseHHMM(hhmm) {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(':').map(Number);
  if (isNaN(h)) return null;
  return h * 60 + (m || 0);
}

function estaNoHorarioDa(etapa, regua) {
  const hhmm = etapa.horario || regua.horarioPadrao || '09:00';
  const alvo = parseHHMM(hhmm);
  if (alvo === null) return false;
  const agora = minutosBRTAgora();
  return agora >= alvo && agora < alvo + 5;
}

function jaRodouHoje(etapa) {
  if (!etapa.ultimaExecucaoEm) return false;
  return chaveBRTDia(etapa.ultimaExecucaoEm) === chaveBRTDia(new Date());
}

// ----- Enfileiramento -----

// Batch size para paginacao — limita pico de memoria (500 rows × ~500B = ~250KB por iteracao)
const BATCH_SIZE = 500;

/**
 * Processa UMA etapa: executa segmentacao em paginas de BATCH_SIZE linhas,
 * enfileirando DisparoMensagem via createMany (com skipDuplicates) por batch.
 *
 * Performance: 1 query por batch em vez de N+1 (antes: 1 query por aluno elegivel).
 * Memoria: pico limitado a BATCH_SIZE rows carregadas ao mesmo tempo.
 * Idempotencia: skipDuplicates + unique(etapaReguaId, pessoaCodigo, contaReceberCodigo)
 * garante que re-execucao no mesmo dia nao duplica.
 */
async function processarEtapa(regua, etapa) {
  if (!etapa.segmentacaoId) {
    console.warn(`[ReguaScheduler] Etapa ${etapa.id} sem segmentacao — pulada`);
    return 0;
  }

  const seg = await prisma.regraSegmentacao.findUnique({ where: { id: etapa.segmentacaoId } });
  if (!seg) {
    console.warn(`[ReguaScheduler] Segmentacao ${etapa.segmentacaoId} nao encontrada`);
    return 0;
  }
  if (seg.tipo !== 'TITULO') {
    console.warn(`[ReguaScheduler] Etapa ${etapa.id} tem segmentacao ${seg.tipo} — regua exige TITULO. Pulada.`);
    return 0;
  }

  let enfileiradosTotal = 0;
  let page = 1;
  const agora = new Date();

  // Paginacao: busca em batches ate esvaziar a segmentacao
  while (true) {
    const sql = buildSegmentacaoQuery(seg.condicoes, { page, limit: BATCH_SIZE }, 'TITULO');
    const rows = await prisma.$queryRawUnsafe(sql);
    if (rows.length === 0) break;

    // Monta array de disparos validos (filtra telefone invalido / sem token)
    const disparosBatch = [];
    for (const r of rows) {
      const tel = String(r.celular || '').replace(/\D/g, '');
      if (tel.length < 10) continue;
      if (!r.titulo_token) continue;

      const ctx = {
        pessoa: { nome: r.nome, cpf: r.cpf },
        conta: {
          codigo: r.titulo_codigo,
          valor: Number(r.titulo_valor || 0),
          datavencimento: r.titulo_data_vencimento,
          token: r.titulo_token,
          situacao: r.titulo_situacao,
          tipoorigem: r.titulo_tipo_origem,
        },
        hoje: agora,
      };
      const { parametrosPorIndice } = resolverVariaveis(etapa.template.variaveis, ctx);

      disparosBatch.push({
        reguaId: regua.id,
        etapaReguaId: etapa.id,
        templateBlipId: etapa.templateBlipId,
        templateNomeBlip: etapa.template.nomeBlip,
        pessoaCodigo: Number(r.codigo),
        pessoaNome: r.nome,
        contaReceberCodigo: Number(r.titulo_codigo),
        telefone: r.celular,
        parametros: parametrosPorIndice,
        status: 'PENDENTE',
        origem: 'REGUA_AUTO',
      });
    }

    if (disparosBatch.length > 0) {
      try {
        const result = await prisma.disparoMensagem.createMany({
          data: disparosBatch,
          skipDuplicates: true,
        });
        enfileiradosTotal += result.count;
      } catch (err) {
        console.warn(`[ReguaScheduler] Falha createMany batch (etapa ${etapa.id}): ${err?.message}`);
      }
    }

    // Se batch retornou menos que BATCH_SIZE, acabou
    if (rows.length < BATCH_SIZE) break;
    page++;
  }

  return enfileiradosTotal;
}

/**
 * Tick do scheduler — checa cada etapa no horario.
 */
async function tick() {
  const reguas = await prisma.reguaCobranca.findMany({
    where: { ativo: true },
    include: {
      etapas: {
        where: { ativo: true },
        include: { template: true },
      },
    },
  });

  if (reguas.length === 0) return;

  for (const regua of reguas) {
    for (const etapa of regua.etapas) {
      if (jaRodouHoje(etapa)) continue;
      if (!estaNoHorarioDa(etapa, regua)) continue;

      console.log(`[ReguaScheduler] Processando etapa "${etapa.nome}" (regua "${regua.nome}")`);
      const enfileirados = await processarEtapa(regua, etapa);
      await prisma.etapaRegua.update({
        where: { id: etapa.id },
        data: { ultimaExecucaoEm: new Date() },
      });
      await prisma.reguaCobranca.update({
        where: { id: regua.id },
        data: { ultimaExecucao: new Date() },
      }).catch(() => {});
      console.log(`[ReguaScheduler] Etapa "${etapa.nome}": ${enfileirados} disparos enfileirados`);
    }
  }
}

/**
 * Executa regua INTEIRA agora — usado pelo botao "Executar agora" e ao ativar.
 * Por padrao (respeitarHorario=false) ignora o horario e forca enqueue de todas etapas ativas.
 * Passa pela barreira jaRodouHoje (pode forcar via opts.forcar).
 */
export async function executarReguaAgora(reguaId, opts = {}) {
  const { respeitarHorario = false, forcar = true } = opts;

  const regua = await prisma.reguaCobranca.findUnique({
    where: { id: reguaId },
    include: {
      etapas: {
        where: { ativo: true },
        include: { template: true },
      },
    },
  });
  if (!regua) throw new Error('Regua nao encontrada');

  let enfileiradosTotal = 0;
  let etapasProcessadas = 0;
  for (const etapa of regua.etapas) {
    if (respeitarHorario && !estaNoHorarioDa(etapa, regua)) continue;
    if (!forcar && jaRodouHoje(etapa)) continue;

    const n = await processarEtapa(regua, etapa);
    enfileiradosTotal += n;
    etapasProcessadas++;

    await prisma.etapaRegua.update({
      where: { id: etapa.id },
      data: { ultimaExecucaoEm: new Date() },
    });
  }

  await prisma.reguaCobranca.update({
    where: { id: reguaId },
    data: { ultimaExecucao: new Date() },
  }).catch(() => {});

  console.log(`[ReguaScheduler] executarReguaAgora "${regua.nome}": ${etapasProcessadas} etapas, ${enfileiradosTotal} disparos`);
  return { enfileirados: enfileiradosTotal, etapasProcessadas };
}

/**
 * Start — chamado uma vez no boot. Tick a cada 1 min.
 *
 * Lock de reentrancia (trabalhandoTick): se o tick anterior ainda esta
 * executando quando o proximo intervalo dispara, pula a execucao.
 * Evita que 2+ ticks rodem em paralelo (potencial duplicacao de insert
 * +/- pressao de memoria em casos com muitas etapas/linhas).
 */
let trabalhandoTick = false;

export function startReguaScheduler() {
  console.log('[ReguaScheduler] Ativo — tick a cada 1min (dispara por horario de etapa)');
  setInterval(async () => {
    if (trabalhandoTick) {
      console.warn('[ReguaScheduler] Tick anterior ainda executando — pulando este ciclo');
      return;
    }
    trabalhandoTick = true;
    try {
      await tick();
    } catch (err) {
      console.error('[ReguaScheduler] Erro no tick:', err?.message);
    } finally {
      trabalhandoTick = false;
    }
  }, 60 * 1000);
}
