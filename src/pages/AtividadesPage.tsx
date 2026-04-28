import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Plus, Loader2, MessageCircle, Phone, Check, X, Clock, AlertCircle } from 'lucide-react';
import {
  listarAtividades, criarAtividade, atualizarAtividade,
  concluirAtividade, cancelarAtividade,
} from '../services/atividades';
import type { Atividade, StatusAtividade, TipoAtividade } from '../types/atividade';
import { TIPO_ATIVIDADE_LABEL } from '../types/atividade';

function formatarDataHora(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function ehVencida(iso: string) {
  return new Date(iso).getTime() < Date.now();
}

// "amanhã 09:00 BRT" como ISO local
function defaultDataHora() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  // input datetime-local quer YYYY-MM-DDTHH:mm
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function AtividadesPage() {
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<StatusAtividade | ''>('PENDENTE');
  const [novoAberto, setNovoAberto] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listarAtividades({ status: filtroStatus || undefined });
      setAtividades(r);
    } catch (e) {
      console.error('Erro ao carregar atividades', e);
    } finally {
      setLoading(false);
    }
  }, [filtroStatus]);

  useEffect(() => { carregar(); }, [carregar]);

  // Agrupa por dia
  const grupos = useMemo(() => {
    const out = new Map<string, Atividade[]>();
    for (const a of atividades) {
      const chave = new Date(a.dataHora).toLocaleDateString('pt-BR');
      if (!out.has(chave)) out.set(chave, []);
      out.get(chave)!.push(a);
    }
    return Array.from(out.entries());
  }, [atividades]);

  async function handleConcluir(id: string) {
    await concluirAtividade(id);
    carregar();
  }
  async function handleCancelar(id: string) {
    if (!confirm('Cancelar esta atividade?')) return;
    await cancelarAtividade(id);
    carregar();
  }
  async function handleAdiar(a: Atividade, horas: number) {
    const nova = new Date(a.dataHora);
    nova.setHours(nova.getHours() + horas);
    await atualizarAtividade(a.id, { dataHora: nova.toISOString() });
    carregar();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-on-surface-variant" />
          <h1 className="text-lg font-bold">Atividades</h1>
        </div>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as StatusAtividade | '')}
          className="h-9 px-3 rounded-lg border border-gray-200 text-[0.8125rem] bg-white"
        >
          <option value="PENDENTE">Pendentes</option>
          <option value="CONCLUIDA">Concluídas</option>
          <option value="CANCELADA">Canceladas</option>
          <option value="">Todas</option>
        </select>
        <span className="text-[0.8125rem] text-on-surface-variant">
          {atividades.length} atividade{atividades.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => setNovoAberto(true)}
          className="ml-auto flex items-center gap-2 h-10 px-5 rounded-xl bg-primary text-white font-semibold text-[0.8125rem] hover:bg-primary-container transition-colors shadow-sm"
        >
          <Plus size={16} /> Nova atividade
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-primary" /></div>
      ) : atividades.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
          <Calendar size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-[0.8125rem] text-on-surface-variant">Nenhuma atividade {filtroStatus === 'PENDENTE' ? 'pendente' : ''}.</p>
          <p className="text-[0.75rem] text-on-surface-variant/60 mt-1">Crie uma usando o botão acima ou pelos atalhos no discador.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grupos.map(([dia, lista]) => (
            <div key={dia}>
              <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-on-surface-variant/60 mb-2">{dia}</p>
              <div className="space-y-2">
                {lista.map(a => {
                  const venc = a.status === 'PENDENTE' && ehVencida(a.dataHora);
                  const Icon = a.tipo === 'LEMBRETE_LIGACAO' ? Phone : MessageCircle;
                  return (
                    <div key={a.id} className={`bg-white rounded-xl border ${venc ? 'border-amber-300' : 'border-gray-100'} p-4 flex items-start gap-3`}>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${a.tipo === 'LEMBRETE_LIGACAO' ? 'bg-sky-50 text-sky-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[0.875rem] font-semibold text-on-surface">{a.titulo}</p>
                          {a.status === 'CONCLUIDA' && (
                            <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium flex items-center gap-1"><Check size={10}/>Concluída</span>
                          )}
                          {a.status === 'CANCELADA' && (
                            <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-stone-50 text-stone-600 font-medium">Cancelada</span>
                          )}
                          {venc && (
                            <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium flex items-center gap-1"><AlertCircle size={10}/>Vencida</span>
                          )}
                        </div>
                        <p className="text-[0.75rem] text-on-surface-variant flex items-center gap-1 mt-0.5">
                          <Clock size={11} /> {formatarDataHora(a.dataHora)}
                          {a.pessoaNome && <span className="ml-2">· {a.pessoaNome}</span>}
                          {a.telefone && <span className="text-on-surface-variant/60">· {a.telefone}</span>}
                        </p>
                        {a.descricao && <p className="text-[0.75rem] text-on-surface-variant/70 mt-1">{a.descricao}</p>}
                      </div>
                      {a.status === 'PENDENTE' && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleAdiar(a, 1)}
                            title="Adiar 1h"
                            className="px-2 h-8 rounded-md bg-gray-50 text-gray-600 text-[0.6875rem] font-medium hover:bg-gray-100"
                          >+1h</button>
                          <button
                            onClick={() => handleAdiar(a, 24)}
                            title="Adiar 1 dia"
                            className="px-2 h-8 rounded-md bg-gray-50 text-gray-600 text-[0.6875rem] font-medium hover:bg-gray-100"
                          >+1d</button>
                          <button
                            onClick={() => handleConcluir(a.id)}
                            title="Concluir"
                            className="w-8 h-8 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center"
                          ><Check size={14} /></button>
                          <button
                            onClick={() => handleCancelar(a.id)}
                            title="Cancelar"
                            className="w-8 h-8 rounded-md bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-600 flex items-center justify-center"
                          ><X size={14} /></button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {novoAberto && (
        <NovaAtividadeModal onFechar={() => setNovoAberto(false)} onCriado={() => { setNovoAberto(false); carregar(); }} />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------

function NovaAtividadeModal({ onFechar, onCriado }: { onFechar: () => void; onCriado: () => void }) {
  const [tipo, setTipo] = useState<TipoAtividade>('LEMBRETE_LIGACAO');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataHora, setDataHora] = useState(defaultDataHora());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function handleSalvar() {
    if (!titulo.trim()) { setErro('Título obrigatório'); return; }
    setSalvando(true);
    setErro('');
    try {
      await criarAtividade({
        tipo,
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        dataHora: new Date(dataHora).toISOString(),
      });
      onCriado();
    } catch (e: any) {
      setErro(e.message || 'Erro ao criar atividade');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Nova atividade</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div>
          <label className="text-[0.75rem] font-medium text-on-surface-variant block mb-1">Tipo</label>
          <div className="grid grid-cols-2 gap-2">
            {(['LEMBRETE_LIGACAO', 'LEMBRETE_MENSAGEM'] as TipoAtividade[]).map(t => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={`h-10 rounded-lg border text-[0.8125rem] font-medium flex items-center justify-center gap-2 transition-colors ${
                  tipo === t ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t === 'LEMBRETE_LIGACAO' ? <Phone size={14}/> : <MessageCircle size={14}/>}
                {TIPO_ATIVIDADE_LABEL[t].replace('Lembrete: ', '')}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[0.75rem] font-medium text-on-surface-variant block mb-1">Título</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Ligar para João sobre boleto"
            className="w-full h-10 px-3 rounded-lg border border-gray-200 text-[0.875rem] outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="text-[0.75rem] font-medium text-on-surface-variant block mb-1">Quando</label>
          <input
            type="datetime-local"
            value={dataHora}
            onChange={(e) => setDataHora(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-gray-200 text-[0.875rem] outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="text-[0.75rem] font-medium text-on-surface-variant block mb-1">Notas (opcional)</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={2}
            placeholder="Detalhes adicionais..."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[0.8125rem] outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
        </div>

        {erro && <p className="text-[0.75rem] text-red-600">{erro}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onFechar} disabled={salvando}
            className="flex-1 h-10 rounded-lg bg-gray-100 text-gray-700 text-[0.8125rem] font-medium hover:bg-gray-200 disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={handleSalvar} disabled={salvando || !titulo.trim()}
            className="flex-1 h-10 rounded-lg bg-primary text-white text-[0.8125rem] font-semibold hover:bg-primary-container transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {salvando ? <Loader2 size={14} className="animate-spin"/> : null}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
