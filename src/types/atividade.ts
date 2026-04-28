export type TipoAtividade = 'LEMBRETE_MENSAGEM' | 'LEMBRETE_LIGACAO';
export type StatusAtividade = 'PENDENTE' | 'CONCLUIDA' | 'CANCELADA';
export type OrigemAtividade = 'MANUAL' | 'DURANTE_LIGACAO' | 'DURANTE_CONVERSA';

export interface Atividade {
  id: string;
  tipo: TipoAtividade;
  titulo: string;
  descricao?: string | null;
  status: StatusAtividade;
  dataHora: string;
  agenteId: number;
  agenteNome: string;
  pessoaCodigo?: number | null;
  pessoaNome?: string | null;
  telefone?: string | null;
  origem: OrigemAtividade;
  origemRefId?: string | null;
  metadados?: Record<string, unknown> | null;
  criadoEm: string;
  atualizadoEm: string;
  concluidoEm?: string | null;
}

export const TIPO_ATIVIDADE_LABEL: Record<TipoAtividade, string> = {
  LEMBRETE_MENSAGEM: 'Lembrete: WhatsApp',
  LEMBRETE_LIGACAO: 'Lembrete: Ligação',
};

export const TIPO_ATIVIDADE_COR: Record<TipoAtividade, string> = {
  LEMBRETE_MENSAGEM: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  LEMBRETE_LIGACAO: 'bg-sky-50 text-sky-700 border-sky-200',
};
