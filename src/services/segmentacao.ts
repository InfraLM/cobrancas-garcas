import { api } from './api';
import type { RegraSegmentacao, Condicao } from '../types/segmentacao';
import type { AlunoListItem, ListarAlunosResponse } from './alunos';

export async function listarRegras(): Promise<RegraSegmentacao[]> {
  const res = await api.get<{ data: RegraSegmentacao[] }>('/segmentacoes');
  return res.data;
}

export async function obterRegra(id: string): Promise<RegraSegmentacao> {
  const res = await api.get<{ data: RegraSegmentacao }>(`/segmentacoes/${id}`);
  return res.data;
}

export async function criarRegra(data: { nome: string; descricao?: string; condicoes: Condicao[] }): Promise<RegraSegmentacao> {
  const res = await api.post<{ data: RegraSegmentacao }>('/segmentacoes', data);
  return res.data;
}

export async function atualizarRegra(id: string, data: Partial<{ nome: string; descricao: string; condicoes: Condicao[]; ativa: boolean }>): Promise<RegraSegmentacao> {
  const res = await api.put<{ data: RegraSegmentacao }>(`/segmentacoes/${id}`, data);
  return res.data;
}

export async function excluirRegra(id: string): Promise<void> {
  await api.delete(`/segmentacoes/${id}`);
}

export async function executarCondicoes(condicoes: Condicao[], opts: { page?: number; limit?: number; search?: string } = {}): Promise<ListarAlunosResponse> {
  return api.post<ListarAlunosResponse>('/segmentacoes/executar', { condicoes, ...opts });
}

export async function executarRegra(id: string, opts: { page?: number; limit?: number; search?: string } = {}): Promise<ListarAlunosResponse & { totalGeral: number; valorTotal: number }> {
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
