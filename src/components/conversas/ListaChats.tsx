import { useState } from 'react';
import type { ConversaCobranca } from '../../types/conversa';
import ChatItem from './ChatItem';
import { Search, X } from 'lucide-react';

type TabConversaCobranca = 'aguardando' | 'meus' | 'equipe' | 'encerradas';

interface ListaChatsProps {
  conversas: ConversaCobranca[];
  conversaAtivaId: string | null;
  onSelecionar: (conversa: ConversaCobranca) => void;
  agenteIdLogado: number;
}

const tabs: { key: TabConversaCobranca; label: string }[] = [
  { key: 'aguardando', label: 'Aguardando' },
  { key: 'meus', label: 'Meus' },
  { key: 'equipe', label: 'Equipe' },
  { key: 'encerradas', label: 'Encerradas' },
];

export default function ListaChats({ conversas, conversaAtivaId, onSelecionar, agenteIdLogado }: ListaChatsProps) {
  const [tab, setTab] = useState<TabConversaCobranca>('aguardando');
  const [busca, setBusca] = useState('');

  const filtradas = conversas
    .filter((c) => {
      switch (tab) {
        case 'aguardando':
          return c.status === 'AGUARDANDO';
        case 'meus':
          // Inclui SNOOZE dos meus — com indicador visual no card
          return (c.status === 'EM_ATENDIMENTO' || c.status === 'SNOOZE') && c.agenteId === agenteIdLogado;
        case 'equipe':
          return (c.status === 'EM_ATENDIMENTO' || c.status === 'SNOOZE') && c.agenteId !== agenteIdLogado && c.agenteId != null;
        case 'encerradas':
          return c.status === 'ENCERRADA';
        default:
          return true;
      }
    })
    .filter((c) => {
      if (!busca.trim()) return true;
      const termo = busca.toLowerCase();
      return (
        (c.contatoNome || '').toLowerCase().includes(termo) ||
        c.contatoNumero.toLowerCase().includes(termo)
      );
    })
    .sort((a, b) => {
      const tsA = a.ultimaMensagemCliente ? new Date(a.ultimaMensagemCliente).getTime() : new Date(a.criadoEm).getTime();
      const tsB = b.ultimaMensagemCliente ? new Date(b.ultimaMensagemCliente).getTime() : new Date(b.criadoEm).getTime();
      return tsB - tsA;
    });

  const contadores = {
    aguardando: conversas.filter(c => c.status === 'AGUARDANDO').length,
    meus: conversas.filter(c => (c.status === 'EM_ATENDIMENTO' || c.status === 'SNOOZE') && c.agenteId === agenteIdLogado).length,
    equipe: conversas.filter(c => (c.status === 'EM_ATENDIMENTO' || c.status === 'SNOOZE') && c.agenteId !== agenteIdLogado && c.agenteId != null).length,
    encerradas: conversas.filter(c => c.status === 'ENCERRADA').length,
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-[0.9375rem] font-semibold text-gray-900 mb-3">Conversas</h2>

        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, número..."
            className="w-full h-8 pl-8 pr-8 rounded-lg bg-gray-50 border border-gray-100 text-[0.75rem] text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300"
          />
          {busca && (
            <button
              onClick={() => setBusca('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-0.5 bg-gray-50 rounded-lg p-0.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 text-[0.6875rem] font-medium py-1.5 rounded-md transition-colors ${
                tab === t.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              {contadores[t.key] > 0 && (
                <span className={`ml-1 text-[0.625rem] ${
                  tab === t.key ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  {contadores[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <p className="text-[0.75rem] text-gray-400 text-center">
              {busca ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa nesta aba'}
            </p>
          </div>
        ) : (
          filtradas.map((c) => (
            <ChatItem
              key={c.id}
              conversa={c}
              ativo={c.id === conversaAtivaId}
              onClick={() => onSelecionar(c)}
            />
          ))
        )}
      </div>
    </div>
  );
}
