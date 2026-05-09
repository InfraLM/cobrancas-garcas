import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import {
  obterFunilDashboard,
  obterRecorrentesHistorico, obterAcumuladoAlunos,
  obterAging, obterAgingHistorico,
  type FunilEtapa,
  type Granularidade, type BucketRecorrentes, type BucketAcumulado,
  type AgingFaixa, type AgingHistoricoSemana,
} from '../services/dashboard';
import FiltroAgentes from '../components/dashboard/FiltroAgentes';
import MatrizRecuperacao from '../components/dashboard/MatrizRecuperacao';

const LS_KEY_AGENTES = 'dashboard:agenteIdsFiltro';

function carregarAgentesLS(): number[] {
  try {
    const raw = localStorage.getItem(LS_KEY_AGENTES);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((n) => typeof n === 'number') : [];
  } catch { return []; }
}

function salvarAgentesLS(ids: number[]) {
  try {
    if (ids.length === 0) localStorage.removeItem(LS_KEY_AGENTES);
    else localStorage.setItem(LS_KEY_AGENTES, JSON.stringify(ids));
  } catch { /* ignora quota/disabled */ }
}
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Line, Cell,
} from 'recharts';
import {
  LayoutDashboard, RefreshCw, Loader2, Users, TrendingDown, DollarSign,
  CreditCard, Landmark, Info
} from 'lucide-react';

interface FormaPagamento { forma: string; qtd: number; valor: number }
interface DashboardData {
  kpis: any;
  ficouFacil: any; pagoPorAging: any[];
  pagoPorForma: { competencia: FormaPagamento[]; caixa: FormaPagamento[] };
  atualizadoEm: string;
}

// Default range: cohort atual (08/02/2026) ate hoje em BRT
function hojeBrtISO(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
const DEFAULT_INICIO = '2026-02-08';

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function fmtK(v: number) {
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(0)}k`;
  return fmt(v);
}

const AGING_COLORS = { '0-5': '#818cf8', '6-30': '#a78bfa', '31-90': '#f59e0b', '90+': '#fbbf24' };

// Series cujo valor representa DINHEIRO. As demais sao contagem de alunos (numero plano)
// ou percentual (detectado por p.unit === '%').
const SERIES_MONETARIAS = new Set([
  '0-5 dias', '6-30 dias', '31-90 dias', '90+ dias',
]);

function formatarValorTooltip(p: any): string {
  if (typeof p.value !== 'number') return String(p.value);
  if (p.unit === '%') return `${p.value}%`;
  if (SERIES_MONETARIAS.has(p.name)) return fmtK(p.value);
  return p.value.toLocaleString('pt-BR');
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg px-4 py-3 border border-gray-100 text-[0.6875rem]">
      <p className="font-semibold text-on-surface mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-on-surface-variant">{p.name}:</span>
          <span className="font-semibold">{formatarValorTooltip(p)}</span>
        </div>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Funil historico: filtra [inicio, fim]. Defaults = ultimos 30d.
  // Backend usa snapshot diario para reconstruir a Base inadimplente do dia
  // de inicio (ver snapshotService.js + dashboardController.obterFunil).
  const [funil, setFunil] = useState<FunilEtapa[]>([]);
  const hoje30atras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 - 3 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  const [inicioFunil, setInicioFunil] = useState(hoje30atras);
  const [fimFunil, setFimFunil] = useState(hojeBrtISO());
  const [snapshotData, setSnapshotData] = useState<string | null>(null);
  const [avisoFunil, setAvisoFunil] = useState<string | null>(null);
  const [loadingFunil, setLoadingFunil] = useState(false);

  // "Recuperado por Forma de Pagamento": competencia (todo valor confirmado)
  // ou caixa (so o que entrou). Toggle local.
  const [visaoForma, setVisaoForma] = useState<'competencia' | 'caixa'>('competencia');

  // Graficos de recorrencia: granularidade + periodo independentes pra cada
  const [granRec, setGranRec] = useState<Granularidade>('semana');
  const [inicioRec, setInicioRec] = useState(DEFAULT_INICIO);
  const [fimRec, setFimRec] = useState(hojeBrtISO());
  const [recorrentesHistorico, setRecorrentesHistorico] = useState<BucketRecorrentes[]>([]);
  const [loadingRec, setLoadingRec] = useState(false);

  const [granAcum, setGranAcum] = useState<Granularidade>('semana');
  const [inicioAcum, setInicioAcum] = useState(DEFAULT_INICIO);
  const [fimAcum, setFimAcum] = useState(hojeBrtISO());
  const [acumuladoAlunos, setAcumuladoAlunos] = useState<BucketAcumulado[]>([]);
  const [loadingAcum, setLoadingAcum] = useState(false);

  // Matriz de Recuperacao: aging do acordo x metodo de pagamento. Periodo proprio.
  const [inicioMatriz, setInicioMatriz] = useState(hoje30atras);
  const [fimMatriz, setFimMatriz] = useState(hojeBrtISO());

  // Aging Atual e Aging Historico: globais (NAO dependem de filtro de agente).
  // Endpoints proprios pra evitar re-renderizar quando muda agente.
  const [aging, setAging] = useState<AgingFaixa[]>([]);
  const [agingHistorico, setAgingHistorico] = useState<AgingHistoricoSemana[]>([]);

  // Filtro de agente: afeta Funil + Pago por Faixa + Recuperado por Forma.
  // Vazio = todos os agentes (sem filtro). Persiste em localStorage.
  const [agenteIdsFiltro, setAgenteIdsFiltro] = useState<number[]>(carregarAgentesLS());
  function aplicarFiltroAgentes(ids: number[]) {
    setAgenteIdsFiltro(ids);
    salvarAgentesLS(ids);
  }

  const carregar = useCallback(async (forcar = false) => {
    try {
      if (forcar) setRefreshing(true); else setLoading(true);
      const qs = new URLSearchParams();
      if (forcar) qs.set('forcar', 'true');
      if (agenteIdsFiltro.length > 0) qs.set('agenteIds', agenteIdsFiltro.join(','));
      const sufixo = qs.toString() ? `?${qs}` : '';
      setData(await api.get<DashboardData>(`/dashboard${sufixo}`));
    } catch (err) { console.error('Erro dashboard:', err); }
    finally { setLoading(false); setRefreshing(false); }
  }, [agenteIdsFiltro]);

  const carregarFunil = useCallback(async (inicio: string, fim: string, agenteIds: number[]) => {
    setLoadingFunil(true);
    try {
      const r = await obterFunilDashboard(inicio, fim, agenteIds);
      setFunil(r.funil);
      setSnapshotData(r.snapshotData);
      setAvisoFunil(r.aviso);
    } catch (err) { console.error('Erro funil:', err); }
    finally { setLoadingFunil(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { carregarFunil(inicioFunil, fimFunil, agenteIdsFiltro); }, [inicioFunil, fimFunil, agenteIdsFiltro, carregarFunil]);

  // Aging Atual e Aging Historico — globais, NAO dependem de agenteIdsFiltro.
  // Carregam 1x no mount e quando user clica "Atualizar" (carregar(true)).
  useEffect(() => {
    obterAging().then(r => setAging(r.data)).catch(e => console.error('Erro aging:', e));
    obterAgingHistorico().then(r => setAgingHistorico(r.data)).catch(e => console.error('Erro aging-historico:', e));
  }, [refreshing]);

  // Fetchs dos graficos de recorrencia
  useEffect(() => {
    setLoadingRec(true);
    obterRecorrentesHistorico({ granularidade: granRec, inicio: inicioRec, fim: fimRec })
      .then(r => setRecorrentesHistorico(r.data))
      .catch(e => console.error('Erro recorrentes-historico:', e))
      .finally(() => setLoadingRec(false));
  }, [granRec, inicioRec, fimRec]);

  useEffect(() => {
    setLoadingAcum(true);
    obterAcumuladoAlunos({ granularidade: granAcum, inicio: inicioAcum, fim: fimAcum })
      .then(r => setAcumuladoAlunos(r.data))
      .catch(e => console.error('Erro acumulado-alunos:', e))
      .finally(() => setLoadingAcum(false));
  }, [granAcum, inicioAcum, fimAcum]);

  if (loading || !data) return <div className="flex items-center justify-center h-[60vh]"><Loader2 size={32} className="animate-spin text-primary" /></div>;

  const { kpis, ficouFacil, pagoPorForma } = data;

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutDashboard size={20} />
          <h1 className="text-lg font-bold">Dashboard</h1>
        </div>
        <div className="flex items-center gap-3 text-[0.75rem] text-on-surface-variant">
          <FiltroAgentes agenteIds={agenteIdsFiltro} onChange={aplicarFiltroAgentes} />
          <span>Atualizado {new Date(data.atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          <button onClick={() => carregar(true)} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 shadow-sm disabled:opacity-40 transition-colors">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3">
        <KpiCard icon={Users} label="Alunos" valor={kpis.totalAlunos} sub={`${kpis.inadimplentes} inadimplentes`} cor="text-gray-800" bg="bg-white" hint="Alunos ATIVOS ou TRANCADOS (não conta CANCELADOS) de Medicina (curso=1), com turma fora da blacklist (1, 10, 14, 19, 22, 27, 29) e que assinaram o contrato no SEI — OU alunos da Turma 3, que assinam pela ClickSign (exceção). O nº de inadimplentes segue os mesmos filtros." />
        <KpiCard icon={TrendingDown} label="Inadimplência" valor={fmtK(kpis.valorInadimplente)} sub={`${kpis.inadimplentes} alunos`} cor="text-red-600" bg="bg-red-50/50" hint="Soma do saldo devedor de parcelas AR vencidas (exclui matrículas e outros cursos). Igual à soma do gráfico Aging Atual." />
        <KpiCard icon={DollarSign} label="Recuperado" valor={fmtK(kpis.valorRecuperado)} sub={`${kpis.acordosConcluidos} acordos`} cor="text-emerald-600" bg="bg-emerald-50/50" />
        <KpiCard icon={CreditCard} label="Recorrência" valor={`${kpis.taxaRecorrencia}%`} sub={`${kpis.alunosComRecorrencia} alunos`} cor="text-blue-600" bg="bg-blue-50/50" />
        <KpiCard icon={Landmark} label="Ficou Fácil" valor={ficouFacil.totalAtivos + ficouFacil.totalConcluidos} sub={`${ficouFacil.totalConcluidos} concluídos`} cor="text-violet-600" bg="bg-violet-50/50" />
      </div>

      {/* Funil de cobranca historico — filtro [inicio, fim], base via snapshot */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[0.8125rem] font-bold">Funil de Cobrança</h3>
            <p className="text-[0.6875rem] text-gray-400 mt-0.5">
              Foto de quem estava inadimplente em {new Date(inicioFunil + 'T00:00:00').toLocaleDateString('pt-BR')} e a evolução até {new Date(fimFunil + 'T00:00:00').toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {loadingFunil && <Loader2 size={12} className="animate-spin text-gray-400" />}
            <input
              type="date"
              value={inicioFunil}
              onChange={(e) => setInicioFunil(e.target.value)}
              className="h-8 px-2 rounded-lg border border-gray-200 text-[0.75rem] bg-white"
            />
            <span className="text-[0.75rem] text-gray-400">até</span>
            <input
              type="date"
              value={fimFunil}
              onChange={(e) => setFimFunil(e.target.value)}
              className="h-8 px-2 rounded-lg border border-gray-200 text-[0.75rem] bg-white"
            />
          </div>
        </div>
        {avisoFunil && (
          <div className="mb-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[0.6875rem] text-amber-800">
            <Info size={12} className="mt-0.5 shrink-0" />
            <span>{avisoFunil}{snapshotData && ` (snapshot de ${new Date(snapshotData + 'T00:00:00').toLocaleDateString('pt-BR')})`}</span>
          </div>
        )}
        {funil.length === 0 ? (
          <div className="py-8 text-center text-[0.75rem] text-gray-400">Carregando funil…</div>
        ) : (
          <div className="grid grid-cols-5 gap-3">
            {funil.map((f, i) => {
              const pctAlunoReal = funil[0].qtd > 0 ? (f.qtd / funil[0].qtd * 100) : 0;
              const pctValorReal = funil[0].valor > 0 ? (f.valor / funil[0].valor * 100) : 0;
              // Cap em 100% para a visualizacao (defensivo: aluno fora da base
              // poderia gerar overflow, mas Tier 1.2 ja restringe pela coorte).
              const pctAluno = Math.min(100, pctAlunoReal);
              const pctValor = Math.min(100, pctValorReal);
              const excedeBase = pctValorReal > 100 || pctAlunoReal > 100;
              // Base (vermelho) → Tentativa (âmbar) → Contato Realizado (laranja) → Negociado (azul) → Recuperado (verde)
              const cores = ['#ef4444', '#f59e0b', '#f97316', '#3b82f6', '#10b981'];
              return (
                <div key={f.etapa} className="relative">
                  <div className="rounded-xl p-4" style={{ backgroundColor: `${cores[i]}10` }}>
                    <p className="text-[0.625rem] font-bold uppercase tracking-wider" style={{ color: cores[i] }}>{f.etapa}</p>
                    <p className="text-2xl font-bold text-on-surface mt-2">{f.qtd}</p>
                    <p className="text-[0.75rem] text-on-surface-variant">alunos</p>
                    <p className="text-[0.875rem] font-bold mt-2" style={{ color: cores[i] }}>{fmtK(f.valor)}</p>
                    <div className="flex gap-3 mt-2 text-[0.625rem] text-on-surface-variant">
                      <span>{pctAluno.toFixed(0)}% CPFs</span>
                      <span title={excedeBase ? `Valor real: ${pctValorReal.toFixed(0)}% — fora da base inadimplente do snapshot` : undefined}>
                        {pctValor.toFixed(0)}% Valor{excedeBase ? '+' : ''}
                      </span>
                    </div>
                    {/* Barra de progresso */}
                    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pctAluno}%`, backgroundColor: cores[i] }} />
                    </div>
                  </div>
                  {i < funil.length - 1 && (
                    <div className="absolute right-[-10px] top-1/2 -translate-y-1/2 text-gray-200 text-lg">›</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Aging Atual + Aging Historico */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="text-[0.8125rem] font-bold mb-4" title="Saldo devedor de parcelas AR vencidas hoje, agrupado por dias de atraso. Conta parcelas (não alunos) — um aluno pode ter várias parcelas em diferentes faixas. Exclui matrículas, outros cursos e funcionários.">Aging Atual</h3>
          <div className="space-y-3">
            {aging.map((a: any, i: number) => {
              const total = aging.reduce((s: number, x: any) => s + x.valor, 0);
              const pct = total > 0 ? (a.valor / total * 100) : 0;
              const cores = [AGING_COLORS['0-5'], AGING_COLORS['6-30'], AGING_COLORS['31-90'], AGING_COLORS['90+']];
              return (
                <div key={a.faixa}>
                  <div className="flex items-center justify-between text-[0.75rem] mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cores[i] }} />
                      <span className="font-medium text-on-surface-variant">{a.faixa}</span>
                    </div>
                    <span className="font-bold">{fmtK(a.valor)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: cores[i] }} />
                  </div>
                  <div className="flex justify-between text-[0.5625rem] text-on-surface-variant/50 mt-0.5">
                    <span>{a.qtd} títulos</span>
                    <span>{pct.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="col-span-2 bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="text-[0.8125rem] font-bold mb-1">Inadimplência por Semana</h3>
          <p className="text-[0.6875rem] text-on-surface-variant mb-3">Distribuição do aging em R$ — últimas 12 semanas</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={agingHistorico} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={fmtK} width={65} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} iconType="square" iconSize={8} />
              <Bar dataKey="faixa_0_5" name="0-5 dias" stackId="a" fill={AGING_COLORS['0-5']} />
              <Bar dataKey="faixa_6_30" name="6-30 dias" stackId="a" fill={AGING_COLORS['6-30']} />
              <Bar dataKey="faixa_31_90" name="31-90 dias" stackId="a" fill={AGING_COLORS['31-90']} />
              <Bar dataKey="faixa_90_mais" name="90+ dias" stackId="a" fill={AGING_COLORS['90+']} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Matriz de Recuperacao: substitui o card antigo "Pago por Faixa de Inadimplencia" */}
      <MatrizRecuperacao
        agenteIds={agenteIdsFiltro}
        inicio={inicioMatriz}
        fim={fimMatriz}
        onChangeInicio={setInicioMatriz}
        onChangeFim={setFimMatriz}
      />

      {/* Recuperado por Forma de Pagamento */}
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[0.8125rem] font-bold" title="Competência = quando o cliente pagou (PAYMENT_CONFIRMED do Asaas). Caixa = quando o dinheiro entrou na conta Asaas (PAYMENT_RECEIVED) — pode demorar de D+1 a D+30 conforme cartão.">Recuperado por Forma de Pagamento</h3>
            <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-[0.6875rem]">
              <button
                onClick={() => setVisaoForma('competencia')}
                className={`px-2.5 py-1 rounded-md transition-colors ${visaoForma === 'competencia' ? 'bg-white shadow-sm font-semibold text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                Competência
              </button>
              <button
                onClick={() => setVisaoForma('caixa')}
                className={`px-2.5 py-1 rounded-md transition-colors ${visaoForma === 'caixa' ? 'bg-white shadow-sm font-semibold text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                Caixa
              </button>
            </div>
          </div>
          <p className="text-[0.6875rem] text-on-surface-variant mb-3">
            {visaoForma === 'competencia'
              ? 'Todo valor confirmado, mesmo que parcelado'
              : 'Apenas o valor que efetivamente entrou'}
          </p>
          {(() => {
            const formas = pagoPorForma[visaoForma] || [];
            if (formas.length === 0) {
              return <p className="text-[0.8125rem] text-on-surface-variant py-8 text-center">Nenhum pagamento registrado</p>;
            }
            const maxVal = Math.max(...formas.map(x => x.valor || 1));
            return (
              <div className="space-y-1.5">
                {formas.map(r => {
                  const pct = r.valor / maxVal * 100;
                  return (
                    <div key={r.forma} className="flex items-center gap-3 text-[0.8125rem]">
                      <span className="w-28 text-on-surface-variant shrink-0 truncate">{r.forma}</span>
                      <span className="w-6 text-center font-bold text-on-surface text-[0.75rem]">{r.qtd}</span>
                      <div className="flex-1 h-4 bg-gray-50 rounded-sm overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-red-400 to-red-300 rounded-sm transition-all" style={{ width: `${Math.max(5, pct)}%` }} />
                      </div>
                      <span className="w-24 text-right font-semibold text-on-surface text-[0.75rem] shrink-0">{fmtK(r.valor)}</span>
                    </div>
                  );
                })}
                <div className="border-t border-gray-100 pt-2 mt-2 flex justify-between text-[0.8125rem] font-bold">
                  <span className="text-on-surface-variant">Total</span>
                  <span className="text-on-surface">{fmt(formas.reduce((s, r) => s + r.valor, 0))}</span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Recorrentes vs Outros + Acumulado */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h3 className="text-[0.8125rem] font-bold" title="Cohort: turmas ativas de medicina (2, 4, 8, 11, 21, 28). Diferente da blacklist usada nos outros gráficos — aqui é whitelist intencional para medir recorrência apenas no público de medicina ativa.">Composição: Recorrentes vs Outros</h3>
            <ControlesGrafico
              loading={loadingRec}
              granularidade={granRec} setGranularidade={setGranRec}
              inicio={inicioRec} setInicio={setInicioRec}
              fim={fimRec} setFim={setFimRec}
            />
          </div>
          <p className="text-[0.6875rem] text-on-surface-variant mb-3">Alunos por método de pagamento + % recorrentes</p>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={recorrentesHistorico} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v: number) => `${v}%`} domain={[0, 40]} ticks={[0, 10, 20, 30, 40]} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} iconType="square" iconSize={8} />
              <Bar yAxisId="left" dataKey="semRecorrencia" name="Sem recorrência" stackId="a" fill="#1e5a8a" />
              <Bar yAxisId="left" dataKey="recorrentes" name="Recorrentes" stackId="a" fill="#ea580c" radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="percentual" name="% recorrentes" stroke="#16a34a" strokeWidth={2.5} dot={false} unit="%" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h3 className="text-[0.8125rem] font-bold" title="Cohort: turmas ativas de medicina (2, 4, 8, 11, 21, 28).">Novos Alunos Acumulados + % com Recorrência</h3>
            <ControlesGrafico
              loading={loadingAcum}
              granularidade={granAcum} setGranularidade={setGranAcum}
              inicio={inicioAcum} setInicio={setInicioAcum}
              fim={fimAcum} setFim={setFimAcum}
            />
          </div>
          <p className="text-[0.6875rem] text-on-surface-variant mb-3">Novas matrículas acumuladas na janela × % que cadastrou cartão recorrente</p>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={acumuladoAlunos} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v: number) => `${v}%`} domain={[10, 40]} ticks={[10, 20, 30, 40]} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} iconType="square" iconSize={8} />
              <Bar yAxisId="left" dataKey="acumulado" name="Novos alunos (acumulado)" fill="#1e5a8a" radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="percentualRecorrentes" name="% recorrência" stroke="#ea580c" strokeWidth={2.5} dot={false} unit="%" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ficou Facil */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h3 className="text-[0.8125rem] font-bold mb-1">Ficou Fácil — Financiamento Estudantil</h3>
        <p className="text-[0.6875rem] text-on-surface-variant mb-4">Distribuição por etapa do workflow</p>
        <div className="flex gap-6">
          <div className="flex-1">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ficouFacil.porEtapa} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="etapa" tick={{ fontSize: 9, fill: '#64748b' }} width={60} axisLine={false} tickLine={false}
                  tickFormatter={(v: string) => ({ AGUARDANDO_DOCUMENTACAO: 'Docs', ANALISE_CREDITO: 'Crédito', ASSINATURA_CONTRATO_1: 'Contr. 1', ASSINATURA_CONTRATO_2: 'Contr. 2', ASSINATURA_CONTRATO_3: 'Contr. 3', ASSINATURA_LM: 'LM', CONCLUIDO: 'Concluído' }[v] || v)} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="qtd" name="Alunos" radius={[0, 4, 4, 0]}>
                  {ficouFacil.porEtapa.map((e: any, i: number) => <Cell key={i} fill={e.etapa === 'CONCLUIDO' ? '#10b981' : '#8b5cf6'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="w-[280px] grid grid-cols-2 gap-3 content-start">
            <div className="bg-violet-50 rounded-xl p-4">
              <p className="text-[0.5625rem] font-bold uppercase tracking-wider text-violet-400">Em andamento</p>
              <p className="text-2xl font-bold text-violet-600 mt-1">{ficouFacil.totalAtivos}</p>
              <p className="text-[0.75rem] text-violet-500">{fmtK(ficouFacil.valorTotalFinanciado)}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4">
              <p className="text-[0.5625rem] font-bold uppercase tracking-wider text-emerald-400">Recuperado</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{ficouFacil.totalConcluidos}</p>
              <p className="text-[0.75rem] text-emerald-500">{fmtK(ficouFacil.valorRecuperado)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, valor, sub, cor, bg, hint }: { icon: any; label: string; valor: any; sub: string; cor: string; bg: string; hint?: string }) {
  return (
    <div className={`${bg} rounded-xl p-4 shadow-sm relative`}>
      <div className={`flex items-center justify-between gap-2 ${cor} mb-1.5`}>
        <div className="flex items-center gap-2">
          <Icon size={14} />
          <span className="text-[0.625rem] font-bold uppercase tracking-wider opacity-70">{label}</span>
        </div>
        {hint && (
          <button
            type="button"
            title={hint}
            className="opacity-40 hover:opacity-100 transition-opacity cursor-help"
            aria-label="Como é calculado"
          >
            <Info size={12} />
          </button>
        )}
      </div>
      <p className={`text-xl font-bold ${cor}`}>{valor}</p>
      <p className="text-[0.6875rem] text-on-surface-variant mt-0.5">{sub}</p>
    </div>
  );
}

// ----------------------------------------------------------------------
// Controles compactos para os graficos parametrizados (semana/mes + range)
// ----------------------------------------------------------------------
function ControlesGrafico({
  loading,
  granularidade, setGranularidade,
  inicio, setInicio,
  fim, setFim,
}: {
  loading: boolean;
  granularidade: Granularidade;
  setGranularidade: (g: Granularidade) => void;
  inicio: string;
  setInicio: (s: string) => void;
  fim: string;
  setFim: (s: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      {loading && <Loader2 size={12} className="animate-spin text-gray-400" />}
      <input
        type="date"
        value={inicio}
        onChange={(e) => setInicio(e.target.value)}
        className="h-7 px-2 rounded-md border border-gray-200 text-[0.6875rem] bg-white outline-none focus:ring-1 focus:ring-primary/30"
        title="Início"
      />
      <span className="text-[0.625rem] text-gray-400">→</span>
      <input
        type="date"
        value={fim}
        onChange={(e) => setFim(e.target.value)}
        className="h-7 px-2 rounded-md border border-gray-200 text-[0.6875rem] bg-white outline-none focus:ring-1 focus:ring-primary/30"
        title="Fim"
      />
      <div className="inline-flex rounded-md bg-gray-100 p-0.5 text-[0.625rem]">
        <button
          onClick={() => setGranularidade('semana')}
          className={`px-2 py-0.5 rounded transition-colors ${granularidade === 'semana' ? 'bg-white shadow-sm font-semibold text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
        >Semana</button>
        <button
          onClick={() => setGranularidade('mes')}
          className={`px-2 py-0.5 rounded transition-colors ${granularidade === 'mes' ? 'bg-white shadow-sm font-semibold text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
        >Mês</button>
      </div>
    </div>
  );
}
