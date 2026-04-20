export type EtapaAcordo =
  | 'SELECAO'
  | 'TERMO_ENVIADO'
  | 'ACORDO_GERADO'
  | 'SEI_VINCULADO'
  | 'CHECANDO_PAGAMENTO'
  | 'CONCLUIDO'
  | 'CANCELADO'
  | 'INADIMPLENTE';

export type SituacaoPagamento = 'PENDENTE' | 'CONFIRMADO' | 'VENCIDO' | 'CANCELADO';
export type SituacaoDocumento = 'RASCUNHO' | 'ENVIADO' | 'ASSINADO' | 'RECUSADO' | 'EXPIRADO';
export type FormaPagamento = 'BOLETO' | 'PIX' | 'CREDIT_CARD';

// ============================================================
// ACORDO → PAGAMENTOS → PARCELAS (se cartão parcelado)
//
// Negociação R$ 10.000:
//   Pagamento 1: R$ 5.000 — PIX à vista
//   Pagamento 2: R$ 5.000 — Cartão 6x
//     └── 6 parcelas de R$ 833,33
// ============================================================

export interface AcordoFinanceiro {
  id: string;
  pessoaCodigo: number;
  pessoaNome: string;
  pessoaCpf: string;
  matricula?: string;
  turmaIdentificador?: string;
  cursoNome?: string;

  etapa: EtapaAcordo;

  // Valores financeiros
  valorOriginal: number;
  valorMultaJuros: number;
  valorDescontos: number;
  valorRecebidoPrevio: number;
  valorSaldoDevedor: number;
  descontoAcordo: number;
  descontoAcordoPercentual?: number;
  valorAcordo: number;

  // Integrações externas
  asaasCustomerId?: string;
  clicksignEnvelopeId?: string;
  negociacaoContaReceberCodigo?: number;

  // Controle
  criadoPor: string;
  criadoPorNome: string;
  observacao?: string;
  motivoCancelamento?: string;

  // Timestamps
  criadoEm: string;
  acordoGeradoEm?: string;
  termoEnviadoEm?: string;
  termoAssinadoEm?: string;
  seiVinculadoEm?: string;
  canceladoEm?: string;

  // Relações
  parcelasOriginais: ParcelaOriginal[];
  pagamentos: PagamentoAcordo[];
  documento?: DocumentoAcordo;
}

export interface ParcelaOriginal {
  id: string;
  contaReceberCodigo: number;
  valor: number;
  multa: number;
  juro: number;
  descontos: number;
  valorRecebido: number;
  saldoDevedor: number;
  dataVencimento: string;
  tipoOrigem: string;
}

// Cada "pagamento" é uma cobrança independente no Asaas
export interface PagamentoAcordo {
  id: string;
  numeroPagamento: number;        // 1, 2, 3...
  valor: number;                   // Valor total deste pagamento
  formaPagamento: FormaPagamento;
  dataVencimento: string;
  parcelas: number;                // 1 = à vista, 2+ = parcelado (cartão)
  descricao?: string;

  // Status
  situacao: SituacaoPagamento;

  // Asaas
  asaasPaymentId?: string;
  asaasInstallmentId?: string;     // ID do parcelamento no Asaas (se cartão parcelado)
  asaasInvoiceUrl?: string;
  asaasPixQrCode?: string;
  asaasBankSlipUrl?: string;

  // Confirmação
  dataPagamento?: string;
  valorPago?: number;
  valorLiquido?: number;           // netValue do Asaas
  taxaAsaas?: number;              // value - netValue
}

export interface DocumentoAcordo {
  id: string;
  tipo: string;
  situacao: SituacaoDocumento;
  urlOriginal?: string;
  urlAssinado?: string;
  enviadoEm?: string;
  assinadoEm?: string;
}

// Labels
export const etapaLabel: Record<EtapaAcordo, string> = {
  SELECAO: 'Seleção',
  TERMO_ENVIADO: 'Termo Enviado',
  ACORDO_GERADO: 'Cobrança Criada',
  SEI_VINCULADO: 'Vincular SEI',
  CHECANDO_PAGAMENTO: 'Checando Pagamento',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
  INADIMPLENTE: 'Inadimplente',
};

export const etapaCor: Record<EtapaAcordo, { bg: string; text: string; badge: string }> = {
  SELECAO:             { bg: 'bg-sky-50',     text: 'text-sky-700',     badge: 'bg-sky-100 text-sky-700' },
  TERMO_ENVIADO:       { bg: 'bg-violet-50',  text: 'text-violet-700',  badge: 'bg-violet-100 text-violet-700' },
  ACORDO_GERADO:       { bg: 'bg-amber-50',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700' },
  SEI_VINCULADO:       { bg: 'bg-indigo-50',  text: 'text-indigo-700',  badge: 'bg-indigo-100 text-indigo-700' },
  CHECANDO_PAGAMENTO:  { bg: 'bg-orange-50',  text: 'text-orange-700',  badge: 'bg-orange-100 text-orange-700' },
  CONCLUIDO:           { bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  CANCELADO:           { bg: 'bg-stone-50',   text: 'text-stone-500',   badge: 'bg-stone-100 text-stone-500' },
  INADIMPLENTE:        { bg: 'bg-red-50',     text: 'text-red-700',     badge: 'bg-red-100 text-red-700' },
};

export const formaPagamentoLabel: Record<FormaPagamento, string> = {
  PIX: 'PIX',
  BOLETO: 'Boleto',
  CREDIT_CARD: 'Cartão de Crédito',
};

export const situacaoPagamentoLabel: Record<SituacaoPagamento, string> = {
  PENDENTE: 'Pendente',
  CONFIRMADO: 'Pago',
  VENCIDO: 'Vencido',
  CANCELADO: 'Cancelado',
};

export const ETAPAS_KANBAN: EtapaAcordo[] = [
  'SELECAO',
  'TERMO_ENVIADO',
  'ACORDO_GERADO',
  'SEI_VINCULADO',
  'CHECANDO_PAGAMENTO',
  'CONCLUIDO',
];
