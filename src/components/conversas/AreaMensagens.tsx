import { useEffect, useRef } from 'react';
import type { Mensagem3CPlus } from '../../types/conversa';
import { agruparMensagensPorDia } from '../../types/conversa';
import BolhaMensagem from './BolhaMensagem';

interface AreaMensagensProps {
  mensagens: Mensagem3CPlus[];
  carregando: boolean;
}

export default function AreaMensagens({ mensagens, carregando }: AreaMensagensProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens.length]);

  if (carregando) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f0ede8]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          <span className="text-[0.75rem] text-gray-400">Carregando mensagens...</span>
        </div>
      </div>
    );
  }

  if (mensagens.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f0ede8]">
        <p className="text-[0.8125rem] text-gray-400">Nenhuma mensagem ainda</p>
      </div>
    );
  }

  const grupos = agruparMensagensPorDia(mensagens);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto bg-[#f0ede8] py-3"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d6d1ca' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }}
    >
      {Array.from(grupos.entries()).map(([label, msgs]) => (
        <div key={label}>
          {/* Day separator */}
          <div className="flex justify-center my-3">
            <span className="text-[0.625rem] font-medium text-gray-500 bg-white/90 px-3 py-1 rounded-lg shadow-sm">
              {label}
            </span>
          </div>

          {/* Messages */}
          {msgs.map((msg) => (
            <BolhaMensagem key={msg.id} mensagem={msg} />
          ))}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
