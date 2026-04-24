import { prisma } from '../config/database.js';
import { enviarTemplate } from '../services/blipMensagemService.js';
import { resolverVariaveis } from '../services/reguaExecutorService.js';
import { buildSegmentacaoQuery } from '../services/segmentacaoQueryBuilder.js';

/**
 * Ordenacao por tipo de disparo:
 * - origem REGUA_AUTO: criado pelo scheduler com etapaReguaId preenchido
 * - origem DISPARO_MANUAL: vem deste endpoint, sem etapa associada
 */

// GET /api/disparos/historico?reguaId=&etapaId=&status=&periodo=30d&pessoaCodigo=&page=1&limit=50
export async function historico(req, res, next) {
  try {
    const { reguaId, etapaId, status, pessoaCodigo, page = 1, limit = 50, periodo = '30d' } = req.query;
    const where = {};
    if (reguaId) where.reguaId = reguaId;
    if (etapaId) where.etapaReguaId = etapaId;
    if (status) where.status = status;
    if (pessoaCodigo) where.pessoaCodigo = Number(pessoaCodigo);

    // Periodo: 7d, 30d, 90d
    const dias = Number(String(periodo).replace(/\D/g, '')) || 30;
    where.criadoEm = { gte: new Date(Date.now() - dias * 24 * 60 * 60 * 1000) };

    const [disparos, total] = await Promise.all([
      prisma.disparoMensagem.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.disparoMensagem.count({ where }),
    ]);
    res.json({ data: disparos, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    next(error);
  }
}

// Valida compatibilidade entre escopo do template e tipo da regra.
function validarCompat(template, regra) {
  const escopoTpl = template.escopo || 'AMBOS';
  const tipoRegra = regra?.tipo || 'ALUNO';
  if (escopoTpl === 'TITULO' && tipoRegra !== 'TITULO') {
    return 'Este template usa variáveis de título (valor, vencimento, link). Exige segmentação por TÍTULO.';
  }
  return null;
}

// POST /api/disparos/prever
// Recebe { templateBlipId, segmentacaoId } e retorna total elegivel + amostra.
export async function prever(req, res, next) {
  try {
    const { templateBlipId, segmentacaoId } = req.body;
    if (!templateBlipId) return res.status(400).json({ error: 'templateBlipId obrigatorio' });
    if (!segmentacaoId) return res.status(400).json({ error: 'segmentacaoId obrigatorio' });

    const template = await prisma.templateBlip.findUnique({ where: { id: templateBlipId } });
    if (!template) return res.status(404).json({ error: 'Template nao encontrado' });
    if (!template.ativo) return res.status(400).json({ error: 'Template inativo' });

    const regra = await prisma.regraSegmentacao.findUnique({ where: { id: segmentacaoId } });
    if (!regra) return res.status(404).json({ error: 'Segmentacao nao encontrada' });

    const erroCompat = validarCompat(template, regra);
    if (erroCompat) return res.status(400).json({ error: erroCompat });

    const tipo = regra.tipo || 'ALUNO';
    const sql = buildSegmentacaoQuery(regra.condicoes, { page: 1, limit: 99999 }, tipo);
    const rows = await prisma.$queryRawUnsafe(sql);

    const comTel = rows.filter(r => r.celular && String(r.celular).replace(/\D/g, '').length >= 10);
    const semTel = rows.length - comTel.length;

    const resp = {
      tipo,
      totalEncontrados: rows.length,
      totalComTelefone: comTel.length,
      totalSemTelefone: semTel,
      template: { id: template.id, nomeBlip: template.nomeBlip, titulo: template.titulo, escopo: template.escopo || 'AMBOS' },
      regra: { id: regra.id, nome: regra.nome, tipo },
    };

    if (tipo === 'TITULO') {
      const alunosUnicos = new Set(comTel.map(r => r.codigo)).size;
      const valorTotal = comTel.reduce((s, r) => s + Number(r.titulo_valor || 0), 0);
      resp.alunosUnicos = alunosUnicos;
      resp.valorTotal = valorTotal;
      resp.amostra = comTel.slice(0, 10).map(r => ({
        codigo: r.codigo,
        nome: r.nome,
        tituloValor: Number(r.titulo_valor),
        tituloVencimento: r.titulo_data_vencimento,
        diasAteVenc: Number(r.titulo_dias_ate_venc),
        tituloSituacao: r.titulo_situacao,
      }));
    } else {
      resp.amostra = comTel.slice(0, 10).map(r => ({ codigo: r.codigo, nome: r.nome }));
    }

    res.json(resp);
  } catch (error) {
    next(error);
  }
}

// POST /api/disparos/disparar-agora
// Body: { templateBlipId, segmentacaoId }
// Dispara em background e retorna resumo imediatamente.
// - Regra ALUNO: 1 disparo por aluno. Ctx de titulo fica vazio (templates ALUNO so usam nome).
// - Regra TITULO: 1 disparo por titulo. Ctx inclui dados do titulo exato da segmentacao.
export async function dispararAgora(req, res, next) {
  try {
    const { templateBlipId, segmentacaoId } = req.body;
    if (!templateBlipId) return res.status(400).json({ error: 'templateBlipId obrigatorio' });
    if (!segmentacaoId) return res.status(400).json({ error: 'segmentacaoId obrigatorio' });

    const template = await prisma.templateBlip.findUnique({ where: { id: templateBlipId } });
    if (!template) return res.status(404).json({ error: 'Template nao encontrado' });
    if (!template.ativo) return res.status(400).json({ error: 'Template inativo' });

    const regra = await prisma.regraSegmentacao.findUnique({ where: { id: segmentacaoId } });
    if (!regra) return res.status(404).json({ error: 'Segmentacao nao encontrada' });

    const erroCompat = validarCompat(template, regra);
    if (erroCompat) return res.status(400).json({ error: erroCompat });

    const tipo = regra.tipo || 'ALUNO';
    const hoje = new Date();

    // Paginacao em batches (limita pico de memoria ~250KB/batch vs carregar toda a
    // segmentacao de uma vez)
    const BATCH_SIZE = 500;
    const disparos = [];
    let page = 1;

    while (true) {
      const sql = buildSegmentacaoQuery(regra.condicoes, { page, limit: BATCH_SIZE }, tipo);
      const rows = await prisma.$queryRawUnsafe(sql);
      if (rows.length === 0) break;

      for (const r of rows) {
        const tel = String(r.celular || '').replace(/\D/g, '');
        if (tel.length < 10) continue;

        const pessoa = { codigo: r.codigo, nome: r.nome, cpf: r.cpf };
        const conta = tipo === 'TITULO'
          ? {
              codigo: r.titulo_codigo,
              valor: Number(r.titulo_valor || 0),
              datavencimento: r.titulo_data_vencimento,
              token: r.titulo_token,
              situacao: r.titulo_situacao,
              tipoorigem: r.titulo_tipo_origem,
            }
          : null;

        const ctx = { pessoa, conta, hoje };
        const { parametrosPorIndice } = resolverVariaveis(template.variaveis, ctx);

        disparos.push({
          templateBlipId: template.id,
          templateNomeBlip: template.nomeBlip,
          pessoaCodigo: Number(r.codigo),
          pessoaNome: r.nome,
          contaReceberCodigo: conta?.codigo ? Number(conta.codigo) : null,
          telefone: r.celular,
          parametros: parametrosPorIndice,
          status: 'PENDENTE',
          origem: 'DISPARO_MANUAL',
        });
      }

      if (rows.length < BATCH_SIZE) break;
      page++;
    }

    if (disparos.length === 0) {
      return res.status(400).json({ error: 'Nenhum destinatario elegivel com telefone valido' });
    }

    // createMany sem skipDuplicates: disparo manual pode repetir (etapaReguaId NULL → sem conflito no unique)
    await prisma.disparoMensagem.createMany({ data: disparos });

    // Buscar os registros recem-criados (para conseguir o id e processar)
    const recentes = await prisma.disparoMensagem.findMany({
      where: {
        templateBlipId: template.id,
        origem: 'DISPARO_MANUAL',
        status: 'PENDENTE',
        criadoEm: { gte: new Date(Date.now() - 60 * 1000) },
      },
      orderBy: { criadoEm: 'desc' },
      take: disparos.length,
    });

    res.json({
      totalEnfileirados: recentes.length,
      disparoIds: recentes.map(p => p.id),
      tipo,
      message: `Disparo iniciado: ${recentes.length} mensagens enfileiradas.`,
    });

    // Background (fire-and-forget)
    processarFilaManual(recentes, 2000).catch(err => {
      console.error('[Disparos] Erro no worker manual:', err?.message);
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Worker inline para disparo manual.
 * Processa a lista com wait entre cada envio.
 */
async function processarFilaManual(disparos, intervaloMs) {
  for (const d of disparos) {
    try {
      const atual = await prisma.disparoMensagem.findUnique({ where: { id: d.id } });
      if (!atual || atual.status !== 'PENDENTE') continue;

      const parametros = atual.parametros || {};
      const parametrosOrdenados = Object.keys(parametros)
        .sort((a, b) => Number(a) - Number(b))
        .map(k => parametros[k]);

      // Detecta se ha variavel que representa link (botao URL)
      // Por convencao: se algum valor comeca com http, tratar como botao URL
      let botaoUrlParam = null;
      const linkKey = Object.keys(parametros).find(k => typeof parametros[k] === 'string' && parametros[k].startsWith('http'));
      // Nota: templates atuais usam o link como {{N}} no corpo, nao como botao.
      // Caso no futuro tenha botao, mapear aqui. Por ora nao envia botaoUrlParam.
      void botaoUrlParam; void linkKey;

      await enviarTemplate({
        telefone: atual.telefone,
        templateNome: atual.templateNomeBlip,
        parametros: parametrosOrdenados,
      });

      await prisma.disparoMensagem.update({
        where: { id: atual.id },
        data: {
          status: 'ENVIADO',
          disparadoEm: new Date(),
          erroMensagem: null,
        },
      });

      // Ocorrencia na timeline do aluno
      try {
        await prisma.ocorrencia.create({
          data: {
            tipo: 'WHATSAPP_ENVIADO',
            descricao: `Mensagem automática enviada (${atual.templateNomeBlip})`,
            origem: 'SISTEMA',
            pessoaCodigo: atual.pessoaCodigo,
            pessoaNome: atual.pessoaNome,
            metadados: { disparoId: atual.id, template: atual.templateNomeBlip },
          },
        });
      } catch (e) { void e; }

    } catch (err) {
      const msg = err?.message || String(err);
      console.warn(`[Disparos] Falha disparo ${d.id}: ${msg}`);
      await prisma.disparoMensagem.update({
        where: { id: d.id },
        data: {
          status: 'FALHOU',
          tentativas: { increment: 1 },
          erroMensagem: msg.slice(0, 500),
        },
      }).catch(() => {});
    }

    // Wait entre disparos
    await new Promise(r => setTimeout(r, intervaloMs));
  }
}

// GET /api/disparos/status/:disparoId — polling pra acompanhar
export async function status(req, res, next) {
  try {
    const d = await prisma.disparoMensagem.findUnique({ where: { id: req.params.disparoId } });
    if (!d) return res.status(404).json({ error: 'Disparo nao encontrado' });
    res.json(d);
  } catch (error) {
    next(error);
  }
}

// GET /api/disparos/resumo?ids=id1,id2
// Para o modal fechar: retorna { enviados, falhas, pendentes } de um batch
export async function resumoBatch(req, res, next) {
  try {
    const ids = String(req.query.ids || '').split(',').filter(Boolean);
    if (ids.length === 0) return res.json({ enviados: 0, falhas: 0, pendentes: 0 });
    const rows = await prisma.disparoMensagem.groupBy({
      by: ['status'],
      where: { id: { in: ids } },
      _count: true,
    });
    const contagem = { enviados: 0, falhas: 0, pendentes: 0 };
    for (const r of rows) {
      if (r.status === 'ENVIADO') contagem.enviados = r._count;
      else if (r.status === 'FALHOU') contagem.falhas = r._count;
      else contagem.pendentes += r._count;
    }
    res.json(contagem);
  } catch (error) {
    next(error);
  }
}
