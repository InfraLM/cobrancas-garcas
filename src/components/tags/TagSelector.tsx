import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, X, Check } from 'lucide-react';
import type { Tag } from '../../types/tag';
import { rotuloCategoria, TAG_COR_CLASSES, TAG_COR_DEFAULT } from '../../types/tag';

interface Props {
  catalogo: Tag[];
  // Codigos das tags ja aplicadas (para mostrar "Aplicada" no item)
  jaAplicadasCodigos: Set<string>;
  onSelect: (tag: Tag, observacao?: string) => Promise<void> | void;
  // Variant: 'button' renderiza botao "+ Tag"; 'inline' integra inline (ex: header da conversa)
  variant?: 'button' | 'inline';
}

export default function TagSelector({ catalogo, jaAplicadasCodigos, onSelect, variant = 'button' }: Props) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [aplicandoId, setAplicandoId] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!aberto) setBusca('');
  }, [aberto]);

  // Agrupa por categoria e filtra por busca
  const grupos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrados = catalogo.filter(t => {
      if (!t.ativo) return false;
      if (!termo) return true;
      return t.label.toLowerCase().includes(termo) || t.codigo.toLowerCase().includes(termo);
    });
    const por: Record<string, Tag[]> = {};
    for (const t of filtrados) {
      (por[t.categoria] = por[t.categoria] || []).push(t);
    }
    return Object.entries(por).map(([cat, tags]) => ({
      categoria: cat,
      tags: tags.sort((a, b) => a.ordem - b.ordem || a.label.localeCompare(b.label)),
    }));
  }, [catalogo, busca]);

  async function handleSelect(tag: Tag) {
    if (jaAplicadasCodigos.has(tag.codigo)) return;
    setAplicandoId(tag.id);
    try {
      await onSelect(tag);
    } finally {
      setAplicandoId(null);
      setAberto(false);
    }
  }

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {variant === 'button' ? (
        <button
          type="button"
          onClick={() => setAberto(!aberto)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-gray-300 text-[0.75rem] text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors"
        >
          <Plus size={12} /> Tag
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setAberto(!aberto)}
          className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-dashed border-gray-300 text-gray-400 hover:bg-gray-50 hover:border-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Adicionar tag"
        >
          <Plus size={11} />
        </button>
      )}

      {aberto && (
        <div className="absolute left-0 top-full mt-1 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
          {/* Header com busca */}
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
            <Search size={13} className="text-gray-400 shrink-0" />
            <input
              autoFocus
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar tag..."
              className="flex-1 text-[0.8125rem] outline-none placeholder:text-gray-400"
            />
            {busca && (
              <button onClick={() => setBusca('')} className="text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Lista agrupada */}
          <div className="max-h-80 overflow-y-auto">
            {grupos.length === 0 ? (
              <div className="px-3 py-4 text-[0.75rem] text-gray-400 text-center">
                Nenhuma tag encontrada
              </div>
            ) : grupos.map(g => (
              <div key={g.categoria}>
                <div className="px-3 py-1.5 bg-gray-50 text-[0.625rem] font-bold text-gray-500 uppercase tracking-wider sticky top-0">
                  {rotuloCategoria(g.categoria)}
                </div>
                {g.tags.map(tag => {
                  const aplicada = jaAplicadasCodigos.has(tag.codigo);
                  const cor = (tag.cor && TAG_COR_CLASSES[tag.cor]) || TAG_COR_DEFAULT;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      disabled={aplicada || aplicandoId === tag.id}
                      onClick={() => handleSelect(tag)}
                      className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left transition-colors ${
                        aplicada
                          ? 'bg-gray-50 cursor-not-allowed opacity-60'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full ${cor.bg} border ${cor.border} shrink-0`} />
                        <div className="min-w-0">
                          <p className="text-[0.8125rem] text-on-surface truncate">{tag.label}</p>
                          {tag.descricao && (
                            <p className="text-[0.6875rem] text-gray-500 truncate">{tag.descricao}</p>
                          )}
                        </div>
                      </div>
                      {aplicada && <Check size={13} className="text-green-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
