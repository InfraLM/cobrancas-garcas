/**
 * Socket.io server interno — retransmite eventos do worker 3C Plus
 * para browsers conectados.
 *
 * Path: /ws (nao conflita com /api)
 *
 * Eventos emitidos:
 * - mensagem:nova        → mensagem WhatsApp recebida/enviada
 * - conversa:atualizada  → ConversaCobranca mudou de status/agente
 * - ligacao:evento       → evento de telefonia (subtipos no payload.tipo)
 */

import { Server as IoServer } from 'socket.io';

let io = null;

export function setupRealtime(httpServer) {
  io = new IoServer(httpServer, {
    path: '/ws',
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`[Realtime] 🔗 Cliente conectado: ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`[Realtime] 🔌 Cliente desconectado: ${socket.id} (${reason})`);
    });
  });

  console.log('[Realtime] ✅ Socket.io server ativo em /ws');
  return io;
}

export function getRealtimeIo() {
  return io;
}
