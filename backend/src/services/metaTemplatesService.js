/**
 * Wrapper para Meta Graph API — gestao de templates WhatsApp Business.
 *
 * Endpoints cobertos:
 *   - GET /{waba_id}/message_templates       (listar)
 *   - POST /{waba_id}/message_templates      (criar/submeter)
 *   - DELETE /{waba_id}/message_templates    (remover)
 *
 * Lifecycle do template:
 *   DRAFT (no nosso banco) -> PENDING (apos submeter) -> APPROVED/REJECTED (via webhook ou cron)
 *   PAUSED/DISABLED gerenciado pela Meta com base em quality rating.
 *
 * Tokens: usa System User Token permanente em META_ACCESS_TOKEN.
 */

import { prisma } from '../config/database.js';

const META_API_BASE = 'https://graph.facebook.com';
const FETCH_TIMEOUT = 30_000;

function metaConfig() {
  const version = process.env.META_API_VERSION || 'v21.0';
  const token = process.env.META_ACCESS_TOKEN;
  const wabaId = process.env.META_WABA_ID;
  if (!token) throw new Error('META_ACCESS_TOKEN nao configurado');
  if (!wabaId) throw new Error('META_WABA_ID nao configurado');
  return { version, token, wabaId, baseUrl: `${META_API_BASE}/${version}` };
}

function metaHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function metaFetch(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error(data?.error?.error_user_msg || data?.error?.message || `Meta API ${r.status}`);
      err.metaError = data?.error;
      err.status = r.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------
// Operacoes Meta (rede)
// ---------------------------------------------------------------

/**
 * Lista templates remotos da WABA (paginado, traz tudo de uma vez ate 100).
 * Campos uteis: id, name, status, category, language, components, quality_score, rejected_reason
 */
export async function listarRemoto(opts = {}) {
  const { baseUrl, token, wabaId } = metaConfig();
  const qs = new URLSearchParams({
    fields: 'id,name,status,category,language,components,quality_score,rejected_reason',
    limit: String(opts.limit || 100),
  });
  if (opts.status) qs.set('status', opts.status);
  if (opts.category) qs.set('category', opts.category);
  if (opts.name) qs.set('name', opts.name);
  return metaFetch(`${baseUrl}/${wabaId}/message_templates?${qs}`, {
    headers: metaHeaders(token),
  });
}

/**
 * Submete um template para aprovacao Meta.
 * Body esperado: { name, language, category, components, allow_category_change? }
 *   - name: lowercase + underscore (validar antes)
 *   - language: 'pt_BR' (default), 'pt', 'en', etc.
 *   - category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
 *   - components: array com pelo menos um BODY. Variaveis no formato {{1}}, {{2}}.
 *     Cada componente com variavel precisa de `example.body_text` (BODY) ou
 *     `example.header_text` / `example.header_handle` (HEADER).
 *   - allow_category_change: default true; permite Meta reclassificar.
 *
 * Retorna { id, status, category }.
 */
export async function criarRemoto(payload) {
  const { baseUrl, token, wabaId } = metaConfig();
  const body = { allow_category_change: true, ...payload };
  return metaFetch(`${baseUrl}/${wabaId}/message_templates`, {
    method: 'POST',
    headers: metaHeaders(token),
    body: JSON.stringify(body),
  });
}

/**
 * Remove um template. Pode passar `name` (apaga TODAS variantes de linguagem)
 * ou `name + hsmId` (apaga so aquela linguagem).
 */
export async function deletarRemoto({ name, hsmId }) {
  const { baseUrl, token, wabaId } = metaConfig();
  const qs = new URLSearchParams({ name });
  if (hsmId) qs.set('hsm_id', hsmId);
  return metaFetch(`${baseUrl}/${wabaId}/message_templates?${qs}`, {
    method: 'DELETE',
    headers: metaHeaders(token),
  });
}

// ---------------------------------------------------------------
// Sincronizacao com banco local
// ---------------------------------------------------------------

/**
 * Mapeia status Meta para nosso status interno (sao os mesmos, mas centralizamos
 * pra eventual divergencia futura).
 */
function mapearStatus(metaStatus) {
  const valido = ['PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED', 'IN_APPEAL', 'DRAFT'];
  if (valido.includes(metaStatus)) return metaStatus;
  return metaStatus || 'PENDING';
}

/**
 * Sincroniza estado de TODOS os templates da WABA com nosso banco.
 * - Insere os que existem na Meta mas nao no banco (criadoPor=0 = importado via sync)
 * - Atualiza status / quality / reject_reason dos que ja existem
 * - NAO remove localmente os que sumiram da Meta (preserva historico; soft-delete via ativo=false fica a cargo do user)
 *
 * Retorna { criados, atualizados, naoMudaram }.
 */
export async function sincronizarStatus() {
  const { wabaId } = metaConfig();
  const remoto = await listarRemoto();
  const lista = remoto.data || [];

  let criados = 0;
  let atualizados = 0;
  let naoMudaram = 0;

  for (const t of lista) {
    const status = mapearStatus(t.status);
    const qualityRating = t.quality_score?.score || null;
    const rejectReason = t.rejected_reason || null;

    const existente = await prisma.templateMeta.findFirst({
      where: {
        OR: [
          { metaTemplateId: t.id },
          { metaWabaId: wabaId, name: t.name, language: t.language },
        ],
      },
    });

    if (!existente) {
      await prisma.templateMeta.create({
        data: {
          metaTemplateId: t.id,
          metaWabaId: wabaId,
          name: t.name,
          language: t.language,
          category: t.category,
          status,
          rejectReason,
          qualityRating,
          components: t.components || [],
          submetidoEm: new Date(),
          aprovadoEm: status === 'APPROVED' ? new Date() : null,
          criadoPor: 0,
          criadoPorNome: 'Importado via sync',
        },
      });
      criados++;
    } else {
      const mudou =
        existente.status !== status ||
        existente.qualityRating !== qualityRating ||
        existente.rejectReason !== rejectReason ||
        existente.metaTemplateId !== t.id;

      if (mudou) {
        await prisma.templateMeta.update({
          where: { id: existente.id },
          data: {
            metaTemplateId: t.id,
            status,
            rejectReason,
            qualityRating,
            // Mantem components atuais se ja submetido (nao sobrescreve edicao local)
            components: existente.metaTemplateId ? existente.components : t.components,
            aprovadoEm: status === 'APPROVED' && !existente.aprovadoEm ? new Date() : existente.aprovadoEm,
          },
        });
        atualizados++;
      } else {
        naoMudaram++;
      }
    }
  }

  return { criados, atualizados, naoMudaram, total: lista.length };
}
