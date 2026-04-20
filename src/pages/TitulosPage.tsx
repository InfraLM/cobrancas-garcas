import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import SearchInput from '../components/ui/SearchInput';
import StatusBadge from '../components/ui/StatusBadge';
import { getAvatarColor, getIniciais } from '../utils/avatarColor';
import {
  Receipt, Loader2, ChevronLeft, ChevronRight, AlertTriangle,
  Calendar, TrendingDown, CheckCircle2, Clock, DollarSign
} from 'lucide-react';

interface Titulo {
  codigo: number;
  parcela: string;
  valor: number;
  valorRecebido: number;
  dataVencimento: string;
  situacao: string;
  tipoOrigem: string;
  multa: number;
  juro: number;
  desconto: number;
  saldo: number;
  pessoaCodigo: number;
  nome: string;
  cpf: string;
  matricula: string;
  turma: string;
}

interface Metricas {
  totalAR: number;
  valorInadimplente: number;
  vencendoHoje: number;
  vencendoSemana: number;
  pagosMes: number;
  valorPagoMes: number;
  aging: { faixa: string; qtd: number; valor: number }[];
}

const SITUACAO_BADGE: Record<string, { label: string; variante: 'success' | 'warning' | 'danger' | 'neutral' | 'blue' }> = {
  AR: { label: 'A Receber', variante: 'warning' },
  RE: { label: 'Recebido', variante: 'success' },
  NE: { label: 'Negociado', variante: 'blue' },
  CF: { label: 'Cancelado', variante: 'neutral' },
};

const TIPO_LABEL: Record<string, string> = {
  MAT: 'Matrícula',
  MEN: 'Mensalidade',
  NCR: 'Negociação',
  OUT: 'Outros',
  REQ: 'Requerimento',
};

function formatarMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

function estaVencido(dataVencimento: string, situacao: string) {
  return situacao === 'AR' && new Date(dataVencimento) < new Date();
}

const AGING_CORES = ['bg-amber-500', 'bg-orange-500', 'bg-red-500', 'bg-red-700'];

export default function TitulosPage() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [vencimentoDe, setVencimentoDe] = useState('');
  const [vencimentoAte, setVencimentoAte] = useState('');
  const [titulos, setTitulos] = useState<Titulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const limit = 30;

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (busca) params.set('search', busca);
      if (filtroSituacao) params.set('situacao', filtroSituacao);
      if (filtroTipo) params.set('tipoorigem', filtroTipo);
      if (vencimentoDe) params.set('vencimentoDe', vencimentoDe);
      if (vencimentoAte) params.set('vencimentoAte', vencimentoAte);
      params.set('page', String(page));
      params.set('limit', String(limit));

      const res = await api.get<{ data: Titulo[]; total: number }>(`/titulos?${params}`);
      setTitulos(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error('Erro ao carregar titulos:', err);
    } finally {
      setLoading(false);
    }
  }, [busca, filtroSituacao, filtroTipo, vencimentoDe, vencimentoAte, page]);

  useEffect(() => {
    const timer = setTimeout(carregar, 400);
    return () => clearTimeout(timer);
  }, [carregar]);

  useEffect(() => {
    api.get<Metricas>('/titulos/metricas').then(setMetricas).catch(() => {});
  }, []);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2 text-on-surface">
        <Receipt size={20} />
        <h1 className="text-lg font-bold">Títulos</h1>
        <span className="text-[0.8125rem] text-on-surface-variant ml-2">{total.toLocaleString('pt-BR')} títulos</span>
        {loading && <Loader2 size={14} className="animate-spin ml-2" />}
      </div>

      {/* Metricas */}
      {metricas && (
        <div className="grid grid-cols-5 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm shadow-black/[0.03]">
            <div className="flex items-center gap-2 text-on-surface-variant mb-1">
              <Clock size={14} />
              <span className="text-[0.625rem] font-bold uppercase tracking-wider">A Receber</span>
            </div>
            <p className="text-xl font-bold text-on-surface">{metricas.totalAR.toLocaleString('pt-BR')}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm shadow-black/[0.03]">
            <div className="flex items-center gap-2 text-red-500 mb-1">
              <TrendingDown size={14} />
              <span className="text-[0.625rem] font-bold uppercase tracking-wider">Inadimplente</span>
            </div>
            <p className="text-xl font-bold text-red-600">{formatarMoeda(metricas.valorInadimplente)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm shadow-black/[0.03]">
            <div className="flex items-center gap-2 text-amber-500 mb-1">
              <AlertTriangle size={14} />
              <span className="text-[0.625rem] font-bold uppercase tracking-wider">Vencendo hoje</span>
            </div>
            <p className="text-xl font-bold text-amber-600">{metricas.vencendoHoje}</p>
            <p className="text-[0.6875rem] text-on-surface-variant">{metricas.vencendoSemana} esta semana</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm shadow-black/[0.03]">
            <div className="flex items-center gap-2 text-emerald-500 mb-1">
              <CheckCircle2 size={14} />
              <span className="text-[0.625rem] font-bold uppercase tracking-wider">Pagos no mês</span>
            </div>
            <p className="text-xl font-bold text-emerald-600">{metricas.pagosMes}</p>
            <p className="text-[0.6875rem] text-on-surface-variant">{formatarMoeda(metricas.valorPagoMes)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm shadow-black/[0.03]">
            <div className="flex items-center gap-2 text-on-surface-variant mb-1">
              <DollarSign size={14} />
              <span className="text-[0.625rem] font-bold uppercase tracking-wider">Aging</span>
            </div>
            <div className="flex gap-1 mt-1">
              {metricas.aging.map((a, i) => (
                <div key={a.faixa} className="flex-1 text-center" title={`${a.faixa}: ${a.qtd} títulos — ${formatarMoeda(a.valor)}`}>
                  <div className={`h-1.5 rounded-full ${AGING_CORES[i]}`} style={{ opacity: a.qtd > 0 ? 1 : 0.2 }} />
                  <span className="text-[0.5625rem] text-on-surface-variant">{a.qtd}</span>
                </div>
              ))}
            </div>
            <p className="text-[0.5rem] text-on-surface-variant/50 mt-1">0-30 | 31-60 | 61-90 | 90+</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-72">
          <SearchInput valor={busca} onChange={(v) => { setBusca(v); setPage(1); }} placeholder="Buscar por nome, matrícula ou CPF..." />
        </div>

        <select value={filtroSituacao} onChange={(e) => { setFiltroSituacao(e.target.value); setPage(1); }}
          className="h-10 px-4 rounded-xl bg-white/70 text-[0.8125rem] text-on-surface outline-none focus:bg-white focus:shadow-sm transition-all appearance-none cursor-pointer">
          <option value="">Todas situações</option>
          <option value="AR">A Receber</option>
          <option value="RE">Recebido</option>
          <option value="NE">Negociado</option>
          <option value="CF">Cancelado</option>
        </select>

        <select value={filtroTipo} onChange={(e) => { setFiltroTipo(e.target.value); setPage(1); }}
          className="h-10 px-4 rounded-xl bg-white/70 text-[0.8125rem] text-on-surface outline-none focus:bg-white focus:shadow-sm transition-all appearance-none cursor-pointer">
          <option value="">Todos os tipos</option>
          <option value="MAT">Matrícula</option>
          <option value="MEN">Mensalidade</option>
          <option value="NCR">Negociação</option>
          <option value="OUT">Outros</option>
          <option value="REQ">Requerimento</option>
        </select>

        <div className="flex items-center gap-1.5 text-[0.8125rem] text-on-surface-variant">
          <Calendar size={14} />
          <input type="date" value={vencimentoDe} onChange={(e) => { setVencimentoDe(e.target.value); setPage(1); }}
            className="h-10 px-3 rounded-xl bg-white/70 text-[0.8125rem] outline-none focus:bg-white focus:shadow-sm transition-all" />
          <span>até</span>
          <input type="date" value={vencimentoAte} onChange={(e) => { setVencimentoAte(e.target.value); setPage(1); }}
            className="h-10 px-3 rounded-xl bg-white/70 text-[0.8125rem] outline-none focus:bg-white focus:shadow-sm transition-all" />
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl shadow-sm shadow-black/[0.03] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Aluno</th>
              <th className="text-left px-3 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Parcela</th>
              <th className="text-left px-3 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Tipo</th>
              <th className="text-left px-3 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Vencimento</th>
              <th className="text-right px-3 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Valor</th>
              <th className="text-right px-3 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">M+J</th>
              <th className="text-right px-3 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Recebido</th>
              <th className="text-right px-3 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Saldo</th>
              <th className="text-left px-3 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Situação</th>
            </tr>
          </thead>
          <tbody>
            {titulos.map((t) => {
              const cor = getAvatarColor(t.nome);
              const vencido = estaVencido(t.dataVencimento, t.situacao);
              const sit = SITUACAO_BADGE[t.situacao] || { label: t.situacao, variante: 'neutral' as const };
              const mj = t.multa + t.juro;

              return (
                <tr key={t.codigo} className="border-b border-gray-50 hover:bg-surface-container-low/30 transition-colors">
                  <td className="px-5 py-3">
                    <button onClick={() => navigate(`/alunos?codigo=${t.pessoaCodigo}`)}
                      className="flex items-center gap-2 hover:underline text-left">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center text-[0.5rem] font-bold shrink-0"
                        style={{ backgroundColor: cor.bg, color: cor.text }}>
                        {getIniciais(t.nome)}
                      </div>
                      <div>
                        <p className="text-[0.8125rem] font-medium text-on-surface truncate max-w-[150px]">{t.nome}</p>
                        <p className="text-[0.6875rem] text-on-surface-variant">{t.matricula || t.cpf}</p>
                      </div>
                    </button>
                  </td>
                  <td className="px-3 py-3 text-[0.8125rem] text-on-surface font-mono">{t.parcela || '—'}</td>
                  <td className="px-3 py-3">
                    <span className="text-[0.6875rem] text-on-surface-variant">{TIPO_LABEL[t.tipoOrigem] || t.tipoOrigem}</span>
                  </td>
                  <td className={`px-3 py-3 text-[0.8125rem] ${vencido ? 'text-red-600 font-semibold' : 'text-on-surface'}`}>
                    {formatarData(t.dataVencimento)}
                  </td>
                  <td className="px-3 py-3 text-[0.8125rem] text-on-surface text-right">{formatarMoeda(t.valor)}</td>
                  <td className="px-3 py-3 text-[0.8125rem] text-right">
                    {mj > 0 ? <span className="text-red-500">{formatarMoeda(mj)}</span> : <span className="text-on-surface-variant/30">—</span>}
                  </td>
                  <td className="px-3 py-3 text-[0.8125rem] text-right">
                    {t.valorRecebido > 0 ? <span className="text-emerald-600">{formatarMoeda(t.valorRecebido)}</span> : <span className="text-on-surface-variant/30">—</span>}
                  </td>
                  <td className="px-3 py-3 text-[0.8125rem] font-semibold text-right">
                    {t.saldo > 0 ? formatarMoeda(t.saldo) : <span className="text-emerald-600">Quitado</span>}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge texto={sit.label} variante={sit.variante} comDot />
                  </td>
                </tr>
              );
            })}
            {titulos.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-[0.8125rem] text-on-surface-variant">
                  {busca || filtroSituacao || filtroTipo ? 'Nenhum título encontrado' : 'Nenhum título registrado'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginacao */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-30">
            <ChevronLeft size={16} />
          </button>
          <span className="text-[0.8125rem] text-on-surface-variant">{page} de {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-30">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
