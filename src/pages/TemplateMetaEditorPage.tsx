import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Plus, X, Save, Send, Loader2 } from 'lucide-react';
import type {
  TemplateMeta, TemplateMetaCategoria, Componente, ComponenteHeader, ComponenteBody, ComponenteFooter, ComponenteButtons, Botao, HeaderFormato, BotaoTipo,
} from '../types/templateMeta';
import { CATEGORIA_META_LABELS, CATEGORIA_META_DESCRICAO } from '../types/templateMeta';
import {
  obterTemplateMeta, criarTemplateMeta, atualizarTemplateMeta, submeterTemplateMeta,
} from '../services/templatesMeta';
import TemplateMetaPreview from '../components/templatesConversa/TemplateMetaPreview';

const CATEGORIAS: TemplateMetaCategoria[] = ['UTILITY', 'AUTHENTICATION', 'MARKETING'];
const IDIOMAS = [
  { code: 'pt_BR', label: 'Português (Brasil)' },
  { code: 'pt', label: 'Português' },
  { code: 'en', label: 'Inglês' },
  { code: 'es', label: 'Espanhol' },
];

// Fontes disponíveis para mapear variáveis (espelho do reguaExecutorService.FONTES)
const FONTES_DISPONIVEIS = [
  { id: 'NOME_ALUNO', label: 'Nome completo do aluno' },
  { id: 'PRIMEIRO_NOME', label: 'Primeiro nome' },
  { id: 'CPF', label: 'CPF' },
  { id: 'MATRICULA', label: 'Número da matrícula' },
  { id: 'CURSO_NOME', label: 'Nome do curso' },
  { id: 'VALOR_INADIMPLENTE', label: 'Valor inadimplente' },
  { id: 'PARCELAS_ATRASO', label: 'Quantidade de parcelas em atraso' },
  { id: 'DIAS_ATRASO', label: 'Dias em atraso' },
  { id: 'CUSTOM', label: 'Texto livre (preenchido na hora)' },
];

export default function TemplateMetaEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const duplicarId = searchParams.get('duplicar');
  const editando = !!id;

  // Estado do formulário
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('pt_BR');
  const [category, setCategory] = useState<TemplateMetaCategoria>('UTILITY');
  const [allowCategoryChange, setAllowCategoryChange] = useState(true);
  const [components, setComponents] = useState<Componente[]>([
    { type: 'BODY', text: '' },
  ]);
  const [variaveisMap, setVariaveisMap] = useState<Record<string, string>>({});

  // Estado UI
  const [carregando, setCarregando] = useState(editando || !!duplicarId);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [readonly, setReadonly] = useState(false);

  // Carrega template existente (edição ou duplicação)
  useEffect(() => {
    const idCarregar = id || duplicarId;
    if (!idCarregar) return;
    setCarregando(true);
    obterTemplateMeta(idCarregar)
      .then(t => {
        // Permite editar APENAS se DRAFT ou REJECTED. Caso contrário, abre em readonly.
        const editavel = t.status === 'DRAFT' || t.status === 'REJECTED';
        if (editando && !editavel) setReadonly(true);

        if (duplicarId) {
          // Duplicar: gera nome novo com sufixo _v2 e força DRAFT
          setName(t.name + '_v2');
        } else {
          setName(t.name);
        }
        setLanguage(t.language);
        setCategory(t.category as TemplateMetaCategoria);
        setComponents(t.components);
        // Reconstrói variaveisMap pra UI: pra cada {{N}} no body, recupera fonte do variaveisMap salvo
        const vmap: Record<string, string> = {};
        t.variaveisMap?.body?.forEach((v: any) => { vmap[String(v.indice)] = v.fonte; });
        setVariaveisMap(vmap);
      })
      .catch(e => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [id, duplicarId, editando]);

  // Body com variáveis
  const body = components.find(c => c.type === 'BODY') as ComponenteBody | undefined;
  const header = components.find(c => c.type === 'HEADER') as ComponenteHeader | undefined;
  const footer = components.find(c => c.type === 'FOOTER') as ComponenteFooter | undefined;
  const buttonsComp = components.find(c => c.type === 'BUTTONS') as ComponenteButtons | undefined;

  // Detecta {{N}} no body
  const indicesBody = useMemo(() => {
    if (!body?.text) return [] as number[];
    const matches = [...body.text.matchAll(/\{\{(\d+)\}\}/g)];
    return Array.from(new Set(matches.map(m => Number(m[1])))).sort((a, b) => a - b);
  }, [body?.text]);

  // Validações em tempo real
  const validacoes = useMemo(() => {
    const avisos: string[] = [];
    const erros: string[] = [];

    // Nome
    if (!name) erros.push('Nome obrigatório');
    else if (!/^[a-z][a-z0-9_]*$/.test(name)) erros.push('Nome deve começar com letra minúscula e usar apenas a-z, 0-9 e _');

    // Body
    if (!body?.text) erros.push('Body é obrigatório');
    else {
      if (body.text.length > 1024) erros.push(`Body tem ${body.text.length} chars (máx 1024)`);
      const palavras = body.text.split(/\s+/).filter(Boolean).length;
      const numVars = indicesBody.length;
      if (numVars > 0) {
        const palavrasPorVar = palavras / numVars;
        if (palavrasPorVar < 4) avisos.push(`Apenas ${palavrasPorVar.toFixed(1)} palavras por variável — Meta pode rejeitar (recomendado: 5+)`);
      }
      const trim = body.text.trim();
      if (/^\{\{\d+\}\}/.test(trim)) avisos.push('Body começa com variável — pode ser rejeitado pela Meta');
      if (/\{\{\d+\}\}$/.test(trim)) avisos.push('Body termina com variável — pode ser rejeitado pela Meta');
      if (/\{\{\d+\}\}\s*\{\{\d+\}\}/.test(trim)) erros.push('Variáveis adjacentes não são permitidas');
    }

    // Footer
    if (footer?.text && footer.text.length > 60) erros.push(`Footer tem ${footer.text.length} chars (máx 60)`);

    return { avisos, erros };
  }, [name, body, footer, indicesBody]);

  const podeSalvar = validacoes.erros.length === 0 && !salvando && !readonly;

  // ─── Handlers de componentes ──────────────────────────────

  function atualizarComponente(tipo: Componente['type'], novo: any) {
    setComponents(prev => {
      const filtered = prev.filter(c => c.type !== tipo);
      if (novo === null) return filtered;
      // Mantém ordem: HEADER, BODY, FOOTER, BUTTONS
      const ordem: Record<string, number> = { HEADER: 0, BODY: 1, FOOTER: 2, BUTTONS: 3 };
      const todos = [...filtered, novo].sort((a, b) => (ordem[a.type] ?? 9) - (ordem[b.type] ?? 9));
      return todos;
    });
  }

  function adicionarBotao(tipo: BotaoTipo) {
    let novo: Botao;
    if (tipo === 'QUICK_REPLY') novo = { type: 'QUICK_REPLY', text: 'Confirmar' };
    else if (tipo === 'URL') novo = { type: 'URL', text: 'Acessar', url: 'https://exemplo.com' };
    else if (tipo === 'PHONE_NUMBER') novo = { type: 'PHONE_NUMBER', text: 'Ligar', phone_number: '+5511999999999' };
    else novo = { type: 'COPY_CODE', text: 'Copiar código', example: 'CODIGO123' };

    const atual = buttonsComp?.buttons || [];
    atualizarComponente('BUTTONS', { type: 'BUTTONS', buttons: [...atual, novo] });
  }

  function removerBotao(idx: number) {
    if (!buttonsComp) return;
    const novos = buttonsComp.buttons.filter((_, i) => i !== idx);
    if (novos.length === 0) atualizarComponente('BUTTONS', null);
    else atualizarComponente('BUTTONS', { type: 'BUTTONS', buttons: novos });
  }

  function atualizarBotao(idx: number, patch: Partial<Botao>) {
    if (!buttonsComp) return;
    const novos = buttonsComp.buttons.map((b, i) => i === idx ? { ...b, ...patch } as Botao : b);
    atualizarComponente('BUTTONS', { type: 'BUTTONS', buttons: novos });
  }

  // ─── Salvar / Submeter ────────────────────────────────────

  async function salvar(submeterDepois = false): Promise<void> {
    if (!podeSalvar) return;
    setSalvando(true);
    setErro(null);
    try {
      // Monta exemplo automático para body se houver variáveis
      const componentsParaSalvar = components.map(c => {
        if (c.type === 'BODY' && indicesBody.length > 0) {
          const exemplos = indicesBody.map(i => {
            const fonte = variaveisMap[String(i)];
            // Exemplo razoável por fonte
            const ex: Record<string, string> = {
              NOME_ALUNO: 'João Silva',
              PRIMEIRO_NOME: 'João',
              CPF: '123.456.789-00',
              MATRICULA: '2026001234',
              CURSO_NOME: 'Pós em Pediatria',
              VALOR_INADIMPLENTE: 'R$ 1.250,00',
              PARCELAS_ATRASO: '3',
              DIAS_ATRASO: '15',
              CUSTOM: 'exemplo',
            };
            return ex[fonte] || 'exemplo';
          });
          return { ...c, example: { body_text: [exemplos] } };
        }
        return c;
      });

      // Monta variaveisMap pra salvar
      const vmap: any = { body: indicesBody.map(i => ({ indice: i, fonte: variaveisMap[String(i)] || 'CUSTOM' })) };

      const payload = {
        name,
        language,
        category,
        components: componentsParaSalvar,
        variaveisMap: vmap,
      };

      let salvo: TemplateMeta;
      if (editando && id) {
        salvo = await atualizarTemplateMeta(id, payload);
      } else {
        salvo = await criarTemplateMeta(payload);
      }

      if (submeterDepois) {
        try {
          await submeterTemplateMeta(salvo.id);
        } catch (e) {
          // Salvou DRAFT mas falhou ao submeter — mostra erro mas mantém na pagina
          setErro(`Salvo como rascunho. Erro ao submeter: ${(e as Error).message}`);
          setSalvando(false);
          // Atualiza navegação pra modo edição do recém-criado
          if (!editando) navigate(`/configuracoes/templates-conversa/meta/${salvo.id}`, { replace: true });
          return;
        }
      }
      navigate('/configuracoes/templates-conversa');
    } catch (e: any) {
      const meta = e.metaError;
      const msg = meta?.userMsg || meta?.userTitle || (e as Error).message;
      setErro(msg);
    } finally {
      setSalvando(false);
    }
  }

  // ─── Variáveis exemplo pra preview ────────────────────────

  const variaveisPreview = useMemo(() => {
    const vmap: Record<string, string> = {};
    indicesBody.forEach(i => {
      const fonte = variaveisMap[String(i)];
      const exemplos: Record<string, string> = {
        NOME_ALUNO: 'André Garcia',
        PRIMEIRO_NOME: 'André',
        CPF: '123.456.789-00',
        MATRICULA: '2026001234',
        CURSO_NOME: 'Pós em Pediatria',
        VALOR_INADIMPLENTE: 'R$ 1.250,00',
        PARCELAS_ATRASO: '3',
        DIAS_ATRASO: '15',
      };
      vmap[String(i)] = exemplos[fonte] || `[Var ${i}]`;
    });
    return vmap;
  }, [indicesBody, variaveisMap]);

  // ─── Render ───────────────────────────────────────────────

  if (carregando) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 size={24} className="animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="flex flex-col min-h-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/configuracoes/templates-conversa')} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-[1.125rem] font-semibold text-gray-900">
            {editando ? 'Editar template Meta' : (duplicarId ? 'Duplicar template Meta' : 'Novo template Meta')}
          </h1>
          <p className="text-[0.75rem] text-gray-500 mt-0.5">
            Mensagem oficial submetida à Meta para envio fora da janela 24h.
          </p>
        </div>
      </div>

      {readonly && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-[0.75rem] text-blue-800">
          Template já submetido — visualização apenas. Para mudar conteúdo, duplique.
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">
        {/* Editor (esquerda 60%) */}
        <div className="col-span-7 space-y-4">
          {/* Identificação */}
          <Bloco titulo="Identificação">
            <div className="space-y-3">
              <Campo label="Nome (lowercase + underscore)">
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  disabled={readonly || editando}
                  placeholder="lm_cobranca_lembrete"
                  className={'w-full px-3 py-2 rounded-lg border border-gray-200 text-[0.8125rem] font-mono focus:outline-none focus:ring-1 focus:ring-gray-300 ' + (readonly || editando ? 'bg-gray-50 text-gray-500' : '')}
                />
                {editando && <p className="text-[0.6875rem] text-gray-500 mt-1">Nome é imutável após criação.</p>}
              </Campo>

              <div className="grid grid-cols-2 gap-3">
                <Campo label="Idioma">
                  <select value={language} onChange={e => setLanguage(e.target.value)} disabled={readonly} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[0.8125rem] focus:outline-none focus:ring-1 focus:ring-gray-300">
                    {IDIOMAS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </Campo>

                <Campo label="Categoria">
                  <select value={category} onChange={e => setCategory(e.target.value as TemplateMetaCategoria)} disabled={readonly} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[0.8125rem] focus:outline-none focus:ring-1 focus:ring-gray-300">
                    {CATEGORIAS.map(c => <option key={c} value={c}>{CATEGORIA_META_LABELS[c]}</option>)}
                  </select>
                  <p className="text-[0.6875rem] text-gray-500 mt-1">{CATEGORIA_META_DESCRICAO[category]}</p>
                </Campo>
              </div>

              <label className="flex items-start gap-2 text-[0.75rem] text-gray-700 cursor-pointer">
                <input type="checkbox" checked={allowCategoryChange} onChange={e => setAllowCategoryChange(e.target.checked)} disabled={readonly} className="mt-0.5" />
                <span>Permitir Meta reclassificar categoria automaticamente <span className="text-gray-500">(recomendado)</span></span>
              </label>
            </div>
          </Bloco>

          {/* Header */}
          <Bloco titulo="Cabeçalho (opcional)" colapsavel inicialAberto={!!header}>
            <HeaderEditor header={header} onChange={(h) => atualizarComponente('HEADER', h)} readonly={readonly} />
          </Bloco>

          {/* Body */}
          <Bloco titulo="Corpo (obrigatório)">
            <BodyEditor
              body={body}
              indices={indicesBody}
              variaveisMap={variaveisMap}
              setVariaveisMap={setVariaveisMap}
              onChange={(b) => atualizarComponente('BODY', b)}
              readonly={readonly}
              avisos={validacoes.avisos}
            />
          </Bloco>

          {/* Footer */}
          <Bloco titulo="Rodapé (opcional)" colapsavel inicialAberto={!!footer}>
            <FooterEditor footer={footer} onChange={(f) => atualizarComponente('FOOTER', f)} readonly={readonly} />
          </Bloco>

          {/* Botões */}
          <Bloco titulo="Botões (opcional, até 3)" colapsavel inicialAberto={(buttonsComp?.buttons.length || 0) > 0}>
            <div className="space-y-2">
              {buttonsComp?.buttons.map((btn, i) => (
                <BotaoEditor key={i} botao={btn} onChange={(p) => atualizarBotao(i, p)} onRemover={() => removerBotao(i)} readonly={readonly} />
              ))}
              {(!buttonsComp || buttonsComp.buttons.length < 3) && !readonly && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <BotaoAdd tipo="QUICK_REPLY" onClick={() => adicionarBotao('QUICK_REPLY')} />
                  <BotaoAdd tipo="URL" onClick={() => adicionarBotao('URL')} />
                  <BotaoAdd tipo="PHONE_NUMBER" onClick={() => adicionarBotao('PHONE_NUMBER')} />
                  <BotaoAdd tipo="COPY_CODE" onClick={() => adicionarBotao('COPY_CODE')} />
                </div>
              )}
            </div>
          </Bloco>
        </div>

        {/* Preview (direita 40%) */}
        <div className="col-span-5">
          <div className="sticky top-4">
            <p className="text-[0.6875rem] font-bold text-gray-500 uppercase tracking-wider mb-2">Preview ao vivo</p>
            <TemplateMetaPreview components={components} variaveis={variaveisPreview} />

            {/* Avisos / erros */}
            {(validacoes.avisos.length > 0 || validacoes.erros.length > 0 || erro) && (
              <div className="mt-4 space-y-2">
                {validacoes.erros.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-200 text-[0.75rem] text-red-700">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" /> {e}
                  </div>
                ))}
                {validacoes.avisos.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[0.75rem] text-amber-800">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" /> {a}
                  </div>
                ))}
                {erro && (
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-200 text-[0.75rem] text-red-700">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" /> {erro}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer ações */}
      {!readonly && (
        <div className="sticky bottom-0 bg-white border-t border-gray-100 mt-6 -mx-6 px-6 py-3 flex items-center justify-end gap-2">
          <button onClick={() => navigate('/configuracoes/templates-conversa')} className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 text-[0.8125rem]">
            Cancelar
          </button>
          <button onClick={() => salvar(false)} disabled={!podeSalvar} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 text-[0.8125rem] font-medium hover:bg-gray-50 disabled:opacity-40">
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar como rascunho
          </button>
          <button onClick={() => salvar(true)} disabled={!podeSalvar} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-[0.8125rem] font-medium hover:bg-emerald-700 disabled:opacity-40">
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Submeter para aprovação
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────

function Bloco({ titulo, children, colapsavel, inicialAberto = true }: { titulo: string; children: React.ReactNode; colapsavel?: boolean; inicialAberto?: boolean }) {
  const [aberto, setAberto] = useState(inicialAberto);
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => colapsavel && setAberto(!aberto)}
        className={'w-full flex items-center justify-between px-4 py-3 ' + (colapsavel ? 'cursor-pointer hover:bg-gray-50/50' : 'cursor-default')}
        type="button"
      >
        <h3 className="text-[0.8125rem] font-semibold text-gray-800">{titulo}</h3>
        {colapsavel && <span className="text-gray-400 text-xs">{aberto ? '−' : '+'}</span>}
      </button>
      {aberto && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[0.75rem] font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function HeaderEditor({ header, onChange, readonly }: { header?: ComponenteHeader; onChange: (h: ComponenteHeader | null) => void; readonly: boolean }) {
  const formato = header?.format || 'TEXT';
  const formatos: HeaderFormato[] = ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'];

  if (!header) {
    return (
      <button onClick={() => onChange({ type: 'HEADER', format: 'TEXT', text: '' })} disabled={readonly} className="text-[0.75rem] text-gray-700 hover:text-gray-900 underline disabled:opacity-50">
        + Adicionar cabeçalho
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select value={formato} onChange={e => onChange({ type: 'HEADER', format: e.target.value as HeaderFormato })} disabled={readonly} className="px-3 py-1.5 rounded-lg border border-gray-200 text-[0.75rem]">
          {formatos.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <button onClick={() => onChange(null)} disabled={readonly} className="ml-auto text-[0.75rem] text-red-600 hover:underline disabled:opacity-50">Remover</button>
      </div>
      {formato === 'TEXT' && (
        <input type="text" value={header.text || ''} onChange={e => onChange({ ...header, text: e.target.value })} disabled={readonly} placeholder="Aviso de Fatura" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[0.8125rem] focus:outline-none focus:ring-1 focus:ring-gray-300" />
      )}
      {formato !== 'TEXT' && (
        <p className="text-[0.6875rem] text-gray-500">Mídia: a URL real é fornecida no momento do envio. A Meta exige um exemplo durante a aprovação — isso será preenchido automaticamente.</p>
      )}
    </div>
  );
}

function BodyEditor({ body, indices, variaveisMap, setVariaveisMap, onChange, readonly }: {
  body?: ComponenteBody;
  indices: number[];
  variaveisMap: Record<string, string>;
  setVariaveisMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onChange: (b: ComponenteBody) => void;
  readonly: boolean;
  avisos: string[];
}) {
  const text = body?.text || '';
  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={e => onChange({ type: 'BODY', text: e.target.value })}
        disabled={readonly}
        rows={6}
        placeholder="Olá, doutor(a) {{1}}! Aqui é a equipe de relacionamento da Liberdade Médica..."
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[0.8125rem] font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-gray-300 resize-y"
      />
      <div className="flex items-center justify-between text-[0.6875rem] text-gray-500">
        <span>Use {'{{1}}'}, {'{{2}}'}, etc. para variáveis. Formatação: *negrito*, _itálico_, ~tachado~.</span>
        <span className={text.length > 1024 ? 'text-red-600 font-medium' : ''}>{text.length}/1024</span>
      </div>

      {indices.length > 0 && (
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <p className="text-[0.6875rem] font-bold text-gray-500 uppercase tracking-wider">Variáveis detectadas</p>
          {indices.map(i => (
            <div key={i} className="flex items-center gap-2">
              <span className="font-mono text-[0.75rem] text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{`{{${i}}}`}</span>
              <span className="text-[0.6875rem] text-gray-500">→</span>
              <select
                value={variaveisMap[String(i)] || ''}
                onChange={e => setVariaveisMap(prev => ({ ...prev, [String(i)]: e.target.value }))}
                disabled={readonly}
                className="flex-1 px-2 py-1 rounded border border-gray-200 text-[0.75rem]"
              >
                <option value="">Selecionar fonte...</option>
                {FONTES_DISPONIVEIS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FooterEditor({ footer, onChange, readonly }: { footer?: ComponenteFooter; onChange: (f: ComponenteFooter | null) => void; readonly: boolean }) {
  if (!footer) {
    return (
      <button onClick={() => onChange({ type: 'FOOTER', text: '' })} disabled={readonly} className="text-[0.75rem] text-gray-700 hover:text-gray-900 underline disabled:opacity-50">
        + Adicionar rodapé
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <input type="text" value={footer.text} onChange={e => onChange({ ...footer, text: e.target.value })} disabled={readonly} maxLength={60} placeholder="Liberdade Médica" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[0.8125rem] focus:outline-none focus:ring-1 focus:ring-gray-300" />
      <div className="flex items-center justify-between text-[0.6875rem] text-gray-500">
        <span>Texto curto, sem variáveis.</span>
        <span className={footer.text.length > 60 ? 'text-red-600 font-medium' : ''}>{footer.text.length}/60</span>
        <button onClick={() => onChange(null)} disabled={readonly} className="text-red-600 hover:underline disabled:opacity-50">Remover</button>
      </div>
    </div>
  );
}

function BotaoEditor({ botao, onChange, onRemover, readonly }: { botao: Botao; onChange: (p: Partial<Botao>) => void; onRemover: () => void; readonly: boolean }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50/40">
      <div className="flex items-center gap-2">
        <span className="text-[0.6875rem] font-medium text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded">{botao.type}</span>
        <button onClick={onRemover} disabled={readonly} className="ml-auto text-gray-400 hover:text-red-600 disabled:opacity-50"><X size={14} /></button>
      </div>
      <input type="text" value={botao.text} onChange={e => onChange({ text: e.target.value })} disabled={readonly} placeholder="Texto do botão" className="w-full px-3 py-1.5 rounded border border-gray-200 text-[0.75rem]" />
      {botao.type === 'URL' && (
        <input type="url" value={(botao as any).url} onChange={e => onChange({ url: e.target.value } as any)} disabled={readonly} placeholder="https://exemplo.com/{{1}}" className="w-full px-3 py-1.5 rounded border border-gray-200 text-[0.75rem] font-mono" />
      )}
      {botao.type === 'PHONE_NUMBER' && (
        <input type="tel" value={(botao as any).phone_number} onChange={e => onChange({ phone_number: e.target.value } as any)} disabled={readonly} placeholder="+5511999999999" className="w-full px-3 py-1.5 rounded border border-gray-200 text-[0.75rem] font-mono" />
      )}
      {botao.type === 'COPY_CODE' && (
        <input type="text" value={(botao as any).example || ''} onChange={e => onChange({ example: e.target.value } as any)} disabled={readonly} placeholder="EXEMPLO123" className="w-full px-3 py-1.5 rounded border border-gray-200 text-[0.75rem] font-mono" />
      )}
    </div>
  );
}

function BotaoAdd({ tipo, onClick }: { tipo: BotaoTipo; onClick: () => void }) {
  const labels: Record<BotaoTipo, string> = {
    QUICK_REPLY: 'Resposta rápida',
    URL: 'Link (URL)',
    PHONE_NUMBER: 'Ligar',
    COPY_CODE: 'Copiar código',
  };
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-[0.6875rem] text-gray-700 hover:bg-gray-50 transition-colors">
      <Plus size={11} /> {labels[tipo]}
    </button>
  );
}
