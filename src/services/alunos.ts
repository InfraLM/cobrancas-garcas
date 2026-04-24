import { api } from './api';
import type {
  Aluno, ResumoFinanceiro, Parcela, Engajamento,
  Plantao, SuporteBlip, SerasaRegistro,
} from '../types/aluno';
import type { PausaAtivaResumo } from '../types/pausaLigacao';

export interface AlunoListItem {
  codigo: number;
  nome: string;
  cpf: string | null;
  celular: string | null;
  matricula: string | null;
  turma: string | null;
  situacao: string;
  situacaoFinanceira: string;
  valorDevedor: number;
  pausaAtiva?: PausaAtivaResumo | null;
}

export interface ListarAlunosResponse {
  data: AlunoListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface AlunoCompleto extends Aluno {
  resumoFinanceiro: ResumoFinanceiro;
  serasaRegistros: SerasaRegistro[];
}

export async function listarAlunos(params: {
  search?: string;
  situacao?: string;
  financeiro?: string;
  page?: number;
  limit?: number;
} = {}): Promise<ListarAlunosResponse> {
  const query = new URLSearchParams();
  if (params.search) query.append('search', params.search);
  if (params.situacao) query.append('situacao', params.situacao);
  if (params.financeiro) query.append('financeiro', params.financeiro);
  if (params.page) query.append('page', String(params.page));
  if (params.limit) query.append('limit', String(params.limit));

  const qs = query.toString();
  return api.get<ListarAlunosResponse>(qs ? `/alunos?${qs}` : '/alunos');
}

export async function obterAluno(codigo: number): Promise<AlunoCompleto> {
  const res = await api.get<{ data: AlunoCompleto }>(`/alunos/${codigo}`);
  return res.data;
}

export async function listarParcelas(codigo: number, situacao?: string): Promise<Parcela[]> {
  const qs = situacao ? `?situacao=${situacao}` : '';
  const res = await api.get<{ data: Parcela[] }>(`/alunos/${codigo}/parcelas${qs}`);
  return res.data;
}

export async function obterEngajamento(codigo: number): Promise<Engajamento | null> {
  const res = await api.get<{ data: Engajamento | null }>(`/alunos/${codigo}/engajamento`);
  return res.data;
}

export async function listarPlantoes(codigo: number): Promise<Plantao[]> {
  const res = await api.get<{ data: Plantao[] }>(`/alunos/${codigo}/plantoes`);
  return res.data;
}

export async function obterSuporte(codigo: number): Promise<SuporteBlip | null> {
  const res = await api.get<{ data: SuporteBlip | null }>(`/alunos/${codigo}/suporte`);
  return res.data;
}

export async function listarSerasaRegistros(codigo: number): Promise<SerasaRegistro[]> {
  const res = await api.get<{ data: SerasaRegistro[] }>(`/alunos/${codigo}/serasa`);
  return res.data;
}

export interface CartaoRecorrencia {
  codigo: number;
  numeroMascarado: string | null;
  nome: string | null;
  mesValidade: number | null;
  anoValidade: number | null;
  situacao: string | null;
  dataCadastro: string | null;
  dataInativacao: string | null;
  motivoInativacao: string | null;
  diaPagamento: number | null;
  inativadoViaRecorrencia: boolean | null;
  celular: string | null;
  email: string | null;
  matricula: string | null;
}

export interface RecorrenciaResponse {
  recorrenciaAtiva: boolean;
  totalCadastros: number;
  cartoes: CartaoRecorrencia[];
}

export async function obterRecorrencia(codigo: number): Promise<RecorrenciaResponse> {
  const res = await api.get<{ data: RecorrenciaResponse }>(`/alunos/${codigo}/recorrencia`);
  return res.data;
}

export interface OcorrenciaTimeline {
  id: string;
  tipo: string;
  descricao: string;
  agente: string | null;
  data: string | null;
}

export async function listarOcorrencias(codigo: number): Promise<OcorrenciaTimeline[]> {
  const res = await api.get<{ data: OcorrenciaTimeline[] }>(`/alunos/${codigo}/ocorrencias`);
  return res.data;
}
