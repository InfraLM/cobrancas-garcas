import { useEffect, useRef } from 'react';
import type { EventoLigacao } from '../../types/ligacao';
import { eventoLabel, categoriaEvento } from '../../types/ligacao';
import { formatarTelefone } from '../../mocks/ligacoes';

interface LogEventosProps {
  eventos: EventoLigacao[];
}

const corCategoria = {
  sucesso: 'bg-emerald-500',
  erro: 'bg-red-500',
  info: 'bg-blue-500',
  neutro: 'bg-gray-500',
};

const corTexto = {
  sucesso: 'text-emerald-400',
  erro: 'text-red-400',
  info: 'text-blue-400',
  neutro: 'text-gray-500',
};

function formatarHora(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function LogEventos({ eventos }: LogEventosProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [eventos.length]);

  return (
    <div className="bg-gray-950 rounded-xl border border-gray-800 flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-800">
        <p className="text-[0.625rem] uppercase tracking-wider text-gray-500 font-medium">
          Log de eventos <span className="normal-case tracking-normal text-gray-600">({eventos.length})</span>
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0">
        {eventos.map((evento) => {
          const cat = categoriaEvento[evento.tipo];
          return (
            <div key={evento.id} className="flex items-start gap-2.5 py-1">
              <span className="font-mono text-[0.6875rem] text-gray-600 shrink-0 mt-0.5">
                {formatarHora(evento.timestamp)}
              </span>
              <div className={`w-1.5 h-1.5 rounded-full ${corCategoria[cat]} shrink-0 mt-1.5`} />
              <div className="min-w-0">
                <span className={`text-[0.75rem] font-medium ${corTexto[cat]}`}>
                  {eventoLabel[evento.tipo]}
                </span>
                {evento.telefone && (
                  <span className="text-[0.6875rem] text-gray-600 ml-2">
                    {formatarTelefone(evento.telefone)}
                  </span>
                )}
                {evento.pessoaNome && (
                  <span className="text-[0.6875rem] text-gray-500 ml-1.5">
                    — {evento.pessoaNome}
                  </span>
                )}
                {evento.duracao != null && (
                  <span className="text-[0.6875rem] text-gray-600 ml-1.5">
                    ({Math.floor(evento.duracao / 60)}:{String(evento.duracao % 60).padStart(2, '0')})
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {eventos.length === 0 && (
          <p className="text-[0.75rem] text-gray-700 text-center py-8">
            Aguardando eventos...
          </p>
        )}
      </div>
    </div>
  );
}
