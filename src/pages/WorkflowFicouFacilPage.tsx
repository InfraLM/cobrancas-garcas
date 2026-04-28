import { useState, useEffect, useCallback, useRef } from 'react';
import type { FicouFacil } from '../services/ficouFacil';
import { listarFicouFacil, criarFicouFacil, atualizarEtapaFF, atualizarCheckboxes, atualizarCredito, atualizarValoresFF, uploadDocumentoFF, baixarDocumentoFF, cancelarFicouFacil, calcularValores } from '../services/ficouFacil';
import { listarAlunos, obterAluno } from '../services/alunos';
import SearchInput from '../components/ui/SearchInput';
import StatusBadge from '../components/ui/StatusBadge';
import Drawer from '../components/ui/Drawer';
import Modal from '../components/ui/Modal';
import { getAvatarColor, getIniciais } from '../utils/avatarColor';
import {
  Plus, Loader2, Search, X, ArrowRight, ArrowLeft, CheckSquare, Square,
  Upload, FileDown, AlertTriangle, CheckCircle2, XCircle, CreditCard,
  FileText, Shield, Landmark, Clock
} from 'lucide-react';

const ETAPAS = [
  { id: 'AGUARDANDO_DOCUMENTACAO', label: 'Aguardando Documentação', cor: 'bg-amber-500' },
  { id: 'ANALISE_CREDITO', label: 'Análise de Crédito', cor: 'bg-blue-500' },
  { id: 'ASSINATURA_CONTRATO_1', label: 'Contrato 1', cor: 'bg-violet-500' },
  { id: 'ASSINATURA_CONTRATO_2', label: 'Contrato 2', cor: 'bg-violet-500' },
  { id: 'ASSINATURA_CONTRATO_3', label: 'Contrato 3', cor: 'bg-violet-500' },
  { id: 'ASSINATURA_LM', label: 'Contrato LM', cor: 'bg-indigo-500' },
  { id: 'CONCLUIDO', label: 'Concluído', cor: 'bg-emerald-500' },
];

const ETAPA_CHECKBOXES: Record<string, { key: string; label: string }[]> = {
  AGUARDANDO_DOCUMENTACAO: [
    { key: 'envioListaDocs', label: 'Envio da lista de documentação' },
    { key: 'docsAlunoRecebidos', label: 'Documentos do aluno recebidos' },
    { key: 'docsAvalistaRecebidos', label: 'Documentos dos avalistas recebidos' },
    { key: 'docsEncaminhados', label: 'Documentos encaminhados para a Ficou Fácil' },
  ],
  ASSINATURA_CONTRATO_1: [
    { key: 'alunoAssinou1', label: 'Aluno assinou' },
    { key: 'avalistaAssinou1', label: 'Avalista assinou' },
  ],
  ASSINATURA_CONTRATO_2: [
    { key: 'alunoAssinou2', label: 'Aluno assinou' },
    { key: 'avalistaAssinou2', label: 'Avalista assinou' },
  ],
  ASSINATURA_CONTRATO_3: [
    { key: 'alunoAssinou3', label: 'Aluno assinou' },
    { key: 'avalistaAssinou3', label: 'Avalista assinou' },
  ],
  ASSINATURA_LM: [
    { key: 'matriculaSEI', label: 'Matrícula no SEI realizada' },
    { key: 'contratoAssinado', label: 'Contrato assinado' },
  ],
};

function formatarMoeda(v: number) { return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatarData(d?: string) { return d ? new Date(d).toLocaleDateString('pt-BR') : '—'; }
function tempoRelativo(d: string) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (diff === 0) return 'Hoje'; if (diff === 1) return '1d'; if (diff < 7) return `${diff}d`; return `${Math.floor(diff / 7)}sem`;
}

export default function WorkflowFicouFacilPage() {
  const [busca, setBusca] = useState('');
  const [registros, setRegistros] = useState<FicouFacil[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecionado, setSelecionado] = useState<FicouFacil | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);

  const carregar = useCallback(async () => {
    try { setLoading(true); setRegistros(await listarFicouFacil({ search: busca || undefined })); } catch {} finally { setLoading(false); }
  }, [busca]);

  useEffect(() => { const t = setTimeout(carregar, 400); return () => clearTimeout(t); }, [carregar]);

  return (
    <div className="space-y-5 h-full">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-72"><SearchInput valor={busca} onChange={setBusca} placeholder="Buscar aluno..." /></div>
        <div className="ml-auto flex items-center gap-4 text-[0.8125rem] text-on-surface-variant">
          {loading && <Loader2 size={14} className="animate-spin" />}
          <span>{registros.filter(r => r.etapa !== 'CANCELADO').length} ativos</span>
          <span className="text-emerald-600 font-medium">{registros.filter(r => r.etapa === 'CONCLUIDO').length} concluídos</span>
        </div>
        <button onClick={() => setNovoAberto(true)} className="flex items-center gap-2 h-10 px-5 rounded-xl bg-primary text-white font-semibold text-[0.8125rem] hover:bg-primary-container transition-colors shadow-sm">
          <Plus size={16} /> Novo financiamento
        </button>
      </div>

      {/* Kanban */}
      <div className="flex gap-3 h-[calc(100vh-200px)] overflow-x-auto">
        {ETAPAS.map(etapa => {
          const cards = registros.filter(c => c.etapa === etapa.id);
          return (
            <div key={etapa.id} className="flex-1 min-w-[200px] flex flex-col">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className={`w-2 h-2 rounded-full ${etapa.cor}`} />
                <span className="text-[0.75rem] font-semibold text-on-surface truncate">{etapa.label}</span>
                <span className="text-[0.6875rem] text-on-surface-variant/40 ml-1">{cards.length}</span>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                {cards.map(card => (
                  <div key={card.id} onClick={() => setSelecionado(card)}
                    className="bg-white rounded-lg px-3 py-2.5 cursor-pointer border border-gray-100 hover:border-gray-200 transition-colors">
                    <p className="text-[0.8125rem] font-medium text-gray-900 truncate">{card.pessoaNome}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[0.75rem] font-bold text-on-surface">{formatarMoeda(Number(card.valorPos) - Number(card.valorRecebido))}</span>
                      {card.contaSantander && <span className="text-[0.5625rem] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium">Santander</span>}
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[0.625rem] text-gray-400">{card.turma}</span>
                      <span className="text-[0.625rem] text-gray-300">{tempoRelativo(card.criadoEm)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selecionado && <FicouFacilDrawer registro={selecionado} onFechar={() => setSelecionado(null)} onAtualizado={() => { setSelecionado(null); carregar(); }} />}
      {novoAberto && <NovoFicouFacilModal onFechar={() => setNovoAberto(false)} onCriado={() => { setNovoAberto(false); carregar(); }} />}
    </div>
  );
}

// -----------------------------------------------
// Drawer
// -----------------------------------------------
function FicouFacilDrawer({ registro, onFechar, onAtualizado }: { registro: FicouFacil; onFechar: () => void; onAtualizado: () => void }) {
  const [checkboxes, setCheckboxes] = useState<Record<string, boolean>>(registro.checkboxes || {});
  const [salvando, setSalvando] = useState(false);
  const [creditoAprovado, setCreditoAprovado] = useState<boolean | null>(registro.creditoAprovado ?? null);
  const fileInputAluno = useRef<HTMLInputElement>(null);
  const fileInputAvalista = useRef<HTMLInputElement>(null);

  // Edicao inline dos valores financeiros (em qualquer etapa, incluindo CONCLUIDO).
  const [editandoValores, setEditandoValores] = useState(false);
  const [salvandoValores, setSalvandoValores] = useState(false);
  const [valorPos, setValorPos] = useState(String(registro.valorPos));
  const [valorRecebido, setValorRecebido] = useState(String(registro.valorRecebido));
  const [valorInadimplente, setValorInadimplente] = useState(String(registro.valorInadimplente));
  const [valorInadimplenteMJ, setValorInadimplenteMJ] = useState(String(registro.valorInadimplenteMJ));
  const [contaSantander, setContaSantander] = useState(registro.contaSantander);

  function cancelarEdicaoValores() {
    setValorPos(String(registro.valorPos));
    setValorRecebido(String(registro.valorRecebido));
    setValorInadimplente(String(registro.valorInadimplente));
    setValorInadimplenteMJ(String(registro.valorInadimplenteMJ));
    setContaSantander(registro.contaSantander);
    setEditandoValores(false);
  }

  async function salvarValores() {
    setSalvandoValores(true);
    try {
      await atualizarValoresFF(registro.id, {
        valorPos: Number(valorPos) || 0,
        valorRecebido: Number(valorRecebido) || 0,
        valorInadimplente: Number(valorInadimplente) || 0,
        valorInadimplenteMJ: Number(valorInadimplenteMJ) || 0,
        contaSantander,
      });
      setEditandoValores(false);
      onAtualizado();
    } finally {
      setSalvandoValores(false);
    }
  }

  const etapaIdx = ETAPAS.findIndex(e => e.id === registro.etapa);
  const checksDaEtapa = ETAPA_CHECKBOXES[registro.etapa] || [];
  const todosChecked = checksDaEtapa.length > 0 ? checksDaEtapa.every(c => checkboxes[c.key]) : true;
  const podeAvancar = registro.etapa === 'ANALISE_CREDITO' ? creditoAprovado === true : todosChecked;

  async function toggleCheckbox(key: string) {
    const novo = { ...checkboxes, [key]: !checkboxes[key] };
    setCheckboxes(novo);
    await atualizarCheckboxes(registro.id, novo);
  }

  async function handleAvancar() {
    if (etapaIdx >= ETAPAS.length - 1) return;
    setSalvando(true);
    await atualizarEtapaFF(registro.id, ETAPAS[etapaIdx + 1].id);
    setSalvando(false);
    onAtualizado();
  }

  async function handleVoltar() {
    if (etapaIdx <= 0) return;
    setSalvando(true);
    await atualizarEtapaFF(registro.id, ETAPAS[etapaIdx - 1].id);
    setSalvando(false);
    onAtualizado();
  }

  async function handleUpload(file: File, tipo: string) {
    await uploadDocumentoFF(registro.id, file, tipo);
    onAtualizado();
  }

  async function handleCredito(aprovado: boolean) {
    setCreditoAprovado(aprovado);
    await atualizarCredito(registro.id, aprovado);
  }

  const valorFinanciado = Number(registro.valorPos) - Number(registro.valorRecebido);
  const eTurma3 = registro.turma?.includes('TURMA 3');

  return (
    <Drawer aberto onFechar={onFechar} largura="w-[520px]">
      <div className="px-6 pt-6 pb-5 bg-gradient-to-br from-surface-container-low to-surface">
        <div className="flex items-center gap-2 mb-3">
          <Landmark size={16} className="text-primary" />
          <span className="text-[0.8125rem] font-semibold text-primary">Ficou Fácil</span>
          <StatusBadge texto={ETAPAS[etapaIdx]?.label || registro.etapa} variante={registro.etapa === 'CONCLUIDO' ? 'success' : 'blue'} comDot />
        </div>
        <h2 className="text-xl font-bold text-on-surface">{registro.pessoaNome}</h2>
        <p className="text-[0.8125rem] text-on-surface-variant mt-0.5">CPF: {registro.pessoaCpf} · {registro.turma}</p>

        <div className="mt-4">
          {!editandoValores ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/60 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-[0.5rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Valor Pós</p>
                  <p className="text-[0.8125rem] font-bold">{formatarMoeda(Number(registro.valorPos))}</p>
                </div>
                <div className="bg-white/60 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-[0.5rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Recebido</p>
                  <p className="text-[0.8125rem] font-bold text-emerald-600">{formatarMoeda(Number(registro.valorRecebido))}</p>
                </div>
                <div className="bg-primary/5 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-[0.5rem] font-bold uppercase tracking-wider text-primary/50">Financiado</p>
                  <p className="text-[0.8125rem] font-bold text-primary">{formatarMoeda(valorFinanciado)}</p>
                </div>
              </div>
              <button onClick={() => setEditandoValores(true)}
                className="mt-2 w-full text-[0.6875rem] text-primary/80 hover:text-primary font-medium py-1.5 rounded-lg hover:bg-primary/5 transition-colors">
                Editar valores
              </button>
            </>
          ) : (
            <div className="bg-white/80 rounded-xl p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/60">Valor Pós</span>
                  <input type="number" step="0.01" value={valorPos} onChange={(e) => setValorPos(e.target.value)}
                    className="w-full mt-0.5 h-8 px-2 rounded-md border border-gray-200 text-[0.8125rem] outline-none focus:ring-2 focus:ring-primary/20" />
                </label>
                <label className="block">
                  <span className="text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/60">Recebido</span>
                  <input type="number" step="0.01" value={valorRecebido} onChange={(e) => setValorRecebido(e.target.value)}
                    className="w-full mt-0.5 h-8 px-2 rounded-md border border-gray-200 text-[0.8125rem] outline-none focus:ring-2 focus:ring-primary/20" />
                </label>
                <label className="block">
                  <span className="text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/60">Inadimplente</span>
                  <input type="number" step="0.01" value={valorInadimplente} onChange={(e) => setValorInadimplente(e.target.value)}
                    className="w-full mt-0.5 h-8 px-2 rounded-md border border-gray-200 text-[0.8125rem] outline-none focus:ring-2 focus:ring-primary/20" />
                </label>
                <label className="block">
                  <span className="text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/60">Inadimplente M+J</span>
                  <input type="number" step="0.01" value={valorInadimplenteMJ} onChange={(e) => setValorInadimplenteMJ(e.target.value)}
                    className="w-full mt-0.5 h-8 px-2 rounded-md border border-gray-200 text-[0.8125rem] outline-none focus:ring-2 focus:ring-primary/20" />
                </label>
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input type="checkbox" checked={contaSantander} onChange={(e) => setContaSantander(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary/20" />
                <span className="text-[0.75rem] text-on-surface">Conta Santander</span>
              </label>
              <div className="flex gap-2 pt-1">
                <button onClick={cancelarEdicaoValores} disabled={salvandoValores}
                  className="flex-1 h-8 rounded-lg bg-surface-container-low text-on-surface-variant text-[0.75rem] font-medium hover:bg-surface-container-high transition-colors disabled:opacity-40">
                  Cancelar
                </button>
                <button onClick={salvarValores} disabled={salvandoValores}
                  className="flex-1 h-8 rounded-lg bg-primary text-white text-[0.75rem] font-semibold hover:bg-primary-container transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                  {salvandoValores ? <Loader2 size={12} className="animate-spin" /> : null}
                  Salvar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Alerta Turma 3 */}
        {eTurma3 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
            <p className="text-[0.8125rem] text-amber-700">Verifique o contrato e o valor da matrícula antes de inserir os dados</p>
          </div>
        )}

        {/* Checkboxes da etapa */}
        {checksDaEtapa.length > 0 && (
          <div className="space-y-2">
            <span className="text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Checklist</span>
            {checksDaEtapa.map(c => (
              <button key={c.key} onClick={() => toggleCheckbox(c.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${checkboxes[c.key] ? 'bg-emerald-50' : 'bg-white/50'}`}>
                {checkboxes[c.key] ? <CheckSquare size={16} className="text-emerald-500 shrink-0" /> : <Square size={16} className="text-on-surface-variant/30 shrink-0" />}
                <span className="text-[0.8125rem] text-on-surface">{c.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Analise de credito */}
        {registro.etapa === 'ANALISE_CREDITO' && (
          <div className="space-y-3">
            <span className="text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Análise de Crédito</span>
            <div className="flex gap-2">
              <button onClick={() => handleCredito(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-[0.8125rem] transition-all ${creditoAprovado === true ? 'bg-emerald-500 text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-emerald-50'}`}>
                <CheckCircle2 size={14} /> Aprovado
              </button>
              <button onClick={() => handleCredito(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-[0.8125rem] transition-all ${creditoAprovado === false ? 'bg-red-500 text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-red-50'}`}>
                <XCircle size={14} /> Reprovado
              </button>
            </div>
          </div>
        )}

        {/* Upload documentos (apenas na primeira etapa) */}
        {registro.etapa === 'AGUARDANDO_DOCUMENTACAO' && (
          <div className="space-y-3">
            <span className="text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Documentos</span>
            <div className="flex gap-2">
              <button onClick={() => fileInputAluno.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-container-low text-on-surface-variant text-[0.8125rem] font-medium hover:bg-surface-container-high transition-colors">
                <Upload size={14} /> Doc. Aluno
              </button>
              <button onClick={() => fileInputAvalista.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-container-low text-on-surface-variant text-[0.8125rem] font-medium hover:bg-surface-container-high transition-colors">
                <Upload size={14} /> Doc. Avalista
              </button>
            </div>
            <input ref={fileInputAluno} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0], 'DOCUMENTO_ALUNO'); }} />
            <input ref={fileInputAvalista} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0], 'DOCUMENTO_AVALISTA'); }} />

            {/* Lista de docs */}
            {registro.documentos && registro.documentos.length > 0 && (
              <div className="space-y-1">
                {registro.documentos.map(doc => (
                  <div key={doc.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50">
                    <FileText size={13} className="text-on-surface-variant/40 shrink-0" />
                    <span className="text-[0.75rem] text-on-surface flex-1 truncate">{doc.nomeArquivo}</span>
                    <span className="text-[0.6875rem] text-on-surface-variant/50">{doc.tipo === 'DOCUMENTO_ALUNO' ? 'Aluno' : 'Avalista'}</span>
                    <button onClick={() => baixarDocumentoFF(doc.id, doc.nomeArquivo)} className="p-1 rounded hover:bg-gray-200"><FileDown size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Concluido */}
        {registro.etapa === 'CONCLUIDO' && (
          <div className="bg-emerald-50 rounded-2xl p-5 text-center space-y-2">
            <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
            <p className="text-lg font-bold text-emerald-700">Financiamento concluído</p>
            <p className="text-[0.875rem] text-emerald-600">Recuperado: {formatarMoeda(Number(registro.valorInadimplenteMJ))}</p>
          </div>
        )}

        {/* Info */}
        <div className="bg-surface-container-low rounded-xl p-3 space-y-1.5 text-[0.8125rem]">
          <div className="flex justify-between"><span className="text-on-surface-variant">Agente</span><span className="font-medium">{registro.criadoPorNome}</span></div>
          <div className="flex justify-between"><span className="text-on-surface-variant">Criado em</span><span>{formatarData(registro.criadoEm)}</span></div>
          <div className="flex justify-between"><span className="text-on-surface-variant">Inadimplente (nominal)</span><span>{formatarMoeda(Number(registro.valorInadimplente))}</span></div>
          <div className="flex justify-between"><span className="text-on-surface-variant">Inadimplente (M+J)</span><span className="text-red-500">{formatarMoeda(Number(registro.valorInadimplenteMJ))}</span></div>
          <div className="flex justify-between"><span className="text-on-surface-variant">Santander</span><span className={registro.contaSantander ? 'text-red-600 font-medium' : 'text-on-surface'}>{registro.contaSantander ? 'Sim' : 'Não'}</span></div>
        </div>

        {/* Botoes avancar/recuar */}
        {registro.etapa !== 'CONCLUIDO' && registro.etapa !== 'CANCELADO' && (
          <div className="flex gap-2">
            {etapaIdx > 0 && (
              <button onClick={handleVoltar} disabled={salvando}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-surface-container-highest text-on-surface font-medium text-[0.8125rem] hover:bg-surface-container-high transition-colors disabled:opacity-40">
                <ArrowLeft size={14} /> Voltar
              </button>
            )}
            <button onClick={handleAvancar} disabled={!podeAvancar || salvando}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-white font-semibold text-[0.8125rem] hover:bg-primary-container transition-colors shadow-sm disabled:opacity-40">
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              {etapaIdx === ETAPAS.length - 2 ? 'Concluir' : 'Avançar'}
            </button>
          </div>
        )}

        {/* Cancelar */}
        {registro.etapa !== 'CONCLUIDO' && registro.etapa !== 'CANCELADO' && (
          <button onClick={async () => { if (confirm('Cancelar financiamento?')) { await cancelarFicouFacil(registro.id); onAtualizado(); } }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-red-600 bg-red-50 font-medium text-[0.8125rem] hover:bg-red-100 transition-colors">
            <XCircle size={14} /> Cancelar
          </button>
        )}
      </div>
    </Drawer>
  );
}

// -----------------------------------------------
// Modal novo
// -----------------------------------------------
function NovoFicouFacilModal({ onFechar, onCriado }: { onFechar: () => void; onCriado: () => void }) {
  const [busca, setBusca] = useState('');
  const [alunos, setAlunos] = useState<any[]>([]);
  const [selecionado, setSelecionado] = useState<any>(null);
  const [valores, setValores] = useState({ valorPos: 0, valorRecebido: 0, valorInadimplente: 0, valorInadimplenteMJ: 0 });
  const [contaSantander, setContaSantander] = useState(false);
  const [observacao, setObservacao] = useState('');
  const [criando, setCriando] = useState(false);
  const [carregandoValores, setCarregandoValores] = useState(false);

  useEffect(() => {
    if (!busca || busca.length < 3) { setAlunos([]); return; }
    const t = setTimeout(async () => {
      try { const res = await listarAlunos({ search: busca, limit: 5 }); setAlunos(res.data || []); } catch { setAlunos([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [busca]);

  async function handleSelecionarAluno(aluno: any) {
    setSelecionado(aluno);
    setBusca('');
    setCarregandoValores(true);
    try {
      const completo = await obterAluno(aluno.codigo);
      setSelecionado({ ...aluno, ...completo });
      const v = await calcularValores(aluno.codigo);
      setValores(v);
    } catch {}
    setCarregandoValores(false);
  }

  async function handleCriar() {
    if (!selecionado) return;
    setCriando(true);
    try {
      await criarFicouFacil({
        pessoaCodigo: selecionado.codigo,
        pessoaNome: selecionado.nome,
        pessoaCpf: selecionado.cpf || '',
        matricula: selecionado.matricula,
        turma: selecionado.turma || selecionado.turmaIdentificador,
        celularAluno: selecionado.celular,
        ...valores,
        contaSantander,
        observacao,
      });
      onCriado();
    } catch (err: any) { alert(err.message); } finally { setCriando(false); }
  }

  const eTurma3 = selecionado?.turma?.includes('TURMA 3') || selecionado?.turmaIdentificador?.includes('TURMA 3');

  return (
    <Modal aberto onFechar={onFechar} titulo="Novo Financiamento Ficou Fácil" largura="max-w-2xl">
      <div className="space-y-5">
        {/* Busca aluno */}
        {!selecionado && (
          <div className="relative">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/40" />
              <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite 3+ caracteres para buscar..."
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/70 text-[0.8125rem] outline-none focus:bg-white focus:shadow-sm transition-all" />
            </div>
            {alunos.length > 0 && (
              <div className="mt-2 bg-white rounded-2xl shadow-sm border border-gray-100 max-h-80 overflow-y-auto">
                {alunos.map(a => (
                  <button key={a.codigo} onClick={() => handleSelecionarAluno(a)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors text-left">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ backgroundColor: getAvatarColor(a.nome).bg, color: getAvatarColor(a.nome).text }}>{getIniciais(a.nome)}</div>
                    <div><p className="text-[0.8125rem] font-medium">{a.nome}</p><p className="text-[0.6875rem] text-on-surface-variant">{a.turma || a.matricula}</p></div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {selecionado && (
          <>
            <div className="bg-white/50 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style={{ backgroundColor: getAvatarColor(selecionado.nome).bg, color: getAvatarColor(selecionado.nome).text }}>{getIniciais(selecionado.nome)}</div>
              <div className="flex-1">
                <p className="text-[0.8125rem] font-semibold">{selecionado.nome}</p>
                <p className="text-[0.6875rem] text-on-surface-variant">CPF: {selecionado.cpf} · {selecionado.turma || selecionado.turmaIdentificador}</p>
              </div>
              <button onClick={() => setSelecionado(null)} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant/40"><X size={16} /></button>
            </div>

            {eTurma3 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                <p className="text-[0.8125rem] text-amber-700 font-medium">Verifique o contrato e o valor da matrícula antes de inserir os dados</p>
              </div>
            )}

            {carregandoValores ? (
              <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>
            ) : (
              <>
                {/* Valores editaveis */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[0.6875rem] text-on-surface-variant mb-1 block">Valor da Pós</label>
                    <input type="number" step="0.01" value={valores.valorPos} onChange={(e) => setValores({ ...valores, valorPos: Number(e.target.value) })}
                      className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[0.875rem] font-semibold outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="text-[0.6875rem] text-on-surface-variant mb-1 block">Valor Recebido</label>
                    <input type="number" step="0.01" value={valores.valorRecebido} onChange={(e) => setValores({ ...valores, valorRecebido: Number(e.target.value) })}
                      className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[0.875rem] font-semibold text-emerald-600 outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="text-[0.6875rem] text-on-surface-variant mb-1 block">Inadimplente (nominal)</label>
                    <input type="number" step="0.01" value={valores.valorInadimplente} onChange={(e) => setValores({ ...valores, valorInadimplente: Number(e.target.value) })}
                      className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[0.875rem] font-semibold outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="text-[0.6875rem] text-on-surface-variant mb-1 block">Inadimplente (M+J)</label>
                    <input type="number" step="0.01" value={valores.valorInadimplenteMJ} onChange={(e) => setValores({ ...valores, valorInadimplenteMJ: Number(e.target.value) })}
                      className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[0.875rem] font-semibold text-red-500 outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                </div>

                <div className="bg-primary/5 rounded-xl p-4 text-center">
                  <p className="text-[0.625rem] font-bold uppercase tracking-wider text-primary/50">Total a ser financiado</p>
                  <p className="text-2xl font-bold text-primary">{formatarMoeda(valores.valorPos - valores.valorRecebido)}</p>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={contaSantander} onChange={(e) => setContaSantander(e.target.checked)} className="w-4 h-4 rounded" />
                  <span className="text-[0.8125rem] font-medium">Aluno possui conta Santander</span>
                </label>

                <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Observação..." rows={2}
                  className="w-full px-4 py-3 rounded-xl bg-white/70 text-[0.8125rem] outline-none focus:bg-white focus:shadow-sm transition-all resize-none" />
              </>
            )}
          </>
        )}

        <button onClick={handleCriar} disabled={!selecionado || criando || carregandoValores}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-primary text-white font-semibold text-[0.9375rem] hover:bg-primary-container transition-colors shadow-sm disabled:opacity-40">
          {criando ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
          {criando ? 'Criando...' : 'Criar financiamento'}
        </button>
      </div>
    </Modal>
  );
}
