/**
 * Service de ConversaCobranca — interage com /api/conversas-cobranca.
 */

import type { ConversaCobranca, MotivoEncerramento, StatusConversa } from '../types/conversa';
import type { Mensagem3CPlus } from '../types/conversa';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const API_BASE = `${API_URL}/conversas-cobranca`;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('auth_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

interface ListarFiltros {
  status?: StatusConversa;
  agenteId?: number;
  instanciaId?: string;
}

export async function listarConversas(filtros: ListarFiltros = {}): Promise<ConversaCobranca[]> {
  const params = new URLSearchParams();
  if (filtros.status) params.append('status', filtros.status);
  if (filtros.agenteId) params.append('agenteId', String(filtros.agenteId));
  if (filtros.instanciaId) params.append('instanciaId', filtros.instanciaId);

  const url = params.toString() ? `${API_BASE}?${params}` : API_BASE;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Erro ao listar conversas: ${res.status}`);
  const json = await res.json();
  return json.data || [];
}

export async function obterConversa(id: string): Promise<{ conversa: ConversaCobranca; mensagens: Mensagem3CPlus[] }> {
  const res = await fetch(`${API_BASE}/${id}`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Erro ao obter conversa: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function assumirConversa(id: string, agenteId: number, agenteNome: string): Promise<ConversaCobranca> {
  const res = await fetch(`${API_BASE}/${id}/assumir`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ agenteId, agenteNome }),
  });
  if (!res.ok) throw new Error(`Erro ao assumir: ${res.status}`);
  return res.json();
}

export async function encerrarConversa(id: string, motivo: MotivoEncerramento, observacao?: string): Promise<ConversaCobranca> {
  const res = await fetch(`${API_BASE}/${id}/encerrar`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ motivo, observacao }),
  });
  if (!res.ok) throw new Error(`Erro ao encerrar: ${res.status}`);
  return res.json();
}

export async function transferirConversa(id: string, agenteId: number, agenteNome: string): Promise<ConversaCobranca> {
  const res = await fetch(`${API_BASE}/${id}/transferir`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ agenteId, agenteNome }),
  });
  if (!res.ok) throw new Error(`Erro ao transferir: ${res.status}`);
  return res.json();
}

export async function snoozeConversa(id: string, reativarEm: Date): Promise<ConversaCobranca> {
  const res = await fetch(`${API_BASE}/${id}/snooze`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ reativarEm: reativarEm.toISOString() }),
  });
  if (!res.ok) throw new Error(`Erro ao adiar: ${res.status}`);
  return res.json();
}

export async function reativarConversa(id: string): Promise<ConversaCobranca> {
  const res = await fetch(`${API_BASE}/${id}/reativar`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Erro ao reativar: ${res.status}`);
  return res.json();
}

export async function marcarLido(id: string): Promise<ConversaCobranca> {
  const res = await fetch(`${API_BASE}/${id}/marcar-lido`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Erro ao marcar como lido: ${res.status}`);
  return res.json();
}
