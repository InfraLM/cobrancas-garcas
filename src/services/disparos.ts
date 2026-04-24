import { api } from './api';
import type { DisparoMensagem } from '../types/disparoMensagem';

export interface AmostraItem {
  codigo: number;
  nome: string;
  tituloValor?: number;
  tituloVencimento?: string;
  diasAteVenc?: number;
  tituloSituacao?: string;
}

export interface PrevisaoDisparo {
  tipo: 'ALUNO' | 'TITULO';
  totalEncontrados: number;
  totalComTelefone: number;
  totalSemTelefone: number;
  alunosUnicos?: number;   // so TITULO
  valorTotal?: number;     // so TITULO
  amostra: AmostraItem[];
  template: { id: string; nomeBlip: string; titulo: string; escopo: string };
  regra: { id: string; nome: string; tipo: 'ALUNO' | 'TITULO' };
}

export async function preverDisparo(payload: { templateBlipId: string; segmentacaoId: string }): Promise<PrevisaoDisparo> {
  return api.post<PrevisaoDisparo>('/disparos/prever', payload);
}

export interface ResultadoDisparoAgora {
  totalEnfileirados: number;
  disparoIds: string[];
  message: string;
}

export async function dispararAgora(payload: { templateBlipId: string; segmentacaoId: string }): Promise<ResultadoDisparoAgora> {
  return api.post<ResultadoDisparoAgora>('/disparos/disparar-agora', payload);
}

export interface ResumoBatch {
  enviados: number;
  falhas: number;
  pendentes: number;
}

export async function resumoBatch(ids: string[]): Promise<ResumoBatch> {
  const qs = `?ids=${ids.join(',')}`;
  return api.get<ResumoBatch>(`/disparos/resumo${qs}`);
}

export interface HistoricoResponse {
  data: DisparoMensagem[];
  total: number;
  page: number;
  limit: number;
}

export async function listarHistorico(params: { status?: string; pessoaCodigo?: number; periodo?: string; page?: number; limit?: number } = {}): Promise<HistoricoResponse> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.pessoaCodigo) qs.set('pessoaCodigo', String(params.pessoaCodigo));
  if (params.periodo) qs.set('periodo', params.periodo);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  return api.get<HistoricoResponse>(`/disparos/historico${qs.toString() ? `?${qs}` : ''}`);
}
