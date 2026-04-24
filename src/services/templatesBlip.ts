import { api } from './api';
import type { TemplateBlip, FonteDisponivel, CategoriaBlip, VariavelMap } from '../types/templateBlip';

export async function listarTemplatesBlip(params: { categoria?: CategoriaBlip; ativo?: boolean } = {}): Promise<TemplateBlip[]> {
  const qs = new URLSearchParams();
  if (params.categoria) qs.set('categoria', params.categoria);
  if (params.ativo !== undefined) qs.set('ativo', String(params.ativo));
  const res = await api.get<{ data: TemplateBlip[] }>(`/templates-blip${qs.toString() ? `?${qs}` : ''}`);
  return res.data;
}

export async function obterTemplateBlip(id: string): Promise<TemplateBlip> {
  return api.get<TemplateBlip>(`/templates-blip/${id}`);
}

export async function listarFontes(): Promise<FonteDisponivel[]> {
  const res = await api.get<{ data: FonteDisponivel[] }>('/templates-blip/fontes');
  return res.data;
}

interface CriarPayload {
  nomeBlip: string;
  titulo: string;
  descricao?: string;
  conteudoPreview: string;
  variaveis: VariavelMap[];
  categoria: CategoriaBlip;
  ativo?: boolean;
}

export async function criarTemplateBlip(payload: CriarPayload): Promise<TemplateBlip> {
  return api.post<TemplateBlip>('/templates-blip', payload);
}

export async function atualizarTemplateBlip(id: string, payload: CriarPayload): Promise<TemplateBlip> {
  return api.put<TemplateBlip>(`/templates-blip/${id}`, payload);
}

export async function removerTemplateBlip(id: string): Promise<void> {
  return api.delete<void>(`/templates-blip/${id}`);
}
