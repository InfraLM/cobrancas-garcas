import { api } from './api';

export interface CadastroRecorrencia {
  id: string;
  pessoaCodigo: number;
  pessoaNome: string;
  pessoaCpf: string;
  matricula?: string;
  celularAluno?: string;
  etapa: string;
  origem: string;
  metodo?: string;
  acordoId?: string;
  contaReceberCodigo?: number;
  parcelaPaga: boolean;
  recorrenciaAtivada: boolean;
  cartaoDetectadoCodigo?: number;
  dataLimite?: string;
  criadoPor: number;
  criadoPorNome: string;
  observacao?: string;
  criadoEm: string;
  concluidoEm?: string;
  canceladoEm?: string;
}

export async function listarRecorrencias(params?: { etapa?: string; search?: string; origem?: string }): Promise<CadastroRecorrencia[]> {
  const query = new URLSearchParams();
  if (params?.etapa) query.set('etapa', params.etapa);
  if (params?.search) query.set('search', params.search);
  if (params?.origem) query.set('origem', params.origem);
  const qs = query.toString();
  return api.get<CadastroRecorrencia[]>(`/recorrencias${qs ? `?${qs}` : ''}`);
}

export async function criarRecorrencia(payload: {
  pessoaCodigo: number;
  pessoaNome: string;
  pessoaCpf: string;
  matricula?: string;
  celularAluno?: string;
  origem?: string;
  observacao?: string;
  dataLimite?: string;
}): Promise<CadastroRecorrencia> {
  return api.post<CadastroRecorrencia>('/recorrencias', payload);
}

export async function definirMetodo(id: string, payload: {
  metodo: string;
  contaReceberCodigo?: number;
  dataLimite?: string;
}): Promise<CadastroRecorrencia> {
  return api.put<CadastroRecorrencia>(`/recorrencias/${id}/metodo`, payload);
}

export async function atualizarEtapaRecorrencia(id: string, etapa: string): Promise<CadastroRecorrencia> {
  return api.put<CadastroRecorrencia>(`/recorrencias/${id}/etapa`, { etapa });
}

export async function cancelarRecorrencia(id: string): Promise<CadastroRecorrencia> {
  return api.delete<CadastroRecorrencia>(`/recorrencias/${id}`);
}
