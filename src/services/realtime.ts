/**
 * Cliente Socket.io do nosso servidor interno.
 *
 * O backend mantem conexao 24/7 com socket.3c.plus. Este cliente
 * conecta ao nosso servidor em /ws e escuta os eventos retransmitidos.
 *
 * Nao conectar direto ao socket.3c.plus — sempre passar por aqui.
 */

import { io, Socket } from 'socket.io-client';

// Em dev, o frontend roda na 5173 e backend na 3001 — usa URL absoluta.
// Em producao, mesmo host, pode usar relativo.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

let socket: Socket | null = null;
let listeners = new Set<() => void>();

export function conectarRealtime(): Socket {
  if (socket?.connected) return socket;

  if (!socket) {
    socket = io(BACKEND_URL, {
      path: '/ws',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      console.log('[Realtime] ✅ Conectado ao backend');
      listeners.forEach(fn => fn());
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Realtime] ⚠️  Desconectado:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[Realtime] ❌ Erro:', err.message);
    });
  }

  if (!socket.connected) socket.connect();
  return socket;
}

export function desconectarRealtime() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  listeners.clear();
}

export function isRealtimeConnected(): boolean {
  return socket?.connected ?? false;
}

export function onRealtimeConnect(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getRealtimeSocket(): Socket | null {
  return socket;
}
