import { api } from './api';
import type { TemplateMeta, TemplateMetaStatus, TemplateMetaCategoria, Componente, VariaveisMap } from '../types/templateMeta';

interface ListResponse<T> { data: T }

export interface ListarOpts {
  status?: TemplateMetaStatus;
  category?: TemplateMetaCategoria;
  ativo?: boolean;
  incluirInativos?: boolean;
}

export async function listarTemplatesMeta(opts: ListarOpts = {}): Promise<TemplateMeta[]> {
  const qs = new URLSearchParams();
  if (opts.status) qs.set('status', opts.status);
  if (opts.category) qs.set('category', opts.category);
  if (opts.ativo !== undefined) qs.set('ativo', String(opts.ativo));
  if (opts.incluirInativos) qs.set('incluirInativos', 'true');
  const url = `/templates-meta${qs.toString() ? `?${qs}` : ''}`;
  const r = await api.get<ListResponse<TemplateMeta[]>>(url);
  return r.data;
}

export async function obterTemplateMeta(id: string): Promise<TemplateMeta> {
  const r = await api.get<ListResponse<TemplateMeta>>(`/templates-meta/${id}`);
  return r.data;
}

export async function criarTemplateMeta(payload: {
  name: string;
  language: string;
  category: TemplateMetaCategoria;
  components: Componente[];
  variaveisMap?: VariaveisMap | null;
}): Promise<TemplateMeta> {
  const r = await api.post<ListResponse<TemplateMeta>>('/templates-meta', payload);
  return r.data;
}

export async function atualizarTemplateMeta(id: string, payload: Partial<{
  name: string;
  language: string;
  category: TemplateMetaCategoria;
  components: Componente[];
  variaveisMap: VariaveisMap | null;
  ativo: boolean;
}>): Promise<TemplateMeta> {
  const r = await api.put<ListResponse<TemplateMeta>>(`/templates-meta/${id}`, payload);
  return r.data;
}

export async function submeterTemplateMeta(id: string): Promise<{ template: TemplateMeta; meta: { id: string; status: string; category: string } }> {
  const r = await api.post<{ data: TemplateMeta; meta: any }>(`/templates-meta/${id}/submeter`, {});
  return { template: r.data, meta: r.meta };
}

export async function deletarTemplateMeta(id: string): Promise<TemplateMeta> {
  const r = await api.delete<ListResponse<TemplateMeta>>(`/templates-meta/${id}`);
  return r.data;
}

export async function sincronizarTemplatesMeta(): Promise<{ criados: number; atualizados: number; naoMudaram: number; total: number }> {
  const r = await api.post<ListResponse<{ criados: number; atualizados: number; naoMudaram: number; total: number }>>('/templates-meta/sync', {});
  return r.data;
}
