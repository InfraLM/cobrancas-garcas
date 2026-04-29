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
 *
 * Rooms (isolamento por usuario):
 * - agent:{threecplusAgentId} — eventos com agent.id especifico vao so pra esse room
 * - admins                    — todos ADMIN entram aqui e recebem todos os eventos
 *
 * Cliente conecta passando { auth: { token } }; backend extrai user do JWT
 * e faz socket.join(...). Conexao sem token continua valida — apenas nao
 * recebe eventos segregados (so broadcasts).
 */

import { Server as IoServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from './config/database.js';

const JWT_SECRET = process.env.JWT_SECRET;

let io = null;

export function setupRealtime(httpServer) {
  const isDev = process.env.NODE_ENV === 'development';
  const ALLOWED_ORIGINS = [
    ...(isDev ? ['http://localhost:5173', 'http://localhost:3000'] : []),
    'https://cobranca.lmedu.com.br',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  io = new IoServer(httpServer, {
    path: '/ws',
    cors: {
      origin: ALLOWED_ORIGINS,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', async (socket) => {
    console.log(`[Realtime] 🔗 Cliente conectado: ${socket.id}`);

    // Auth opcional via handshake.auth.token. Token ausente/invalido NAO
    // recusa a conexao — cliente fica fora dos rooms (recebe so broadcasts).
    const token = socket.handshake.auth?.token;
    if (token && JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: { id: true, role: true, threecplusAgentId: true },
        });
        if (user) {
          if (user.threecplusAgentId) {
            socket.join(`agent:${user.threecplusAgentId}`);
          }
          if (user.role === 'ADMIN') {
            socket.join('admins');
          }
          console.log(
            `[Realtime] 👤 user=${user.id} role=${user.role} agentId=${user.threecplusAgentId || '-'} → rooms join`
          );
        }
      } catch (err) {
        console.warn(`[Realtime] Token invalido em conexao ${socket.id}: ${err.message}`);
      }
    }

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
