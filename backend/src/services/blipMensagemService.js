// Blip Roteador — Envio de mensagens ativas (templates WhatsApp)
// DIFERENTE do chatbot (BLIP_API_URL) — este usa o roteador (BLIP_ROUTER_URL)

import { randomUUID } from 'crypto';

const BLIP_ROUTER_URL = process.env.BLIP_ROUTER_URL;
const BLIP_ROUTER_KEY = process.env.BLIP_ROUTER_KEY;
const TEMPLATE_PAGAMENTO = process.env.BLIP_TEMPLATE_PAGAMENTO || 'cobranca_link_de_pagamento_asaas';

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
// Enviar link de pagamento via template WhatsApp
// -----------------------------------------------
export async function enviarLinkPagamento({ telefone, nomeAluno, formaPagamento, dataVencimento, valor, paymentIdAsaas }) {
  if (!BLIP_ROUTER_URL || !BLIP_ROUTER_KEY) {
    throw new Error('BLIP_ROUTER_URL e BLIP_ROUTER_KEY nao configurados');
  }

  const to = formatarTelefoneBlip(telefone);
  const formaLabel = FORMA_LABEL[formaPagamento] || formaPagamento;

  const payload = {
    id: randomUUID(),
    to,
    type: 'application/json',
    content: {
      type: 'template',
      template: {
        name: TEMPLATE_PAGAMENTO,
        language: {
          code: 'pt_BR',
          policy: 'deterministic',
        },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: nomeAluno },
              { type: 'text', text: formaLabel },
              { type: 'text', text: formatarData(dataVencimento) },
              { type: 'text', text: formatarMoeda(valor) },
            ],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: 0,
            parameters: [
              { type: 'text', text: paymentIdAsaas },
            ],
          },
        ],
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
    throw new Error(`Blip POST /messages — HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  console.log(`[Blip] Link de pagamento enviado para ${to} (${formaLabel})`);
  return true;
}
