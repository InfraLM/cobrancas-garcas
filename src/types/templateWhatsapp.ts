export type CategoriaTemplate = 'cobranca' | 'saudacao' | 'encerramento' | 'follow_up' | 'outros';

export const CATEGORIAS_TEMPLATE: CategoriaTemplate[] = [
  'cobranca',
  'saudacao',
  'encerramento',
  'follow_up',
  'outros',
];

export const CATEGORIA_LABELS: Record<CategoriaTemplate, string> = {
  cobranca: 'Cobrança',
  saudacao: 'Saudação',
  encerramento: 'Encerramento',
  follow_up: 'Follow-up',
  outros: 'Outros',
};

export const CATEGORIA_CORES: Record<CategoriaTemplate, string> = {
  cobranca: 'bg-red-100 text-red-700 border-red-200',
  saudacao: 'bg-blue-100 text-blue-700 border-blue-200',
  encerramento: 'bg-gray-100 text-gray-700 border-gray-200',
  follow_up: 'bg-amber-100 text-amber-700 border-amber-200',
  outros: 'bg-purple-100 text-purple-700 border-purple-200',
};

export interface TemplateWhatsapp {
  id: number;
  nome: string;
  categoria: CategoriaTemplate;
  conteudo: string;
  icone: string | null;
  ativo: boolean;
  criadoPor: number;
  criadoPorNome: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NovoTemplateWhatsapp {
  nome: string;
  categoria: CategoriaTemplate;
  conteudo: string;
  icone?: string | null;
}

export interface VariavelTemplate {
  nome: string;
  descricao: string;
  exemplo: string;
}

export const VARIAVEIS_DISPONIVEIS: VariavelTemplate[] = [
  { nome: 'nome', descricao: 'Nome completo do aluno', exemplo: 'ABDIAS PEREIRA' },
  { nome: 'primeiroNome', descricao: 'Primeiro nome (capitalizado)', exemplo: 'Abdias' },
  { nome: 'cpf', descricao: 'CPF do aluno', exemplo: '123.456.789-00' },
  { nome: 'matricula', descricao: 'Matricula do aluno', exemplo: '2024/1234' },
  { nome: 'celular', descricao: 'Celular do aluno', exemplo: '(11) 98765-4321' },
  { nome: 'cursoNome', descricao: 'Nome do curso', exemplo: 'Medicina' },
  { nome: 'turma', descricao: 'Identificador da turma', exemplo: '2024/1' },
  { nome: 'valorDivida', descricao: 'Valor total em atraso (BRL)', exemplo: 'R$ 1.234,56' },
  { nome: 'parcelasAtraso', descricao: 'Quantidade de parcelas em atraso', exemplo: '3' },
  { nome: 'diasAtraso', descricao: 'Dias desde o vencimento mais antigo', exemplo: '47' },
  { nome: 'vencimentoAntigo', descricao: 'Data do vencimento mais antigo', exemplo: '15/12/2025' },
  { nome: 'meuNome', descricao: 'Nome completo do agente logado', exemplo: 'André Garcia' },
  { nome: 'primeiroNomeAgente', descricao: 'Primeiro nome do agente', exemplo: 'André' },
];
