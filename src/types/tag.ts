// Catalogo de tags qualitativas. Tag eh editavel exceto pelo `codigo` (imutavel).
export interface Tag {
  id: string;
  categoria: string;
  codigo: string;
  label: string;
  descricao?: string | null;
  cor?: string | null;
  ordem: number;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
  // Campos extras quando listado com ?incluirUso=true
  qtdAplicadaAtiva?: number;
  qtdHistorico?: number;
}

// Atribuicao de uma tag a um aluno (1:N).
export interface AlunoTag {
  id: string;
  pessoaCodigo: number;
  tagId: string;
  observacao?: string | null;
  origemConversaId?: string | null;
  origemAcordoId?: string | null;
  criadoPor: number;
  criadoPorNome?: string | null;
  criadoEm: string;
  removidoEm?: string | null;
  removidoPor?: number | null;
  removidoPorNome?: string | null;
  tag: Tag;
}

// Mapeamento cor → classes Tailwind. Usado pelos chips.
export const TAG_COR_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
  amber:  { bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-200' },
  blue:   { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-200' },
  gray:   { bg: 'bg-gray-100',   text: 'text-gray-700',   border: 'border-gray-200' },
  red:    { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-200' },
  green:  { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-200' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
  pink:   { bg: 'bg-pink-100',   text: 'text-pink-800',   border: 'border-pink-200' },
  teal:   { bg: 'bg-teal-100',   text: 'text-teal-800',   border: 'border-teal-200' },
};

export const TAG_COR_DEFAULT = TAG_COR_CLASSES.gray;

// Labels amigaveis para categorias conhecidas. Categorias novas usam o codigo.
export const CATEGORIA_LABELS: Record<string, string> = {
  FINANCEIRO: 'Financeiro',
  MATRICULA_INTENCAO: 'Matrícula / Intenção',
  QUALIDADE_CONTATO: 'Qualidade do contato',
  JURIDICO: 'Jurídico',
};

export function rotuloCategoria(categoria: string): string {
  return CATEGORIA_LABELS[categoria] || categoria;
}
