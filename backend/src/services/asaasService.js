// Asaas API — Gateway de pagamentos
// Docs: https://docs.asaas.com

const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

async function asaasRequest(method, path, body) {
  const url = `${ASAAS_API_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const text = await res.text();

  if (!res.ok) {
    const detail = text.slice(0, 300);
    throw new Error(`Asaas ${method} ${path} — HTTP ${res.status}: ${detail}`);
  }

  return text ? JSON.parse(text) : null;
}

// -----------------------------------------------
// Criar ou buscar cliente por CPF
// -----------------------------------------------
export async function criarOuBuscarCliente({ cpf, nome, email, celular }) {
  const cpfLimpo = cpf.replace(/\D/g, '');

  // Buscar existente
  const busca = await asaasRequest('GET', `/customers?cpfCnpj=${cpfLimpo}`);
  if (busca.data && busca.data.length > 0) {
    return busca.data[0];
  }

  // Criar novo
  const telefoneLimpo = celular ? celular.replace(/\D/g, '') : undefined;
  return asaasRequest('POST', '/customers', {
    name: nome,
    cpfCnpj: cpfLimpo,
    email: email || undefined,
    mobilePhone: telefoneLimpo,
  });
}

// -----------------------------------------------
// Criar cobranca
// -----------------------------------------------
export async function criarCobranca(customerId, { valor, vencimento, tipo, descricao, externalReference, parcelas }) {
  const payload = {
    customer: customerId,
    billingType: tipo, // PIX, BOLETO, CREDIT_CARD
    value: valor,
    dueDate: vencimento, // YYYY-MM-DD
    description: descricao || 'Negociacao Liberdade Medica',
    externalReference: externalReference || undefined,
  };

  // Cartao parcelado: usar installmentCount + totalValue
  if (tipo === 'CREDIT_CARD' && parcelas > 1) {
    payload.installmentCount = parcelas;
    payload.totalValue = valor;
    delete payload.value; // totalValue substitui value
  }

  return asaasRequest('POST', '/payments', payload);
}

// -----------------------------------------------
// Obter QR Code PIX
// -----------------------------------------------
export async function obterPixQrCode(paymentId) {
  try {
    const data = await asaasRequest('GET', `/payments/${paymentId}/pixQrCode`);
    return data;
  } catch {
    return null;
  }
}

// -----------------------------------------------
// Obter linha digitavel (boleto)
// -----------------------------------------------
export async function obterLinhaDigitavel(paymentId) {
  try {
    const data = await asaasRequest('GET', `/payments/${paymentId}/identificationField`);
    return data;
  } catch {
    return null;
  }
}

// -----------------------------------------------
// Cancelar/excluir cobranca
// -----------------------------------------------
// Asaas permite DELETE em cobrancas que ainda nao foram pagas.
// Para cobrancas ja processadas, deve-se usar refund (nao implementado aqui).
export async function cancelarCobranca(paymentId) {
  return asaasRequest('DELETE', `/payments/${paymentId}`);
}

// -----------------------------------------------
// Listar todas as parcelas (payments) de um installment.
// Usado quando o cartao parcelado e capturado: precisamos do netValue real
// de TODAS as parcelas de uma vez (Asaas so envia webhook de cada parcela
// quando ela confirma mes a mes). Cada payment tem seu proprio value e
// netValue.
// -----------------------------------------------
export async function listarPagamentosDoInstallment(installmentId) {
  // Asaas paginates installment payments — limit 100 cobre o maximo de 21x.
  const r = await asaasRequest('GET', `/installments/${installmentId}/payments?limit=100`);
  return r?.data || [];
}
