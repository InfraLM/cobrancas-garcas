import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Handshake, ChevronLeft, ChevronRight, Loader2, DollarSign, CheckCircle2, Clock, Users, TrendingUp } from 'lucide-react';
import {
  listarAcordos,
  obterResumoAcordos,
  type AcordoEnriquecido,
  type ListarAcordosParams,
  type ResumoAcordos,
} from '../services/acordos';
import FiltrosNegociacoes, { QUICK_FILTERS } from '../components/negociacoes/FiltrosNegociacoes';
import TabelaNegociacoes from '../components/negociacoes/TabelaNegociacoes';
import DrawerNegociacao from '../components/negociacoes/DrawerNegociacao';

function fmtBRL(v: number, compact = false) {
  if (compact && Math.abs(v) >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

// Le filtros do query string (drill-down da matriz)
function filtrosFromUrl(sp: URLSearchParams): ListarAcordosParams {
  const filtros: ListarAcordosParams = { page: 1, limit: 50 };
  for (const [k, v] of sp.entries()) {
    if (v) (filtros as Record<string, string>)[k] = v;
  }
  return filtros;
}

export default function NegociacoesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtros, setFiltrosState] = useState<ListarAcordosParams>(() => filtrosFromUrl(searchParams));
  const [quickAtivo, setQuickAtivo] = useState<string>(() => {
    // detecta quick ativo via URL (futuro: caso queiramos sincronizar)
    return '';
  });
  const [acordos, setAcordos] = useState<AcordoEnriquecido[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState<ResumoAcordos | null>(null);
  const [acordoSelId, setAcordoSelId] = useState<string | null>(null);

  // Sincroniza filtros para URL (preserva drill-down + refresh-safe)
  const setFiltros = useCallback((novo: ListarAcordosParams) => {
    setFiltrosState(novo);
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(novo)) {
      if (v !== undefined && v !== null && v !== '' && k !== 'limit') sp.set(k, String(v));
    }
    setSearchParams(sp, { replace: true });
  }, [setSearchParams]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listarAcordos(filtros);
      setAcordos(r.acordos);
      setTotal(r.total);
    } catch (e) {
      console.error('Erro listar acordos:', e);
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  const carregarResumo = useCallback(async () => {
    try {
      const r = await obterResumoAcordos(filtros);
      setResumo(r);
    } catch (e) {
      console.error('Erro resumo:', e);
    }
  }, [filtros]);

  useEffect(() => { carregar(); carregarResumo(); }, [carregar, carregarResumo]);

  const limit = filtros.limit || 50;
  const page = filtros.page || 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const pct = resumo && resumo.valorAcordoTotal > 0
    ? Math.round((resumo.valorPago / resumo.valorAcordoTotal) * 100)
    : 0;

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Handshake size={20} className="text-on-surface" />
          <h1 className="text-lg font-bold">Negociações</h1>
          {resumo && (
            <span className="text-[0.75rem] text-on-surface-variant">
              {resumo.total} no escopo atual
            </span>
          )}
        </div>
      </div>

      {/* Cards de resumo */}
      {resumo && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <CardResumo label="Total" valor={String(resumo.total)} icon={Users} sub={`${resumo.abertos} aberto(s)`} />
          <CardResumo label="Concluídos" valor={String(resumo.concluidos)} icon={CheckCircle2} cor="text-emerald-600" sub={`${resumo.cancelados} cancelado(s)`} />
          <CardResumo label="Valor acordo" valor={fmtBRL(resumo.valorAcordoTotal, true)} icon={DollarSign} />
          <CardResumo label="Pago" valor={fmtBRL(resumo.valorPago, true)} cor={pct >= 80 ? 'text-emerald-600' : 'text-blue-600'} icon={TrendingUp} sub={`${pct}% do total`} />
          <CardResumo label="Desconto" valor={fmtBRL(resumo.descontoTotal, true)} icon={DollarSign} cor="text-amber-600" />
          <CardResumo label="Tempo médio" valor={resumo.diasMedioConcluir != null ? `${resumo.diasMedioConcluir}d` : '—'} icon={Clock} sub="até concluir" />
        </div>
      )}

      {/* Top agentes (mini chart) */}
      {resumo && resumo.porAgente.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[0.75rem] font-bold uppercase tracking-wide text-on-surface-variant">Top agentes (no escopo)</h3>
          </div>
          <div className="space-y-1.5">
            {resumo.porAgente.map((a, i) => {
              const maxV = Math.max(...resumo.porAgente.map(x => x.valor));
              const w = maxV > 0 ? (a.valor / maxV) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-3 text-[0.75rem]">
                  <span className="w-32 truncate font-medium">{a.agente}</span>
                  <span className="w-12 text-on-surface-variant text-[0.6875rem]">{a.qtd}</span>
                  <div className="flex-1 h-3 bg-gray-50 rounded-sm overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary/70 to-primary rounded-sm transition-all" style={{ width: `${Math.max(5, w)}%` }} />
                  </div>
                  <span className="w-20 text-right font-semibold">{fmtBRL(a.valor, true)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtros */}
      <FiltrosNegociacoes filtros={filtros} setFiltros={setFiltros} quickAtivo={quickAtivo} setQuickAtivo={setQuickAtivo} />

      {/* Tabela */}
      <TabelaNegociacoes acordos={acordos} loading={loading} onClickAcordo={(a) => setAcordoSelId(a.id)} />

      {/* Paginacao */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[0.75rem]">
          <span className="text-on-surface-variant">
            Mostrando {(page - 1) * limit + 1}–{Math.min(page * limit, total)} de {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFiltros({ ...filtros, page: page - 1 })}
              disabled={page <= 1}
              className="h-7 w-7 rounded-md bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-30 flex items-center justify-center"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 font-semibold">{page} / {totalPages}</span>
            <button
              onClick={() => setFiltros({ ...filtros, page: page + 1 })}
              disabled={page >= totalPages}
              className="h-7 w-7 rounded-md bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-30 flex items-center justify-center"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Drawer */}
      <DrawerNegociacao acordoId={acordoSelId} onClose={() => setAcordoSelId(null)} />

      {/* Loading overlay */}
      {loading && acordos.length > 0 && (
        <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-full px-3 py-2 flex items-center gap-2 text-[0.75rem]">
          <Loader2 size={12} className="animate-spin text-primary" />
          Atualizando…
        </div>
      )}
    </div>
  );
}

function CardResumo({
  label, valor, sub, icon: Icon, cor = 'text-on-surface',
}: {
  label: string; valor: string; sub?: string; icon: typeof Users; cor?: string;
}) {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="text-[0.625rem] uppercase tracking-wide text-on-surface-variant font-semibold">{label}</div>
        <Icon size={12} className="text-gray-300" />
      </div>
      <div className={`text-base font-bold mt-1 ${cor}`}>{valor}</div>
      {sub && <div className="text-[0.625rem] text-on-surface-variant mt-0.5">{sub}</div>}
    </div>
  );
}

// Re-export para outras telas usarem ao construir links
export { QUICK_FILTERS };
