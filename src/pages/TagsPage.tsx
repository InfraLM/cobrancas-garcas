import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Search, Eye, EyeOff } from 'lucide-react';
import * as tagsService from '../services/tags';
import type { Tag } from '../types/tag';
import { rotuloCategoria, TAG_COR_CLASSES, TAG_COR_DEFAULT } from '../types/tag';
import TagFormModal from '../components/tags/TagFormModal';

export default function TagsPage() {
  const navigate = useNavigate();
  const [tags, setTags] = useState<Tag[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [mostrarInativas, setMostrarInativas] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [tagEditando, setTagEditando] = useState<Tag | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const data = await tagsService.listarCatalogo({
        incluirInativos: mostrarInativas,
        incluirUso: true,
      });
      setTags(data);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarInativas]);

  const categoriasExistentes = Array.from(new Set(tags.map(t => t.categoria)));

  // Filtra por busca + agrupa por categoria
  const grupos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtradas = tags.filter(t =>
      !termo ||
      t.label.toLowerCase().includes(termo) ||
      t.codigo.toLowerCase().includes(termo) ||
      t.categoria.toLowerCase().includes(termo)
    );
    const por: Record<string, Tag[]> = {};
    for (const t of filtradas) (por[t.categoria] = por[t.categoria] || []).push(t);
    return Object.entries(por)
      .map(([cat, ts]) => ({
        categoria: cat,
        tags: ts.sort((a, b) => a.ordem - b.ordem || a.label.localeCompare(b.label)),
      }))
      .sort((a, b) => rotuloCategoria(a.categoria).localeCompare(rotuloCategoria(b.categoria)));
  }, [tags, busca]);

  function abrirNova() {
    setTagEditando(null);
    setModalAberto(true);
  }

  function abrirEditar(tag: Tag) {
    setTagEditando(tag);
    setModalAberto(true);
  }

  async function alternarAtivo(tag: Tag) {
    if (tag.ativo) {
      // Desativando
      const ok = window.confirm(
        `Desativar "${tag.label}"?\n\nA tag some do seletor mas alunos que ja a tem mantem o chip. Voce pode reativar a qualquer momento.`
      );
      if (!ok) return;
      try {
        await tagsService.desativarTag(tag.id);
        await carregar();
      } catch (e) {
        alert((e as Error).message);
      }
    } else {
      // Reativando via update
      try {
        await tagsService.atualizarTag(tag.id, { ativo: true });
        await carregar();
      } catch (e) {
        alert((e as Error).message);
      }
    }
  }

  return (
    <div className="max-w-5xl mx-auto pt-2 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/configuracoes')}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-on-surface">Tags</h1>
          <p className="text-[0.8125rem] text-on-surface-variant">Catálogo de motivos de inadimplência</p>
        </div>
        <button
          onClick={abrirNova}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-[0.8125rem] font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={15} />
          Nova tag
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por label, código ou categoria..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-[0.8125rem] bg-white focus:outline-none focus:border-primary"
          />
        </div>
        <button
          onClick={() => setMostrarInativas(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[0.75rem] font-medium border transition-colors ${
            mostrarInativas
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          {mostrarInativas ? <Eye size={13} /> : <EyeOff size={13} />}
          {mostrarInativas ? 'Mostrando inativas' : 'Só ativas'}
        </button>
      </div>

      {/* Conteudo */}
      {carregando ? (
        <div className="text-center py-12 text-[0.8125rem] text-gray-400">Carregando...</div>
      ) : erro ? (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-[0.75rem] text-red-700">{erro}</div>
      ) : grupos.length === 0 ? (
        <div className="text-center py-12 text-[0.8125rem] text-gray-400">Nenhuma tag encontrada</div>
      ) : (
        <div className="space-y-4">
          {grupos.map(g => (
            <div key={g.categoria} className="bg-white rounded-2xl shadow-sm shadow-black/[0.04] overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-[0.875rem] font-semibold text-on-surface">{rotuloCategoria(g.categoria)}</h2>
                <span className="text-[0.6875rem] text-gray-400">{g.tags.length} tag{g.tags.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {g.tags.map(tag => {
                  const cor = (tag.cor && TAG_COR_CLASSES[tag.cor]) || TAG_COR_DEFAULT;
                  return (
                    <div
                      key={tag.id}
                      className={`flex items-center gap-4 px-5 py-3 hover:bg-gray-50/60 transition-colors ${!tag.ativo ? 'opacity-50' : ''}`}
                    >
                      <span className={`w-3 h-3 rounded-full border ${cor.bg} ${cor.border} shrink-0`} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[0.875rem] text-on-surface truncate">{tag.label}</p>
                          {!tag.ativo && (
                            <span className="text-[0.625rem] px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 font-medium">
                              Inativa
                            </span>
                          )}
                        </div>
                        {tag.descricao && (
                          <p className="text-[0.6875rem] text-gray-500 truncate mt-0.5">{tag.descricao}</p>
                        )}
                      </div>

                      <span className="text-[0.625rem] font-mono text-gray-400 shrink-0" title="Código imutável">
                        {tag.codigo}
                      </span>

                      <div className="text-right shrink-0 w-20">
                        <p className="text-[0.625rem] text-gray-400 uppercase tracking-wider">Em uso</p>
                        <p className="text-[0.8125rem] font-medium text-gray-700">
                          {tag.qtdAplicadaAtiva ?? 0}
                          {tag.qtdHistorico !== undefined && tag.qtdHistorico > (tag.qtdAplicadaAtiva ?? 0) && (
                            <span className="text-gray-400 font-normal" title="Total histórico (incluindo removidas)">
                              {' / '}{tag.qtdHistorico}
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => abrirEditar(tag)}
                          title="Editar"
                          className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => alternarAtivo(tag)}
                          title={tag.ativo ? 'Desativar' : 'Reativar'}
                          className={`relative w-9 h-5 rounded-full transition-colors ${tag.ativo ? 'bg-emerald-500' : 'bg-gray-300'}`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${tag.ativo ? 'translate-x-4' : ''}`}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <TagFormModal
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        tag={tagEditando}
        categoriasExistentes={categoriasExistentes}
        onSalvo={() => carregar()}
      />
    </div>
  );
}
