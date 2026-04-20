// ClickSign API v3 — Assinatura digital de documentos
// Docs: https://developers.clicksign.com

const CLICKSIGN_API_URL = (process.env.CLICKSIGN_API_URL || 'https://app.clicksign.com').replace(/"/g, '');
const CLICKSIGN_API_KEY = (process.env.CLICKSIGN_API_KEY || '').replace(/"/g, '');

function getHeaders() {
  return {
    'Content-Type': 'application/vnd.api+json',
    'Accept': 'application/vnd.api+json',
    'Authorization': CLICKSIGN_API_KEY,
  };
}

async function clicksignRequest(method, path, body) {
  const url = `${CLICKSIGN_API_URL}${path}`;
  const options = { method, headers: getHeaders() };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const text = await res.text();

  if (!res.ok) {
    const detail = text.slice(0, 300);
    throw new Error(`ClickSign ${method} ${path} — HTTP ${res.status}: ${detail}`);
  }

  return text ? JSON.parse(text) : null;
}

// -----------------------------------------------
// 1. Criar envelope vazio
// -----------------------------------------------
export async function criarEnvelope(nome, deadlineDias = 30) {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + deadlineDias);

  const data = await clicksignRequest('POST', '/api/v3/envelopes', {
    data: {
      type: 'envelopes',
      attributes: {
        name: nome,
        locale: 'pt-BR',
        auto_close: true,
        remind_interval: 3,
        block_after_refusal: true,
        deadline_at: deadline.toISOString(),
      },
    },
  });

  return data.data.id;
}

// -----------------------------------------------
// 2. Upload do documento PDF (base64)
// -----------------------------------------------
export async function adicionarDocumento(envelopeId, pdfBase64, filename) {
  const content = pdfBase64.startsWith('data:')
    ? pdfBase64
    : `data:application/pdf;base64,${pdfBase64}`;

  const data = await clicksignRequest('POST', `/api/v3/envelopes/${envelopeId}/documents`, {
    data: {
      type: 'documents',
      attributes: {
        filename,
        content_base64: content,
      },
    },
  });

  return data.data.id;
}

// -----------------------------------------------
// 3. Adicionar signatario (apenas aluno)
// -----------------------------------------------
export async function adicionarSignatario(envelopeId, { nome, email, celular }) {
  // Formatar celular: apenas digitos, sem +55
  const phone = celular.replace(/\D/g, '').replace(/^55/, '');

  const data = await clicksignRequest('POST', `/api/v3/envelopes/${envelopeId}/signers`, {
    data: {
      type: 'signers',
      attributes: {
        name: nome,
        email: email,
        phone_number: phone,
        group: 1,
        refusable: true,
        communicate_events: {
          signature_request: 'whatsapp',
          signature_reminder: 'email',
          document_signed: 'whatsapp',
        },
      },
    },
  });

  return data.data.id;
}

// -----------------------------------------------
// 4. Criar requisito de assinatura
// -----------------------------------------------
export async function criarRequisito(envelopeId, documentId, signerId) {
  await clicksignRequest('POST', `/api/v3/envelopes/${envelopeId}/requirements`, {
    data: {
      type: 'requirements',
      attributes: {
        action: 'agree',
        role: 'sign',
      },
      relationships: {
        document: { data: { type: 'documents', id: documentId } },
        signer: { data: { type: 'signers', id: signerId } },
      },
    },
  });
}

// -----------------------------------------------
// 5. Criar requisito de autenticacao WhatsApp
// -----------------------------------------------
export async function criarRequisitoAuth(envelopeId, documentId, signerId) {
  await clicksignRequest('POST', `/api/v3/envelopes/${envelopeId}/requirements`, {
    data: {
      type: 'requirements',
      attributes: {
        action: 'provide_evidence',
        auth: 'whatsapp',
      },
      relationships: {
        document: { data: { type: 'documents', id: documentId } },
        signer: { data: { type: 'signers', id: signerId } },
      },
    },
  });
}

// -----------------------------------------------
// 6. Ativar envelope (status → running)
// -----------------------------------------------
export async function ativarEnvelope(envelopeId) {
  await clicksignRequest('PATCH', `/api/v3/envelopes/${envelopeId}`, {
    data: {
      type: 'envelopes',
      id: envelopeId,
      attributes: {
        status: 'running',
      },
    },
  });
}

// -----------------------------------------------
// 7. Cancelar/deletar envelope
// -----------------------------------------------
export async function cancelarEnvelope(envelopeId) {
  try {
    await clicksignRequest('DELETE', `/api/v3/envelopes/${envelopeId}`);
  } catch {
    // Fallback: tentar PATCH cancel
    await clicksignRequest('PATCH', `/api/v3/envelopes/${envelopeId}/cancel`);
  }
}

// -----------------------------------------------
// Fluxo completo: enviar documento para assinatura
// -----------------------------------------------
export async function enviarParaAssinatura({ titulo, pdfBase64, filename, signatario }) {
  // 1. Criar envelope
  const envelopeId = await criarEnvelope(titulo);

  try {
    // 2. Upload documento
    const documentId = await adicionarDocumento(envelopeId, pdfBase64, filename);

    // 3. Adicionar signatario (aluno)
    const signerId = await adicionarSignatario(envelopeId, signatario);

    // 4. Requisito de assinatura
    await criarRequisito(envelopeId, documentId, signerId);

    // 5. Requisito de autenticacao WhatsApp
    await criarRequisitoAuth(envelopeId, documentId, signerId);

    // 6. Ativar
    await ativarEnvelope(envelopeId);

    // 7. Forcar envio de notificacao (WhatsApp imediato)
    try {
      await clicksignRequest('POST', `/api/v3/envelopes/${envelopeId}/notifications`, {
        data: { type: 'notifications', attributes: {} },
      });
    } catch { /* nao critico */ }

    return { envelopeId, documentId, signerId };
  } catch (err) {
    // Cleanup: deletar envelope se falhou apos criacao
    try { await cancelarEnvelope(envelopeId); } catch {}
    throw err;
  }
}

// -----------------------------------------------
// Validar webhook HMAC
// -----------------------------------------------
import crypto from 'crypto';

export function validarWebhookHmac(rawBody, signature) {
  const secret = process.env.CLICKSIGN_WEBHOOK_SECRET;
  if (!secret) return true; // sem secret configurado, aceitar tudo

  if (!signature) return false;

  const sig = signature.replace('sha256=', '');
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return sig === expected;
}
