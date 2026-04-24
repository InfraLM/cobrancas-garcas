export type TipoCampo = 'numero' | 'moeda' | 'booleano' | 'lista' | 'data';
export type Operador = 'igual' | 'maior' | 'menor' | 'entre' | 'sim' | 'nao' | 'em' | 'nao_em';

export interface CampoSegmentacao {
  id: string;
  label: string;
  categoria: string;
  tipo: TipoCampo;
  operadores: Operador[];
  opcoes?: string[];
}

export interface Condicao {
  campo: string;
  operador: Operador;
  valor: string | number | boolean | string[];
  valor2?: string | number;
}

export interface RegraSegmentacao {
  id: string;
  nome: string;
  descricao?: string | null;
  condicoes: Condicao[];
  ativa: boolean;
  criadoPor: number;
  criadoPorNome?: string | null;
  criadoEm: string;
  atualizadoEm: string;
  ultimaExecucao?: string | null;
  totalAlunos?: number | null;
  valorInadimplente?: number | null;
}

export const CAMPOS_SEGMENTACAO: CampoSegmentacao[] = [
  // Financeiro
  { id: 'parcelas_atraso', label: 'Parcelas em atraso', categoria: 'Financeiro', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'] },
  { id: 'valor_inadimplente', label: 'Valor inadimplente', categoria: 'Financeiro', tipo: 'moeda', operadores: ['igual', 'maior', 'menor', 'entre'] },
  { id: 'dias_atraso', label: 'Dias de atraso', categoria: 'Financeiro', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'] },
  { id: 'parcelas_pagas', label: 'Parcelas pagas', categoria: 'Financeiro', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'] },
  { id: 'parcelas_a_vencer', label: 'Parcelas a vencer', categoria: 'Financeiro', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'] },
  { id: 'valor_pago', label: 'Total pago', categoria: 'Financeiro', tipo: 'moeda', operadores: ['igual', 'maior', 'menor', 'entre'] },

  // Situacao
  { id: 'situacao_aluno', label: 'Situacao do aluno', categoria: 'Situacao', tipo: 'lista', operadores: ['em', 'nao_em'], opcoes: ['ATIVO', 'TRANCADO', 'CANCELADO'] },
  { id: 'situacao_financeira', label: 'Situacao financeira', categoria: 'Situacao', tipo: 'lista', operadores: ['em', 'nao_em'], opcoes: ['ADIMPLENTE', 'INADIMPLENTE'] },
  { id: 'ja_trancou', label: 'Ja trancou alguma vez', categoria: 'Situacao', tipo: 'booleano', operadores: ['sim', 'nao'] },

  // Academico
  { id: 'turma', label: 'Turma', categoria: 'Academico', tipo: 'lista', operadores: ['em', 'nao_em'], opcoes: [] },
  { id: 'frequencia', label: 'Frequencia (%)', categoria: 'Academico', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'] },
  { id: 'aulas_assistidas', label: 'Aulas assistidas', categoria: 'Academico', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'] },
  { id: 'dias_ultima_aula', label: 'Dias desde ultima aula', categoria: 'Academico', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'] },

  // Recorrencia
  { id: 'recorrencia_ativa', label: 'Recorrencia ativa', categoria: 'Recorrencia', tipo: 'booleano', operadores: ['sim', 'nao'] },
  { id: 'qtd_cadastros_recorrencia', label: 'Cadastros de recorrencia', categoria: 'Recorrencia', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'] },

  // Serasa
  { id: 'negativado', label: 'Negativado Serasa', categoria: 'Serasa', tipo: 'booleano', operadores: ['sim', 'nao'] },

  // Comunicacao
  { id: 'tem_conversa_whatsapp', label: 'Tem conversa WhatsApp', categoria: 'Comunicacao', tipo: 'booleano', operadores: ['sim', 'nao'] },
  { id: 'tem_ligacao', label: 'Tem ligacao registrada', categoria: 'Comunicacao', tipo: 'booleano', operadores: ['sim', 'nao'] },
  { id: 'total_tickets_blip', label: 'Total tickets Blip', categoria: 'Comunicacao', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'] },
  { id: 'tickets_financeiro', label: 'Tickets financeiros', categoria: 'Comunicacao', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'] },

  // Plantoes
  { id: 'total_plantoes', label: 'Total plantoes', categoria: 'Plantoes', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'] },
  { id: 'plantoes_realizados', label: 'Plantoes realizados', categoria: 'Plantoes', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'] },

  // Datas
  { id: 'data_vencimento', label: 'Próximo vencimento', categoria: 'Financeiro', tipo: 'data', operadores: ['igual', 'maior', 'menor', 'entre'] },
  { id: 'data_vencimento_mais_antiga', label: 'Vencimento mais antigo', categoria: 'Financeiro', tipo: 'data', operadores: ['igual', 'maior', 'menor', 'entre'] },

  // Flags
  { id: 'nao_enviar_cobranca', label: 'Nao enviar cobranca', categoria: 'Flags', tipo: 'booleano', operadores: ['sim', 'nao'] },
  { id: 'bloquear_contato', label: 'Bloquear contato CRM', categoria: 'Flags', tipo: 'booleano', operadores: ['sim', 'nao'] },

  // Pausa de ligacoes (CRM)
  { id: 'pausa_ligacao_ativa', label: 'Pausa de ligacao ativa', categoria: 'Flags', tipo: 'booleano', operadores: ['sim', 'nao'] },
];

export const OPERADOR_LABELS: Record<Operador, string> = {
  igual: 'Igual a',
  maior: 'Maior que',
  menor: 'Menor que',
  entre: 'Entre',
  sim: 'Sim',
  nao: 'Nao',
  em: 'Em',
  nao_em: 'Nao em',
};

export function camposPorCategoria(): Record<string, CampoSegmentacao[]> {
  return CAMPOS_SEGMENTACAO.reduce<Record<string, CampoSegmentacao[]>>((acc, campo) => {
    if (!acc[campo.categoria]) acc[campo.categoria] = [];
    acc[campo.categoria].push(campo);
    return acc;
  }, {});
}
