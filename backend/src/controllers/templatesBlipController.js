import { prisma } from '../config/database.js';
import { listarFontesDisponiveis, detectarIndicesNoConteudo, previewConteudo } from '../services/reguaExecutorService.js';

// Fontes que exigem um titulo especifico no contexto do disparo.
// Se o template usar qualquer uma, ele so pode ser disparado com regra de segmentacao TIPO=TITULO.
const FONTES_TITULO = new Set([
  'VALOR_PARCELA',
  'DATA_VENCIMENTO',
  'DIAS_ATE_VENCIMENTO',
  'DIAS_ATE_VENCIMENTO_FRIENDLY',
  'DIAS_APOS_VENCIMENTO',
  'DIAS_APOS_VENCIMENTO_FRIENDLY',
  'LINK_PAGAMENTO_SEI',
]);

function inferirEscopo(variaveis) {
  const precisaTitulo = (variaveis || []).some(v => FONTES_TITULO.has(v.fonte));
  return precisaTitulo ? 'TITULO' : 'AMBOS';
}

// GET /api/templates-blip
export async function listar(req, res, next) {
  try {
    const { categoria, ativo } = req.query;
    const where = {};
    if (categoria) where.categoria = categoria;
    if (ativo !== undefined) where.ativo = ativo === 'true';
    const templates = await prisma.templateBlip.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
    });
    res.json({ data: templates });
  } catch (error) {
    next(error);
  }
}

// GET /api/templates-blip/:id
export async function obter(req, res, next) {
  try {
    const t = await prisma.templateBlip.findUnique({ where: { id: req.params.id } });
    if (!t) return res.status(404).json({ error: 'Template nao encontrado' });
    res.json(t);
  } catch (error) {
    next(error);
  }
}

// GET /api/templates-blip/fontes
// Retorna lista de fontes de variaveis disponiveis (para UI de cadastro).
export async function fontes(req, res, next) {
  try {
    res.json({ data: listarFontesDisponiveis() });
  } catch (error) {
    next(error);
  }
}

function validarPayload(body) {
  const { nomeBlip, titulo, conteudoPreview, variaveis, categoria } = body || {};
  if (!nomeBlip?.trim()) return 'nomeBlip obrigatorio';
  if (!titulo?.trim()) return 'titulo obrigatorio';
  if (!conteudoPreview?.trim()) return 'conteudoPreview obrigatorio';
  if (!categoria) return 'categoria obrigatoria';
  if (!Array.isArray(variaveis)) return 'variaveis deve ser array';
  // Verifica consistencia: indices no conteudo vs map
  const indicesConteudo = detectarIndicesNoConteudo(conteudoPreview);
  const indicesMap = (variaveis || []).map(v => Number(v.indice)).sort((a, b) => a - b);
  const faltando = indicesConteudo.filter(i => !indicesMap.includes(i));
  if (faltando.length > 0) return `Variaveis nao mapeadas: ${faltando.map(i => `{{${i}}}`).join(', ')}`;
  return null;
}

// POST /api/templates-blip
export async function criar(req, res, next) {
  try {
    const erro = validarPayload(req.body);
    if (erro) return res.status(400).json({ error: erro });

    const usuario = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { nome: true },
    });

    const escopo = inferirEscopo(req.body.variaveis);

    const criado = await prisma.templateBlip.create({
      data: {
        nomeBlip: req.body.nomeBlip.trim(),
        titulo: req.body.titulo.trim(),
        descricao: req.body.descricao?.trim() || null,
        conteudoPreview: req.body.conteudoPreview,
        variaveis: req.body.variaveis,
        categoria: req.body.categoria,
        escopo,
        ativo: req.body.ativo !== false,
        criadoPor: req.user.id,
        criadoPorNome: usuario?.nome || req.user.email || 'Admin',
      },
    });
    res.status(201).json(criado);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ja existe template com esse nomeBlip' });
    }
    next(error);
  }
}

// PUT /api/templates-blip/:id
export async function atualizar(req, res, next) {
  try {
    const erro = validarPayload(req.body);
    if (erro) return res.status(400).json({ error: erro });

    const escopo = inferirEscopo(req.body.variaveis);

    const atualizado = await prisma.templateBlip.update({
      where: { id: req.params.id },
      data: {
        nomeBlip: req.body.nomeBlip.trim(),
        titulo: req.body.titulo.trim(),
        descricao: req.body.descricao?.trim() || null,
        conteudoPreview: req.body.conteudoPreview,
        variaveis: req.body.variaveis,
        categoria: req.body.categoria,
        escopo,
        ativo: req.body.ativo !== false,
      },
    });
    res.json(atualizado);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Template nao encontrado' });
    if (error.code === 'P2002') return res.status(409).json({ error: 'nomeBlip duplicado' });
    next(error);
  }
}

// DELETE /api/templates-blip/:id
// Soft delete — so desativa. Nao apaga porque pode ter referencias em DisparoMensagem/EtapaRegua.
export async function remover(req, res, next) {
  try {
    const emUso = await prisma.etapaRegua.count({ where: { templateBlipId: req.params.id } });
    if (emUso > 0) {
      return res.status(409).json({ error: `Template em uso em ${emUso} etapa(s). Desative em vez de deletar.` });
    }
    await prisma.templateBlip.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Template nao encontrado' });
    next(error);
  }
}

// POST /api/templates-blip/:id/preview
// Gera preview com valores mock substituidos.
export async function gerarPreview(req, res, next) {
  try {
    const t = await prisma.templateBlip.findUnique({ where: { id: req.params.id } });
    if (!t) return res.status(404).json({ error: 'Template nao encontrado' });
    const preview = previewConteudo(t.conteudoPreview, t.variaveis);
    res.json({ preview });
  } catch (error) {
    next(error);
  }
}
