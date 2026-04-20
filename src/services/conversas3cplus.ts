/**
 * Service REST para 3C Plus Omnichannel.
 *
 * Todas as chamadas passam pelo backend proxy (/api/conversas/*).
 * Socket.io NAO conecta mais direto — passa pelo worker 24/7 do backend.
 * Para receber eventos em tempo real, use src/services/realtime.ts.
 */

import type { Chat3CPlus, Mensagem3CPlus, TipoMensagem } from '../types/conversa';

const API_BASE = '/api/conversas';

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const token = localStorage.getItem('auth_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// ─── REST: Chats ───────────────────────────────────────────
export async function listarChatsFila(instanceId?: string): Promise<any> {
  const query = instanceId ? `?instance_id=${instanceId}` : '';
  const res = await fetch(`${API_BASE}/chats/queue${query}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Erro ao listar fila: ${res.status}`);
  return res.json();
}

export async function obterChat(chatId: string | number): Promise<any> {
  const res = await fetch(`${API_BASE}/chats/${chatId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Erro ao obter chat: ${res.status}`);
  return res.json();
}

export async function listarMensagens(chatId: string | number, page = 1): Promise<any> {
  const res = await fetch(`${API_BASE}/chats/${chatId}/messages?page=${page}&per_page=50`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Erro ao listar mensagens: ${res.status}`);
  return res.json();
}

// ─── REST: Send ────────────────────────────────────────────
export async function enviarTexto(chatId: string | number, body: string, instanceId?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/enviar/texto`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ chat_id: chatId, body, instance_id: instanceId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ao enviar texto: ${res.status}`);
  }
  return res.json();
}

export async function enviarInterno(chatId: string | number, body: string): Promise<any> {
  const res = await fetch(`${API_BASE}/enviar/interno`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ chat_id: chatId, body }),
  });
  if (!res.ok) throw new Error(`Erro ao enviar interno: ${res.status}`);
  return res.json();
}

export async function enviarImagem(chatId: string | number, file: File, instanceId?: string, caption?: string): Promise<any> {
  const form = new FormData();
  form.append('image', file);
  form.append('chat_id', String(chatId));
  if (instanceId) form.append('instance_id', instanceId);
  if (caption) form.append('caption', caption);

  const res = await fetch(`${API_BASE}/enviar/imagem`, { method: 'POST', headers: authHeaders(), body: form });
  if (!res.ok) throw new Error(`Erro ao enviar imagem: ${res.status}`);
  return res.json();
}

export async function enviarAudio(chatId: string | number, file: File | Blob, instanceId?: string): Promise<any> {
  const form = new FormData();
  form.append('audio', file, 'audio.ogg');
  form.append('chat_id', String(chatId));
  if (instanceId) form.append('instance_id', instanceId);

  const res = await fetch(`${API_BASE}/enviar/audio`, { method: 'POST', headers: authHeaders(), body: form });
  if (!res.ok) throw new Error(`Erro ao enviar audio: ${res.status}`);
  return res.json();
}

export async function enviarDocumento(chatId: string | number, file: File, instanceId?: string): Promise<any> {
  const form = new FormData();
  form.append('file', file);
  form.append('chat_id', String(chatId));
  if (instanceId) form.append('instance_id', instanceId);

  const res = await fetch(`${API_BASE}/enviar/documento`, { method: 'POST', headers: authHeaders(), body: form });
  if (!res.ok) throw new Error(`Erro ao enviar documento: ${res.status}`);
  return res.json();
}

// ─── REST: Actions ─────────────────────────────────────────
export async function abrirChatNovo(number: string, instanceId?: string): Promise<any> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/abrir-chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ number, instanceId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro ao abrir chat' }));
    throw new Error(err.error || `Erro ${res.status}`);
  }
  return res.json();
}

export async function aceitarChat(chatId: string | number): Promise<any> {
  const res = await fetch(`${API_BASE}/chats/${chatId}/aceitar`, { method: 'POST', headers: authHeaders() });
  if (!res.ok) throw new Error(`Erro ao aceitar chat: ${res.status}`);
  return res.json();
}

export async function finalizarChat(chatId: string | number, qualification?: string, note?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/chats/${chatId}/finalizar`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ qualification, qualification_note: note }),
  });
  if (!res.ok) throw new Error(`Erro ao finalizar chat: ${res.status}`);
  return res.json();
}

export async function transferirChat(chatId: string | number, agentId?: number, teamId?: number): Promise<any> {
  const res = await fetch(`${API_BASE}/chats/${chatId}/transferir`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ agent_id: agentId, team_id: teamId }),
  });
  if (!res.ok) throw new Error(`Erro ao transferir chat: ${res.status}`);
  return res.json();
}

// ─── REST: Banco local ─────────────────────────────────────
export async function persistirMensagem(msg: {
  mensagemExternaId: string;
  chatId: string | number;
  contatoNumero: string;
  contatoNome?: string;
  contatoImagem?: string;
  instanciaId: string;
  instanciaNome?: string;
  tipo: string;
  corpo?: string;
  mediaUrl?: string | null;
  mediaNome?: string | null;
  fromMe: boolean;
  de: string;
  para: string;
  agenteId?: number | null;
  agenteNome?: string | null;
  mensagemCitadaId?: string | null;
  mensagemCitadaCorpo?: string | null;
  timestamp: number;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/mensagens/persistir`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(msg),
  });
  return res.json();
}

export async function buscarMensagensLocal(chatId: string | number): Promise<any> {
  const res = await fetch(`${API_BASE}/mensagens/local/${chatId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Erro ao buscar mensagens locais: ${res.status}`);
  return res.json();
}

export async function buscarChatsLocal(instanceId?: string): Promise<any> {
  const query = instanceId ? `?instance_id=${instanceId}` : '';
  const res = await fetch(`${API_BASE}/mensagens/chats-local${query}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Erro ao buscar chats locais: ${res.status}`);
  return res.json();
}

// ─── REST: Config ──────────────────────────────────────────
export async function listarAgentes(): Promise<any> {
  const res = await fetch(`${API_BASE}/agentes`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Erro ao listar agentes: ${res.status}`);
  return res.json();
}

export async function listarEquipes(): Promise<any> {
  const res = await fetch(`${API_BASE}/equipes`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Erro ao listar equipes: ${res.status}`);
  return res.json();
}

// ─── Normalization ─────────────────────────────────────────
// Converte payload da API/Socket 3C Plus para nosso tipo Chat3CPlus
// Payload real: { id, contact: { name, number, image }, instance: { id, name, type },
//   agent: { id, name } | null, last_message (string), last_message_data: { body, type, date },
//   unread (number), finished (bool), in_snooze (bool), transferred (bool), updated_at }
export function normalizarChat(raw: any): Chat3CPlus {
  const lastMsgData = raw.last_message_data;
  return {
    id: raw.id,
    contatoNome: raw.contact?.name || '',
    contatoNumero: raw.contact?.number || raw.number || '',
    contatoImagem: raw.contact?.image || '',
    instanciaId: raw.instance?.id || raw.instance_id || '',
    instanciaNome: raw.instance?.name || '',
    instanciaTipo: (raw.instance?.type || 'whatsapp-3c') as 'whatsapp-3c' | 'waba',
    agenteId: raw.agent?.id || raw.agent_id || null,
    agenteNome: raw.agent?.name || null,
    ultimaMensagem: lastMsgData?.body || raw.last_message || '',
    ultimaMensagemTipo: mapTipoMensagem(lastMsgData?.type || 'chat'),
    ultimaMensagemData: lastMsgData?.date || Math.floor(new Date(raw.updated_at || Date.now()).getTime() / 1000),
    naoLidos: raw.unread || 0,
    finalizado: raw.finished || false,
    emSnooze: raw.in_snooze || false,
    transferido: raw.transferred || false,
    pessoaCodigo: undefined,
  };
}

// Payload real message: { id, chat_id, type, body, media (url|null), media_name,
//   fromMe (bool), agent: []|{id,name}, time (unix), ack (""|"read"|"device"),
//   internal (null|obj), is_deleted (bool), quoted_msg: {body,id,media,type} }
export function normalizarMensagem(raw: any): Mensagem3CPlus {
  const agentObj = Array.isArray(raw.agent) ? null : raw.agent;
  return {
    id: String(raw.id || raw.internal_id || `msg-${Date.now()}`),
    chatId: raw.chat_id || raw.chatId || 0,
    tipo: mapTipoMensagem(raw.type || 'chat'),
    corpo: raw.body || '',
    mediaUrl: raw.media || raw.media_url || null,
    mediaNome: raw.media_name || raw.media_original_name || null,
    fromMe: raw.fromMe ?? raw.from_me ?? false,
    agenteId: agentObj?.id || raw.agent_id || null,
    agenteNome: agentObj?.name || raw.author || null,
    timestamp: raw.time || raw.time_whatsapp || raw.timestamp || Math.floor(Date.now() / 1000),
    ack: raw.ack || null,
    mensagemCitada: raw.quoted_msg?.body ? { corpo: raw.quoted_msg.body, id: raw.quoted_msg.id } : undefined,
    interno: raw.internal != null && raw.internal !== false,
    deletado: raw.is_deleted || raw.deleted || false,
  };
}

function mapTipoMensagem(type: string): TipoMensagem {
  const mapa: Record<string, TipoMensagem> = {
    chat: 'chat',
    text: 'chat',
    audio: 'audio',
    voice: 'voice',
    ptt: 'voice',
    image: 'image',
    document: 'document',
    video: 'video',
    'internal-message': 'internal-message',
    internal: 'internal-message',
    'protocol-message': 'protocol-message',
    transfer: 'transfer',
    'qualification-message': 'qualification-message',
    'snooze-message': 'snooze-message',
    template: 'template',
  };
  return mapa[type] || 'chat';
}
