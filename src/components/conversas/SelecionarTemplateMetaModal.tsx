import { useState, useEffect, useMemo } from 'react';
import { X, Search, ArrowLeft, Send, Loader2, AlertCircle } from 'lucide-react';
import type { TemplateMeta } from '../../types/templateMeta';
import {
  CATEGORIA_META_LABELS,
  QUALITY_META_CLASSES,
  QUALITY_META_LABELS,
} from '../../types/templateMeta';
import { listarTemplatesMeta } from '../../services/templatesMeta';
import { enviarTemplate } from '../../services/conversas3cplus';
import TemplateMetaPreview from '../templatesConversa/TemplateMetaPreview';
import type { Aluno } from '../../types/aluno';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  chatId: string | number;
  instanciaId: string;
  aluno?: Aluno | null;
  onEnviado?: () => void;
}

// Auto-preenche variáveis com base no aluno vinculado, mapeadas pela fonte
// salva no template (variaveisMap.body[i].fonte).
function autoPreencher(template: TemplateMeta, aluno: Aluno | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  const map = template.variaveisMap?.body || [];
  for (const v of map) {
    let valor = '';
    if (!aluno) { out[String(v.indice)] = ''; continue; }
    switch (v.fonte) {
      case 'NOME_ALUNO': valor = aluno.nome || ''; break;
      case 'PRIMEIRO_NOME': valor = (aluno.nome || '').split(' ')[0] || ''; break;
      case 'CPF': valor = aluno.cpf || ''; break;
      case 'MATRICULA': valor = aluno.matricula || ''; break;
      case 'CURSO_NOME': valor = aluno.cursoNome || ''; break;
      case 'VALOR_INADIMPLENTE':
        valor = aluno.financeiro?.valorInadimplente
          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(aluno.financeiro.valorInadimplente)
          : '';
        break;
      case 'PARCELAS_ATRASO':
        valor = String(aluno.financeiro?.parcelasEmAtraso ?? '');
        break;
      case 'DIAS_ATRASO':
        // Se tem vencimento mais antigo, calcula
        if (aluno.financeiro?.vencimentoMaisAntigo) {
          const venc = new Date(aluno.financeiro.vencimentoMaisAntigo);
          const dias = Math.max(0, Math.floor((Date.now() - venc.getTime()) / 86400000));
          valor = String(dias);
        }
        break;
      default:
        valor = '';
    }
    out[String(v.indice)] = valor;
  }
  return out;
}

export default function SelecionarTemplateMetaModal({ aberto, onFechar, chatId, instanciaId, aluno, onEnviado }: Props) {
  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');
  const [selecionado, setSelecionado] = useState<TemplateMeta | null>(null);
  const [parametros, setParametros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Carregar lista de aprovados ao abrir
  useEffect(() => {
    if (!aberto) return;
    setLoading(true);
    setErro(null);
    listarTemplatesMeta({ status: 'APPROVED', ativo: true })
      .then(setTemplates)
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false));
  }, [aberto]);

  // Reset ao fechar
  useEffect(() => {
    if (!aberto) {
      setSelecionado(null);
      setParametros({});
      setBusca('');
      setFiltroCategoria('todos');
      setErro(null);
    }
  }, [aberto]);

  // Quando seleciona template: auto-preenche parametros pelo aluno
  useEffect(() => {
    if (selecionado) {
      setParametros(autoPreencher(selecionado, aluno));
    }
  }, [selecionado, aluno]);

  // Lista filtrada
  const templatesFiltrados = useMemo(() => {
    return templates.filter(t => {
      if (filtroCategoria !== 'todos' && t.category !== filtroCategoria) return false;
      if (busca.trim()) {
        const b = busca.toLowerCase();
        const bodyText = ((t.components.find(c => c.type === 'BODY') as any)?.text || '').toLowerCase();
        return t.name.toLowerCase().includes(b) || bodyText.includes(b);
      }
      return true;
    });
  }, [templates, busca, filtroCategoria]);

  // Agrupar por categoria
  const grupos = useMemo(() => {
    const por: Record<string, TemplateMeta[]> = {};
    for (const t of templatesFiltrados) {
      const cat = t.category;
      if (!por[cat]) por[cat] = [];
      por[cat].push(t);
    }
    return Object.entries(por);
  }, [templatesFiltrados]);

  // Indices das variaveis do body do template selecionado
  const indices = useMemo(() => {
    if (!selecionado) return [] as number[];
    const bodyComp = selecionado.components.find(c => c.type === 'BODY') as any;
    if (!bodyComp?.text) return [];
    const matches = [...(bodyComp.text as string).matchAll(/\{\{(\d+)\}\}/g)];
    return Array.from(new Set(matches.map(m => Number(m[1])))).sort((a, b) => a - b);
  }, [selecionado]);

  const todasVariaveisPreenchidas = indices.every(i => (parametros[String(i)] || '').trim() !== '');

  async function handleEnviar() {
    if (!selecionado) return;
    if (!todasVariaveisPreenchidas) {
      setErro('Preencha todas as variáveis antes de enviar.');
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await enviarTemplate(chatId, instanciaId, selecionado.id, parametros);
      if (onEnviado) onEnviado();
      onFechar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (!aberto) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onFechar} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col pointer-events-auto" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2 min-w-0">
              {selecionado && (
                <button onClick={() => setSelecionado(null)} className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                  <ArrowLeft size={16} />
                </button>
              )}
              <div className="min-w-0">
                {selecionado ? (
                  <p className="text-[0.875rem] font-semibold text-gray-900 font-mono truncate">{selecionado.name}</p>
                ) : (
                  <p className="text-[0.875rem] font-semibold text-gray-900">Selecionar modelo de mensagem</p>
                )}
                <p className="text-[0.6875rem] text-gray-500 mt-0.5">
                  {selecionado ? CATEGORIA_META_LABELS[selecionado.category as keyof typeof CATEGORIA_META_LABELS] : 'Templates aprovados pela Meta para envio fora da janela 24h'}
                </p>
              </div>
            </div>
            <button onClick={onFechar} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
              <X size={16} />
            </button>
          </div>

          {/* Conteúdo */}
          {!selecionado ? (
            // ─── Etapa 1: Lista ─────────────────────────────────
            <>
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    autoFocus
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    placeholder="Buscar por nome ou conteúdo..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[0.8125rem] focus:outline-none focus:ring-1 focus:ring-gray-300"
                  />
                </div>
                <select
                  value={filtroCategoria}
                  onChange={e => setFiltroCategoria(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-[0.75rem]"
                >
                  <option value="todos">Todas categorias</option>
                  <option value="UTILITY">Utility</option>
                  <option value="MARKETING">Marketing</option>
                  <option value="AUTHENTICATION">Authentication</option>
                </select>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3">
                {loading ? (
                  <p className="text-center text-[0.8125rem] text-gray-400 py-8">Carregando templates...</p>
                ) : templatesFiltrados.length === 0 ? (
                  <p className="text-center text-[0.8125rem] text-gray-400 py-8">
                    {templates.length === 0
                      ? 'Nenhum template aprovado disponível. Crie e aguarde aprovação Meta em Configurações.'
                      : 'Nenhum template corresponde ao filtro.'}
                  </p>
                ) : grupos.map(([cat, lista]) => (
                  <div key={cat} className="mb-4">
                    <p className="text-[0.625rem] font-bold text-gray-500 uppercase tracking-wider mb-1.5 px-2">
                      {CATEGORIA_META_LABELS[cat as keyof typeof CATEGORIA_META_LABELS] || cat}
                    </p>
                    <div className="space-y-1.5">
                      {lista.map(t => {
                        const bodyText = (t.components.find(c => c.type === 'BODY') as any)?.text || '';
                        return (
                          <button
                            key={t.id}
                            onClick={() => setSelecionado(t)}
                            className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className="text-[0.8125rem] font-medium text-gray-900 font-mono truncate">{t.name}</p>
                              {t.qualityRating && t.qualityRating !== 'UNKNOWN' && (
                                <span className={`text-[0.625rem] px-1.5 py-0.5 rounded shrink-0 ${QUALITY_META_CLASSES[t.qualityRating]}`}>
                                  {QUALITY_META_LABELS[t.qualityRating]}
                                </span>
                              )}
                            </div>
                            <p className="text-[0.75rem] text-gray-600 line-clamp-2">{bodyText}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            // ─── Etapa 2: Preencher e enviar ─────────────────────
            <>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Preview */}
                <div>
                  <p className="text-[0.625rem] font-bold text-gray-500 uppercase tracking-wider mb-2">Como o aluno vai ver:</p>
                  <TemplateMetaPreview components={selecionado.components} variaveis={parametros} comMockup={false} />
                </div>

                {/* Variáveis */}
                {indices.length > 0 && (
                  <div>
                    <p className="text-[0.625rem] font-bold text-gray-500 uppercase tracking-wider mb-2">Variáveis</p>
                    <div className="space-y-2">
                      {indices.map(i => {
                        const fonte = selecionado.variaveisMap?.body?.find((v: any) => v.indice === i)?.fonte;
                        const autoPreenchido = !!parametros[String(i)] && fonte && fonte !== 'CUSTOM';
                        return (
                          <div key={i}>
                            <label className="block text-[0.6875rem] text-gray-600 mb-1">
                              <span className="font-mono bg-gray-100 px-1 rounded">{`{{${i}}}`}</span>
                              {fonte && <span className="ml-2 text-gray-500">{fonte === 'CUSTOM' ? 'Texto livre' : fonte}</span>}
                              {autoPreenchido && <span className="ml-2 text-emerald-600">✓ auto-preenchido</span>}
                            </label>
                            <input
                              value={parametros[String(i)] || ''}
                              onChange={e => setParametros(prev => ({ ...prev, [String(i)]: e.target.value }))}
                              placeholder={`Valor para {{${i}}}`}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[0.8125rem] focus:outline-none focus:ring-1 focus:ring-gray-300"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {erro && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-[0.75rem] text-red-700">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" /> {erro}
                  </div>
                )}
              </div>

              {/* Footer ações */}
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button onClick={onFechar} disabled={enviando} className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 text-[0.8125rem] disabled:opacity-50">
                  Cancelar
                </button>
                <button
                  onClick={handleEnviar}
                  disabled={enviando || !todasVariaveisPreenchidas}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-[0.8125rem] font-medium hover:bg-emerald-700 disabled:opacity-40"
                >
                  {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Enviar agora
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
