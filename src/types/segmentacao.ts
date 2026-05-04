export type TipoCampo = 'numero' | 'moeda' | 'booleano' | 'lista' | 'data';
export type Operador = 'igual' | 'maior' | 'menor' | 'entre' | 'sim' | 'nao' | 'em' | 'nao_em';
export type TipoSegmentacao = 'ALUNO' | 'TITULO';

export interface CampoSegmentacao {
  id: string;
  label: string;
  categoria: string;
  tipo: TipoCampo;
  operadores: Operador[];
  opcoes?: string[];
  escopos: TipoSegmentacao[];  // em quais tipos de regra o campo é válido
}

export interface Condicao {
  campo: string;
  operador: Operador;
  valor: string | number | boolean | string[];
  valor2?: string | number;
}

export type EscopoUsoSegmentacao = 'GLOBAL' | 'EMBUTIDA_REGUA';

export interface RegraSegmentacao {
  id: string;
  nome: string;
  descricao?: string | null;
  tipo: TipoSegmentacao;
  condicoes: Condicao[];
  ativa: boolean;
  escopoUso: EscopoUsoSegmentacao;
  reguaOwnerId?: string | null;
  reguaOwner?: { id: string; nome: string } | null;
  criadoPor: number;
  criadoPorNome?: string | null;
  criadoEm: string;
  atualizadoEm: string;
  ultimaExecucao?: string | null;
  totalAlunos?: number | null;
  totalTitulos?: number | null;
  valorInadimplente?: number | null;
}

const AMBOS: TipoSegmentacao[] = ['ALUNO', 'TITULO'];
const SO_ALUNO: TipoSegmentacao[] = ['ALUNO'];
const SO_TITULO: TipoSegmentacao[] = ['TITULO'];

export const CAMPOS_SEGMENTACAO: CampoSegmentacao[] = [
  // Financeiro agregado — só ALUNO
  { id: 'parcelas_atraso', label: 'Parcelas em atraso', categoria: 'Financeiro', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'], escopos: SO_ALUNO },
  { id: 'valor_inadimplente', label: 'Valor inadimplente', categoria: 'Financeiro', tipo: 'moeda', operadores: ['igual', 'maior', 'menor', 'entre'], escopos: SO_ALUNO },
  { id: 'dias_atraso', label: 'Dias de atraso', categoria: 'Financeiro', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'], escopos: SO_ALUNO },
  { id: 'parcelas_pagas', label: 'Parcelas pagas', categoria: 'Financeiro', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'], escopos: SO_ALUNO },
  { id: 'parcelas_a_vencer', label: 'Parcelas a vencer', categoria: 'Financeiro', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'], escopos: SO_ALUNO },
  { id: 'valor_pago', label: 'Total pago', categoria: 'Financeiro', tipo: 'moeda', operadores: ['igual', 'maior', 'menor', 'entre'], escopos: SO_ALUNO },

  // Situacao
  { id: 'situacao_aluno', label: 'Situacao do aluno', categoria: 'Situacao', tipo: 'lista', operadores: ['em', 'nao_em'], opcoes: ['ATIVO', 'TRANCADO', 'CANCELADO'], escopos: AMBOS },
  { id: 'situacao_financeira', label: 'Situacao financeira', categoria: 'Situacao', tipo: 'lista', operadores: ['em', 'nao_em'], opcoes: ['ADIMPLENTE', 'INADIMPLENTE'], escopos: SO_ALUNO },
  { id: 'ja_trancou', label: 'Ja trancou alguma vez', categoria: 'Situacao', tipo: 'booleano', operadores: ['sim', 'nao'], escopos: AMBOS },

  // Academico
  { id: 'turma', label: 'Turma', categoria: 'Academico', tipo: 'lista', operadores: ['em', 'nao_em'], opcoes: [], escopos: AMBOS },
  { id: 'frequencia', label: 'Frequencia (%)', categoria: 'Academico', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'], escopos: AMBOS },
  { id: 'aulas_assistidas', label: 'Aulas assistidas', categoria: 'Academico', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'], escopos: AMBOS },
  { id: 'dias_ultima_aula', label: 'Dias desde ultima aula', categoria: 'Academico', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'], escopos: AMBOS },

  // Recorrencia
  { id: 'recorrencia_ativa', label: 'Recorrencia ativa', categoria: 'Recorrencia', tipo: 'booleano', operadores: ['sim', 'nao'], escopos: AMBOS },
  { id: 'qtd_cadastros_recorrencia', label: 'Cadastros de recorrencia', categoria: 'Recorrencia', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'], escopos: AMBOS },

  // Serasa
  { id: 'negativado', label: 'Negativado Serasa', categoria: 'Serasa', tipo: 'booleano', operadores: ['sim', 'nao'], escopos: AMBOS },

  // Comunicacao
  { id: 'tem_conversa_whatsapp', label: 'Tem conversa WhatsApp', categoria: 'Comunicacao', tipo: 'booleano', operadores: ['sim', 'nao'], escopos: AMBOS },
  { id: 'tem_ligacao', label: 'Tem ligacao registrada', categoria: 'Comunicacao', tipo: 'booleano', operadores: ['sim', 'nao'], escopos: AMBOS },
  { id: 'total_tickets_blip', label: 'Total tickets Blip', categoria: 'Comunicacao', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'], escopos: AMBOS },
  { id: 'tickets_financeiro', label: 'Tickets financeiros', categoria: 'Comunicacao', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'], escopos: AMBOS },

  // Plantoes
  { id: 'total_plantoes', label: 'Total plantoes', categoria: 'Plantoes', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'], escopos: AMBOS },
  { id: 'plantoes_realizados', label: 'Plantoes realizados', categoria: 'Plantoes', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'], escopos: AMBOS },

  // Datas agregadas (só ALUNO)
  { id: 'data_vencimento', label: 'Próximo vencimento', categoria: 'Financeiro', tipo: 'data', operadores: ['igual', 'maior', 'menor', 'entre'], escopos: SO_ALUNO },
  { id: 'data_vencimento_mais_antiga', label: 'Vencimento mais antigo', categoria: 'Financeiro', tipo: 'data', operadores: ['igual', 'maior', 'menor', 'entre'], escopos: SO_ALUNO },

  // Flags
  { id: 'nao_enviar_cobranca', label: 'Nao enviar cobranca', categoria: 'Flags', tipo: 'booleano', operadores: ['sim', 'nao'], escopos: AMBOS },
  { id: 'bloquear_contato', label: 'Bloquear contato CRM', categoria: 'Flags', tipo: 'booleano', operadores: ['sim', 'nao'], escopos: AMBOS },
  { id: 'pausa_ligacao_ativa', label: 'Pausa de ligacao ativa', categoria: 'Flags', tipo: 'booleano', operadores: ['sim', 'nao'], escopos: AMBOS },
  { id: 'assinou_contrato', label: 'Assinou contrato', categoria: 'Flags', tipo: 'booleano', operadores: ['sim', 'nao'], escopos: AMBOS },

  // Identificacao
  { id: 'codigo_pessoa', label: 'Codigo do aluno', categoria: 'Identificacao', tipo: 'numero', operadores: ['igual', 'em', 'nao_em'], escopos: AMBOS },
  { id: 'cpf_pessoa', label: 'CPF (so digitos)', categoria: 'Identificacao', tipo: 'lista', operadores: ['igual', 'em'], opcoes: [], escopos: AMBOS },

  // TITULO — exclusivos
  { id: 'titulo_situacao', label: 'Situação do título', categoria: 'Título', tipo: 'lista', operadores: ['em', 'nao_em'], opcoes: ['AR', 'RE', 'NE', 'CF'], escopos: SO_TITULO },
  { id: 'titulo_tipo_origem', label: 'Tipo de origem', categoria: 'Título', tipo: 'lista', operadores: ['em', 'nao_em'], opcoes: ['MEN', 'MAT', 'NCR', 'REQ', 'OUT'], escopos: SO_TITULO },
  { id: 'titulo_valor', label: 'Valor do título', categoria: 'Título', tipo: 'moeda', operadores: ['igual', 'maior', 'menor', 'entre'], escopos: SO_TITULO },
  { id: 'titulo_dias_ate_vencimento', label: 'Dias até o vencimento', categoria: 'Título', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'], escopos: SO_TITULO },
  { id: 'titulo_dias_apos_vencimento', label: 'Dias após vencimento', categoria: 'Título', tipo: 'numero', operadores: ['igual', 'maior', 'menor', 'entre'], escopos: SO_TITULO },
  { id: 'titulo_data_vencimento', label: 'Data de vencimento', categoria: 'Título', tipo: 'data', operadores: ['igual', 'maior', 'menor', 'entre'], escopos: SO_TITULO },
  { id: 'titulo_data_recebimento', label: 'Data de recebimento', categoria: 'Título', tipo: 'data', operadores: ['igual', 'maior', 'menor', 'entre'], escopos: SO_TITULO },
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

export function camposPorCategoria(tipo?: TipoSegmentacao): Record<string, CampoSegmentacao[]> {
  const base = tipo ? CAMPOS_SEGMENTACAO.filter(c => c.escopos.includes(tipo)) : CAMPOS_SEGMENTACAO;
  return base.reduce<Record<string, CampoSegmentacao[]>>((acc, campo) => {
    if (!acc[campo.categoria]) acc[campo.categoria] = [];
    acc[campo.categoria].push(campo);
    return acc;
  }, {});
}
