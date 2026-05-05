import { api } from './api';
import type { Tag, AlunoTag } from '../types/tag';

interface ListResponse<T> { data: T }

// Catalogo
export async function listarCatalogo(opts?: { incluirInativos?: boolean; categoria?: string }): Promise<Tag[]> {
  const qs = new URLSearchParams();
  if (opts?.incluirInativos) qs.set('incluirInativos', 'true');
  if (opts?.categoria) qs.set('categoria', opts.categoria);
  const url = `/tags${qs.toString() ? `?${qs}` : ''}`;
  const r = await api.get<ListResponse<Tag[]>>(url);
  return r.data;
}

export async function listarCategorias(): Promise<string[]> {
  const r = await api.get<ListResponse<string[]>>('/tags/categorias');
  return r.data;
}

export async function criarTag(payload: {
  categoria: string; codigo: string; label: string; descricao?: string; cor?: string; ordem?: number;
}): Promise<Tag> {
  const r = await api.post<ListResponse<Tag>>('/tags', payload);
  return r.data;
}

export async function atualizarTag(id: string, payload: Partial<{
  categoria: string; label: string; descricao: string | null; cor: string | null; ordem: number; ativo: boolean;
}>): Promise<Tag> {
  const r = await api.put<ListResponse<Tag>>(`/tags/${id}`, payload);
  return r.data;
}

export async function desativarTag(id: string): Promise<Tag> {
  const r = await api.delete<ListResponse<Tag>>(`/tags/${id}`);
  return r.data;
}

// Atribuicoes por aluno
export async function listarPorAluno(pessoaCodigo: number, incluirRemovidas = false): Promise<AlunoTag[]> {
  const qs = incluirRemovidas ? '?incluirRemovidas=true' : '';
  const r = await api.get<ListResponse<AlunoTag[]>>(`/alunos/${pessoaCodigo}/tags${qs}`);
  return r.data;
}

export async function aplicarTag(pessoaCodigo: number, payload: {
  tagId: string; observacao?: string; origemConversaId?: string; origemAcordoId?: string;
}): Promise<AlunoTag> {
  const r = await api.post<ListResponse<AlunoTag>>(`/alunos/${pessoaCodigo}/tags`, payload);
  return r.data;
}

export async function removerTag(pessoaCodigo: number, atribId: string): Promise<AlunoTag> {
  const r = await api.delete<ListResponse<AlunoTag>>(`/alunos/${pessoaCodigo}/tags/${atribId}`);
  return r.data;
}
