import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Line, Cell,
} from 'recharts';
import {
  LayoutDashboard, RefreshCw, Loader2, Users, TrendingDown, DollarSign,
  CreditCard, Landmark
} from 'lucide-react';

interface DashboardData {
  kpis: any; aging: any[]; agingHistorico: any[]; recorrentesHistorico: any[];
  acumuladoAlunos: any[]; ficouFacil: any; funil: any[]; pagoPorAging: any[]; pagoPorForma: any[];
  atualizadoEm: string;
}

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function fmtK(v: number) {
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(0)}k`;
  return fmt(v);
}

const AGING_COLORS = { '0-5': '#818cf8', '6-30': '#a78bfa', '31-90': '#f59e0b', '90+': '#fbbf24' };

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg px-4 py-3 border border-gray-100 text-[0.6875rem]">
      <p className="font-semibold text-on-surface mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-on-surface-variant">{p.name}:</span>
          <span className="font-semibold">{typeof p.value === 'number' && p.value > 100 ? fmtK(p.value) : p.value}{p.unit || ''}</span>
        </div>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = useCallback(async (forcar = false) => {
    try {
      if (forcar) setRefreshing(true); else setLoading(true);
      setData(await api.get<DashboardData>(`/dashboard${forcar ? '?forcar=true' : ''}`));
    } catch (err) { console.error('Erro dashboard:', err); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (loading || !data) return <div className="flex items-center justify-center h-[60vh]"><Loader2 size={32} className="animate-spin text-primary" /></div>;

  const { kpis, aging, agingHistorico, recorrentesHistorico, acumuladoAlunos, ficouFacil, funil, pagoPorAging, pagoPorForma } = data;

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutDashboard size={20} />
          <h1 className="text-lg font-bold">Dashboard</h1>
        </div>
        <div className="flex items-center gap-3 text-[0.75rem] text-on-surface-variant">
          <span>Atualizado {new Date(data.atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          <button onClick={() => carregar(true)} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 shadow-sm disabled:opacity-40 transition-colors">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3">
        <KpiCard icon={Users} label="Alunos" valor={kpis.totalAlunos} sub={`${kpis.inadimplentes} inadimplentes`} cor="text-gray-800" bg="bg-white" />
        <KpiCard icon={TrendingDown} label="Inadimplência" valor={fmtK(kpis.valorInadimplente)} sub={`${kpis.inadimplentes} alunos`} cor="text-red-600" bg="bg-red-50/50" />
        <KpiCard icon={DollarSign} label="Recuperado" valor={fmtK(kpis.valorRecuperado)} sub={`${kpis.acordosConcluidos} acordos`} cor="text-emerald-600" bg="bg-emerald-50/50" />
        <KpiCard icon={CreditCard} label="Recorrência" valor={`${kpis.taxaRecorrencia}%`} sub={`${kpis.alunosComRecorrencia} alunos`} cor="text-blue-600" bg="bg-blue-50/50" />
        <KpiCard icon={Landmark} label="Ficou Fácil" valor={ficouFacil.totalAtivos + ficouFacil.totalConcluidos} sub={`${ficouFacil.totalConcluidos} concluídos`} cor="text-violet-600" bg="bg-violet-50/50" />
      </div>

      {/* Funil de cobranca */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h3 className="text-[0.8125rem] font-bold mb-4">Funil de Cobrança</h3>
        <div className="grid grid-cols-4 gap-3">
          {funil.map((f: any, i: number) => {
            const pctAluno = funil[0].qtd > 0 ? (f.qtd / funil[0].qtd * 100) : 0;
            const pctValor = funil[0].valor > 0 ? (f.valor / funil[0].valor * 100) : 0;
            const cores = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
            return (
              <div key={f.etapa} className="relative">
                <div className="rounded-xl p-4" style={{ backgroundColor: `${cores[i]}10` }}>
                  <p className="text-[0.625rem] font-bold uppercase tracking-wider" style={{ color: cores[i] }}>{f.etapa}</p>
                  <p className="text-2xl font-bold text-on-surface mt-2">{f.qtd}</p>
                  <p className="text-[0.75rem] text-on-surface-variant">alunos</p>
                  <p className="text-[0.875rem] font-bold mt-2" style={{ color: cores[i] }}>{fmtK(f.valor)}</p>
                  <div className="flex gap-3 mt-2 text-[0.625rem] text-on-surface-variant">
                    <span>{pctAluno.toFixed(0)}% CPFs</span>
                    <span>{pctValor.toFixed(0)}% Valor</span>
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
      </div>

      {/* Aging Atual + Aging Historico */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="text-[0.8125rem] font-bold mb-4">Aging Atual</h3>
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

      {/* Pago por Aging + Pago por Forma */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="text-[0.8125rem] font-bold mb-1">Pago por Faixa de Inadimplência</h3>
          <p className="text-[0.6875rem] text-on-surface-variant mb-3">Qtd parcelas, valor recebido e negociado</p>
          {pagoPorAging.length > 0 ? (
            <div className="space-y-2">
              {pagoPorAging.map((r: any) => (
                <div key={r.faixa} className="flex items-center gap-3 text-[0.8125rem]">
                  <span className="w-16 font-medium text-on-surface-variant shrink-0">{r.faixa}</span>
                  <span className="w-8 text-center font-bold text-on-surface">{r.qtdParcelas}</span>
                  <div className="flex-1">
                    <div className="flex gap-1 h-5">
                      <div className="bg-emerald-400 rounded-sm h-full transition-all" style={{ width: `${r.valorRecebido > 0 ? Math.max(20, r.valorRecebido / Math.max(...pagoPorAging.map((x: any) => x.valorNegociado || 1)) * 100) : 0}%` }} title={`Recebido: ${fmt(r.valorRecebido)}`} />
                      <div className="bg-blue-300 rounded-sm h-full transition-all" style={{ width: `${r.valorNegociado > 0 ? Math.max(20, r.valorNegociado / Math.max(...pagoPorAging.map((x: any) => x.valorNegociado || 1)) * 100) : 0}%` }} title={`Negociado: ${fmt(r.valorNegociado)}`} />
                    </div>
                  </div>
                  <div className="text-right w-28 shrink-0">
                    <p className="text-[0.6875rem] text-emerald-600 font-medium">{fmtK(r.valorRecebido)}</p>
                    <p className="text-[0.5625rem] text-blue-500">{fmtK(r.valorNegociado)}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3 border-t border-gray-100 pt-2 mt-2 text-[0.75rem]">
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /><span className="text-on-surface-variant">Recebido</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-blue-300" /><span className="text-on-surface-variant">Negociado</span></div>
              </div>
            </div>
          ) : (
            <p className="text-[0.8125rem] text-on-surface-variant py-8 text-center">Nenhum pagamento registrado</p>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="text-[0.8125rem] font-bold mb-1">Recuperado por Forma de Pagamento</h3>
          <p className="text-[0.6875rem] text-on-surface-variant mb-3">Quantidade e valor por método</p>
          {pagoPorForma.length > 0 ? (
            <div className="space-y-1.5">
              {pagoPorForma.map((r: any) => {
                const maxVal = Math.max(...pagoPorForma.map((x: any) => x.valor || 1));
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
                <span className="text-on-surface">{fmt(pagoPorForma.reduce((s: number, r: any) => s + r.valor, 0))}</span>
              </div>
            </div>
          ) : (
            <p className="text-[0.8125rem] text-on-surface-variant py-8 text-center">Nenhum pagamento registrado</p>
          )}
        </div>
      </div>

      {/* Recorrentes vs Outros + Acumulado */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="text-[0.8125rem] font-bold mb-1">Composição: Recorrentes vs Outros</h3>
          <p className="text-[0.6875rem] text-on-surface-variant mb-3">Alunos por método de pagamento + % recorrentes</p>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={recorrentesHistorico} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v: number) => `${v}%`} domain={[10, 40]} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} iconType="square" iconSize={8} />
              <Bar yAxisId="left" dataKey="semRecorrencia" name="Sem recorrência" stackId="a" fill="#1e5a8a" />
              <Bar yAxisId="left" dataKey="recorrentes" name="Recorrentes" stackId="a" fill="#ea580c" radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="percentual" name="% recorrentes" stroke="#16a34a" strokeWidth={2.5} dot={false} unit="%" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="text-[0.8125rem] font-bold mb-1">Base de Alunos + % com Recorrência Ativa</h3>
          <p className="text-[0.6875rem] text-on-surface-variant mb-3">Total matriculados até a semana × % com cartão recorrente ativo</p>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={acumuladoAlunos} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v: number) => `${v}%`} domain={[0, 'auto']} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} iconType="square" iconSize={8} />
              <Bar yAxisId="left" dataKey="acumulado" name="Total de alunos" fill="#1e5a8a" radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="percentualRecorrentes" name="% recorrência ativa" stroke="#ea580c" strokeWidth={2.5} dot={false} unit="%" />
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

function KpiCard({ icon: Icon, label, valor, sub, cor, bg }: { icon: any; label: string; valor: any; sub: string; cor: string; bg: string }) {
  return (
    <div className={`${bg} rounded-xl p-4 shadow-sm`}>
      <div className={`flex items-center gap-2 ${cor} mb-1.5`}>
        <Icon size={14} />
        <span className="text-[0.625rem] font-bold uppercase tracking-wider opacity-70">{label}</span>
      </div>
      <p className={`text-xl font-bold ${cor}`}>{valor}</p>
      <p className="text-[0.6875rem] text-on-surface-variant mt-0.5">{sub}</p>
    </div>
  );
}
