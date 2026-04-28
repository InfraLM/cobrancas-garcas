import { api } from './api';
import type { Atividade, StatusAtividade, TipoAtividade } from '../types/atividade';

export interface ListarAtividadesParams {
  status?: StatusAtividade;
  tipo?: TipoAtividade;
  inicio?: string;
  fim?: string;
  pessoaCodigo?: number;
}

export async function listarAtividades(params: ListarAtividadesParams = {}): Promise<Atividade[]> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.tipo) qs.set('tipo', params.tipo);
  if (params.inicio) qs.set('inicio', params.inicio);
  if (params.fim) qs.set('fim', params.fim);
  if (params.pessoaCodigo) qs.set('pessoaCodigo', String(params.pessoaCodigo));
  const s = qs.toString();
  return api.get<Atividade[]>(`/atividades${s ? `?${s}` : ''}`);
}

export async function criarAtividade(payload: {
  tipo: TipoAtividade;
  titulo: string;
  descricao?: string;
  dataHora: string;
  pessoaCodigo?: number;
  pessoaNome?: string;
  telefone?: string;
  origem?: 'MANUAL' | 'DURANTE_LIGACAO' | 'DURANTE_CONVERSA';
  origemRefId?: string;
}): Promise<Atividade> {
  return api.post<Atividade>('/atividades', payload);
}

export async function atualizarAtividade(id: string, payload: Partial<{
  titulo: string;
  descricao: string;
  dataHora: string;
  status: StatusAtividade;
}>): Promise<Atividade> {
  return api.patch<Atividade>(`/atividades/${id}`, payload);
}

export async function concluirAtividade(id: string): Promise<Atividade> {
  return api.post<Atividade>(`/atividades/${id}/concluir`, {});
}

export async function cancelarAtividade(id: string): Promise<void> {
  return api.delete<void>(`/atividades/${id}`);
}

export async function obterResumoAtividades(): Promise<{ vencidas: number; vencendoAgora: number }> {
  return api.get<{ vencidas: number; vencendoAgora: number }>('/atividades/resumo');
}
