// Templates Meta WABA — gestao + envio de mensagens fora da janela 24h.

export type TemplateMetaCategoria = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

export type TemplateMetaStatus =
  | 'DRAFT'        // local, ainda nao submetido
  | 'PENDING'      // submetido, aguardando review Meta
  | 'APPROVED'     // pronto pra usar
  | 'REJECTED'     // recusado, ver rejectReason
  | 'PAUSED'       // quality rating caiu
  | 'DISABLED'     // permanente (3 pausas)
  | 'IN_APPEAL';   // contestou rejeicao

export type TemplateMetaQuality = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export type ComponenteTipo = 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
export type HeaderFormato = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
export type BotaoTipo = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE';

export interface ComponenteHeader {
  type: 'HEADER';
  format: HeaderFormato;
  text?: string;
  example?: {
    header_text?: string[];
    header_handle?: string[];
  };
}

export interface ComponenteBody {
  type: 'BODY';
  text: string;
  example?: {
    body_text?: string[][];
  };
}

export interface ComponenteFooter {
  type: 'FOOTER';
  text: string;
}

export interface BotaoQuickReply {
  type: 'QUICK_REPLY';
  text: string;
}
export interface BotaoUrl {
  type: 'URL';
  text: string;
  url: string;
  example?: string[];
}
export interface BotaoPhone {
  type: 'PHONE_NUMBER';
  text: string;
  phone_number: string;
}
export interface BotaoCopyCode {
  type: 'COPY_CODE';
  text: string;
  example?: string;
}
export type Botao = BotaoQuickReply | BotaoUrl | BotaoPhone | BotaoCopyCode;

export interface ComponenteButtons {
  type: 'BUTTONS';
  buttons: Botao[];
}

export type Componente = ComponenteHeader | ComponenteBody | ComponenteFooter | ComponenteButtons;

// Mapeamento variavel -> fonte do CRM (usado pra resolver na hora de enviar)
export interface VariavelMap {
  indice: number;
  fonte: string;          // ex: 'NOME_ALUNO', 'VALOR_PARCELA' ou 'CUSTOM' (input livre)
  rotuloCustom?: string;  // se fonte === 'CUSTOM', label amigavel
}

export interface VariaveisMap {
  body?: VariavelMap[];
  header?: VariavelMap[];
  buttons?: Record<number, VariavelMap[]>; // index do botao -> vars
}

export interface TemplateMeta {
  id: string;
  metaTemplateId: string | null;
  metaWabaId: string;
  name: string;
  language: string;
  category: TemplateMetaCategoria;
  status: TemplateMetaStatus;
  rejectReason: string | null;
  qualityRating: TemplateMetaQuality | null;
  components: Componente[];
  variaveisMap: VariaveisMap | null;
  ativo: boolean;
  criadoPor: number;
  criadoPorNome: string | null;
  criadoEm: string;
  atualizadoEm: string;
  submetidoEm: string | null;
  aprovadoEm: string | null;
}

// ─── Helpers visuais ─────────────────────────────────────────

export const CATEGORIA_META_LABELS: Record<TemplateMetaCategoria, string> = {
  MARKETING: 'Marketing',
  UTILITY: 'Utility (transacional)',
  AUTHENTICATION: 'Autenticação',
};

export const CATEGORIA_META_DESCRICAO: Record<TemplateMetaCategoria, string> = {
  MARKETING: 'Promoções, novidades, campanhas. Custo mais alto. Meta é mais rigorosa na aprovação.',
  UTILITY: 'Cobrança, lembretes, status, confirmações. Recomendado para o nosso caso. Custo baixo.',
  AUTHENTICATION: 'Códigos OTP, 2FA. Texto restrito a "seu código é {{1}}" — pouca flexibilidade.',
};

export const STATUS_META_LABELS: Record<TemplateMetaStatus, string> = {
  DRAFT: 'Rascunho',
  PENDING: 'Em revisão',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  PAUSED: 'Pausado',
  DISABLED: 'Desativado',
  IN_APPEAL: 'Em contestação',
};

export const STATUS_META_CLASSES: Record<TemplateMetaStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  APPROVED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  REJECTED: 'bg-red-100 text-red-800 border-red-200',
  PAUSED: 'bg-orange-100 text-orange-800 border-orange-200',
  DISABLED: 'bg-zinc-200 text-zinc-700 border-zinc-300',
  IN_APPEAL: 'bg-blue-100 text-blue-700 border-blue-200',
};

export const QUALITY_META_LABELS: Record<TemplateMetaQuality, string> = {
  HIGH: 'Alta',
  MEDIUM: 'Média',
  LOW: 'Baixa',
  UNKNOWN: 'Sem dados',
};

export const QUALITY_META_CLASSES: Record<TemplateMetaQuality, string> = {
  HIGH: 'bg-emerald-50 text-emerald-700',
  MEDIUM: 'bg-amber-50 text-amber-700',
  LOW: 'bg-red-50 text-red-700',
  UNKNOWN: 'bg-gray-50 text-gray-600',
};
