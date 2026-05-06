import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, MessageSquareQuote, RefreshCw, Zap, BadgeCheck, Eye } from 'lucide-react';
import type { TemplateWhatsapp } from '../types/templateWhatsapp';
import {
  CATEGORIA_LABELS as CAT_WA_LABELS,
  CATEGORIA_CORES as CAT_WA_CORES,
} from '../types/templateWhatsapp';
import type { TemplateMeta } from '../types/templateMeta';
import {
  STATUS_META_LABELS,
  STATUS_META_CLASSES,
  CATEGORIA_META_LABELS,
  QUALITY_META_LABELS,
  QUALITY_META_CLASSES,
} from '../types/templateMeta';
import { listarTemplates, removerTemplate } from '../services/templatesWhatsapp';
import {
  listarTemplatesMeta,
  sincronizarTemplatesMeta,
} from '../services/templatesMeta';
import { useRealtime } from '../contexts/RealtimeContext';
import TemplateDrawer from '../components/conversas/TemplateDrawer';
import EscolherTipoTemplateModal from '../components/templatesConversa/EscolherTipoTemplateModal';
import TemplateMetaDrawer from '../components/templatesConversa/TemplateMetaDrawer';

// Item unificado pra exibicao na tabela. Cada linha eh um "atalho" ou "meta".
type ItemUnificado =
  | { tipo: 'atalho'; data: TemplateWhatsapp }
  | { tipo: 'meta'; data: TemplateMeta };

type FiltroTipo = 'todos' | 'atalho' | 'meta';

export default function TemplatesConversaPage() {
  const navigate = useNavigate();
  const [whatsapps, setWhatsapps] = useState<TemplateWhatsapp[]>([]);
  const [metas, setMetas] = useState<TemplateMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [sincronizando, setSincronizando] = useState(false);

  // Modais e drawers
  const [escolherTipoAberto, setEscolherTipoAberto] = useState(false);
  const [drawerAtalhoAberto, setDrawerAtalhoAberto] = useState(false);
  const [atalhoEditando, setAtalhoEditando] = useState<TemplateWhatsapp | null>(null);
  const [metaSelecionado, setMetaSelecionado] = useState<TemplateMeta | null>(null);

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      setErro(null);
      const [wa, meta] = await Promise.all([
        listarTemplates().catch(() => [] as TemplateWhatsapp[]),
        listarTemplatesMeta().catch(() => [] as TemplateMeta[]),
      ]);
      setWhatsapps(wa);
      setMetas(meta);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Escuta atualizacoes em tempo real do webhook Meta:
  // quando Meta aprova/rejeita/pausa um template, evento `template-meta:atualizado`
  // chega via socket e mesclamos no estado local sem refresh manual.
  const realtime = useRealtime();
  useEffect(() => {
    if (!realtime.socket) return;
    const off = realtime.on('template-meta:atualizado', (payload: any) => {
      if (!payload?.id) return;
      setMetas(prev => prev.map(t => t.id === payload.id ? { ...t, ...payload } : t));
    });
    return off;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtime.socket]);

  // Lista unificada com filtragem
  const itens = useMemo<ItemUnificado[]>(() => {
    const todos: ItemUnificado[] = [
      ...whatsapps.map(w => ({ tipo: 'atalho' as const, data: w })),
      ...metas.map(m => ({ tipo: 'meta' as const, data: m })),
    ];

    return todos.filter(item => {
      if (filtroTipo !== 'todos' && item.tipo !== filtroTipo) return false;
      if (busca.trim()) {
        const b = busca.toLowerCase();
        if (item.tipo === 'atalho') {
          return item.data.nome.toLowerCase().includes(b) || item.data.conteudo.toLowerCase().includes(b);
        } else {
          const bodyTexto = (item.data.components.find(c => c.type === 'BODY') as any)?.text || '';
          return item.data.name.toLowerCase().includes(b) || bodyTexto.toLowerCase().includes(b);
        }
      }
      return true;
    }).sort((a, b) => {
      // Aprovados Meta primeiro, depois pending, rejected, drafts; atalhos no fim
      if (a.tipo === 'meta' && b.tipo === 'meta') {
        const ordem: Record<string, number> = { APPROVED: 0, PENDING: 1, REJECTED: 2, PAUSED: 3, DRAFT: 4, DISABLED: 5, IN_APPEAL: 6 };
        return (ordem[a.data.status] ?? 9) - (ordem[b.data.status] ?? 9);
      }
      if (a.tipo === 'meta') return -1;
      if (b.tipo === 'meta') return 1;
      return 0;
    });
  }, [whatsapps, metas, busca, filtroTipo]);

  function handleEscolherTipo(tipo: 'atalho' | 'meta') {
    setEscolherTipoAberto(false);
    if (tipo === 'atalho') {
      setAtalhoEditando(null);
      setDrawerAtalhoAberto(true);
    } else {
      navigate('/configuracoes/templates-conversa/novo-meta');
    }
  }

  function abrirEdicaoAtalho(template: TemplateWhatsapp) {
    setAtalhoEditando(template);
    setDrawerAtalhoAberto(true);
  }

  async function handleExcluirAtalho(template: TemplateWhatsapp) {
    if (!confirm(`Excluir atalho "${template.nome}"?`)) return;
    try {
      await removerTemplate(template.id);
      await carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir');
    }
  }

  async function handleSincronizar() {
    setSincronizando(true);
    try {
      const r = await sincronizarTemplatesMeta();
      await carregar();
      const msg = `${r.criados} novo(s) · ${r.atualizados} atualizado(s) · ${r.naoMudaram} sem mudanças`;
      // Pequeno toast manual
      alert('Sincronização concluída\n' + msg);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao sincronizar');
    } finally {
      setSincronizando(false);
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[1.25rem] font-semibold text-gray-900">Templates da conversa</h1>
          <p className="text-[0.8125rem] text-gray-500 mt-0.5">
            Atalhos rápidos e modelos oficiais Meta usados pelo agente em conversas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSincronizar}
            disabled={sincronizando}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white border border-gray-200 text-gray-700 text-[0.8125rem] hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Puxa o estado atual dos templates Meta"
          >
            <RefreshCw size={13} className={sincronizando ? 'animate-spin' : ''} />
            {sincronizando ? 'Sincronizando...' : 'Sincronizar Meta'}
          </button>
          <button
            onClick={() => setEscolherTipoAberto(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-gray-900 text-white text-[0.8125rem] font-medium hover:bg-gray-800 transition-colors"
          >
            <Plus size={14} />
            Novo template
          </button>
        </div>
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
          {([
            { id: 'todos', label: 'Todos' },
            { id: 'atalho', label: 'Atalhos' },
            { id: 'meta', label: 'Meta oficiais' },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFiltroTipo(opt.id)}
              className={`px-3 py-1.5 rounded-full text-[0.6875rem] font-medium border transition-colors ${
                filtroTipo === opt.id
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {opt.label}
              {opt.id === 'atalho' && ` (${whatsapps.length})`}
              {opt.id === 'meta' && ` (${metas.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading && (
        <p className="text-[0.8125rem] text-gray-400">Carregando templates...</p>
      )}
      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-[0.8125rem] text-red-700">
          {erro}
        </div>
      )}
      {!loading && !erro && itens.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-10 flex flex-col items-center gap-2">
          <MessageSquareQuote size={32} className="text-gray-300" />
          <p className="text-[0.8125rem] text-gray-500">
            {whatsapps.length + metas.length === 0
              ? 'Nenhum template cadastrado ainda.'
              : 'Nenhum template corresponde ao filtro.'}
          </p>
          {whatsapps.length + metas.length === 0 && (
            <button
              onClick={() => setEscolherTipoAberto(true)}
              className="mt-1 text-[0.75rem] text-gray-700 hover:text-gray-900 underline"
            >
              Criar o primeiro template
            </button>
          )}
        </div>
      )}
      {!loading && !erro && itens.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-[0.6875rem] font-medium text-gray-500 uppercase tracking-wider w-12">Tipo</th>
                <th className="text-left px-4 py-2.5 text-[0.6875rem] font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="text-left px-4 py-2.5 text-[0.6875rem] font-medium text-gray-500 uppercase tracking-wider">Categoria/Status</th>
                <th className="text-left px-4 py-2.5 text-[0.6875rem] font-medium text-gray-500 uppercase tracking-wider">Conteúdo</th>
                <th className="text-right px-4 py-2.5 text-[0.6875rem] font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => (
                item.tipo === 'atalho' ? (
                  <LinhaAtalho
                    key={`a-${item.data.id}`}
                    template={item.data}
                    onEditar={() => abrirEdicaoAtalho(item.data)}
                    onExcluir={() => handleExcluirAtalho(item.data)}
                  />
                ) : (
                  <LinhaMeta
                    key={`m-${item.data.id}`}
                    template={item.data}
                    onAbrir={() => setMetaSelecionado(item.data)}
                  />
                )
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modais e Drawers */}
      <EscolherTipoTemplateModal
        aberto={escolherTipoAberto}
        onFechar={() => setEscolherTipoAberto(false)}
        onEscolher={handleEscolherTipo}
      />

      {drawerAtalhoAberto && (
        <TemplateDrawer
          template={atalhoEditando}
          onFechar={() => setDrawerAtalhoAberto(false)}
          onSalvou={() => { setDrawerAtalhoAberto(false); carregar(); }}
        />
      )}

      {metaSelecionado && (
        <TemplateMetaDrawer
          template={metaSelecionado}
          onFechar={() => setMetaSelecionado(null)}
          onMudou={() => { carregar(); setMetaSelecionado(null); }}
        />
      )}
    </div>
  );
}

// ─── Linha: Atalho rápido ────────────────────────────────────

function LinhaAtalho({
  template,
  onEditar,
  onExcluir,
}: { template: TemplateWhatsapp; onEditar: () => void; onExcluir: () => void }) {
  return (
    <tr className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
      <td className="px-4 py-3">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-gray-100 text-gray-500" title="Atalho rápido">
          <Zap size={12} />
        </span>
      </td>
      <td className="px-4 py-3 text-[0.8125rem] font-medium text-gray-900">{template.nome}</td>
      <td className="px-4 py-3">
        <span className={`text-[0.6875rem] px-2 py-0.5 rounded border ${CAT_WA_CORES[template.categoria]}`}>
          {CAT_WA_LABELS[template.categoria]}
        </span>
      </td>
      <td className="px-4 py-3 text-[0.75rem] text-gray-500 max-w-md">
        <p className="line-clamp-2">{template.conteudo}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button onClick={onEditar} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="Editar">
            <Pencil size={14} />
          </button>
          <button onClick={onExcluir} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Excluir">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Linha: Template Meta ────────────────────────────────────

function LinhaMeta({
  template,
  onAbrir,
}: { template: TemplateMeta; onAbrir: () => void }) {
  const bodyText = (template.components.find(c => c.type === 'BODY') as any)?.text || '';
  return (
    <tr className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 cursor-pointer" onClick={onAbrir}>
      <td className="px-4 py-3">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-100 text-emerald-600" title="Template Meta oficial">
          <BadgeCheck size={12} />
        </span>
      </td>
      <td className="px-4 py-3">
        <p className="text-[0.8125rem] font-medium text-gray-900 font-mono">{template.name}</p>
        <p className="text-[0.6875rem] text-gray-400">{template.language}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className={`text-[0.6875rem] px-2 py-0.5 rounded border w-fit ${STATUS_META_CLASSES[template.status]}`}>
            {STATUS_META_LABELS[template.status]}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[0.625rem] text-gray-500">{CATEGORIA_META_LABELS[template.category as keyof typeof CATEGORIA_META_LABELS] || template.category}</span>
            {template.qualityRating && template.qualityRating !== 'UNKNOWN' && (
              <span className={`text-[0.625rem] px-1.5 py-0.5 rounded ${QUALITY_META_CLASSES[template.qualityRating]}`}>
                {QUALITY_META_LABELS[template.qualityRating]}
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-[0.75rem] text-gray-500 max-w-md">
        <p className="line-clamp-2">{bodyText}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button onClick={(e) => { e.stopPropagation(); onAbrir(); }} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="Ver detalhes">
            <Eye size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}
