import { useEffect, useRef, useState } from 'react';
import { ChevronDown, BadgeCheck, MessageCircle } from 'lucide-react';
import type { InstanciaWhatsappUser } from '../../types';

interface Props {
  instancias: InstanciaWhatsappUser[];
  selecionadaId: string;
  onSelecionar: (instanciaId: string) => void;
  desabilitado?: boolean;
}

// Dropdown compacto (estilo print da 3C Plus) que permite o agente trocar de
// canal de envio durante a conversa. Mostra "WABA" ou "WhatsApp 3C+" no botão
// e abre lista com todas as instâncias vinculadas ao agente.
export default function SeletorCanal({ instancias, selecionadaId, onSelecionar, desabilitado }: Props) {
  const [aberto, setAberto] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const atual = instancias.find(i => i.instanciaId === selecionadaId) || instancias[0];

  // Fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    function onDocClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [aberto]);

  if (instancias.length === 0) return null;

  // Se só tem 1 instância, só mostra (sem dropdown)
  const eh1So = instancias.length === 1;

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <button
        type="button"
        onClick={() => !eh1So && !desabilitado && setAberto(!aberto)}
        disabled={desabilitado}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[0.6875rem] font-medium border transition-colors ${
          atual?.tipo === 'waba'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
        } ${eh1So ? 'cursor-default' : 'cursor-pointer'} ${desabilitado ? 'opacity-50' : ''}`}
        title={atual?.apelido || atual?.instanciaId}
      >
        {atual?.tipo === 'waba' ? <BadgeCheck size={11} /> : <MessageCircle size={11} />}
        <span>{labelCanal(atual)}</span>
        {!eh1So && <ChevronDown size={11} className={`transition-transform ${aberto ? 'rotate-180' : ''}`} />}
      </button>

      {aberto && instancias.length > 1 && (
        <div className="absolute left-0 bottom-full mb-1 min-w-[200px] bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-gray-100 text-[0.625rem] font-bold text-gray-500 uppercase tracking-wider">
            Selecionar canal
          </div>
          {instancias.map((inst) => {
            const ehAtual = inst.instanciaId === selecionadaId;
            const ehWaba = inst.tipo === 'waba';
            return (
              <button
                key={inst.id}
                onClick={() => { onSelecionar(inst.instanciaId); setAberto(false); }}
                className={`w-full px-3 py-2 flex items-start gap-2 text-left hover:bg-gray-50 transition-colors ${ehAtual ? 'bg-gray-50' : ''}`}
              >
                <span className={`mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded ${ehWaba ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-600'}`}>
                  {ehWaba ? <BadgeCheck size={11} /> : <MessageCircle size={11} />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[0.75rem] font-medium text-gray-900">{labelCanal(inst)}</p>
                  <p className="text-[0.625rem] text-gray-500 truncate">{inst.apelido}</p>
                </div>
                {ehAtual && <span className="text-[0.625rem] text-emerald-600 font-medium">Selecionado</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function labelCanal(inst?: InstanciaWhatsappUser | null): string {
  if (!inst) return 'Canal';
  if (inst.tipo === 'waba') return 'WABA';
  return 'WhatsApp 3C+';
}
