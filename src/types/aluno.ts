export interface Aluno {
  codigo: number;
  nome: string;
  cpf?: string | null;
  rg?: string | null;
  email?: string | null;
  celular?: string | null;
  telefone1?: string | null;
  telefone2?: string | null;
  sexo?: string | null;
  dataNascimento?: string | null;
  estadoCivil?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
  cidade?: string | null;
  uf?: string | null;
  dataCriacao?: string | null;
  serasa?: boolean;
  bloquearContatoCrm?: boolean;

  matricula?: string | null;
  situacaoMatricula?: string | null;
  dataMatricula?: string | null;
  naoEnviarMensagemCobranca?: boolean;
  cursoNome?: string | null;
  turmaIdentificador?: string | null;

  financeiro?: ResumoFinanceiro;
  resumoFinanceiro?: ResumoFinanceiro;
  engajamento?: Engajamento;
  plantoes?: Plantao[];
  suporteBlip?: SuporteBlip;
  serasaDetalhes?: SerasaRegistro[];
  serasaRegistros?: SerasaRegistro[];
  parcelas?: Parcela[];
}

export interface ResumoFinanceiro {
  totalParcelas: number;
  parcelasEmAtraso: number;
  parcelasAVencer: number;
  parcelasPagas: number;
  parcelasNegociadas: number;
  parcelasCanceladas: number;
  valorEmAberto: number;
  valorInadimplente: number;
  valorPago: number;
  vencimentoMaisAntigo?: string | null;
}

export interface Parcela {
  codigo: number;
  valor: number;
  valorRecebido: number;
  dataVencimento: string;
  situacao: 'AR' | 'RE' | 'NE' | 'CF';
  tipoOrigem: 'MAT' | 'MEN' | 'NCR' | 'OUT' | 'REQ';
  multa?: number;
  juro?: number;
  desconto?: number;
}

export interface Engajamento {
  matricula: string;
  turma?: string;
  statusFinanceiro?: string;
  aulasAssistidas?: number;
  aulasTotalPorcentagem?: number;
  diasDesdePrimeiraAula?: number;
  diasDesdeUltimaAula?: number;
  criadoEm?: string;
  cidade?: string;
  tag?: string;
  parcelasPagas?: number;
  parcelasAtraso?: number;
  parcelasAberto?: number;
}

export interface Plantao {
  id: number;
  dataPlantao: string;
  dataMarcado?: string;
  status: 'Realizado' | 'Cancelado' | 'Em Aberto';
  moscow?: string;
}

export interface SuporteBlip {
  totalTickets: number;
  ticketsFinanceiro: number;
  ultimoTicket?: string;
  primeiroTicket?: string;
  tickets: TicketBlip[];
}

export interface TicketBlip {
  id: string;
  equipe: string;
  status: string;
  data: string;
}

export interface SerasaRegistro {
  id: number;
  contrato: string;
  valor: string;
  valorNumerico: number;
  enviadoEm: string;
  baixadoEm?: string;
  situacao: 'Ativa' | 'Baixada';
}

// Labels para exibição
export const situacaoMatriculaLabel: Record<string, string> = {
  AT: 'Ativa',
  CA: 'Cancelada',
  IN: 'Inativa',
  TR: 'Trancada',
};

export const situacaoParcelaLabel: Record<string, string> = {
  AR: 'A Receber',
  RE: 'Recebido',
  NE: 'Negociado',
  CF: 'Cancelado',
};

export const tipoOrigemLabel: Record<string, string> = {
  MAT: 'Matrícula',
  MEN: 'Mensalidade',
  NCR: 'Negociação',
  OUT: 'Outros',
  REQ: 'Requerimento',
};
