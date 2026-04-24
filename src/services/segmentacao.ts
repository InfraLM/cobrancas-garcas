import { api } from './api';
import type { RegraSegmentacao, Condicao, TipoSegmentacao } from '../types/segmentacao';
import type { AlunoListItem, ListarAlunosResponse } from './alunos';

export interface TituloDaSegmentacao {
  codigo: number;
  nome: string;
  cpf: string | null;
  celular: string | null;
  matricula: string | null;
  tituloCodigo: number;
  tituloValor: number;
  tituloValorRecebido: number;
  tituloDataVencimento: string;
  tituloToken: string | null;
  tituloSituacao: 'AR' | 'RE' | 'NE' | 'CF';
  tituloTipoOrigem: string | null;
  tituloDiasAteVencimento: number;
  tituloDiasAposVencimento: number;
  tituloTurma: string | null;
}

export interface ExecutarRegraResponse {
  data: AlunoListItem[] | TituloDaSegmentacao[];
  total: number;
  totalGeral: number;
  valorTotal: number;
  alunosUnicos?: number;
  page: number;
  limit: number;
  tipo: TipoSegmentacao;
}

export interface ExecutarAvulsoResponse {
  data: AlunoListItem[] | TituloDaSegmentacao[];
  total: number;
  page: number;
  limit: number;
  tipo: TipoSegmentacao;
}

export async function listarRegras(): Promise<RegraSegmentacao[]> {
  const res = await api.get<{ data: RegraSegmentacao[] }>('/segmentacoes');
  return res.data;
}

export async function obterRegra(id: string): Promise<RegraSegmentacao> {
  const res = await api.get<{ data: RegraSegmentacao }>(`/segmentacoes/${id}`);
  return res.data;
}

export async function criarRegra(data: { nome: string; descricao?: string; tipo: TipoSegmentacao; condicoes: Condicao[]; reguaOwnerId?: string }): Promise<RegraSegmentacao> {
  const res = await api.post<{ data: RegraSegmentacao }>('/segmentacoes', data);
  return res.data;
}

export async function listarRegrasComFiltros(params: { incluirEmbutidas?: boolean; reguaOwnerId?: string; tipo?: TipoSegmentacao } = {}): Promise<RegraSegmentacao[]> {
  const qs = new URLSearchParams();
  if (params.incluirEmbutidas) qs.set('incluirEmbutidas', 'true');
  if (params.reguaOwnerId) qs.set('reguaOwnerId', params.reguaOwnerId);
  if (params.tipo) qs.set('tipo', params.tipo);
  const res = await api.get<{ data: RegraSegmentacao[] }>(`/segmentacoes${qs.toString() ? `?${qs}` : ''}`);
  return res.data;
}

export async function promoverGlobal(id: string): Promise<RegraSegmentacao> {
  const res = await api.post<{ data: RegraSegmentacao }>(`/segmentacoes/${id}/promover-global`, {});
  return res.data;
}

export async function atualizarRegra(id: string, data: Partial<{ nome: string; descricao: string; tipo: TipoSegmentacao; condicoes: Condicao[]; ativa: boolean }>): Promise<RegraSegmentacao> {
  const res = await api.put<{ data: RegraSegmentacao }>(`/segmentacoes/${id}`, data);
  return res.data;
}

export async function excluirRegra(id: string): Promise<void> {
  await api.delete(`/segmentacoes/${id}`);
}

export async function executarCondicoes(condicoes: Condicao[], opts: { page?: number; limit?: number; search?: string; tipo?: TipoSegmentacao } = {}): Promise<ExecutarAvulsoResponse> {
  return api.post<ExecutarAvulsoResponse>('/segmentacoes/executar', { condicoes, ...opts });
}

export async function executarRegra(id: string, opts: { page?: number; limit?: number; search?: string } = {}): Promise<ExecutarRegraResponse> {
  return api.post(`/segmentacoes/${id}/executar`, opts);
}

export async function listarTurmas(): Promise<string[]> {
  const res = await api.get<{ data: string[] }>('/segmentacoes/turmas');
  return res.data;
}

export interface PausadoDetalhe {
  codigo: number;
  nome: string;
  motivo: string;
  pausaAte?: string | null;
}

export interface SubirCampanhaResult {
  listId: number;
  totalEncontrados?: number;
  totalSubidos: number;
  totalEnviados?: number;
  totalPausados?: number;
  totalSemTelefone: number;
  pausados?: PausadoDetalhe[];
  campanha: number;
}

export async function subirParaCampanha(regraId: string): Promise<SubirCampanhaResult> {
  const res = await api.post<{ data: SubirCampanhaResult }>(`/segmentacoes/${regraId}/subir-campanha`, {});
  return res.data;
}
