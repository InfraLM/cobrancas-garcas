import { useState, useRef, useMemo } from 'react';
import { X, Save, Info } from 'lucide-react';
import type { TemplateWhatsapp, CategoriaTemplate } from '../../types/templateWhatsapp';
import {
  CATEGORIAS_TEMPLATE,
  CATEGORIA_LABELS,
  VARIAVEIS_DISPONIVEIS,
} from '../../types/templateWhatsapp';
import { criarTemplate, atualizarTemplate } from '../../services/templatesWhatsapp';
import { extrairVariaveisDoTexto, resolverTemplate } from '../../utils/resolverTemplate';

interface TemplateDrawerProps {
  template: TemplateWhatsapp | null;
  onFechar: () => void;
  onSalvou: () => void;
}

const LIMITE_CONTEUDO = 4096;

// Mock de dados para preview
const DADOS_PREVIEW = {
  aluno: {
    codigo: 0,
    nome: 'ABDIAS PEREIRA DA SILVA',
    cpf: '123.456.789-00',
    celular: '(11) 98765-4321',
    matricula: '2024/1234',
    cursoNome: 'Medicina',
    turmaIdentificador: '2024/1',
    resumoFinanceiro: {
      totalParcelas: 12,
      parcelasEmAtraso: 3,
      parcelasAVencer: 5,
      parcelasPagas: 4,
      parcelasNegociadas: 0,
      parcelasCanceladas: 0,
      valorEmAberto: 3000,
      valorInadimplente: 1234.56,
      valorPago: 2000,
      vencimentoMaisAntigo: '2025-12-15',
    },
  } as any,
  conversa: {
    diasAtraso: 47,
    valorInadimplente: 1234.56,
  } as any,
  agente: {
    nome: 'André Garcia',
  } as any,
};

export default function TemplateDrawer({ template, onFechar, onSalvou }: TemplateDrawerProps) {
  const [nome, setNome] = useState(template?.nome || '');
  const [categoria, setCategoria] = useState<CategoriaTemplate>(template?.categoria || 'cobranca');
  const [conteudo, setConteudo] = useState(template?.conteudo || '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const variaveisUsadasNoTexto = useMemo(() => extrairVariaveisDoTexto(conteudo), [conteudo]);

  const preview = useMemo(() => {
    if (!conteudo.trim()) return null;
    return resolverTemplate(conteudo, DADOS_PREVIEW);
  }, [conteudo]);

  function inserirVariavel(nomeVar: string) {
    const el = textareaRef.current;
    if (!el) {
      setConteudo((c) => `${c}{{${nomeVar}}}`);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const texto = `{{${nomeVar}}}`;
    const novo = conteudo.slice(0, start) + texto + conteudo.slice(end);
    setConteudo(novo);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + texto.length;
    });
  }

  async function handleSalvar() {
    setErro(null);

    const nomeTrim = nome.trim();
    if (!nomeTrim) return setErro('Nome obrigatório');
    if (nomeTrim.length > 100) return setErro('Nome excede 100 caracteres');
    if (!conteudo.trim()) return setErro('Conteúdo obrigatório');
    if (conteudo.length > LIMITE_CONTEUDO) {
      return setErro(`Conteúdo excede ${LIMITE_CONTEUDO} caracteres`);
    }

    setSalvando(true);
    try {
      if (template) {
        await atualizarTemplate(template.id, { nome: nomeTrim, categoria, conteudo });
      } else {
        await criarTemplate({ nome: nomeTrim, categoria, conteudo });
      }
      onSalvou();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onFechar} />
      <div className="w-full max-w-3xl bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-[0.9375rem] font-semibold text-gray-900">
            {template ? 'Editar template' : 'Novo template'}
          </h3>
          <button
            onClick={onFechar}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-[0.8125rem] text-red-700">
              {erro}
            </div>
          )}

          {/* Nome */}
          <div>
            <label className="block text-[0.75rem] font-medium text-gray-700 mb-1">Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Cobrança primeira abordagem"
              maxLength={100}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[0.8125rem] focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300"
            />
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-[0.75rem] font-medium text-gray-700 mb-1">Categoria</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaTemplate)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[0.8125rem] bg-white focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300"
            >
              {CATEGORIAS_TEMPLATE.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORIA_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>

          {/* Conteudo + painel de variaveis */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="flex items-center justify-between text-[0.75rem] font-medium text-gray-700 mb-1">
                <span>Conteúdo</span>
                <span className={`text-[0.6875rem] ${conteudo.length > LIMITE_CONTEUDO ? 'text-red-600' : 'text-gray-400'}`}>
                  {conteudo.length} / {LIMITE_CONTEUDO}
                </span>
              </label>
              <textarea
                ref={textareaRef}
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                placeholder={'Olá {{primeiroNome}}, notei que você tem {{parcelasAtraso}} parcela(s) em atraso...'}
                rows={12}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[0.8125rem] font-mono focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300 resize-none"
              />
            </div>

            <div>
              <label className="block text-[0.75rem] font-medium text-gray-700 mb-1">Variáveis</label>
              <p className="text-[0.6875rem] text-gray-500 mb-2">
                Clique para inserir no cursor
              </p>
              <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                {VARIAVEIS_DISPONIVEIS.map((v) => {
                  const usada = variaveisUsadasNoTexto.includes(v.nome);
                  return (
                    <button
                      key={v.nome}
                      onClick={() => inserirVariavel(v.nome)}
                      className={`w-full text-left px-2 py-1.5 rounded border text-[0.6875rem] transition-colors ${
                        usada
                          ? 'bg-blue-50 border-blue-200 text-blue-700'
                          : 'bg-white border-gray-100 hover:border-gray-300 text-gray-700'
                      }`}
                      title={v.descricao}
                    >
                      <span className="font-mono font-medium block">{`{{${v.nome}}}`}</span>
                      <span className="text-gray-500">{v.descricao}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Preview */}
          {preview && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Info size={12} className="text-gray-400" />
                <label className="text-[0.75rem] font-medium text-gray-700">
                  Preview (com dados de exemplo)
                </label>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-[0.8125rem] text-gray-900 whitespace-pre-wrap">
                {preview.texto}
              </div>
              {preview.variaveisInvalidas.length > 0 && (
                <p className="text-[0.6875rem] text-amber-700 mt-1">
                  Variáveis desconhecidas: {preview.variaveisInvalidas.join(', ')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onFechar}
            disabled={salvando}
            className="px-3 py-1.5 rounded-lg text-[0.75rem] text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[0.75rem] bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            <Save size={13} />
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
