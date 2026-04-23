/**
 * Worker Socket.io 24/7 — conexao permanente com socket.3c.plus.
 *
 * Iniciado no startup do Express. Persiste todos os eventos relevantes
 * no banco e retransmite para browsers via Socket.io interno.
 *
 * Frontend NAO conecta direto ao socket.3c.plus — sempre passa por aqui.
 */

import { io as socketIoClient } from 'socket.io-client';
import { onNovaMensagemWhatsapp } from './handlers/whatsappHandler.js';
import {
  onCallCreated,
  onCallAnswered,
  onCallConnected,
  onCallHungUp,
  onCallFinished,
  onCallUnanswered,
  onCallAbandoned,
  onCallHistoryCreated,
  onAgentIsIdle,
  onAgentInAcw,
  onAgentLoginFailed,
} from './handlers/ligacaoHandler.js';
import {
  getWhitelists,
  iniciarRefreshAutomatico,
  lerContadoresEReset,
} from '../services/threecplusWhitelist.js';

const SOCKET_URL = 'https://socket.3c.plus';
let socket = null;
let heartbeatInterval = null;

export async function startSocketWorker() {
  const token = process.env.THREECPLUS_MANAGER_TOKEN;
  if (!token) {
    console.error('[Worker] ❌ THREECPLUS_MANAGER_TOKEN nao configurado. Worker nao iniciado.');
    return;
  }

  if (socket?.connected) {
    console.log('[Worker] Ja conectado, ignorando reconexao.');
    return;
  }

  // Carrega whitelist ANTES de conectar — evita race com primeiros eventos
  try {
    await getWhitelists();
    iniciarRefreshAutomatico();
  } catch (err) {
    console.error('[Worker] Erro ao carregar whitelist inicial:', err.message);
  }

  console.log('[Worker] 🔌 Conectando ao Socket 3C Plus...');

  socket = socketIoClient(SOCKET_URL, {
    query: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
  });

  // ─── Lifecycle ───────────────────────────────────────────
  socket.on('connect', () => {
    console.log('[Worker] ✅ Conectado ao Socket 3C Plus | id=' + socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.warn('[Worker] ⚠️  Desconectado:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('[Worker] ❌ Erro de conexao:', err.message);
  });

  socket.io.on('reconnect_attempt', (n) => {
    console.log(`[Worker] 🔄 Tentativa de reconexao #${n}`);
  });

  socket.io.on('reconnect', (n) => {
    console.log(`[Worker] ✅ Reconectado apos ${n} tentativas`);
  });

  // ─── WhatsApp ────────────────────────────────────────────
  // A 3C Plus documenta APENAS new-message-whatsapp para WhatsApp.
  // Ack updates (null → "device" → "read") devem vir no mesmo evento
  // com a mesma mensagemExternaId + ack atualizado. O handler faz dedup+upsert.
  socket.on('new-message-whatsapp', onNovaMensagemWhatsapp);
  socket.on('new-agent-chat-whatsapp', onNovaMensagemWhatsapp);
  socket.on('new-whatsapp-internal-message', onNovaMensagemWhatsapp);

  // ─── Ligacoes ────────────────────────────────────────────
  socket.on('call-was-created', onCallCreated);
  socket.on('call-was-answered', onCallAnswered);
  socket.on('call-was-connected', onCallConnected);
  socket.on('call-was-hung-up', onCallHungUp);
  socket.on('call-was-finished', onCallFinished);
  socket.on('call-was-unanswered', onCallUnanswered);
  socket.on('call-was-abandoned', onCallAbandoned);
  socket.on('call-history-was-created', onCallHistoryCreated);

  // ─── Estado do agente ────────────────────────────────────
  socket.on('agent-is-idle', onAgentIsIdle);
  socket.on('agent-in-acw', onAgentInAcw);
  socket.on('agent-login-failed', onAgentLoginFailed);

  // ─── Wildcard diagnostico ────────────────────────────────
  // Loga TODOS os eventos que chegam, para descobrir se existem
  // eventos nao documentados. Util para validar se click2call emite
  // call-was-created ou nao, etc.
  socket.onAny((nomeEvento, ...args) => {
    const preview = args[0] ? JSON.stringify(args[0]).slice(0, 200) : '';
    console.log(`[Worker/ANY] "${nomeEvento}" ${preview}`);
  });

  // ─── Heartbeat ──────────────────────────────────────────
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    const status = socket?.connected ? '✅ conectado' : '⚠️  desconectado';
    const mem = process.memoryUsage();
    const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(0);
    const rssMB = (mem.rss / 1024 / 1024).toFixed(0);
    const ev = lerContadoresEReset();
    console.log(`[Worker] 💓 Heartbeat ${status} | heap ${heapMB} MB | rss ${rssMB} MB | eventos recebidos ${ev.recebidos} / processados ${ev.processados} / filtrados ${ev.filtrados} | ${new Date().toISOString()}`);
  }, 60000);
}

export function stopSocketWorker() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  console.log('[Worker] 🛑 Worker parado');
}

export function isSocketConnected() {
  return socket?.connected ?? false;
}
