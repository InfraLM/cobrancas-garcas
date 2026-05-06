/**
 * CRUD de TemplateMeta — gestao de templates Meta WABA.
 *
 * Lifecycle:
 *   - criar (POST)        -> registra local com status DRAFT
 *   - atualizar (PUT)     -> permitido apenas em DRAFT/REJECTED
 *   - submeter (POST)     -> envia para Meta, status vira PENDING
 *   - deletar (DELETE)    -> remove local + remoto na Meta (soft local)
 *   - sincronizar (POST)  -> puxa estado atual da Meta para o banco
 */

import { prisma } from '../config/database.js';
import * as metaService from '../services/metaTemplatesService.js';

const CATEGORIAS_VALIDAS = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
const STATUS_EDITAVEIS = ['DRAFT', 'REJECTED'];
const NAME_REGEX = /^[a-z][a-z0-9_]*$/;

function validarPayload(payload, { exigirCategoria = true } = {}) {
  const erros = [];
  if (!payload.name || !NAME_REGEX.test(payload.name)) {
    erros.push('name invalido (precisa estar em lowercase + underscore, ex: lm_cobranca_lembrete)');
  }
  if (exigirCategoria && !CATEGORIAS_VALIDAS.includes(payload.category)) {
    erros.push(`category invalida (use ${CATEGORIAS_VALIDAS.join(' | ')})`);
  }
  if (!Array.isArray(payload.components) || payload.components.length === 0) {
    erros.push('components obrigatorio (pelo menos um componente, normalmente BODY)');
  } else {
    const temBody = payload.components.some(c => c.type === 'BODY' || c.type === 'body');
    if (!temBody) erros.push('components deve incluir um BODY');
  }
  return erros;
}

// ============================================================
// LISTAR
// ============================================================
export async function listar(req, res, next) {
  try {
    const { status, category, ativo, incluirInativos } = req.query;
    const where = {};
    if (status) where.status = String(status);
    if (category) where.category = String(category);
    if (ativo !== undefined) where.ativo = ativo === 'true';
    else if (!incluirInativos) where.ativo = true;

    const templates = await prisma.templateMeta.findMany({
      where,
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
    res.json({ data: templates });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// OBTER
// ============================================================
export async function obter(req, res, next) {
  try {
    const t = await prisma.templateMeta.findUnique({ where: { id: req.params.id } });
    if (!t) return res.status(404).json({ error: 'Template nao encontrado' });
    res.json({ data: t });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// CRIAR (local DRAFT — nao envia para Meta ainda)
// ============================================================
export async function criar(req, res, next) {
  try {
    const { name, language, category, components, variaveisMap } = req.body;
    const erros = validarPayload({ name, category, components });
    if (erros.length) return res.status(400).json({ error: erros.join('; ') });

    const wabaId = process.env.META_WABA_ID;
    if (!wabaId) return res.status(500).json({ error: 'META_WABA_ID nao configurado' });

    // Verifica se ja existe (local) com mesmo nome+lang+waba
    const existente = await prisma.templateMeta.findFirst({
      where: { metaWabaId: wabaId, name, language: language || 'pt_BR' },
    });
    if (existente) {
      return res.status(409).json({ error: `Ja existe template com name=${name} language=${language || 'pt_BR'} nesta WABA` });
    }

    const tpl = await prisma.templateMeta.create({
      data: {
        metaWabaId: wabaId,
        name,
        language: language || 'pt_BR',
        category,
        components,
        variaveisMap: variaveisMap || null,
        status: 'DRAFT',
        criadoPor: req.user?.id || 0,
        criadoPorNome: req.user?.nome || null,
      },
    });
    res.status(201).json({ data: tpl });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// ATUALIZAR (apenas em DRAFT ou REJECTED)
// ============================================================
export async function atualizar(req, res, next) {
  try {
    const tpl = await prisma.templateMeta.findUnique({ where: { id: req.params.id } });
    if (!tpl) return res.status(404).json({ error: 'Template nao encontrado' });

    if (!STATUS_EDITAVEIS.includes(tpl.status)) {
      return res.status(400).json({
        error: `Templates com status ${tpl.status} nao podem ser editados. Apenas DRAFT/REJECTED. Para alterar um aprovado, crie nova versao com nome diferente (ex: ${tpl.name}_v2).`,
      });
    }

    const { name, language, category, components, variaveisMap, ativo } = req.body;

    // Se mudar identificadores (name, language), precisa revalidar unicidade
    const novoName = name || tpl.name;
    const novoLanguage = language || tpl.language;
    if (novoName !== tpl.name || novoLanguage !== tpl.language) {
      const erros = validarPayload({ name: novoName, components: components || tpl.components, category: category || tpl.category });
      if (erros.length) return res.status(400).json({ error: erros.join('; ') });
      const conflito = await prisma.templateMeta.findFirst({
        where: { metaWabaId: tpl.metaWabaId, name: novoName, language: novoLanguage, NOT: { id: tpl.id } },
      });
      if (conflito) return res.status(409).json({ error: 'Ja existe outro template com esse name/language' });
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (language !== undefined) data.language = language;
    if (category !== undefined) {
      if (!CATEGORIAS_VALIDAS.includes(category)) {
        return res.status(400).json({ error: `category invalida (use ${CATEGORIAS_VALIDAS.join(' | ')})` });
      }
      data.category = category;
    }
    if (components !== undefined) data.components = components;
    if (variaveisMap !== undefined) data.variaveisMap = variaveisMap;
    if (ativo !== undefined) data.ativo = Boolean(ativo);

    const atualizado = await prisma.templateMeta.update({ where: { id: tpl.id }, data });
    res.json({ data: atualizado });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// SUBMETER (envia para Meta, status -> PENDING)
// ============================================================
export async function submeter(req, res, next) {
  try {
    const tpl = await prisma.templateMeta.findUnique({ where: { id: req.params.id } });
    if (!tpl) return res.status(404).json({ error: 'Template nao encontrado' });

    if (tpl.status !== 'DRAFT' && tpl.status !== 'REJECTED') {
      return res.status(400).json({
        error: `Template ${tpl.status} ja foi submetido. Para revisar texto, crie nova versao com nome diferente.`,
      });
    }

    try {
      const remoto = await metaService.criarRemoto({
        name: tpl.name,
        language: tpl.language,
        category: tpl.category,
        components: tpl.components,
        allow_category_change: true,
      });

      const atualizado = await prisma.templateMeta.update({
        where: { id: tpl.id },
        data: {
          metaTemplateId: remoto.id,
          status: remoto.status || 'PENDING',
          category: remoto.category || tpl.category,
          submetidoEm: new Date(),
          rejectReason: null,
        },
      });
      res.json({ data: atualizado, meta: remoto });
    } catch (err) {
      // Meta retornou erro de validacao — devolve para usuario com detalhe.
      // CRITICO: nunca propagar 401/403 da Meta. O frontend trata 401 como
      // sessao do nosso JWT expirada e desloga o usuario. Mapear pra 502
      // (Bad Gateway) preserva a mensagem mas evita o redirect pra /login.
      const metaErr = err.metaError;
      const isAuthMeta = err.status === 401 || err.status === 403;
      const statusResposta = isAuthMeta ? 502 : (err.status || 502);
      return res.status(statusResposta).json({
        error: isAuthMeta
          ? `Erro de autenticação com a Meta: ${err.message}. Verifique se META_ACCESS_TOKEN esta configurado e tem as permissoes whatsapp_business_management + whatsapp_business_messaging.`
          : err.message,
        metaError: metaErr ? {
          code: metaErr.code,
          subcode: metaErr.error_subcode,
          userTitle: metaErr.error_user_title,
          userMsg: metaErr.error_user_msg,
        } : undefined,
      });
    }
  } catch (error) {
    next(error);
  }
}

// ============================================================
// DELETAR (remove na Meta + soft-delete local)
// ============================================================
export async function deletar(req, res, next) {
  try {
    const tpl = await prisma.templateMeta.findUnique({ where: { id: req.params.id } });
    if (!tpl) return res.status(404).json({ error: 'Template nao encontrado' });

    // Se ja foi submetido na Meta, deleta la primeiro
    if (tpl.metaTemplateId) {
      try {
        await metaService.deletarRemoto({ name: tpl.name, hsmId: tpl.metaTemplateId });
      } catch (err) {
        // Loga mas nao bloqueia — pode ja nao existir na Meta
        console.warn('[TemplatesMeta] Falha ao deletar na Meta:', err.message);
      }
    }

    // Soft-delete local: marca ativo=false. Nao hard-delete pra preservar
    // referencias em mensagem_whatsapp.templateMetaId.
    const atualizado = await prisma.templateMeta.update({
      where: { id: tpl.id },
      data: { ativo: false },
    });
    res.json({ data: atualizado });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// SINCRONIZAR (puxa estado atual da Meta)
// ============================================================
export async function sincronizar(_req, res, _next) {
  try {
    const result = await metaService.sincronizarStatus();
    res.json({ data: result });
  } catch (err) {
    // Mesmo cuidado do submeter: nao propagar 401/403 da Meta para o frontend.
    const isAuthMeta = err.status === 401 || err.status === 403;
    const statusResposta = isAuthMeta ? 502 : (err.status || 500);
    res.status(statusResposta).json({
      error: isAuthMeta
        ? `Erro de autenticação com a Meta: ${err.message}. Verifique se META_ACCESS_TOKEN esta configurado e tem as permissoes whatsapp_business_management + whatsapp_business_messaging.`
        : err.message,
    });
  }
}
