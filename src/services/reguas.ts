import { api } from './api';
import type { ReguaCobranca, EtapaRegua, MetricaEtapa, SimulacaoEtapa } from '../types/reguaCobranca';

export async function listarReguas(): Promise<ReguaCobranca[]> {
  const res = await api.get<{ data: ReguaCobranca[] }>('/reguas-cobranca');
  return res.data;
}

export async function obterRegua(id: string): Promise<ReguaCobranca> {
  const res = await api.get<{ data: ReguaCobranca }>(`/reguas-cobranca/${id}`);
  return res.data;
}

export async function criarRegua(payload: { nome: string; descricao?: string; horarioPadrao?: string; intervaloDisparoSeg?: number }): Promise<ReguaCobranca> {
  const res = await api.post<{ data: ReguaCobranca }>('/reguas-cobranca', payload);
  return res.data;
}

export async function atualizarRegua(id: string, payload: Partial<{ nome: string; descricao: string; ativo: boolean; horarioPadrao: string; intervaloDisparoSeg: number }>): Promise<ReguaCobranca> {
  const res = await api.put<{ data: ReguaCobranca }>(`/reguas-cobranca/${id}`, payload);
  return res.data;
}

export async function removerRegua(id: string): Promise<void> {
  await api.delete(`/reguas-cobranca/${id}`);
}

export async function duplicarRegua(id: string): Promise<ReguaCobranca> {
  const res = await api.post<{ data: ReguaCobranca }>(`/reguas-cobranca/${id}/duplicar`, {});
  return res.data;
}

export async function criarReguaDoModelo(): Promise<{ data: ReguaCobranca } | { error: string; faltantes: string[] }> {
  return api.post<{ data: ReguaCobranca } | { error: string; faltantes: string[] }>('/reguas-cobranca/modelo-padrao', {});
}

export async function executarReguaAgora(id: string): Promise<{ enfileirados: number; etapasProcessadas: number }> {
  const res = await api.post<{ data: { enfileirados: number; etapasProcessadas: number } }>(`/reguas-cobranca/${id}/executar-agora`, {});
  return res.data;
}

// Etapas
export async function criarEtapa(reguaId: string, payload: { nome?: string; diasRelativoVenc: number; templateBlipId: string; segmentacaoId: string; horario?: string | null; ordem?: number; ativo?: boolean }): Promise<EtapaRegua> {
  const res = await api.post<{ data: EtapaRegua }>(`/reguas-cobranca/${reguaId}/etapas`, payload);
  return res.data;
}

export async function atualizarEtapa(reguaId: string, etapaId: string, payload: Partial<{ nome: string; diasRelativoVenc: number; templateBlipId: string; segmentacaoId: string; horario: string | null; ativo: boolean }>): Promise<EtapaRegua> {
  const res = await api.put<{ data: EtapaRegua }>(`/reguas-cobranca/${reguaId}/etapas/${etapaId}`, payload);
  return res.data;
}

export async function removerEtapa(reguaId: string, etapaId: string): Promise<void> {
  await api.delete(`/reguas-cobranca/${reguaId}/etapas/${etapaId}`);
}

export async function simularEtapa(reguaId: string, etapaId: string): Promise<SimulacaoEtapa> {
  return api.post<SimulacaoEtapa>(`/reguas-cobranca/${reguaId}/etapas/${etapaId}/simular`, {});
}

export async function previewMensagemEtapa(reguaId: string, etapaId: string): Promise<{ preview: string; conteudo: string; amostraAluno?: string }> {
  return api.get<{ preview: string; conteudo: string; amostraAluno?: string }>(`/reguas-cobranca/${reguaId}/etapas/${etapaId}/preview`);
}

export async function obterMetricas(reguaId: string): Promise<MetricaEtapa[]> {
  const res = await api.get<{ data: MetricaEtapa[] }>(`/reguas-cobranca/${reguaId}/metricas`);
  return res.data;
}
