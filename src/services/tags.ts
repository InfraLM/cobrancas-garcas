import { api } from './api';
import type { Tag, AlunoTag } from '../types/tag';

interface ListResponse<T> { data: T }

// Cache do catalogo (apenas variante padrao: ativos + sem filtro de categoria).
// 60s eh suficiente para evitar refetches em abre/fecha rapido do drawer.
// Invalidado explicitamente pela tela de gestao quando salva alteracoes.
const CACHE_KEY = 'tags_catalog_v1';
const CACHE_TTL_MS = 60_000;

export function invalidarCacheCatalogo(): void {
  try { sessionStorage.removeItem(CACHE_KEY); } catch { /* ignora */ }
}

// Catalogo (com cache leve em sessionStorage)
export async function listarCatalogo(opts?: { incluirInativos?: boolean; categoria?: string; incluirUso?: boolean }): Promise<Tag[]> {
  const variantePadrao = !opts?.incluirInativos && !opts?.categoria && !opts?.incluirUso;

  if (variantePadrao) {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { ts, data } = JSON.parse(cached) as { ts: number; data: Tag[] };
        if (Date.now() - ts < CACHE_TTL_MS) return data;
      }
    } catch { /* cache invalido, segue fluxo normal */ }
  }

  const qs = new URLSearchParams();
  if (opts?.incluirInativos) qs.set('incluirInativos', 'true');
  if (opts?.categoria) qs.set('categoria', opts.categoria);
  if (opts?.incluirUso) qs.set('incluirUso', 'true');
  const url = `/tags${qs.toString() ? `?${qs}` : ''}`;
  const r = await api.get<ListResponse<Tag[]>>(url);

  if (variantePadrao) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: r.data }));
    } catch { /* sem cache, sem problema */ }
  }
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
  invalidarCacheCatalogo();
  return r.data;
}

export async function atualizarTag(id: string, payload: Partial<{
  categoria: string; label: string; descricao: string | null; cor: string | null; ordem: number; ativo: boolean;
}>): Promise<Tag> {
  const r = await api.put<ListResponse<Tag>>(`/tags/${id}`, payload);
  invalidarCacheCatalogo();
  return r.data;
}

export async function desativarTag(id: string): Promise<Tag> {
  const r = await api.delete<ListResponse<Tag>>(`/tags/${id}`);
  invalidarCacheCatalogo();
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
