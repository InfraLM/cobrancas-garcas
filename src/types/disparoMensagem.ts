export type StatusDisparo = 'PENDENTE' | 'ENVIADO' | 'FALHOU' | 'CANCELADO';
export type OrigemDisparo = 'REGUA_AUTO' | 'DISPARO_MANUAL';

export interface DisparoMensagem {
  id: string;
  reguaId?: string | null;
  etapaReguaId?: string | null;
  templateBlipId: string;
  templateNomeBlip: string;
  pessoaCodigo: number;
  pessoaNome: string;
  contaReceberCodigo?: number | null;
  telefone: string;
  parametros: Record<string, string>;
  status: StatusDisparo;
  tentativas: number;
  blipMessageId?: string | null;
  erroMensagem?: string | null;
  origem: OrigemDisparo;
  criadoEm: string;
  disparadoEm?: string | null;
  convertido: boolean;
  convertidoEm?: string | null;
  diasAteConversao?: number | null;
}

export const STATUS_DISPARO_LABEL: Record<StatusDisparo, string> = {
  PENDENTE: 'Pendente',
  ENVIADO: 'Enviado',
  FALHOU: 'Falhou',
  CANCELADO: 'Cancelado',
};

export const STATUS_DISPARO_COR: Record<StatusDisparo, string> = {
  PENDENTE: 'bg-gray-100 text-gray-600',
  ENVIADO: 'bg-emerald-50 text-emerald-700',
  FALHOU: 'bg-red-50 text-red-700',
  CANCELADO: 'bg-stone-50 text-stone-600',
};
