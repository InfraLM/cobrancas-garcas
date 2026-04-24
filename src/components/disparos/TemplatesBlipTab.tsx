import { useState, useEffect, useCallback } from 'react';
import { Plus, Loader2, Pencil, Trash2, Send, Receipt, User } from 'lucide-react';
import type { TemplateBlip } from '../../types/templateBlip';
import { CATEGORIA_BLIP_LABEL, CATEGORIA_BLIP_COR } from '../../types/templateBlip';
import { listarTemplatesBlip, removerTemplateBlip } from '../../services/templatesBlip';
import TemplateBlipModal from './TemplateBlipModal';
import DispararAgoraModal from './DispararAgoraModal';

export default function TemplatesBlipTab() {
  const [templates, setTemplates] = useState<TemplateBlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<TemplateBlip | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [dispararTemplate, setDispararTemplate] = useState<TemplateBlip | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listarTemplatesBlip();
      setTemplates(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function handleRemover(t: TemplateBlip) {
    if (!confirm(`Remover o template "${t.titulo}"? (não pode estar em uso em nenhuma régua)`)) return;
    try {
      await removerTemplateBlip(t.id);
      carregar();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao remover');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[0.8125rem] text-on-surface-variant">
          Templates aprovados na Blip/Meta com mapeamento de variáveis. Usados em réguas automáticas ou disparos pontuais.
        </p>
        <button
          onClick={() => { setEditando(null); setModalAberto(true); }}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-gray-900 text-white text-[0.8125rem] font-medium hover:bg-gray-800"
        >
          <Plus size={14} /> Novo template
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={22} className="animate-spin text-primary" />
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
          <p className="text-[0.8125rem] text-gray-400">Nenhum template cadastrado ainda.</p>
          <p className="text-[0.75rem] text-gray-300 mt-1">Clique em "Novo template" acima.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          {templates.map((t) => {
            const cor = CATEGORIA_BLIP_COR[t.categoria];
            return (
              <div key={t.id} className="p-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[0.875rem] font-semibold text-gray-900">{t.titulo}</h3>
                    <span className={`text-[0.625rem] font-medium px-2 py-0.5 rounded ${cor.bg} ${cor.text}`}>
                      {CATEGORIA_BLIP_LABEL[t.categoria]}
                    </span>
                    {t.escopo === 'TITULO' ? (
                      <span className="inline-flex items-center gap-1 text-[0.625rem] font-semibold px-2 py-0.5 rounded bg-violet-50 text-violet-700" title="Usa variáveis de título específicas — exige segmentação por título.">
                        <Receipt size={10} /> Por título
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[0.625rem] font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-700" title="Não usa variáveis de título — serve para qualquer segmentação.">
                        <User size={10} /> Universal
                      </span>
                    )}
                    {!t.ativo && <span className="text-[0.625rem] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-500">Inativo</span>}
                  </div>
                  <p className="text-[0.75rem] font-mono text-gray-400 mt-0.5">{t.nomeBlip}</p>
                  {t.descricao && <p className="text-[0.75rem] text-gray-500 mt-1">{t.descricao}</p>}
                  <p className="text-[0.6875rem] text-gray-400 mt-1">
                    {t.variaveis.length} variáveis · {t.conteudoPreview.slice(0, 90).replace(/\n/g, ' ')}…
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setDispararTemplate(t)}
                    disabled={!t.ativo}
                    className="inline-flex items-center gap-1 px-3 h-8 rounded-md text-[0.75rem] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Disparar este template para uma segmentação"
                  >
                    <Send size={12} /> Disparar agora
                  </button>
                  <button
                    onClick={() => { setEditando(t); setModalAberto(true); }}
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-md"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleRemover(t)}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-md"
                    title="Remover"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TemplateBlipModal
        aberto={modalAberto}
        onFechar={() => { setModalAberto(false); setEditando(null); }}
        template={editando}
        onSalvou={() => { setModalAberto(false); setEditando(null); carregar(); }}
      />

      {dispararTemplate && (
        <DispararAgoraModal
          template={dispararTemplate}
          onFechar={() => setDispararTemplate(null)}
        />
      )}
    </div>
  );
}
