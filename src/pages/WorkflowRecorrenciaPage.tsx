import { useState, useEffect, useCallback } from 'react';
import type { CadastroRecorrencia } from '../services/recorrencia';
import { listarRecorrencias, criarRecorrencia, definirMetodo, atualizarEtapaRecorrencia, cancelarRecorrencia } from '../services/recorrencia';
import { listarAlunos } from '../services/alunos';
import { useRealtime } from '../contexts/RealtimeContext';
import SearchInput from '../components/ui/SearchInput';
import StatusBadge from '../components/ui/StatusBadge';
import Drawer from '../components/ui/Drawer';
import Modal from '../components/ui/Modal';
import { getAvatarColor, getIniciais } from '../utils/avatarColor';
import {
  RefreshCw, Plus, Loader2, Search, Clock, CheckCircle2, AlertTriangle,
  CreditCard, X, Calendar, ArrowRight, Eye, XCircle
} from 'lucide-react';

const ETAPAS = [
  { id: 'PENDENTE', label: 'Pendente', cor: 'bg-amber-500' },
  { id: 'MONITORANDO', label: 'Monitorando', cor: 'bg-blue-500' },
  { id: 'CONCLUIDO', label: 'Concluído', cor: 'bg-emerald-500' },
];

const ORIGEM_LABEL: Record<string, { texto: string; cor: string }> = {
  MANUAL: { texto: 'Manual', cor: 'bg-gray-100 text-gray-600' },
  NEGOCIACAO: { texto: 'Negociação', cor: 'bg-violet-100 text-violet-600' },
  RECONVERSAO: { texto: 'Reconversão', cor: 'bg-red-100 text-red-600' },
};

const METODO_LABEL: Record<string, string> = {
  PARCELA_SIMBOLICA: 'Parcela simbólica',
  ATIVACAO_MANUAL: 'Ativação manual',
};

function formatarData(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

function formatarDataHora(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function tempoRelativo(data: string) {
  const diff = Math.floor((Date.now() - new Date(data).getTime()) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return '1d';
  if (diff < 7) return `${diff}d`;
  return `${Math.floor(diff / 7)}sem`;
}

function dataVencida(data?: string) {
  if (!data) return false;
  return new Date(data) < new Date();
}

export default function WorkflowRecorrenciaPage() {
  const [busca, setBusca] = useState('');
  const [cadastros, setCadastros] = useState<CadastroRecorrencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecionado, setSelecionado] = useState<CadastroRecorrencia | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listarRecorrencias({ search: busca || undefined });
      setCadastros(data);
    } catch (err) {
      console.error('Erro ao carregar recorrencias:', err);
    } finally {
      setLoading(false);
    }
  }, [busca]);

  useEffect(() => {
    const timer = setTimeout(carregar, 400);
    return () => clearTimeout(timer);
  }, [carregar]);

  // Metricas
  const pendentes = cadastros.filter(c => c.etapa === 'PENDENTE').length;
  const monitorando = cadastros.filter(c => c.etapa === 'MONITORANDO').length;
  const concluidos = cadastros.filter(c => c.etapa === 'CONCLUIDO').length;

  function handleAtualizado() {
    setSelecionado(null);
    carregar();
  }

  return (
    <div className="space-y-5 h-full">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-72">
          <SearchInput valor={busca} onChange={setBusca} placeholder="Buscar aluno..." />
        </div>

        <div className="flex items-center gap-4 ml-auto text-[0.8125rem] text-on-surface-variant">
          {loading && <Loader2 size={14} className="animate-spin" />}
          <span>{pendentes} pendentes</span>
          <span className="text-on-surface-variant/20">·</span>
          <span className="text-blue-600">{monitorando} monitorando</span>
          <span className="text-on-surface-variant/20">·</span>
          <span className="text-emerald-600 font-medium">{concluidos} concluídos</span>
        </div>

        <button onClick={() => setNovoAberto(true)}
          className="flex items-center gap-2 h-10 px-5 rounded-xl bg-primary text-white font-semibold text-[0.8125rem] hover:bg-primary-container transition-colors shadow-sm">
          <Plus size={16} />
          Novo cadastro
        </button>
      </div>

      {/* Kanban */}
      <div className="flex gap-4 h-[calc(100vh-200px)] overflow-x-auto">
        {ETAPAS.map(etapa => {
          const cards = cadastros.filter(c => c.etapa === etapa.id);
          return (
            <div key={etapa.id} className="flex-1 min-w-[280px] flex flex-col">
              {/* Coluna header */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className={`w-2 h-2 rounded-full ${etapa.cor}`} />
                <span className="text-[0.8125rem] font-semibold text-on-surface">{etapa.label}</span>
                <span className="text-[0.6875rem] text-on-surface-variant/40 ml-1">{cards.length}</span>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                {cards.map(card => {
                  const cor = getAvatarColor(card.pessoaNome);
                  const origemInfo = ORIGEM_LABEL[card.origem] || ORIGEM_LABEL.MANUAL;
                  const vencido = dataVencida(card.dataLimite);

                  return (
                    <div key={card.id} onClick={() => setSelecionado(card)}
                      className="bg-white rounded-lg px-3 py-2.5 cursor-pointer border border-gray-100 hover:border-gray-200 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[0.8125rem] font-medium text-gray-900 truncate">{card.pessoaNome}</p>
                        <span className="text-[0.625rem] text-gray-300 shrink-0">{tempoRelativo(card.criadoEm)}</span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className={`text-[0.5625rem] font-medium px-1.5 py-0.5 rounded ${origemInfo.cor}`}>
                          {origemInfo.texto}
                        </span>
                        {card.metodo && (
                          <span className="text-[0.5625rem] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                            {METODO_LABEL[card.metodo] || card.metodo}
                          </span>
                        )}
                        {card.recorrenciaAtivada && (
                          <span className="text-[0.5625rem] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">
                            Ativada
                          </span>
                        )}
                        {vencido && card.etapa !== 'CONCLUIDO' && (
                          <span className="text-[0.5625rem] font-medium px-1.5 py-0.5 rounded bg-red-50 text-red-600">
                            Vencido
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-1.5">
                        {card.dataLimite && (
                          <span className={`text-[0.625rem] ${vencido ? 'text-red-500' : 'text-gray-400'}`}>
                            Limite: {formatarData(card.dataLimite)}
                          </span>
                        )}
                        <p className="text-[0.625rem] text-gray-300 ml-auto">{card.criadoPorNome}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Drawer detalhes */}
      {selecionado && (
        <RecorrenciaDrawer cadastro={selecionado} onFechar={() => setSelecionado(null)} onAtualizado={handleAtualizado} />
      )}

      {/* Modal novo cadastro */}
      {novoAberto && (
        <NovoCadastroModal onFechar={() => setNovoAberto(false)} onCriado={() => { setNovoAberto(false); carregar(); }} />
      )}
    </div>
  );
}

// -----------------------------------------------
// Drawer de detalhes
// -----------------------------------------------
function RecorrenciaDrawer({ cadastro, onFechar, onAtualizado }: { cadastro: CadastroRecorrencia; onFechar: () => void; onAtualizado: () => void }) {
  const [metodo, setMetodo] = useState(cadastro.metodo || '');
  const [contaCodigo, setContaCodigo] = useState(cadastro.contaReceberCodigo?.toString() || '');
  const [dataLimite, setDataLimite] = useState(cadastro.dataLimite?.slice(0, 10) || '');
  const [salvando, setSalvando] = useState(false);

  const origemInfo = ORIGEM_LABEL[cadastro.origem] || ORIGEM_LABEL.MANUAL;

  async function handleDefinirMetodo() {
    setSalvando(true);
    try {
      await definirMetodo(cadastro.id, {
        metodo,
        contaReceberCodigo: metodo === 'PARCELA_SIMBOLICA' ? Number(contaCodigo) : undefined,
        dataLimite: dataLimite || undefined,
      });
      onAtualizado();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function handleCancelar() {
    if (!confirm('Cancelar este cadastro de recorrência?')) return;
    await cancelarRecorrencia(cadastro.id);
    onAtualizado();
  }

  return (
    <Drawer aberto onFechar={onFechar} largura="w-[480px]">
      <div className="px-6 pt-6 pb-5 bg-gradient-to-br from-surface-container-low to-surface">
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-[0.6875rem] font-medium px-2 py-1 rounded ${origemInfo.cor}`}>{origemInfo.texto}</span>
          <StatusBadge texto={cadastro.etapa === 'CONCLUIDO' ? 'Concluído' : cadastro.etapa === 'MONITORANDO' ? 'Monitorando' : 'Pendente'}
            variante={cadastro.etapa === 'CONCLUIDO' ? 'success' : cadastro.etapa === 'MONITORANDO' ? 'blue' : 'warning'} comDot />
        </div>
        <h2 className="text-xl font-bold text-on-surface">{cadastro.pessoaNome}</h2>
        <p className="text-[0.8125rem] text-on-surface-variant mt-0.5">
          CPF: {cadastro.pessoaCpf} · Matrícula: {cadastro.matricula || '—'}
        </p>
        <p className="text-[0.75rem] text-on-surface-variant mt-1">Agente: {cadastro.criadoPorNome} · {formatarDataHora(cadastro.criadoEm)}</p>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* PENDENTE: escolher metodo */}
        {cadastro.etapa === 'PENDENTE' && (
          <div className="space-y-4">
            <span className="text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Configurar monitoramento</span>

            <div>
              <label className="text-[0.8125rem] font-medium text-on-surface mb-2 block">Método de ativação</label>
              <div className="flex gap-2">
                <button onClick={() => setMetodo('PARCELA_SIMBOLICA')}
                  className={`flex-1 px-4 py-3 rounded-xl text-[0.8125rem] font-medium transition-all ${metodo === 'PARCELA_SIMBOLICA' ? 'bg-on-surface text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'}`}>
                  <CreditCard size={14} className="inline mr-1.5" />
                  Parcela simbólica
                </button>
                <button onClick={() => setMetodo('ATIVACAO_MANUAL')}
                  className={`flex-1 px-4 py-3 rounded-xl text-[0.8125rem] font-medium transition-all ${metodo === 'ATIVACAO_MANUAL' ? 'bg-on-surface text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'}`}>
                  <RefreshCw size={14} className="inline mr-1.5" />
                  Ativação manual
                </button>
              </div>
            </div>

            {metodo === 'PARCELA_SIMBOLICA' && (
              <div>
                <label className="text-[0.8125rem] font-medium text-on-surface mb-1 block">Código da conta no SEI (R$ 0,50)</label>
                <input type="text" value={contaCodigo} onChange={(e) => setContaCodigo(e.target.value.replace(/\D/g, ''))}
                  placeholder="Código da contareceber"
                  className="w-full h-10 px-4 rounded-xl bg-surface-container-low text-[0.875rem] font-mono text-on-surface outline-none focus:ring-2 focus:ring-primary/20" />
                <p className="text-[0.6875rem] text-on-surface-variant mt-1">Crie uma conta avulsa (tipoOrigem OUT) de R$ 0,50 no SEI e informe o código.</p>
              </div>
            )}

            <div>
              <label className="text-[0.8125rem] font-medium text-on-surface mb-1 block flex items-center gap-1.5">
                <Calendar size={13} /> Data limite
              </label>
              <input type="date" value={dataLimite} onChange={(e) => setDataLimite(e.target.value)}
                className="w-full h-10 px-4 rounded-xl bg-surface-container-low text-[0.8125rem] text-on-surface outline-none focus:ring-2 focus:ring-primary/20" />
            </div>

            <button onClick={handleDefinirMetodo} disabled={!metodo || salvando || (metodo === 'PARCELA_SIMBOLICA' && !contaCodigo)}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-semibold text-[0.875rem] hover:bg-primary-container transition-colors shadow-sm disabled:opacity-40">
              {salvando ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              Iniciar monitoramento
            </button>
          </div>
        )}

        {/* MONITORANDO: status */}
        {cadastro.etapa === 'MONITORANDO' && (
          <div className="space-y-4">
            <span className="text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Status do monitoramento</span>

            <div className="bg-blue-50 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Eye size={14} className="text-blue-600" />
                <span className="text-[0.8125rem] font-semibold text-blue-800">Sistema verificando a cada sync</span>
              </div>
              <div className="space-y-2 text-[0.8125rem]">
                <div className="flex justify-between">
                  <span className="text-blue-700">Método</span>
                  <span className="font-medium text-blue-900">{METODO_LABEL[cadastro.metodo || ''] || '—'}</span>
                </div>
                {cadastro.contaReceberCodigo && (
                  <div className="flex justify-between">
                    <span className="text-blue-700">Conta SEI</span>
                    <span className="font-mono font-medium text-blue-900">#{cadastro.contaReceberCodigo}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-blue-700">Parcela simbólica</span>
                  <StatusBadge texto={cadastro.parcelaPaga ? 'Paga' : 'Pendente'} variante={cadastro.parcelaPaga ? 'success' : 'warning'} comDot />
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Recorrência</span>
                  <StatusBadge texto={cadastro.recorrenciaAtivada ? 'Ativada' : 'Não ativada'} variante={cadastro.recorrenciaAtivada ? 'success' : 'warning'} comDot />
                </div>
              </div>
            </div>

            {cadastro.dataLimite && dataVencida(cadastro.dataLimite) && (
              <div className="flex items-center gap-2 text-[0.8125rem] text-red-600 bg-red-50 rounded-xl px-4 py-3">
                <AlertTriangle size={14} />
                <span className="font-medium">Data limite atingida ({formatarData(cadastro.dataLimite)}) — aluno não ativou a recorrência</span>
              </div>
            )}
          </div>
        )}

        {/* CONCLUIDO */}
        {cadastro.etapa === 'CONCLUIDO' && (
          <div className="space-y-4">
            <div className="bg-emerald-50 rounded-2xl p-5 text-center space-y-2">
              <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
              <p className="text-lg font-bold text-emerald-700">Recorrência ativada</p>
              <p className="text-[0.8125rem] text-emerald-600">Concluído em {formatarDataHora(cadastro.concluidoEm)}</p>
            </div>
          </div>
        )}

        {/* Observacao */}
        {cadastro.observacao && (
          <div className="bg-surface-container-low rounded-xl p-3">
            <span className="text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Observação</span>
            <p className="text-[0.8125rem] text-on-surface mt-1">{cadastro.observacao}</p>
          </div>
        )}

        {/* Cancelar */}
        {cadastro.etapa !== 'CONCLUIDO' && cadastro.etapa !== 'CANCELADO' && (
          <button onClick={handleCancelar}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-red-600 bg-red-50 font-medium text-[0.8125rem] hover:bg-red-100 transition-colors">
            <XCircle size={14} />
            Cancelar cadastro
          </button>
        )}
      </div>
    </Drawer>
  );
}

// -----------------------------------------------
// Modal novo cadastro
// -----------------------------------------------
function NovoCadastroModal({ onFechar, onCriado }: { onFechar: () => void; onCriado: () => void }) {
  const [busca, setBusca] = useState('');
  const [alunos, setAlunos] = useState<any[]>([]);
  const [selecionado, setSelecionado] = useState<any>(null);
  const [observacao, setObservacao] = useState('');
  const [dataLimite, setDataLimite] = useState('');
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    if (!busca || busca.length < 3) { setAlunos([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await listarAlunos({ search: busca, limit: 5 });
        setAlunos(res.data || []);
      } catch { setAlunos([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [busca]);

  async function handleCriar() {
    if (!selecionado) return;
    setCriando(true);
    try {
      await criarRecorrencia({
        pessoaCodigo: selecionado.codigo,
        pessoaNome: selecionado.nome,
        pessoaCpf: selecionado.cpf || '',
        matricula: selecionado.matricula,
        celularAluno: selecionado.celular,
        observacao,
        dataLimite: dataLimite || undefined,
      });
      onCriado();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCriando(false);
    }
  }

  return (
    <Modal aberto onFechar={onFechar} titulo="Novo cadastro de recorrência" largura="max-w-lg">
      <div className="space-y-5">
        {!selecionado && (
          <div className="relative">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/40" />
              <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)}
                placeholder="Digite 3+ caracteres para buscar..."
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/70 text-[0.8125rem] text-on-surface outline-none focus:bg-white focus:shadow-sm transition-all" />
            </div>
            {alunos.length > 0 && (
              <div className="mt-2 bg-white rounded-2xl shadow-sm border border-gray-100 max-h-80 overflow-y-auto">
                {alunos.map((aluno) => (
                  <button key={aluno.codigo} onClick={() => { setSelecionado(aluno); setBusca(''); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors text-left">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: getAvatarColor(aluno.nome).bg, color: getAvatarColor(aluno.nome).text }}>
                      {getIniciais(aluno.nome)}
                    </div>
                    <div>
                      <p className="text-[0.8125rem] font-medium text-on-surface">{aluno.nome}</p>
                      <p className="text-[0.6875rem] text-on-surface-variant">{aluno.turma || aluno.matricula}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {selecionado && (
          <div className="bg-white/50 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
              style={{ backgroundColor: getAvatarColor(selecionado.nome).bg, color: getAvatarColor(selecionado.nome).text }}>
              {getIniciais(selecionado.nome)}
            </div>
            <div className="flex-1">
              <p className="text-[0.8125rem] font-semibold text-on-surface">{selecionado.nome}</p>
              <p className="text-[0.6875rem] text-on-surface-variant">CPF: {selecionado.cpf} · {selecionado.turma}</p>
            </div>
            <button onClick={() => setSelecionado(null)} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant/40">
              <X size={16} />
            </button>
          </div>
        )}

        <div>
          <label className="text-[0.8125rem] font-medium text-on-surface mb-1 block">Data limite (opcional)</label>
          <input type="date" value={dataLimite} onChange={(e) => setDataLimite(e.target.value)}
            className="w-full h-10 px-4 rounded-xl bg-white/70 text-[0.8125rem] text-on-surface outline-none focus:bg-white focus:shadow-sm transition-all" />
        </div>

        <div>
          <label className="text-[0.8125rem] font-medium text-on-surface mb-1 block">Observação</label>
          <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)}
            placeholder="Notas..."
            rows={2}
            className="w-full px-4 py-3 rounded-xl bg-white/70 text-[0.8125rem] text-on-surface outline-none focus:bg-white focus:shadow-sm transition-all resize-none" />
        </div>

        <button onClick={handleCriar} disabled={!selecionado || criando}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-primary text-white font-semibold text-[0.9375rem] hover:bg-primary-container transition-colors shadow-sm disabled:opacity-40">
          {criando ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
          {criando ? 'Criando...' : 'Criar cadastro'}
        </button>
      </div>
    </Modal>
  );
}
