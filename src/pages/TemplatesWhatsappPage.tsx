import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, MessageSquareQuote } from 'lucide-react';
import type { TemplateWhatsapp, CategoriaTemplate } from '../types/templateWhatsapp';
import {
  CATEGORIAS_TEMPLATE,
  CATEGORIA_LABELS,
  CATEGORIA_CORES,
} from '../types/templateWhatsapp';
import {
  listarTemplates,
  removerTemplate,
} from '../services/templatesWhatsapp';
import TemplateDrawer from '../components/conversas/TemplateDrawer';

export default function TemplatesWhatsappPage() {
  const [templates, setTemplates] = useState<TemplateWhatsapp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaTemplate | 'todos'>('todos');
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [templateEditando, setTemplateEditando] = useState<TemplateWhatsapp | null>(null);

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listarTemplates();
      setTemplates(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const templatesFiltrados = useMemo(() => {
    return templates.filter((t) => {
      if (categoriaFiltro !== 'todos' && t.categoria !== categoriaFiltro) return false;
      if (busca.trim()) {
        const b = busca.toLowerCase();
        return (
          t.nome.toLowerCase().includes(b) ||
          t.conteudo.toLowerCase().includes(b)
        );
      }
      return true;
    });
  }, [templates, busca, categoriaFiltro]);

  function abrirCriacao() {
    setTemplateEditando(null);
    setDrawerAberto(true);
  }

  function abrirEdicao(template: TemplateWhatsapp) {
    setTemplateEditando(template);
    setDrawerAberto(true);
  }

  async function handleExcluir(template: TemplateWhatsapp) {
    if (!confirm(`Excluir template "${template.nome}"?`)) return;
    try {
      await removerTemplate(template.id);
      await carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir');
    }
  }

  function handleSalvou() {
    setDrawerAberto(false);
    setTemplateEditando(null);
    carregar();
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[1.25rem] font-semibold text-gray-900">Templates de WhatsApp</h1>
          <p className="text-[0.8125rem] text-gray-500 mt-0.5">
            Mensagens rápidas com variáveis para agilizar o atendimento.
          </p>
        </div>
        <button
          onClick={abrirCriacao}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-gray-900 text-white text-[0.8125rem] font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus size={14} />
          Novo template
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou conteúdo..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-gray-200 text-[0.8125rem] focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCategoriaFiltro('todos')}
            className={`px-3 py-1.5 rounded-full text-[0.6875rem] font-medium border transition-colors ${
              categoriaFiltro === 'todos'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            Todas
          </button>
          {CATEGORIAS_TEMPLATE.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoriaFiltro(cat)}
              className={`px-3 py-1.5 rounded-full text-[0.6875rem] font-medium border transition-colors ${
                categoriaFiltro === cat
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {CATEGORIA_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading && (
        <p className="text-[0.8125rem] text-gray-400">Carregando templates...</p>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-[0.8125rem] text-red-700">
          {error}
        </div>
      )}
      {!loading && !error && templatesFiltrados.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-10 flex flex-col items-center gap-2">
          <MessageSquareQuote size={32} className="text-gray-300" />
          <p className="text-[0.8125rem] text-gray-500">
            {templates.length === 0
              ? 'Nenhum template cadastrado ainda.'
              : 'Nenhum template corresponde ao filtro.'}
          </p>
          {templates.length === 0 && (
            <button
              onClick={abrirCriacao}
              className="mt-1 text-[0.75rem] text-gray-700 hover:text-gray-900 underline"
            >
              Criar o primeiro template
            </button>
          )}
        </div>
      )}
      {!loading && !error && templatesFiltrados.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-[0.6875rem] font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="text-left px-4 py-2.5 text-[0.6875rem] font-medium text-gray-500 uppercase tracking-wider">
                  Categoria
                </th>
                <th className="text-left px-4 py-2.5 text-[0.6875rem] font-medium text-gray-500 uppercase tracking-wider">
                  Preview
                </th>
                <th className="text-left px-4 py-2.5 text-[0.6875rem] font-medium text-gray-500 uppercase tracking-wider">
                  Criado por
                </th>
                <th className="text-right px-4 py-2.5 text-[0.6875rem] font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {templatesFiltrados.map((t) => (
                <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-[0.8125rem] font-medium text-gray-900">
                    {t.nome}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[0.6875rem] px-2 py-0.5 rounded border ${CATEGORIA_CORES[t.categoria]}`}
                    >
                      {CATEGORIA_LABELS[t.categoria]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[0.75rem] text-gray-500 max-w-md">
                    <p className="line-clamp-2">{t.conteudo}</p>
                  </td>
                  <td className="px-4 py-3 text-[0.75rem] text-gray-500">
                    {t.criadoPorNome || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => abrirEdicao(t)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleExcluir(t)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer */}
      {drawerAberto && (
        <TemplateDrawer
          template={templateEditando}
          onFechar={() => setDrawerAberto(false)}
          onSalvou={handleSalvou}
        />
      )}
    </div>
  );
}
