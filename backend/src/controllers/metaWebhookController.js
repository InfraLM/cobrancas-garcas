/**
 * Webhook listener da Meta para WhatsApp Business.
 *
 * GET  /api/webhooks/meta — handshake (Meta envia hub.challenge na configuracao)
 * POST /api/webhooks/meta — eventos
 *
 * Eventos relevantes (nao subscrevemos `messages` aqui — fica via 3C Plus Socket.io):
 *  - message_template_status_update    APPROVED | REJECTED | PAUSED | DISABLED | FLAGGED
 *  - template_category_update          mudanca de categoria pela Meta
 *  - message_template_quality_update   atualizacao de quality_score
 *
 * Estrategia:
 *  1. Responder 200 imediato (Meta exige < 5s)
 *  2. Persistir cada `change` em MetaWebhookEvent (auditoria + retry futuro)
 *  3. Processar inline (sao eventos pequenos, sem necessidade de queue)
 *  4. Emitir socket pra UI atualizar em tempo real
 */

import { prisma } from '../config/database.js';
import { getRealtimeIo } from '../realtime.js';

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;

// ============================================================
// Handshake (verificacao Meta)
// ============================================================
export function verificar(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (!VERIFY_TOKEN) {
    console.warn('[MetaWebhook] META_WEBHOOK_VERIFY_TOKEN nao configurado — handshake sempre falha');
    return res.sendStatus(500);
  }

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[MetaWebhook] Handshake OK');
    return res.status(200).send(challenge);
  }

  console.warn('[MetaWebhook] Handshake falhou (mode/token nao bateu)');
  return res.sendStatus(403);
}

// ============================================================
// Receber eventos
// ============================================================
export async function receber(req, res) {
  // 1. Responde 200 imediato — Meta tem timeout de 5s
  res.sendStatus(200);

  // 2. Processa async (best-effort — se falhar, fica no MetaWebhookEvent pra retry)
  try {
    const entries = req.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        await persistirEProcessar(change, req.body);
      }
    }
  } catch (err) {
    console.error('[MetaWebhook] Erro processando entry:', err.message);
  }
}

async function persistirEProcessar(change, payloadCompleto) {
  // Persiste evento bruto pra auditoria (append-only)
  let evento;
  try {
    evento = await prisma.metaWebhookEvent.create({
      data: {
        field: change.field,
        payload: { ...change.value, _envelope: payloadCompleto?.object || null },
        processado: false,
      },
    });
  } catch (err) {
    console.warn('[MetaWebhook] Falha ao persistir evento:', err.message);
    return;
  }

  // Processa conforme field
  try {
    if (change.field === 'message_template_status_update') {
      await processarStatusUpdate(change.value);
    } else if (change.field === 'template_category_update') {
      await processarCategoryUpdate(change.value);
    } else if (change.field === 'message_template_quality_update') {
      await processarQualityUpdate(change.value);
    } else {
      console.log('[MetaWebhook] Field desconhecido:', change.field);
    }

    await prisma.metaWebhookEvent.update({
      where: { id: evento.id },
      data: { processado: true },
    });
  } catch (err) {
    console.error('[MetaWebhook] Falha ao processar evento ' + evento.id + ':', err.message);
    await prisma.metaWebhookEvent.update({
      where: { id: evento.id },
      data: { erro: err.message?.slice(0, 500) },
    }).catch(() => {});
  }
}

// ============================================================
// Handlers por field
// ============================================================

async function processarStatusUpdate(value) {
  // value = { event, message_template_id, message_template_name, message_template_language, reason }
  const {
    event,
    message_template_id: metaId,
    message_template_name: nome,
    message_template_language: language,
    reason,
  } = value || {};

  if (!metaId && !nome) {
    console.warn('[MetaWebhook] status_update sem identificador');
    return;
  }

  // Mapear event Meta -> nosso status
  // event: APPROVED | REJECTED | PAUSED | DISABLED | FLAGGED
  // FLAGGED = aviso antes de pause; tratamos como PENDING (precisa atencao)
  const statusMap = {
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    PAUSED: 'PAUSED',
    DISABLED: 'DISABLED',
    FLAGGED: 'PENDING',
  };
  const novoStatus = statusMap[event] || event;

  // Encontrar template local via metaTemplateId (preferido) ou (waba+name+lang)
  const where = metaId
    ? { metaTemplateId: String(metaId) }
    : { metaWabaId: process.env.META_WABA_ID, name: nome, language };

  const local = await prisma.templateMeta.findFirst({ where });
  if (!local) {
    console.warn('[MetaWebhook] template ' + (metaId || nome) + ' nao encontrado no banco');
    return;
  }

  const dadosUpdate = {
    status: novoStatus,
    rejectReason: reason || null,
  };
  if (novoStatus === 'APPROVED' && !local.aprovadoEm) {
    dadosUpdate.aprovadoEm = new Date();
  }
  // Se ainda nao tinha o metaTemplateId salvo, preencha agora
  if (metaId && !local.metaTemplateId) {
    dadosUpdate.metaTemplateId = String(metaId);
  }

  const atualizado = await prisma.templateMeta.update({
    where: { id: local.id },
    data: dadosUpdate,
  });

  // Emite realtime para UI atualizar sem refresh manual
  emitirAtualizacao('template-meta:atualizado', {
    id: atualizado.id,
    status: atualizado.status,
    qualityRating: atualizado.qualityRating,
    rejectReason: atualizado.rejectReason,
    aprovadoEm: atualizado.aprovadoEm,
    event,
  });

  console.log('[MetaWebhook] status_update ' + atualizado.name + ' [' + atualizado.language + '] -> ' + novoStatus);
}

async function processarCategoryUpdate(value) {
  // value = { message_template_id, message_template_name, message_template_language, previous_category, new_category }
  const {
    message_template_id: metaId,
    message_template_name: nome,
    message_template_language: language,
    previous_category: anterior,
    new_category: nova,
  } = value || {};

  const where = metaId
    ? { metaTemplateId: String(metaId) }
    : { metaWabaId: process.env.META_WABA_ID, name: nome, language };

  const local = await prisma.templateMeta.findFirst({ where });
  if (!local) return;

  const atualizado = await prisma.templateMeta.update({
    where: { id: local.id },
    data: { category: nova || local.category },
  });

  emitirAtualizacao('template-meta:atualizado', {
    id: atualizado.id,
    category: atualizado.category,
    previousCategory: anterior,
  });

  console.log('[MetaWebhook] category_update ' + atualizado.name + ' ' + anterior + ' -> ' + nova);
}

async function processarQualityUpdate(value) {
  // value = { message_template_id, message_template_name, message_template_language, previous_quality_score, new_quality_score }
  const {
    message_template_id: metaId,
    message_template_name: nome,
    message_template_language: language,
    new_quality_score: novoScore,
  } = value || {};

  const where = metaId
    ? { metaTemplateId: String(metaId) }
    : { metaWabaId: process.env.META_WABA_ID, name: nome, language };

  const local = await prisma.templateMeta.findFirst({ where });
  if (!local) return;

  const atualizado = await prisma.templateMeta.update({
    where: { id: local.id },
    data: { qualityRating: novoScore || null },
  });

  emitirAtualizacao('template-meta:atualizado', {
    id: atualizado.id,
    qualityRating: atualizado.qualityRating,
  });

  console.log('[MetaWebhook] quality_update ' + atualizado.name + ' -> ' + novoScore);
}

function emitirAtualizacao(evento, payload) {
  try {
    const io = getRealtimeIo();
    if (io) io.emit(evento, payload);
  } catch (err) {
    console.warn('[MetaWebhook] Falha ao emitir socket ' + evento + ':', err.message);
  }
}
