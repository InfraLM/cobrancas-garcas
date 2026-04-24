export type MotivoPausa = 'EM_NEGOCIACAO' | 'CLIENTE_SOLICITOU' | 'AGENTE_DECISAO' | 'OUTRO';
export type OrigemPausa = 'SISTEMA' | 'AGENTE';

export interface PausaLigacao {
  id: string;
  pessoaCodigo: number;
  pessoaNome?: string | null;
  motivo: MotivoPausa;
  observacao?: string | null;
  origem: OrigemPausa;
  acordoId?: string | null;
  pausadoPor: number;
  pausadoPorNome?: string | null;
  pausadoEm: string;
  pausaAte?: string | null;
  removidoEm?: string | null;
  removidoPor?: number | null;
  removidoPorNome?: string | null;
  motivoRemocao?: string | null;
}

// Forma "resumida" embutida em aluno/segmentacao/preview
export interface PausaAtivaResumo {
  id: string;
  motivo: MotivoPausa;
  observacao?: string | null;
  origem: OrigemPausa;
  acordoId?: string | null;
  pausaAte?: string | null;
  pausadoEm?: string | null;
  pausadoPorNome?: string | null;
}

export const motivoPausaLabel: Record<MotivoPausa, string> = {
  EM_NEGOCIACAO: 'Em negociação',
  CLIENTE_SOLICITOU: 'Cliente solicitou',
  AGENTE_DECISAO: 'Decisão do agente',
  OUTRO: 'Outro',
};

export const MOTIVOS_PAUSA_SELECIONAVEIS: MotivoPausa[] = [
  'CLIENTE_SOLICITOU',
  'AGENTE_DECISAO',
  'OUTRO',
];
