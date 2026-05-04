import { prisma } from '../config/database.js';
import { gerarPdfTermo, gerarPdfBase64 } from '../services/termoNegociacaoService.js';
import { enviarParaAssinatura, cancelarEnvelope } from '../services/clicksignService.js';
import { criarOuBuscarCliente, criarCobranca, obterPixQrCode, cancelarCobranca } from '../services/asaasService.js';
import { enviarLinkPagamento } from '../services/blipMensagemService.js';
import { sincronizarPausaPorEtapa } from '../services/pausaLigacaoService.js';
import { buildBuscaClauses } from '../utils/buscaNomeHelper.js';

// -----------------------------------------------
// GET /api/acordos — Listar acordos
// -----------------------------------------------
export async function listar(req, res, next) {
  try {
    const { etapa, criadoPor, search, page = 1, limit = 50 } = req.query;
    const termo = String(search || '').trim();
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 50;
    const offset = (pageNum - 1) * limitNum;

    // Antes: 5 round-trips Prisma (acordo + pagamentos + parcelas + documento + count)
    // levavam 500ms-3.5s no Cloud SQL. Agora: 1 round-trip com json_agg/row_to_json
    // — em ~500ms cold, ~450ms warm para a base atual.
    // Os 2 fluxos (com/sem busca) compartilham a mesma SQL; so muda WHERE + ORDER BY.

    const whereClauses = [];
    const params = [];
    let idx = 1;
    let orderClause = '"criadoEm" DESC';

    if (termo) {
      const busca = buildBuscaClauses({
        colunaNome: '"pessoaNome"',
        termo,
        extras: { colunaCpf: '"pessoaCpf"' },
        paramStartIndex: idx,
      });
      if (busca.filterClause) {
        whereClauses.push(busca.filterClause);
        params.push(...busca.params);
        idx = busca.nextIndex;
        orderClause = busca.orderClause;
      }
    }
    if (etapa) { whereClauses.push(`etapa = $${idx++}`); params.push(etapa); }
    if (criadoPor) { whereClauses.push(`"criadoPor" = $${idx++}`); params.push(Number(criadoPor)); }

    params.push(limitNum, offset);
    const limitIdx = idx++;
    const offsetIdx = idx++;

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Documento: excluimos pdfAssinado (Bytes pesados, nao usados no kanban) via json_build_object.
    // pagamentos/parcelas: json_agg traz tudo dos respectivos models.
    const sql = `
      SELECT
        a.*,
        COALESCE((
          SELECT json_agg(p ORDER BY p."numeroPagamento" ASC)
          FROM cobranca.pagamento_acordo p
          WHERE p."acordoId" = a.id
        ), '[]'::json) AS pagamentos,
        COALESCE((
          SELECT json_agg(po ORDER BY po."dataVencimento" ASC)
          FROM cobranca.parcela_original_acordo po
          WHERE po."acordoId" = a.id
        ), '[]'::json) AS "parcelasOriginais",
        (SELECT json_build_object(
            'id', d.id,
            'acordoId', d."acordoId",
            'tipo', d.tipo,
            'clicksignDocumentKey', d."clicksignDocumentKey",
            'clicksignEnvelopeId', d."clicksignEnvelopeId",
            'situacao', d.situacao,
            'urlOriginal', d."urlOriginal",
            'urlAssinado', d."urlAssinado",
            'signatarios', d.signatarios,
            'enviadoEm', d."enviadoEm",
            'assinadoEm', d."assinadoEm"
          )
          FROM cobranca.documento d
          WHERE d."acordoId" = a.id
          LIMIT 1) AS documento,
        COUNT(*) OVER()::int AS _total
      FROM cobranca.acordo_financeiro a
      ${where}
      ORDER BY ${orderClause}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const rows = await prisma.$queryRawUnsafe(sql, ...params);
    const total = rows.length > 0 ? rows[0]._total : 0;

    // Normaliza paridade com o output do Prisma (Date objects nos campos de data dentro dos
    // arrays). PostgreSQL retorna timestamp sem TZ via json_agg como string "YYYY-MM-DDTHH:MM:SS";
    // convertemos para Date para que JSON.stringify produza ISO 'Z' UTC, igual ao caminho Prisma.
    const acordos = rows.map(r => {
      const { _total, ...acordo } = r;
      if (Array.isArray(acordo.pagamentos)) {
        for (const p of acordo.pagamentos) {
          if (typeof p.dataVencimento === 'string') p.dataVencimento = parseTimestampUtc(p.dataVencimento);
          if (typeof p.dataPagamento === 'string') p.dataPagamento = parseTimestampUtc(p.dataPagamento);
        }
      }
      if (Array.isArray(acordo.parcelasOriginais)) {
        for (const po of acordo.parcelasOriginais) {
          if (typeof po.dataVencimento === 'string') po.dataVencimento = parseTimestampUtc(po.dataVencimento);
        }
      }
      if (acordo.documento) {
        if (typeof acordo.documento.enviadoEm === 'string') acordo.documento.enviadoEm = parseTimestampUtc(acordo.documento.enviadoEm);
        if (typeof acordo.documento.assinadoEm === 'string') acordo.documento.assinadoEm = parseTimestampUtc(acordo.documento.assinadoEm);
      }
      return acordo;
    });

    res.json({ acordos, total });
  } catch (error) {
    next(error);
  }
}

// Helper: converte string sem timezone ('2026-04-30T00:00:00') para Date UTC
// (mesmo formato que Prisma entrega ao serializar timestamp sem TZ).
function parseTimestampUtc(s) {
  if (!s) return null;
  return new Date(s.endsWith('Z') ? s : s + 'Z');
}

// -----------------------------------------------
// GET /api/acordos/:id — Obter acordo
// -----------------------------------------------
export async function obter(req, res, next) {
  try {
    const acordo = await prisma.acordoFinanceiro.findUnique({
      where: { id: req.params.id },
      include: {
        pagamentos: { orderBy: { numeroPagamento: 'asc' } },
        parcelasOriginais: { orderBy: { dataVencimento: 'asc' } },
        documento: true,
      },
    });

    if (!acordo) return res.status(404).json({ error: 'Acordo nao encontrado' });
    res.json(acordo);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// POST /api/acordos — Criar acordo
// -----------------------------------------------
export async function criar(req, res, next) {
  try {
    const {
      pessoaCodigo, pessoaNome, pessoaCpf, matricula, turmaIdentificador, cursoNome,
      celularAluno, emailAluno,
      valorOriginal, valorMultaJuros, valorDescontos, valorRecebidoPrevio,
      valorSaldoDevedor, descontoAcordo, descontoAcordoPercentual, valorAcordo,
      vincularRecorrencia,
      observacao,
      parcelasOriginais, // [{ contaReceberCodigo, parcela, valor, multa, juro, descontos, valorRecebido, saldoDevedor, dataVencimento, tipoOrigem }]
      pagamentos, // [{ numeroPagamento, valor, formaPagamento, parcelas, dataVencimento }]
    } = req.body;

    // Buscar nome do agente
    const usuario = await prisma.user.findUnique({ where: { id: req.user.id }, select: { nome: true } });
    const nomeAgente = usuario?.nome || req.user.email || 'Agente';

    const acordo = await prisma.acordoFinanceiro.create({
      data: {
        pessoaCodigo,
        pessoaNome,
        pessoaCpf,
        matricula,
        turmaIdentificador,
        cursoNome,
        celularAluno,
        emailAluno,
        valorOriginal,
        valorMultaJuros,
        valorDescontos: valorDescontos || 0,
        valorRecebidoPrevio: valorRecebidoPrevio || 0,
        valorSaldoDevedor,
        descontoAcordo: descontoAcordo || 0,
        descontoAcordoPercentual,
        valorAcordo,
        vincularRecorrencia: vincularRecorrencia || false,
        criadoPor: req.user.id,
        criadoPorNome: nomeAgente,
        observacao,
        parcelasOriginais: {
          create: parcelasOriginais.map(p => ({
            contaReceberCodigo: p.contaReceberCodigo,
            parcela: p.parcela,
            valor: p.valor,
            multa: p.multa || 0,
            juro: p.juro || 0,
            descontos: p.descontos || 0,
            valorRecebido: p.valorRecebido || 0,
            saldoDevedor: p.saldoDevedor,
            dataVencimento: new Date(p.dataVencimento),
            tipoOrigem: p.tipoOrigem,
          })),
        },
        pagamentos: {
          create: pagamentos.map((pg, idx) => ({
            numeroPagamento: pg.numeroPagamento || idx + 1,
            valor: pg.valor,
            formaPagamento: pg.formaPagamento,
            parcelas: pg.parcelas || 1,
            dataVencimento: new Date(pg.dataVencimento),
          })),
        },
      },
      include: {
        parcelasOriginais: true,
        pagamentos: true,
      },
    });

    // Registrar ocorrencia
    try {
      const valor = Number(acordo.valorAcordo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      await prisma.ocorrencia.create({
        data: {
          tipo: 'NEGOCIACAO_CRIADA',
          descricao: `Negociação criada — ${valor}`,
          origem: 'AGENTE',
          pessoaCodigo: acordo.pessoaCodigo,
          pessoaNome: acordo.pessoaNome,
          agenteNome: nomeAgente,
          acordoId: acordo.id,
        },
      });
    } catch {}

    res.status(201).json(acordo);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// PATCH /api/acordos/:id/etapa — Atualizar etapa
// -----------------------------------------------
export async function atualizarEtapa(req, res, next) {
  try {
    const { etapa } = req.body;
    const timestamps = {};

    if (etapa === 'TERMO_ENVIADO') timestamps.termoEnviadoEm = new Date();
    if (etapa === 'ACORDO_GERADO') timestamps.acordoGeradoEm = new Date();
    if (etapa === 'SEI_VINCULADO') timestamps.seiVinculadoEm = new Date();
    if (etapa === 'CANCELADO') timestamps.canceladoEm = new Date();

    const acordo = await prisma.acordoFinanceiro.update({
      where: { id: req.params.id },
      data: { etapa, ...timestamps },
      include: { pagamentos: true, parcelasOriginais: true, documento: true },
    });

    await sincronizarPausaPorEtapa({
      acordoId: acordo.id,
      etapa: acordo.etapa,
      pessoaCodigo: acordo.pessoaCodigo,
      pessoaNome: acordo.pessoaNome,
    });

    res.json(acordo);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// PATCH /api/acordos/:id/vincular-sei — Informar codigo SEI
//
// Suporta vinculacao retroativa: se o aluno pagou a cobranca antes do
// agente conseguir criar a negociacao no SEI, o acordo vai direto para
// CONCLUIDO (via webhook Asaas). Nesse caso, permitimos gravar o codigo
// SEI sem voltar pra SEI_VINCULADO — mantem a etapa atual.
// -----------------------------------------------
export async function vincularSei(req, res, next) {
  try {
    const { codigoNegociacao } = req.body;

    const existente = await prisma.acordoFinanceiro.findUnique({
      where: { id: req.params.id },
      select: { etapa: true },
    });
    if (!existente) return res.status(404).json({ error: 'Acordo nao encontrado' });

    // Se ja foi concluido, preserva a etapa. Caso contrario, move para SEI_VINCULADO.
    const manterEtapa = existente.etapa === 'CONCLUIDO';
    const novaEtapa = manterEtapa ? existente.etapa : 'SEI_VINCULADO';

    const acordo = await prisma.acordoFinanceiro.update({
      where: { id: req.params.id },
      data: {
        negociacaoContaReceberCodigo: Number(codigoNegociacao),
        etapa: novaEtapa,
        seiVinculadoEm: new Date(),
      },
    });

    await sincronizarPausaPorEtapa({
      acordoId: acordo.id,
      etapa: acordo.etapa,
      pessoaCodigo: acordo.pessoaCodigo,
      pessoaNome: acordo.pessoaNome,
    });

    res.json(acordo);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// GET /api/acordos/:id/preview-cancelamento
// Retorna o que vai acontecer se cancelar o acordo, sem mexer no banco.
// O frontend usa pra construir os avisos do modal de confirmacao.
// -----------------------------------------------
export async function previewCancelamento(req, res, next) {
  try {
    const acordo = await prisma.acordoFinanceiro.findUnique({
      where: { id: req.params.id },
      include: { pagamentos: true, documento: true },
    });
    if (!acordo) return res.status(404).json({ error: 'Acordo nao encontrado' });

    const podeCancelar = acordo.etapa !== 'CONCLUIDO' && acordo.etapa !== 'CANCELADO';
    const motivo = !podeCancelar
      ? (acordo.etapa === 'CONCLUIDO'
        ? 'Acordo ja concluido (todos pagamentos confirmados). Nao pode ser cancelado.'
        : 'Acordo ja esta cancelado.')
      : null;

    const pagamentosACancelar = acordo.pagamentos
      .filter(p => p.situacao !== 'CONFIRMADO' && p.situacao !== 'CANCELADO')
      .map(p => ({
        id: p.id,
        numero: p.numeroPagamento,
        valor: Number(p.valor),
        situacao: p.situacao,
        vencimento: p.dataVencimento,
        asaasPaymentId: p.asaasPaymentId,
      }));

    const pagamentosConfirmados = acordo.pagamentos
      .filter(p => p.situacao === 'CONFIRMADO')
      .map(p => ({
        numero: p.numeroPagamento,
        valor: Number(p.valorPago || p.valor),
        pagoEm: p.dataPagamento,
      }));

    const termo = {
      envelopeId: acordo.clicksignEnvelopeId || null,
      assinado: !!acordo.termoAssinadoEm,
      // So tenta cancelar na ClickSign se ha envelope e nao foi assinado.
      seraCanceladoNaClicksign: !!acordo.clicksignEnvelopeId && !acordo.termoAssinadoEm,
    };

    res.json({
      podeCancelar,
      motivo,
      etapa: acordo.etapa,
      pagamentosACancelar,
      pagamentosConfirmados,
      termo,
    });
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// DELETE /api/acordos/:id — Cancelar acordo (com cascade Asaas/ClickSign)
// -----------------------------------------------
export async function cancelar(req, res, next) {
  try {
    // Aceita motivo no body (preferido) OU query string (compat com frontend antigo).
    const motivo = String(req.body?.motivo || req.query?.motivo || '').trim();
    if (motivo.length < 10) {
      return res.status(400).json({ error: 'Justificativa obrigatoria (minimo 10 caracteres)' });
    }

    const acordo = await prisma.acordoFinanceiro.findUnique({
      where: { id: req.params.id },
      include: { pagamentos: true },
    });
    if (!acordo) return res.status(404).json({ error: 'Acordo nao encontrado' });

    if (acordo.etapa === 'CONCLUIDO') {
      return res.status(409).json({
        error: 'Acordo concluido (todos pagamentos confirmados) nao pode ser cancelado. Use estorno no painel do Asaas se necessario.',
      });
    }
    if (acordo.etapa === 'CANCELADO') {
      return res.status(409).json({ error: 'Acordo ja esta cancelado' });
    }

    // 1. Cancelar cobrancas Asaas que ainda nao foram pagas — best effort.
    //    Falhas na API do Asaas NAO bloqueiam o cancelamento do acordo;
    //    sao agregadas em `erros` e registradas na ocorrencia.
    const pagamentosCancelados = [];
    const erros = [];
    for (const pag of acordo.pagamentos) {
      if (pag.situacao === 'CONFIRMADO' || pag.situacao === 'CANCELADO') continue;

      if (pag.asaasPaymentId) {
        try {
          await cancelarCobranca(pag.asaasPaymentId);
        } catch (err) {
          const msg = err?.message || String(err);
          // Asaas 404 = cobranca ja nao existe la (ja deletada). Ignora.
          if (!/HTTP 404/.test(msg) && !/does not exist/i.test(msg)) {
            erros.push({ pagamento: pag.numeroPagamento, asaas: msg.slice(0, 200) });
            console.warn(`[Cancelar] Falha Asaas pagamento ${pag.asaasPaymentId}: ${msg}`);
          }
        }
      }

      await prisma.pagamentoAcordo.update({
        where: { id: pag.id },
        data: { situacao: 'CANCELADO' },
      });
      pagamentosCancelados.push(pag.numeroPagamento);
    }

    // 2. Cancelar envelope ClickSign se ainda nao foi assinado.
    //    Se ja foi assinado, preserva (documento legal vale como historico).
    let clicksignCancelado = false;
    if (acordo.clicksignEnvelopeId && !acordo.termoAssinadoEm) {
      try {
        await cancelarEnvelope(acordo.clicksignEnvelopeId);
        clicksignCancelado = true;
      } catch (err) {
        const msg = err?.message || String(err);
        erros.push({ clicksign: msg.slice(0, 200) });
        console.warn(`[Cancelar] Falha ClickSign envelope ${acordo.clicksignEnvelopeId}: ${msg}`);
      }
    }

    // 3. Atualizar acordo
    const atualizado = await prisma.acordoFinanceiro.update({
      where: { id: req.params.id },
      data: {
        etapa: 'CANCELADO',
        motivoCancelamento: motivo,
        canceladoEm: new Date(),
      },
    });

    // 4. Atualizar Documento associado, se existir
    await prisma.documento.updateMany({
      where: { acordoId: req.params.id },
      data: { situacao: 'CANCELADO' },
    });

    // 5. Sincronizar pausa de ligacao (CANCELADO libera o aluno pra contato)
    await sincronizarPausaPorEtapa({
      acordoId: atualizado.id,
      etapa: atualizado.etapa,
      pessoaCodigo: atualizado.pessoaCodigo,
      pessoaNome: atualizado.pessoaNome,
    });

    // 6. Registrar ocorrencia com a justificativa e relatorio do cascade.
    try {
      await prisma.ocorrencia.create({
        data: {
          tipo: 'NEGOCIACAO_CANCELADA',
          descricao: `Negociacao cancelada — ${motivo}`,
          origem: 'AGENTE',
          pessoaCodigo: atualizado.pessoaCodigo,
          pessoaNome: atualizado.pessoaNome,
          agenteNome: req.user?.nome || req.user?.email || null,
          acordoId: atualizado.id,
          metadados: {
            motivoCancelamento: motivo,
            pagamentosCancelados,
            clicksignCancelado,
            erros,
          },
        },
      });
    } catch (e) {
      console.warn('[Cancelar] Falha ao registrar ocorrencia:', e?.message);
    }

    res.json({
      ...atualizado,
      _cancelamento: {
        pagamentosCancelados: pagamentosCancelados.length,
        clicksignCancelado,
        erros,
      },
    });
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// POST /api/acordos/:id/gerar-pdf — Gerar PDF do termo (download)
// -----------------------------------------------
export async function gerarPdf(req, res, next) {
  try {
    const acordo = await prisma.acordoFinanceiro.findUnique({
      where: { id: req.params.id },
      include: { parcelasOriginais: true, pagamentos: true },
    });

    if (!acordo) return res.status(404).json({ error: 'Acordo nao encontrado' });

    // Atualizar dados do signatario se enviados no body
    const { nome, email, celular, cpf } = req.body || {};
    if (nome || email || celular || cpf) {
      await prisma.acordoFinanceiro.update({
        where: { id: acordo.id },
        data: {
          ...(nome && { pessoaNome: nome }),
          ...(email && { emailAluno: email }),
          ...(celular && { celularAluno: celular }),
          ...(cpf && { pessoaCpf: cpf }),
        },
      });
      // Usar dados atualizados no PDF
      if (nome) acordo.pessoaNome = nome;
      if (email) acordo.emailAluno = email;
      if (celular) acordo.celularAluno = celular;
      if (cpf) acordo.pessoaCpf = cpf;
    }

    const pdfBuffer = await gerarPdfTermo(acordo);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="termo_${acordo.pessoaNome.replace(/\s+/g, '_')}.pdf"`);
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// POST /api/acordos/:id/enviar-assinatura — Enviar para ClickSign
// -----------------------------------------------
export async function enviarAssinatura(req, res, next) {
  try {
    const acordo = await prisma.acordoFinanceiro.findUnique({
      where: { id: req.params.id },
      include: { parcelasOriginais: true, pagamentos: true },
    });

    if (!acordo) return res.status(404).json({ error: 'Acordo nao encontrado' });
    if (!acordo.celularAluno || !acordo.emailAluno) {
      return res.status(400).json({ error: 'Aluno precisa ter celular e e-mail cadastrados. Gere o documento primeiro preenchendo os dados.' });
    }

    // 1. Gerar PDF
    const pdfBase64 = await gerarPdfBase64(acordo);
    const filename = `termo_${acordo.pessoaNome.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}.pdf`;

    // 2. Enviar para ClickSign
    const { envelopeId, documentId, signerId } = await enviarParaAssinatura({
      titulo: `Termo de Negociacao - ${acordo.pessoaNome}`,
      pdfBase64,
      filename,
      signatario: {
        nome: acordo.pessoaNome,
        email: acordo.emailAluno,
        celular: acordo.celularAluno,
      },
    });

    // 3. Atualizar acordo com IDs ClickSign
    const acordoAtualizado = await prisma.acordoFinanceiro.update({
      where: { id: acordo.id },
      data: {
        etapa: 'TERMO_ENVIADO',
        termoEnviadoEm: new Date(),
        clicksignEnvelopeId: envelopeId,
        clicksignDocumentId: documentId,
        clicksignSignerId: signerId,
      },
      include: { parcelasOriginais: true, pagamentos: true, documento: true },
    });

    await sincronizarPausaPorEtapa({
      acordoId: acordoAtualizado.id,
      etapa: acordoAtualizado.etapa,
      pessoaCodigo: acordoAtualizado.pessoaCodigo,
      pessoaNome: acordoAtualizado.pessoaNome,
    });

    // 4. Criar ou atualizar registro do documento (idempotente:
    //    acordoId e @unique, entao reenvio atualiza os ids do ClickSign
    //    em vez de falhar com P2002)
    await prisma.documento.upsert({
      where: { acordoId: acordo.id },
      create: {
        acordoId: acordo.id,
        tipo: 'TERMO_ACORDO',
        clicksignDocumentKey: documentId,
        clicksignEnvelopeId: envelopeId,
        situacao: 'ENVIADO',
        enviadoEm: new Date(),
      },
      update: {
        clicksignDocumentKey: documentId,
        clicksignEnvelopeId: envelopeId,
        situacao: 'ENVIADO',
        enviadoEm: new Date(),
        // Limpa campos de assinatura antiga ao reenviar
        assinadoEm: null,
        pdfAssinado: null,
        urlAssinado: null,
      },
    });

    // Registrar ocorrencia
    try {
      await prisma.ocorrencia.create({
        data: {
          tipo: 'NEGOCIACAO_TERMO_ENVIADO',
          descricao: 'Termo de negociação enviado para assinatura via ClickSign',
          origem: 'SISTEMA',
          pessoaCodigo: acordo.pessoaCodigo,
          pessoaNome: acordo.pessoaNome,
          acordoId: acordo.id,
        },
      });
    } catch {}

    res.json(acordoAtualizado);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// POST /api/acordos/:id/enviar-lembrete — Reenviar notificacao ClickSign
// -----------------------------------------------
export async function enviarLembrete(req, res, next) {
  try {
    const acordo = await prisma.acordoFinanceiro.findUnique({
      where: { id: req.params.id },
    });

    if (!acordo?.clicksignEnvelopeId) {
      return res.status(400).json({ error: 'Acordo nao tem envelope ClickSign' });
    }

    // Importar dinamicamente para enviar notificacao
    const { default: fetch } = await import('node-fetch');
    const CLICKSIGN_API_URL = process.env.CLICKSIGN_API_URL || 'https://app.clicksign.com';
    const CLICKSIGN_API_KEY = process.env.CLICKSIGN_API_KEY;

    await fetch(`${CLICKSIGN_API_URL}/api/v3/envelopes/${acordo.clicksignEnvelopeId}/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
        'Authorization': CLICKSIGN_API_KEY,
      },
      body: JSON.stringify({ data: { type: 'notifications', attributes: {} } }),
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// GET /api/acordos/:id/documento-assinado — Baixar PDF assinado
// -----------------------------------------------
export async function documentoAssinado(req, res, next) {
  try {
    const doc = await prisma.documento.findFirst({
      where: { acordoId: req.params.id, situacao: 'ASSINADO' },
      select: { pdfAssinado: true, urlAssinado: true },
    });

    if (!doc) {
      return res.status(404).json({ error: 'Documento assinado nao encontrado' });
    }

    // Se temos o PDF salvo no banco, servir direto
    if (doc.pdfAssinado) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="termo_assinado.pdf"');
      return res.send(Buffer.from(doc.pdfAssinado));
    }

    // Fallback: URL (pode estar expirada)
    if (doc.urlAssinado) {
      return res.json({ url: doc.urlAssinado });
    }

    res.status(404).json({ error: 'PDF assinado nao disponivel' });
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// GET /api/acordos/por-aluno/:codigo — Acordos de um aluno
// -----------------------------------------------
export async function listarPorAluno(req, res, next) {
  try {
    const codigo = Number(req.params.codigo);

    const acordos = await prisma.acordoFinanceiro.findMany({
      where: { pessoaCodigo: codigo },
      include: {
        pagamentos: { orderBy: { numeroPagamento: 'asc' } },
        parcelasOriginais: { orderBy: { dataVencimento: 'asc' } },
        documento: true,
      },
      orderBy: { criadoEm: 'desc' },
    });

    res.json(acordos);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// POST /api/acordos/:id/gerar-cobrancas — Criar cobrancas no Asaas
// -----------------------------------------------
export async function gerarCobrancas(req, res, next) {
  try {
    const acordo = await prisma.acordoFinanceiro.findUnique({
      where: { id: req.params.id },
      include: { pagamentos: true },
    });

    if (!acordo) return res.status(404).json({ error: 'Acordo nao encontrado' });

    // 1. Criar/buscar cliente no Asaas
    const cliente = await criarOuBuscarCliente({
      cpf: acordo.pessoaCpf,
      nome: acordo.pessoaNome,
      email: acordo.emailAluno,
      celular: acordo.celularAluno,
    });

    // Salvar customerId no acordo
    await prisma.acordoFinanceiro.update({
      where: { id: acordo.id },
      data: { asaasCustomerId: cliente.id },
    });

    // 2. Criar cobranca para cada pagamento — resiliente:
    //    - Ignora pagamentos ja confirmados (asaasPaymentId preenchido com situacao diferente
    //      de ERRO/CANCELADA) para nao duplicar
    //    - Permite retry de pagamentos com situacao ERRO ou CANCELADA
    //    - Erros individuais do Asaas nao abortam o loop — cada pagamento falho
    //      fica marcado com situacao=ERRO + erroMensagem, os outros seguem
    let sucessos = 0;
    let falhas = 0;

    for (const pgto of acordo.pagamentos) {
      const situacao = pgto.situacao || 'PENDENTE';
      const podeCriar = !pgto.asaasPaymentId || situacao === 'ERRO' || situacao === 'CANCELADO';
      if (!podeCriar) continue;

      const vencimento = new Date(pgto.dataVencimento).toISOString().slice(0, 10);
      const descricao = `Negociacao ${acordo.pessoaNome} - Pgto ${pgto.numeroPagamento}`;

      try {
        const cobranca = await criarCobranca(cliente.id, {
          valor: Number(pgto.valor),
          vencimento,
          tipo: pgto.formaPagamento,
          descricao,
          externalReference: acordo.id,
          parcelas: pgto.parcelas,
        });

        // Buscar PIX QR Code se for PIX
        let pixQr = null;
        if (pgto.formaPagamento === 'PIX' && cobranca.id) {
          const pixData = await obterPixQrCode(cobranca.id);
          pixQr = pixData?.payload || null;
        }

        // Atualizar pagamento com dados do Asaas (limpa erroMensagem em retry bem-sucedido)
        await prisma.pagamentoAcordo.update({
          where: { id: pgto.id },
          data: {
            asaasPaymentId: cobranca.id,
            asaasInvoiceUrl: cobranca.invoiceUrl,
            asaasPixQrCode: pixQr,
            asaasBankSlipUrl: cobranca.bankSlipUrl || null,
            situacao: 'PENDENTE',
            erroMensagem: null,
          },
        });
        sucessos++;
      } catch (err) {
        const mensagem = err?.message || String(err);
        // Extrai descricao legivel do JSON de erro do Asaas quando possivel
        let mensagemLimpa = mensagem;
        const jsonMatch = mensagem.match(/\{.*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed?.errors?.[0]?.description) mensagemLimpa = parsed.errors[0].description;
          } catch {}
        }
        console.warn(`[Acordo] Falha ao criar cobranca pgto=${pgto.numeroPagamento}: ${mensagemLimpa}`);
        await prisma.pagamentoAcordo.update({
          where: { id: pgto.id },
          data: {
            situacao: 'ERRO',
            erroMensagem: mensagemLimpa.slice(0, 500),
          },
        });
        falhas++;
      }
    }

    // Registrar ocorrencia (sempre, com descricao refletindo o resultado)
    try {
      await prisma.ocorrencia.create({
        data: {
          tipo: 'NEGOCIACAO_COBRANCA_CRIADA',
          descricao: `Geracao de cobrancas no Asaas — ${sucessos} OK, ${falhas} com erro`,
          origem: 'SISTEMA',
          pessoaCodigo: acordo.pessoaCodigo,
          pessoaNome: acordo.pessoaNome,
          acordoId: acordo.id,
        },
      });
    } catch (e) {
      console.warn('[Acordo] Falha ao registrar ocorrencia:', e?.message);
    }

    // 3. Recarregar acordo atualizado
    const acordoAtualizado = await prisma.acordoFinanceiro.findUnique({
      where: { id: acordo.id },
      include: { pagamentos: true, parcelasOriginais: true, documento: true },
    });

    res.json(acordoAtualizado);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// POST /api/acordos/:id/pagamentos/:pagamentoId/enviar-whatsapp — Enviar link via WhatsApp
// -----------------------------------------------
export async function enviarWhatsapp(req, res, next) {
  try {
    const acordo = await prisma.acordoFinanceiro.findUnique({
      where: { id: req.params.id },
    });

    if (!acordo) return res.status(404).json({ error: 'Acordo nao encontrado' });
    if (!acordo.celularAluno) return res.status(400).json({ error: 'Aluno nao tem celular cadastrado' });

    const pagamento = await prisma.pagamentoAcordo.findUnique({
      where: { id: req.params.pagamentoId },
    });

    if (!pagamento) return res.status(404).json({ error: 'Pagamento nao encontrado' });
    if (!pagamento.asaasPaymentId) return res.status(400).json({ error: 'Cobranca ainda nao foi gerada no Asaas' });

    // Extrair ID da invoice URL (parte apos /i/)
    const paymentIdAsaas = pagamento.asaasInvoiceUrl
      ? pagamento.asaasInvoiceUrl.split('/i/')[1]
      : pagamento.asaasPaymentId;

    await enviarLinkPagamento({
      telefone: acordo.celularAluno,
      nomeAluno: acordo.pessoaNome,
      formaPagamento: pagamento.formaPagamento,
      dataVencimento: pagamento.dataVencimento,
      valor: Number(pagamento.valor),
      paymentIdAsaas,
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

// Cancela uma cobranca individual no Asaas + marca no banco.
// Depois do cancelamento, a UI mostra o botao "Gerar novamente" que
// chama gerarCobrancas — que ja aceita retry para situacao CANCELADA/ERRO.
export async function cancelarPagamento(req, res, next) {
  try {
    const { id: acordoId, pagamentoId } = req.params;

    const pagamento = await prisma.pagamentoAcordo.findUnique({
      where: { id: pagamentoId },
    });
    if (!pagamento || pagamento.acordoId !== acordoId) {
      return res.status(404).json({ error: 'Pagamento nao encontrado para este acordo' });
    }

    if (pagamento.situacao === 'CANCELADO') {
      return res.status(409).json({ error: 'Pagamento ja esta cancelado' });
    }
    if (pagamento.situacao === 'CONFIRMADO') {
      return res.status(409).json({ error: 'Nao e possivel cancelar um pagamento ja confirmado. Use reembolso no painel do Asaas.' });
    }

    // Cancelamento no Asaas (ignora erro se a cobranca nao existe mais la —
    // e.g. foi criada com erro ou ja deletada; o nosso banco tem a verdade local)
    if (pagamento.asaasPaymentId) {
      try {
        await cancelarCobranca(pagamento.asaasPaymentId);
      } catch (err) {
        const msg = err?.message || String(err);
        console.warn(`[Acordo] Falha ao cancelar pagamento ${pagamento.asaasPaymentId} no Asaas: ${msg}`);
        // Se Asaas retornar 404 a gente ignora (cobranca nao existe la), qualquer
        // outro erro retornamos pro cliente pra nao mascarar
        if (!/HTTP 404/.test(msg) && !/does not exist/i.test(msg)) {
          return res.status(502).json({ error: `Falha ao cancelar no Asaas: ${msg.slice(0, 200)}` });
        }
      }
    }

    const atualizado = await prisma.pagamentoAcordo.update({
      where: { id: pagamentoId },
      data: {
        situacao: 'CANCELADO',
        erroMensagem: null,
      },
    });

    try {
      const acordo = await prisma.acordoFinanceiro.findUnique({ where: { id: acordoId }, select: { pessoaCodigo: true, pessoaNome: true } });
      await prisma.ocorrencia.create({
        data: {
          tipo: 'NEGOCIACAO_COBRANCA_CANCELADA',
          descricao: `Cobranca cancelada (pgto ${pagamento.numeroPagamento})`,
          origem: 'AGENTE',
          pessoaCodigo: acordo?.pessoaCodigo || 0,
          pessoaNome: acordo?.pessoaNome || null,
          acordoId,
          agenteNome: req.user?.nome || null,
        },
      });
    } catch (e) {
      console.warn('[Acordo] Falha ao registrar ocorrencia cancelamento:', e?.message);
    }

    res.json(atualizado);
  } catch (error) {
    next(error);
  }
}
