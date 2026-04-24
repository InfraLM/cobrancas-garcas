import { api } from './api';
import type { MotivoPausa, PausaLigacao } from '../types/pausaLigacao';

interface CriarPausaPayload {
  pessoaCodigo: number;
  motivo: MotivoPausa;
  observacao?: string;
  pausaAte?: string;
}

export async function criarPausa(payload: CriarPausaPayload): Promise<PausaLigacao> {
  return api.post<PausaLigacao>('/pausas-ligacao', payload);
}

export async function removerPausa(id: string, motivoRemocao?: string): Promise<PausaLigacao> {
  return api.delete<PausaLigacao>(`/pausas-ligacao/${id}`, { motivoRemocao });
}

export async function historicoPorAluno(codigo: number): Promise<PausaLigacao[]> {
  const res = await api.get<{ data: PausaLigacao[] }>(`/pausas-ligacao/por-aluno/${codigo}`);
  return res.data;
}

export async function removerEmMassa(codigos: number[], motivoRemocao: string): Promise<{ removidas: number }> {
  return api.post<{ removidas: number }>('/pausas-ligacao/remover-em-massa', { codigos, motivoRemocao });
}
