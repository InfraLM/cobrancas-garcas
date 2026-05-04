import { useState, useEffect, useRef } from 'react';
import { Users, X, Check } from 'lucide-react';
import { listarUsuarios } from '../../services/users';
import type { User } from '../../types';

interface Props {
  agenteIds: number[];
  onChange: (ids: number[]) => void;
}

/**
 * Multi-select de agentes que afeta os 3 graficos do dashboard:
 * Funil, Pago por Faixa de Inadimplencia e Recuperado por Forma.
 *
 * Vazio = todos os agentes (sem filtro). Persiste em localStorage no parent.
 */
export default function FiltroAgentes({ agenteIds, onChange }: Props) {
  const [aberto, setAberto] = useState(false);
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Carrega usuarios uma vez ao montar
  useEffect(() => {
    setLoading(true);
    listarUsuarios()
      .then(us => setUsuarios(us.filter(u => u.ativo).sort((a, b) => a.nome.localeCompare(b.nome))))
      .catch(err => console.error('Erro ao listar usuarios:', err))
      .finally(() => setLoading(false));
  }, []);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    function onDocClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [aberto]);

  function toggleAgente(id: number) {
    if (agenteIds.includes(id)) {
      onChange(agenteIds.filter(x => x !== id));
    } else {
      onChange([...agenteIds, id]);
    }
  }

  function limparTudo() {
    onChange([]);
  }

  // Label do botao: nomes selecionados ou "Todos"
  const selecionados = usuarios.filter(u => agenteIds.includes(u.id));
  const labelBotao = (() => {
    if (selecionados.length === 0) return 'Todos os agentes';
    if (selecionados.length === 1) return selecionados[0].nome;
    if (selecionados.length === 2) return `${selecionados[0].nome.split(' ')[0]}, ${selecionados[1].nome.split(' ')[0]}`;
    return `${selecionados.length} agentes`;
  })();

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setAberto(!aberto)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.75rem] shadow-sm transition-colors ${
          agenteIds.length > 0
            ? 'bg-primary text-white hover:bg-primary/90'
            : 'bg-white text-on-surface-variant hover:bg-gray-50'
        }`}
      >
        <Users size={13} />
        <span className="font-medium">{labelBotao}</span>
        {agenteIds.length > 0 && (
          <span
            onClick={(e) => { e.stopPropagation(); limparTudo(); }}
            className="ml-1 hover:bg-white/20 rounded p-0.5"
            role="button"
            aria-label="Limpar filtro"
          >
            <X size={11} />
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-wider">Filtrar por agente</span>
            {agenteIds.length > 0 && (
              <button
                onClick={limparTudo}
                className="text-[0.6875rem] text-primary hover:underline"
              >
                Limpar
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-4 text-[0.75rem] text-gray-400 text-center">Carregando...</div>
            ) : usuarios.length === 0 ? (
              <div className="px-3 py-4 text-[0.75rem] text-gray-400 text-center">Nenhum usuario ativo</div>
            ) : (
              usuarios.map(u => {
                const selecionado = agenteIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => toggleAgente(u.id)}
                    className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      selecionado ? 'bg-primary border-primary' : 'border-gray-300'
                    }`}>
                      {selecionado && <Check size={11} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.8125rem] font-medium text-on-surface truncate">{u.nome}</p>
                      <p className="text-[0.625rem] text-on-surface-variant uppercase tracking-wider">{u.role}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
