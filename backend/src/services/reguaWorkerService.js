/**
 * Worker de disparo de reguas.
 *
 * Roda continuamente (setInterval), drena DisparoMensagem com status=PENDENTE,
 * respeitando:
 *  - horario configurado na etapa (ou horarioPadrao da regua)
 *  - intervalo entre disparos (regua.intervaloDisparoSeg, default 2s)
 *  - max 3 tentativas antes de marcar FALHOU
 *
 * Processa 1 disparo por iteracao (LIMIT 1) pra manter memoria baixa.
 * Se regua foi desativada, disparos PENDENTES dela sao marcados CANCELADO.
 */

import { prisma } from '../config/database.js';
import { enviarTemplate } from './blipMensagemService.js';

const INTERVALO_POLL_MS = 5 * 1000; // verifica a cada 5s
const MAX_TENTATIVAS = 3;

function horarioAgoraBRT() {
  const d = new Date();
  const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return brt.getUTCHours() * 60 + brt.getUTCMinutes();
}

function parseHHMM(hhmm) {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(':').map(Number);
  if (isNaN(h)) return null;
  return h * 60 + (m || 0);
}

/**
 * Processa 1 disparo PENDENTE elegivel.
 * Retorna true se processou algo, false se nao havia nada pra fazer.
 */
export async function drenarUm() {
  // Cancela pendentes de reguas desativadas primeiro
  await prisma.$executeRawUnsafe(`
    UPDATE cobranca.disparo_mensagem d
    SET status = 'CANCELADO', "atualizadoEm" = NOW()
    WHERE d.status = 'PENDENTE'
      AND d."reguaId" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM cobranca.regua_cobranca r
        WHERE r.id = d."reguaId" AND r.ativo = false
      )
  `);

  // Buscar 1 disparo pendente elegivel (respeita horario da etapa)
  const agoraMin = horarioAgoraBRT();

  const candidatos = await prisma.disparoMensagem.findMany({
    where: { status: 'PENDENTE' },
    include: {
      // nao tem include porque reguaId e etapaReguaId sao soltos — faz queries separadas
    },
    orderBy: { criadoEm: 'asc' },
    take: 20, // pega os 20 mais antigos e filtra por horario em memoria
  });

  if (candidatos.length === 0) return false;

  // Filtra por horario: precisa buscar etapa+regua de cada candidato pra checar horario
  let selecionado = null;
  for (const d of candidatos) {
    if (d.origem === 'DISPARO_MANUAL') {
      // Manual: dispara imediato, sem checagem de horario
      selecionado = d;
      break;
    }
    if (!d.etapaReguaId) continue;
    const etapa = await prisma.etapaRegua.findUnique({
      where: { id: d.etapaReguaId },
      include: { regua: true },
    });
    if (!etapa || !etapa.regua) continue;
    if (!etapa.regua.ativo) continue; // regua desativada — sera cancelado no proximo loop
    const horarioAlvo = parseHHMM(etapa.horario) ?? parseHHMM(etapa.regua.horarioPadrao) ?? 9 * 60;
    if (agoraMin >= horarioAlvo) {
      selecionado = d;
      break;
    }
  }

  if (!selecionado) return false;

  // DEFESA EM PROFUNDIDADE: re-valida situacao do titulo antes do envio.
  // Isso evita enviar cobranca pra quem pagou ou cancelou entre enqueue e envio.
  if (selecionado.contaReceberCodigo) {
    try {
      const conta = await prisma.contareceber.findUnique({
        where: { codigo: Number(selecionado.contaReceberCodigo) },
        select: { situacao: true },
      });
      if (!conta || conta.situacao !== 'AR') {
        await prisma.disparoMensagem.update({
          where: { id: selecionado.id },
          data: {
            status: 'CANCELADO',
            erroMensagem: `Titulo nao mais AR (situacao=${conta?.situacao || 'NAO_ENCONTRADO'}). Cancelado antes do envio.`,
          },
        });
        console.log(`[ReguaWorker] Disparo ${selecionado.id} cancelado — conta ${selecionado.contaReceberCodigo} situacao=${conta?.situacao}`);
        return true;
      }
    } catch (err) {
      console.warn(`[ReguaWorker] Re-validacao falhou (${selecionado.id}): ${err?.message}. Prosseguindo por padrao conservador.`);
    }
  }

  // Envia via Blip
  try {
    const parametros = selecionado.parametros || {};
    const parametrosOrdenados = Object.keys(parametros)
      .sort((a, b) => Number(a) - Number(b))
      .map(k => parametros[k]);

    await enviarTemplate({
      telefone: selecionado.telefone,
      templateNome: selecionado.templateNomeBlip,
      parametros: parametrosOrdenados,
    });

    await prisma.disparoMensagem.update({
      where: { id: selecionado.id },
      data: {
        status: 'ENVIADO',
        disparadoEm: new Date(),
        erroMensagem: null,
      },
    });

    // Ocorrencia pra timeline
    try {
      await prisma.ocorrencia.create({
        data: {
          tipo: 'WHATSAPP_ENVIADO',
          descricao: `Mensagem automática (${selecionado.templateNomeBlip})`,
          origem: selecionado.origem === 'REGUA_AUTO' ? 'SISTEMA' : 'AGENTE',
          pessoaCodigo: selecionado.pessoaCodigo,
          pessoaNome: selecionado.pessoaNome,
          metadados: {
            disparoId: selecionado.id,
            template: selecionado.templateNomeBlip,
            reguaId: selecionado.reguaId,
            etapaReguaId: selecionado.etapaReguaId,
          },
        },
      });
    } catch { /* noop */ }

    // Wait conforme intervalo da regua (ou 2s se manual)
    let intervaloMs = 2000;
    if (selecionado.reguaId) {
      const r = await prisma.reguaCobranca.findUnique({
        where: { id: selecionado.reguaId },
        select: { intervaloDisparoSeg: true },
      });
      if (r?.intervaloDisparoSeg) intervaloMs = r.intervaloDisparoSeg * 1000;
    }
    await new Promise(r => setTimeout(r, intervaloMs));

  } catch (err) {
    const msg = err?.message || String(err);
    const tentativas = (selecionado.tentativas || 0) + 1;
    const novoStatus = tentativas >= MAX_TENTATIVAS ? 'FALHOU' : 'PENDENTE';
    await prisma.disparoMensagem.update({
      where: { id: selecionado.id },
      data: {
        status: novoStatus,
        tentativas,
        erroMensagem: msg.slice(0, 500),
      },
    }).catch(() => {});
    console.warn(`[ReguaWorker] Falha disparo ${selecionado.id} (tentativa ${tentativas}/${MAX_TENTATIVAS}): ${msg}`);
  }

  return true;
}

/**
 * Loop principal. Chamado 1x no boot.
 */
export function startReguaWorker() {
  console.log('[ReguaWorker] Ativo. Poll interval:', INTERVALO_POLL_MS, 'ms');
  let trabalhando = false;
  setInterval(async () => {
    if (trabalhando) return; // evita reentrada
    trabalhando = true;
    try {
      // Drena enquanto tiver trabalho (ate 20 por tick, pra nao travar)
      for (let i = 0; i < 20; i++) {
        const processou = await drenarUm();
        if (!processou) break;
      }
    } catch (err) {
      console.error('[ReguaWorker] Erro:', err?.message);
    } finally {
      trabalhando = false;
    }
  }, INTERVALO_POLL_MS);
}
