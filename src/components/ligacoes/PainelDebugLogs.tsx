import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Trash2, Copy } from 'lucide-react';

export interface DebugLog {
  id: string;
  timestamp: string;
  categoria: 'socket' | 'http' | 'webrtc' | 'sistema' | 'erro';
  mensagem: string;
  dados?: unknown;
}

interface PainelDebugLogsProps {
  logs: DebugLog[];
  onLimpar: () => void;
}

const corCategoria: Record<DebugLog['categoria'], string> = {
  socket: 'text-violet-400',
  http: 'text-blue-400',
  webrtc: 'text-amber-400',
  sistema: 'text-gray-400',
  erro: 'text-red-400',
};

const bgCategoria: Record<DebugLog['categoria'], string> = {
  socket: 'bg-violet-500',
  http: 'bg-blue-500',
  webrtc: 'bg-amber-500',
  sistema: 'bg-gray-500',
  erro: 'bg-red-500',
};

const labelCategoria: Record<DebugLog['categoria'], string> = {
  socket: 'SOCKET',
  http: 'HTTP',
  webrtc: 'WEBRTC',
  sistema: 'SISTEMA',
  erro: 'ERRO',
};

function formatarHora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
}

export default function PainelDebugLogs({ logs, onLimpar }: PainelDebugLogsProps) {
  const [expandido, setExpandido] = useState(true);
  const [expandidoItem, setExpandidoItem] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && expandido) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length, expandido]);

  function copiarLogs() {
    const text = logs.map(l => {
      const dados = l.dados ? `\n${JSON.stringify(l.dados, null, 2)}` : '';
      return `[${formatarHora(l.timestamp)}] [${labelCategoria[l.categoria]}] ${l.mensagem}${dados}`;
    }).join('\n\n');
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="fixed bottom-4 right-4 z-[90] w-[480px] max-h-[60vh] flex flex-col bg-gray-950 rounded-xl border border-gray-800 shadow-2xl shadow-black/50 font-mono text-[0.6875rem]">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-gray-800 cursor-pointer select-none"
        onClick={() => setExpandido(!expandido)}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-gray-300 font-medium text-[0.75rem]">Debug 3C Plus</span>
          <span className="text-gray-600">({logs.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); copiarLogs(); }} className="p-1 text-gray-600 hover:text-gray-400 transition-colors" title="Copiar logs">
            <Copy size={12} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onLimpar(); }} className="p-1 text-gray-600 hover:text-red-400 transition-colors" title="Limpar">
            <Trash2 size={12} />
          </button>
          {expandido ? <ChevronDown size={14} className="text-gray-600" /> : <ChevronUp size={14} className="text-gray-600" />}
        </div>
      </div>

      {/* Logs */}
      {expandido && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 max-h-[50vh]">
          {logs.map((entry) => (
            <div
              key={entry.id}
              className="px-3 py-1.5 border-b border-gray-900 hover:bg-gray-900/50 cursor-pointer"
              onClick={() => setExpandidoItem(expandidoItem === entry.id ? null : entry.id)}
            >
              <div className="flex items-start gap-2">
                <span className="text-gray-700 shrink-0">{formatarHora(entry.timestamp)}</span>
                <span className={`shrink-0 px-1 rounded text-[0.5625rem] font-bold ${bgCategoria[entry.categoria]} text-white`}>
                  {labelCategoria[entry.categoria]}
                </span>
                <span className={`${corCategoria[entry.categoria]} break-all`}>{entry.mensagem}</span>
              </div>

              {expandidoItem === entry.id && entry.dados != null ? (
                <pre className="mt-1.5 ml-[72px] text-[0.625rem] text-gray-500 bg-gray-900 rounded p-2 overflow-x-auto max-h-[200px] whitespace-pre-wrap">
                  {JSON.stringify(entry.dados, null, 2)}
                </pre>
              ) : null}
            </div>
          ))}

          {logs.length === 0 && (
            <p className="text-gray-700 text-center py-6">Nenhum log ainda. Clique "Ir Online" para começar.</p>
          )}
        </div>
      )}
    </div>
  );
}
