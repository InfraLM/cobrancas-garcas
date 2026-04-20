/**
 * Context de Realtime — mantem UMA conexao Socket.io com o backend (/ws)
 * enquanto o app esta aberto. Paginas se inscrevem em eventos via hook.
 *
 * Nao desconecta ao navegar entre rotas (esse era o bug que causava
 * "Cliente desconectado" → "Cliente conectado" em loop).
 */

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

interface RealtimeContextValue {
  socket: Socket | null;
  conectado: boolean;
  on: <T = any>(evento: string, callback: (payload: T) => void) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used inside RealtimeProvider');
  return ctx;
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [conectado, setConectado] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      path: '/ws',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Realtime] ✅ Conectado ao backend');
      setConectado(true);
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Realtime] ⚠️  Desconectado:', reason);
      setConectado(false);
    });

    socket.on('connect_error', (err) => {
      console.error('[Realtime] ❌ Erro:', err.message);
    });

    return () => {
      console.log('[Realtime] 🛑 Desmontando provider — desconectando');
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const on: RealtimeContextValue['on'] = (evento, callback) => {
    const socket = socketRef.current;
    if (!socket) return () => {};
    socket.on(evento, callback as any);
    return () => {
      socket.off(evento, callback as any);
    };
  };

  return (
    <RealtimeContext.Provider value={{ socket: socketRef.current, conectado, on }}>
      {children}
    </RealtimeContext.Provider>
  );
}
