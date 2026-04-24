// Blip Roteador — Envio de mensagens ativas (templates WhatsApp)
// DIFERENTE do chatbot (BLIP_API_URL) — este usa o roteador (BLIP_ROUTER_URL)

import { randomUUID } from 'crypto';

const BLIP_ROUTER_URL = process.env.BLIP_ROUTER_URL;
const BLIP_ROUTER_KEY = process.env.BLIP_ROUTER_KEY;
const TEMPLATE_PAGAMENTO = process.env.BLIP_TEMPLATE_PAGAMENTO || 'cobranca_link_de_pagamento_asaas';

// -----------------------------------------------
// Envio generico de template WhatsApp via Blip.
// Aceita parametros posicionais (ordenados por indice) e opcionalmente
// um parametro pra botao URL.
//
// @param {Object} opts
// @param {string} opts.telefone - telefone do destinatario (com ou sem +55)
// @param {string} opts.templateNome - nome do template aprovado na Blip/Meta
// @param {Array<string>} opts.parametros - array ordenado: [{{1}}, {{2}}, ...]
// @param {string} [opts.botaoUrlParam] - parametro do botao URL (se o template tiver)
// @param {string} [opts.languageCode='pt_BR']
// @returns {Promise<{ok: boolean, messageId: string}>}
// -----------------------------------------------
export async function enviarTemplate({ telefone, templateNome, parametros = [], botaoUrlParam = null, languageCode = 'pt_BR' }) {
  if (!BLIP_ROUTER_URL || !BLIP_ROUTER_KEY) {
    throw new Error('BLIP_ROUTER_URL e BLIP_ROUTER_KEY nao configurados');
  }
  if (!telefone) throw new Error('telefone obrigatorio');
  if (!templateNome) throw new Error('templateNome obrigatorio');

  const to = formatarTelefoneBlip(telefone);
  const messageId = randomUUID();

  const components = [];
  if (parametros.length > 0) {
    components.push({
      type: 'body',
      parameters: parametros.map(p => ({ type: 'text', text: String(p ?? '') })),
    });
  }
  if (botaoUrlParam) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: 0,
      parameters: [{ type: 'text', text: String(botaoUrlParam) }],
    });
  }

  const payload = {
    id: messageId,
    to,
    type: 'application/json',
    content: {
      type: 'template',
      template: {
        name: templateNome,
        language: { code: languageCode, policy: 'deterministic' },
        components,
      },
    },
  };

  const res = await fetch(BLIP_ROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${BLIP_ROUTER_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Blip HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  return { ok: true, messageId };
}

// -----------------------------------------------
// Formatar telefone para Blip: 55XXXXXXXXXXX@wa.gw.msging.net
// -----------------------------------------------
function formatarTelefoneBlip(telefone) {
  let digits = telefone.replace(/\D/g, '');
  // Remover +55 se presente
  if (digits.startsWith('55') && digits.length >= 12) {
    // ja tem codigo do pais
  } else {
    digits = '55' + digits;
  }
  return `${digits}@wa.gw.msging.net`;
}

// -----------------------------------------------
// Formatar moeda BRL
// -----------------------------------------------
function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// -----------------------------------------------
// Formatar data BR
// -----------------------------------------------
function formatarData(data) {
  return new Date(data).toLocaleDateString('pt-BR');
}

// -----------------------------------------------
// Forma de pagamento label
// -----------------------------------------------
const FORMA_LABEL = {
  PIX: 'PIX',
  BOLETO: 'Boleto Bancário',
  CREDIT_CARD: 'Cartão de Crédito',
};

// -----------------------------------------------
// Enviar link de pagamento via template WhatsApp (usado no workflow de acordo).
// Mantido como wrapper sobre enviarTemplate para nao quebrar callers existentes.
// -----------------------------------------------
export async function enviarLinkPagamento({ telefone, nomeAluno, formaPagamento, dataVencimento, valor, paymentIdAsaas }) {
  const formaLabel = FORMA_LABEL[formaPagamento] || formaPagamento;
  const r = await enviarTemplate({
    telefone,
    templateNome: TEMPLATE_PAGAMENTO,
    parametros: [nomeAluno, formaLabel, formatarData(dataVencimento), formatarMoeda(valor)],
    botaoUrlParam: paymentIdAsaas,
  });
  console.log(`[Blip] Link de pagamento enviado (${formaLabel})`);
  return r.ok;
}
