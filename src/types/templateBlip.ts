export type CategoriaBlip = 'PRE_VENCIMENTO' | 'POS_VENCIMENTO' | 'OUTRO';

export type FonteVariavel =
  | 'NOME_ALUNO'
  | 'PRIMEIRO_NOME'
  | 'VALOR_PARCELA'
  | 'DATA_VENCIMENTO'
  | 'DIAS_ATE_VENCIMENTO'
  | 'DIAS_ATE_VENCIMENTO_FRIENDLY'
  | 'DIAS_APOS_VENCIMENTO'
  | 'DIAS_APOS_VENCIMENTO_FRIENDLY'
  | 'LINK_PAGAMENTO_SEI';

export interface VariavelMap {
  indice: number;
  fonte: FonteVariavel;
}

export type EscopoTemplate = 'AMBOS' | 'TITULO';

export interface TemplateBlip {
  id: string;
  nomeBlip: string;
  titulo: string;
  descricao?: string | null;
  conteudoPreview: string;
  variaveis: VariavelMap[];
  categoria: CategoriaBlip;
  escopo: EscopoTemplate;
  ativo: boolean;
  criadoPor: number;
  criadoPorNome?: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface FonteDisponivel {
  fonte: FonteVariavel;
  descricao: string;
  exemplo: string;
}

export const CATEGORIAS_BLIP: CategoriaBlip[] = ['PRE_VENCIMENTO', 'POS_VENCIMENTO', 'OUTRO'];

export const CATEGORIA_BLIP_LABEL: Record<CategoriaBlip, string> = {
  PRE_VENCIMENTO: 'Pré-vencimento',
  POS_VENCIMENTO: 'Pós-vencimento',
  OUTRO: 'Outro',
};

export const CATEGORIA_BLIP_COR: Record<CategoriaBlip, { bg: string; text: string }> = {
  PRE_VENCIMENTO: { bg: 'bg-sky-50', text: 'text-sky-700' },
  POS_VENCIMENTO: { bg: 'bg-amber-50', text: 'text-amber-700' },
  OUTRO: { bg: 'bg-gray-50', text: 'text-gray-700' },
};
