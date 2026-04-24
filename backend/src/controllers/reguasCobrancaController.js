import { prisma } from '../config/database.js';
import { buildSegmentacaoQuery, buildSegmentacaoCountQuery } from '../services/segmentacaoQueryBuilder.js';
import { resolverVariaveis } from '../services/reguaExecutorService.js';
import { executarReguaAgora as executarReguaAgoraService } from '../services/reguaSchedulerService.js';

const FONTES_TITULO = new Set([
  'VALOR_PARCELA', 'DATA_VENCIMENTO',
  'DIAS_ATE_VENCIMENTO', 'DIAS_ATE_VENCIMENTO_FRIENDLY',
  'DIAS_APOS_VENCIMENTO', 'DIAS_APOS_VENCIMENTO_FRIENDLY',
  'LINK_PAGAMENTO_SEI',
]);

// ===== Regua CRUD =====

// GET /api/reguas-cobranca
export async function listar(req, res, next) {
  try {
    const reguas = await prisma.reguaCobranca.findMany({
      orderBy: { criadoEm: 'desc' },
      include: { etapas: { select: { id: true, ativo: true } } },
    });
    // Metricas 30d agregadas por regua
    const ids = reguas.map(r => r.id);
    const metricas = ids.length > 0
      ? await prisma.$queryRawUnsafe(`
          SELECT "reguaId",
            COUNT(*)::int AS total_30d,
            COUNT(*) FILTER (WHERE status = 'ENVIADO')::int AS enviados_30d,
            COUNT(*) FILTER (WHERE status = 'FALHOU')::int AS falhas_30d,
            COUNT(*) FILTER (WHERE convertido = true)::int AS convertidos_30d
          FROM cobranca.disparo_mensagem
          WHERE "reguaId" IN (${ids.map(i => `'${i}'`).join(',')})
            AND "criadoEm" >= NOW() - INTERVAL '30 days'
          GROUP BY "reguaId"
        `)
      : [];
    const byId = new Map(metricas.map(m => [m.reguaId, m]));
    const data = reguas.map(r => ({
      ...r,
      totalEtapas: r.etapas.length,
      etapasAtivas: r.etapas.filter(e => e.ativo).length,
      metricas30d: byId.get(r.id) || { total_30d: 0, enviados_30d: 0, falhas_30d: 0, convertidos_30d: 0 },
    }));
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

// GET /api/reguas-cobranca/:id
export async function obter(req, res, next) {
  try {
    const regua = await prisma.reguaCobranca.findUnique({
      where: { id: req.params.id },
      include: {
        etapas: {
          orderBy: { diasRelativoVenc: 'asc' },
          include: {
            template: { select: { id: true, nomeBlip: true, titulo: true, escopo: true, categoria: true, variaveis: true, conteudoPreview: true } },
          },
        },
        segmentacoesEmbutidas: { select: { id: true, nome: true, tipo: true, condicoes: true } },
      },
    });
    if (!regua) return res.status(404).json({ error: 'Regua nao encontrada' });

    // Anexa dados da segmentacao em cada etapa
    const segIds = regua.etapas.map(e => e.segmentacaoId).filter(Boolean);
    const segs = segIds.length > 0
      ? await prisma.regraSegmentacao.findMany({
          where: { id: { in: segIds } },
          select: { id: true, nome: true, tipo: true, escopoUso: true, condicoes: true, reguaOwnerId: true },
        })
      : [];
    const segsById = new Map(segs.map(s => [s.id, s]));
    const etapas = regua.etapas.map(e => ({
      ...e,
      segmentacao: e.segmentacaoId ? segsById.get(e.segmentacaoId) : null,
    }));

    res.json({ data: { ...regua, etapas } });
  } catch (error) {
    next(error);
  }
}

// POST /api/reguas-cobranca
export async function criar(req, res, next) {
  try {
    const { nome, descricao, horarioPadrao, intervaloDisparoSeg } = req.body;
    if (!nome?.trim()) return res.status(400).json({ error: 'nome obrigatorio' });

    const usuario = await prisma.user.findUnique({ where: { id: req.user.id }, select: { nome: true } });

    const regua = await prisma.reguaCobranca.create({
      data: {
        nome: nome.trim(),
        descricao: descricao?.trim() || null,
        horarioPadrao: horarioPadrao || '09:00',
        intervaloDisparoSeg: Number(intervaloDisparoSeg) || 2,
        ativo: false,
        criadoPor: req.user.id,
        criadoPorNome: usuario?.nome || req.user.email || 'Admin',
      },
    });
    res.status(201).json({ data: regua });
  } catch (error) {
    next(error);
  }
}

// PUT /api/reguas-cobranca/:id
export async function atualizar(req, res, next) {
  try {
    const { nome, descricao, ativo, horarioPadrao, intervaloDisparoSeg } = req.body;
    const data = {};
    if (nome !== undefined) data.nome = nome.trim();
    if (descricao !== undefined) data.descricao = descricao?.trim() || null;
    if (ativo !== undefined) data.ativo = Boolean(ativo);
    if (horarioPadrao !== undefined) data.horarioPadrao = horarioPadrao;
    if (intervaloDisparoSeg !== undefined) data.intervaloDisparoSeg = Number(intervaloDisparoSeg);

    // Carrega estado anterior pra detectar transicao ativacao
    const antes = await prisma.reguaCobranca.findUnique({ where: { id: req.params.id }, select: { ativo: true } });
    const regua = await prisma.reguaCobranca.update({ where: { id: req.params.id }, data });

    // Se foi desativada, cancela disparos pendentes dessa regua
    if (ativo === false) {
      await prisma.disparoMensagem.updateMany({
        where: { reguaId: req.params.id, status: 'PENDENTE' },
        data: { status: 'CANCELADO' },
      });
    }

    // Se VIROU ativa (antes false, agora true): enfileira em background (fire-and-forget).
    // Scheduler vai processar imediatamente; retornamos resposta antes do enqueue completar.
    if (ativo === true && antes?.ativo === false) {
      executarReguaAgoraService(req.params.id, { respeitarHorario: false, forcar: true })
        .then(r => console.log(`[Regua ATIVADA] "${regua.nome}": ${r.enfileirados} disparos enfileirados`))
        .catch(err => console.error(`[Regua ATIVADA] erro:`, err?.message));
    }

    res.json({ data: regua });
  } catch (error) {
    next(error);
  }
}

// POST /api/reguas-cobranca/:id/executar-agora
// Forca enqueue imediato de todas as etapas ativas (ignora horario e jaRodouHoje).
export async function executarAgora(req, res, next) {
  try {
    const r = await executarReguaAgoraService(req.params.id, { respeitarHorario: false, forcar: true });
    res.json({ data: r });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/reguas-cobranca/:id
// Remove regua e etapas (cascade) e suas segmentacoes embutidas (cascade via schema).
export async function remover(req, res, next) {
  try {
    // Disparos ficam historicos — nao cascatear (sao auditoria)
    // Por isso setamos reguaId como nullable no model.
    await prisma.disparoMensagem.updateMany({
      where: { reguaId: req.params.id },
      data: { reguaId: null, etapaReguaId: null },
    });
    await prisma.reguaCobranca.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// POST /api/reguas-cobranca/:id/duplicar
export async function duplicar(req, res, next) {
  try {
    const original = await prisma.reguaCobranca.findUnique({
      where: { id: req.params.id },
      include: { etapas: true },
    });
    if (!original) return res.status(404).json({ error: 'Regua nao encontrada' });
    const usuario = await prisma.user.findUnique({ where: { id: req.user.id }, select: { nome: true } });

    const nova = await prisma.reguaCobranca.create({
      data: {
        nome: `${original.nome} (cópia)`,
        descricao: original.descricao,
        horarioPadrao: original.horarioPadrao,
        intervaloDisparoSeg: original.intervaloDisparoSeg,
        ativo: false,
        criadoPor: req.user.id,
        criadoPorNome: usuario?.nome || req.user.email || 'Admin',
        etapas: {
          create: original.etapas.map(e => ({
            nome: e.nome,
            ordem: e.ordem,
            diasRelativoVenc: e.diasRelativoVenc,
            horario: e.horario,
            templateBlipId: e.templateBlipId,
            segmentacaoId: e.segmentacaoId, // aponta mesma segmentacao (embutidas nao duplicadas automaticamente)
            filtroRecorrencia: e.filtroRecorrencia,
            filtroSituacao: e.filtroSituacao,
            tiposOrigem: e.tiposOrigem,
            ativo: e.ativo,
          })),
        },
      },
    });
    res.status(201).json({ data: nova });
  } catch (error) {
    next(error);
  }
}

// ===== Etapa CRUD =====

// POST /api/reguas-cobranca/:id/etapas
export async function criarEtapa(req, res, next) {
  try {
    const { nome, diasRelativoVenc, templateBlipId, segmentacaoId, horario, ordem, ativo } = req.body;
    if (diasRelativoVenc === undefined || diasRelativoVenc === null) {
      return res.status(400).json({ error: 'diasRelativoVenc obrigatorio' });
    }
    if (!templateBlipId) return res.status(400).json({ error: 'templateBlipId obrigatorio' });
    if (!segmentacaoId) return res.status(400).json({ error: 'segmentacaoId obrigatorio' });

    // Valida compat template-regra
    const template = await prisma.templateBlip.findUnique({ where: { id: templateBlipId } });
    if (!template) return res.status(404).json({ error: 'Template nao encontrado' });
    const seg = await prisma.regraSegmentacao.findUnique({ where: { id: segmentacaoId } });
    if (!seg) return res.status(404).json({ error: 'Segmentacao nao encontrada' });
    if (template.escopo === 'TITULO' && seg.tipo !== 'TITULO') {
      return res.status(400).json({ error: 'Template exige segmentacao por TITULO' });
    }
    if (seg.tipo !== 'TITULO') {
      return res.status(400).json({ error: 'Reguas automaticas so aceitam segmentacoes TITULO' });
    }

    const etapa = await prisma.etapaRegua.create({
      data: {
        reguaId: req.params.id,
        nome: nome?.trim() || `${diasRelativoVenc}d · ${template.titulo}`,
        diasRelativoVenc: Number(diasRelativoVenc),
        templateBlipId,
        segmentacaoId,
        horario: horario || null,
        ordem: Number(ordem) || 0,
        ativo: ativo !== false,
      },
    });
    res.status(201).json({ data: etapa });
  } catch (error) {
    next(error);
  }
}

// PUT /api/reguas-cobranca/:id/etapas/:etapaId
export async function atualizarEtapa(req, res, next) {
  try {
    const { nome, diasRelativoVenc, templateBlipId, segmentacaoId, horario, ativo } = req.body;
    const data = {};
    if (nome !== undefined) data.nome = nome.trim();
    if (diasRelativoVenc !== undefined) data.diasRelativoVenc = Number(diasRelativoVenc);
    if (horario !== undefined) data.horario = horario || null;
    if (ativo !== undefined) data.ativo = Boolean(ativo);

    if (templateBlipId || segmentacaoId) {
      const etapaAtual = await prisma.etapaRegua.findUnique({ where: { id: req.params.etapaId } });
      if (!etapaAtual) return res.status(404).json({ error: 'Etapa nao encontrada' });
      const tplId = templateBlipId || etapaAtual.templateBlipId;
      const segId = segmentacaoId || etapaAtual.segmentacaoId;
      const [t, s] = await Promise.all([
        prisma.templateBlip.findUnique({ where: { id: tplId } }),
        prisma.regraSegmentacao.findUnique({ where: { id: segId } }),
      ]);
      if (!t || !s) return res.status(400).json({ error: 'Template ou segmentacao nao encontrados' });
      if (t.escopo === 'TITULO' && s.tipo !== 'TITULO') {
        return res.status(400).json({ error: 'Template exige segmentacao por TITULO' });
      }
      if (s.tipo !== 'TITULO') {
        return res.status(400).json({ error: 'Reguas automaticas so aceitam segmentacoes TITULO' });
      }
      if (templateBlipId) data.templateBlipId = templateBlipId;
      if (segmentacaoId) data.segmentacaoId = segmentacaoId;
    }

    const etapa = await prisma.etapaRegua.update({ where: { id: req.params.etapaId }, data });
    res.json({ data: etapa });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/reguas-cobranca/:id/etapas/:etapaId
export async function removerEtapa(req, res, next) {
  try {
    await prisma.etapaRegua.delete({ where: { id: req.params.etapaId } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// POST /api/reguas-cobranca/:id/etapas/:etapaId/simular
// Executa a query da segmentacao da etapa e retorna contagem + amostra (sem criar disparo).
export async function simularEtapa(req, res, next) {
  try {
    const etapa = await prisma.etapaRegua.findUnique({
      where: { id: req.params.etapaId },
      include: { template: true },
    });
    if (!etapa) return res.status(404).json({ error: 'Etapa nao encontrada' });
    if (!etapa.segmentacaoId) return res.status(400).json({ error: 'Etapa sem segmentacao' });

    const seg = await prisma.regraSegmentacao.findUnique({ where: { id: etapa.segmentacaoId } });
    if (!seg) return res.status(404).json({ error: 'Segmentacao nao encontrada' });

    const sql = buildSegmentacaoQuery(seg.condicoes, { page: 1, limit: 50 }, 'TITULO');
    const rows = await prisma.$queryRawUnsafe(sql);
    const countSql = buildSegmentacaoCountQuery(seg.condicoes, 'TITULO');
    const count = await prisma.$queryRawUnsafe(countSql);

    const total = Number(count[0]?.total || 0);
    const alunosUnicos = Number(count[0]?.alunos_unicos || 0);
    const valorTotal = Number(count[0]?.valor_total || 0);
    const comTel = rows.filter(r => r.celular && String(r.celular).replace(/\D/g, '').length >= 10).length;

    res.json({
      total,
      alunosUnicos,
      valorTotal,
      totalComTelefone: comTel,
      amostra: rows.slice(0, 10).map(r => ({
        codigo: r.codigo,
        nome: r.nome,
        tituloValor: Number(r.titulo_valor),
        tituloVencimento: r.titulo_data_vencimento,
        diasAteVenc: Number(r.titulo_dias_ate_venc),
      })),
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/reguas-cobranca/:id/metricas
// Retorna metricas 30d por etapa.
export async function metricasRegua(req, res, next) {
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT e.id AS etapa_id,
        COUNT(d.*)::int AS total_30d,
        COUNT(d.*) FILTER (WHERE d.status='ENVIADO')::int AS enviados_30d,
        COUNT(d.*) FILTER (WHERE d.status='FALHOU')::int AS falhas_30d,
        COUNT(d.*) FILTER (WHERE d.status='PENDENTE')::int AS pendentes_30d,
        COUNT(d.*) FILTER (WHERE d.convertido = true)::int AS convertidos_30d
      FROM cobranca.etapa_regua e
      LEFT JOIN cobranca.disparo_mensagem d
        ON d."etapaReguaId" = e.id AND d."criadoEm" >= NOW() - INTERVAL '30 days'
      WHERE e."reguaId" = $1
      GROUP BY e.id
    `, req.params.id);
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
}

// POST /api/reguas-cobranca/modelo-padrao
// Cria regua + 10 etapas + 10 segmentacoes embutidas conforme documento do usuario.
// Requer que os templates indicados ja existam.
export async function criarDoModelo(req, res, next) {
  try {
    const NOMES_TEMPLATES = [
      'template_fluxo_antes_venc_rec_inativa1',
      'template_fluxo_pos_venc_rec_inativa1',
      'template_fluxo_pos_venc_rec_inativa2',
      'template_fluxo_pos_venc_rec_inativa3',
      'template_fluxo_pos_venc_rec_inativa4',
    ];

    const templates = await prisma.templateBlip.findMany({
      where: { nomeBlip: { in: NOMES_TEMPLATES } },
    });
    const byNome = new Map(templates.map(t => [t.nomeBlip, t]));
    const faltantes = NOMES_TEMPLATES.filter(n => !byNome.has(n));
    if (faltantes.length > 0) {
      return res.status(400).json({
        error: 'Alguns templates precisam ser cadastrados antes',
        faltantes,
      });
    }

    const usuario = await prisma.user.findUnique({ where: { id: req.user.id }, select: { nome: true } });
    const nomeAgente = usuario?.nome || req.user.email || 'Admin';

    // ETAPAS: [diasRelativoVenc, templateKey, condicoesAdicionais]
    const DEF_ETAPAS = [
      { dias: -7, nome: '7 dias antes — rec. inativa', tpl: 'template_fluxo_antes_venc_rec_inativa1' },
      { dias: -4, nome: '4 dias antes — rec. inativa', tpl: 'template_fluxo_antes_venc_rec_inativa1' },
      { dias: -2, nome: '2 dias antes — rec. inativa', tpl: 'template_fluxo_antes_venc_rec_inativa1' },
      { dias: 0,  nome: 'Dia do vencimento — rec. inativa', tpl: 'template_fluxo_antes_venc_rec_inativa1' },
      { dias: 2,  nome: '2 dias após — rec. inativa', tpl: 'template_fluxo_pos_venc_rec_inativa1' },
      { dias: 5,  nome: '5 dias após — rec. inativa', tpl: 'template_fluxo_pos_venc_rec_inativa1' },
      { dias: 10, nome: '10 dias após — rec. inativa', tpl: 'template_fluxo_pos_venc_rec_inativa2' },
      { dias: 15, nome: '15 dias após — rec. inativa', tpl: 'template_fluxo_pos_venc_rec_inativa3' },
      { dias: 25, nome: '25 dias após — rec. inativa', tpl: 'template_fluxo_pos_venc_rec_inativa3' },
      { dias: 30, nome: '30 dias após — rec. inativa', tpl: 'template_fluxo_pos_venc_rec_inativa3' },
    ];

    // 1. Criar regua vazia
    const regua = await prisma.reguaCobranca.create({
      data: {
        nome: 'Cobrança mensal (modelo padrão)',
        descricao: 'Régua criada a partir do modelo do documento — 10 toques, recorrência inativa',
        ativo: false,
        horarioPadrao: '09:00',
        intervaloDisparoSeg: 2,
        criadoPor: req.user.id,
        criadoPorNome: nomeAgente,
      },
    });

    // 2. Para cada etapa: criar segmentacao embutida + etapa
    for (let i = 0; i < DEF_ETAPAS.length; i++) {
      const d = DEF_ETAPAS[i];
      const condicoes = [
        { campo: 'titulo_situacao', operador: 'igual', valor: 'AR' },
        {
          campo: d.dias < 0 ? 'titulo_dias_ate_vencimento' : (d.dias === 0 ? 'titulo_dias_ate_vencimento' : 'titulo_dias_apos_vencimento'),
          operador: 'igual',
          valor: Math.abs(d.dias),
        },
        { campo: 'recorrencia_ativa', operador: 'nao', valor: '' },
      ];
      const seg = await prisma.regraSegmentacao.create({
        data: {
          nome: `Etapa ${d.dias >= 0 ? '+' : ''}${d.dias}d — ${regua.nome}`,
          descricao: `Segmentação embutida da régua "${regua.nome}"`,
          tipo: 'TITULO',
          escopoUso: 'EMBUTIDA_REGUA',
          reguaOwnerId: regua.id,
          condicoes,
          criadoPor: req.user.id,
          criadoPorNome: nomeAgente,
        },
      });
      await prisma.etapaRegua.create({
        data: {
          reguaId: regua.id,
          nome: d.nome,
          ordem: i,
          diasRelativoVenc: d.dias,
          templateBlipId: byNome.get(d.tpl).id,
          segmentacaoId: seg.id,
          filtroRecorrencia: 'INATIVA',
          filtroSituacao: 'AR',
          ativo: true,
        },
      });
    }

    res.status(201).json({ data: regua });
  } catch (error) {
    next(error);
  }
}

// Helper interno: resolve variaveis pra mostrar preview de como ficará a mensagem.
export async function previewMensagemEtapa(req, res, next) {
  try {
    const etapa = await prisma.etapaRegua.findUnique({
      where: { id: req.params.etapaId },
      include: { template: true },
    });
    if (!etapa) return res.status(404).json({ error: 'Etapa nao encontrada' });
    if (!etapa.segmentacaoId) return res.status(400).json({ error: 'Sem segmentacao' });

    const seg = await prisma.regraSegmentacao.findUnique({ where: { id: etapa.segmentacaoId } });
    const sql = buildSegmentacaoQuery(seg.condicoes, { page: 1, limit: 1 }, 'TITULO');
    const rows = await prisma.$queryRawUnsafe(sql);
    if (rows.length === 0) {
      return res.json({ preview: '(nenhum aluno elegível agora para gerar preview)', conteudo: etapa.template.conteudoPreview });
    }
    const r = rows[0];
    const ctx = {
      pessoa: { nome: r.nome, cpf: r.cpf },
      conta: {
        codigo: r.titulo_codigo,
        valor: Number(r.titulo_valor),
        datavencimento: r.titulo_data_vencimento,
        token: r.titulo_token,
      },
      hoje: new Date(),
    };
    const { parametrosPorIndice } = resolverVariaveis(etapa.template.variaveis, ctx);
    let texto = etapa.template.conteudoPreview;
    for (const [idx, val] of Object.entries(parametrosPorIndice)) {
      texto = texto.replace(new RegExp(`\\{\\{\\s*${idx}\\s*\\}\\}`, 'g'), val);
    }
    res.json({ preview: texto, amostraAluno: r.nome, conteudo: etapa.template.conteudoPreview });
  } catch (error) {
    next(error);
  }
}

// Pra manter import clean
export { FONTES_TITULO };
