import { useEffect, useMemo, useState } from 'react';
import { X, Search, AlertCircle, Check, MessageSquareQuote } from 'lucide-react';
import type { TemplateWhatsapp, CategoriaTemplate } from '../../types/templateWhatsapp';
import { CATEGORIAS_TEMPLATE, CATEGORIA_LABELS, CATEGORIA_CORES } from '../../types/templateWhatsapp';
import { listarTemplates } from '../../services/templatesWhatsapp';
import { resolverTemplate, type DadosResolucao } from '../../utils/resolverTemplate';

interface ModalSelecionarTemplateProps {
  aberto: boolean;
  onFechar: () => void;
  onInserir: (texto: string) => void;
  dados: DadosResolucao;
}

export default function ModalSelecionarTemplate({
  aberto,
  onFechar,
  onInserir,
  dados,
}: ModalSelecionarTemplateProps) {
  const [templates, setTemplates] = useState<TemplateWhatsapp[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState<CategoriaTemplate | 'todos'>('todos');
  const [templateSelecionado, setTemplateSelecionado] = useState<TemplateWhatsapp | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setCarregando(true);
    setErro(null);
    listarTemplates()
      .then(setTemplates)
      .catch((e) => setErro(e?.message || 'Erro ao carregar templates'))
      .finally(() => setCarregando(false));
  }, [aberto]);

  useEffect(() => {
    if (!aberto) {
      setTemplateSelecionado(null);
      setBusca('');
      setCategoriaAtiva('todos');
    }
  }, [aberto]);

  const templatesFiltrados = useMemo(() => {
    return templates.filter((t) => {
      if (categoriaAtiva !== 'todos' && t.categoria !== categoriaAtiva) return false;
      if (busca.trim()) {
        const b = busca.toLowerCase();
        return (
          t.nome.toLowerCase().includes(b) ||
          t.conteudo.toLowerCase().includes(b)
        );
      }
      return true;
    });
  }, [templates, busca, categoriaAtiva]);

  const resolucao = useMemo(() => {
    if (!templateSelecionado) return null;
    return resolverTemplate(templateSelecionado.conteudo, dados);
  }, [templateSelecionado, dados]);

  function handleInserir() {
    if (!resolucao || !templateSelecionado) return;
    onInserir(resolucao.texto);
    onFechar();
  }

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MessageSquareQuote size={18} className="text-gray-700" />
            <h3 className="text-[0.9375rem] font-semibold text-gray-900">Escolher template</h3>
          </div>
          <button
            onClick={onFechar}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Busca + categorias */}
        <div className="px-5 py-3 border-b border-gray-100 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou conteúdo..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-50 border border-gray-100 text-[0.8125rem] focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setCategoriaAtiva('todos')}
              className={`px-3 py-1 rounded-full text-[0.6875rem] font-medium border transition-colors ${
                categoriaAtiva === 'todos'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              Todos
            </button>
            {CATEGORIAS_TEMPLATE.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoriaAtiva(cat)}
                className={`px-3 py-1 rounded-full text-[0.6875rem] font-medium border transition-colors ${
                  categoriaAtiva === cat
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {CATEGORIA_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Conteúdo: lista + preview lado a lado */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Lista */}
          <div className="w-2/5 border-r border-gray-100 overflow-y-auto">
            {carregando && (
              <p className="p-5 text-[0.8125rem] text-gray-400">Carregando templates...</p>
            )}
            {erro && (
              <p className="p-5 text-[0.8125rem] text-red-600">{erro}</p>
            )}
            {!carregando && !erro && templatesFiltrados.length === 0 && (
              <p className="p-5 text-[0.8125rem] text-gray-400">
                {templates.length === 0
                  ? 'Nenhum template cadastrado ainda.'
                  : 'Nenhum template corresponde ao filtro.'}
              </p>
            )}
            {templatesFiltrados.map((t) => (
              <button
                key={t.id}
                onClick={() => setTemplateSelecionado(t)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors ${
                  templateSelecionado?.id === t.id
                    ? 'bg-gray-50'
                    : 'hover:bg-gray-50/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[0.8125rem] font-medium text-gray-900 truncate flex-1">
                    {t.nome}
                  </span>
                  <span
                    className={`text-[0.625rem] px-1.5 py-0.5 rounded border ${CATEGORIA_CORES[t.categoria]}`}
                  >
                    {CATEGORIA_LABELS[t.categoria]}
                  </span>
                </div>
                <p className="text-[0.75rem] text-gray-500 line-clamp-2">
                  {t.conteudo}
                </p>
              </button>
            ))}
          </div>

          {/* Preview */}
          <div className="flex-1 overflow-y-auto p-5">
            {!templateSelecionado && (
              <p className="text-[0.8125rem] text-gray-400">
                Selecione um template à esquerda para ver o preview.
              </p>
            )}

            {templateSelecionado && resolucao && (
              <div className="space-y-4">
                <div>
                  <p className="text-[0.6875rem] uppercase tracking-wider text-gray-400 mb-1">
                    Preview da mensagem
                  </p>
                  <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-[0.8125rem] text-gray-900 whitespace-pre-wrap">
                    {resolucao.texto}
                  </div>
                </div>

                {resolucao.variaveisVazias.length > 0 && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                    <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                    <div className="text-[0.75rem] text-red-700">
                      <p className="font-medium mb-1">Faltam dados para resolver este template:</p>
                      <p className="font-mono">
                        {resolucao.variaveisVazias.map((v) => `{{${v}}}`).join(', ')}
                      </p>
                      <p className="mt-1 text-red-600">
                        Escolha outro template, atualize os dados do aluno, ou edite o texto manualmente depois de inserir.
                      </p>
                    </div>
                  </div>
                )}

                {resolucao.variaveisInvalidas.length > 0 && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-[0.75rem] text-amber-700">
                      <p className="font-medium mb-1">Variáveis desconhecidas:</p>
                      <p className="font-mono">
                        {resolucao.variaveisInvalidas.map((v) => `{{${v}}}`).join(', ')}
                      </p>
                    </div>
                  </div>
                )}

                {resolucao.variaveisUsadas.length > 0 && resolucao.variaveisVazias.length === 0 && (
                  <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                    <Check size={16} className="text-green-600 mt-0.5 shrink-0" />
                    <p className="text-[0.75rem] text-green-700">
                      Todas as variáveis foram resolvidas com sucesso.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-[0.6875rem] text-gray-500">
            O texto será inserido no campo, mas não enviado automaticamente.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onFechar}
              className="px-3 py-1.5 rounded-lg text-[0.75rem] text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleInserir}
              disabled={!resolucao || resolucao.variaveisVazias.length > 0}
              className="px-3 py-1.5 rounded-lg text-[0.75rem] bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Inserir no campo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
