import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { DisparoMensagem } from '../../types/disparoMensagem';
import { STATUS_DISPARO_LABEL, STATUS_DISPARO_COR } from '../../types/disparoMensagem';
import { listarHistorico } from '../../services/disparos';

export default function HistoricoDisparosTab() {
  const [disparos, setDisparos] = useState<DisparoMensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [statusFiltro, setStatusFiltro] = useState<string>('');
  const [periodo, setPeriodo] = useState<string>('7d');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listarHistorico({
        status: statusFiltro || undefined,
        periodo,
        limit: 100,
      });
      setDisparos(r.data);
      setTotal(r.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statusFiltro, periodo]);

  useEffect(() => { carregar(); }, [carregar]);

  function formatarDataHora(iso: string | null | undefined) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }
    catch { return '—'; }
  }

  function iconeStatus(s: DisparoMensagem['status']) {
    if (s === 'ENVIADO') return <CheckCircle size={12} className="text-emerald-600" />;
    if (s === 'FALHOU') return <XCircle size={12} className="text-red-600" />;
    return <Clock size={12} className="text-gray-400" />;
  }

  const resumoStatus = disparos.reduce(
    (acc, d) => { acc[d.status] = (acc[d.status] || 0) + 1; return acc; },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={periodo}
          onChange={e => setPeriodo(e.target.value)}
          className="h-9 px-3 rounded-lg border border-gray-200 text-[0.8125rem] bg-white"
        >
          <option value="1d">Hoje</option>
          <option value="7d">7 dias</option>
          <option value="30d">30 dias</option>
          <option value="90d">90 dias</option>
        </select>
        <select
          value={statusFiltro}
          onChange={e => setStatusFiltro(e.target.value)}
          className="h-9 px-3 rounded-lg border border-gray-200 text-[0.8125rem] bg-white"
        >
          <option value="">Todos os status</option>
          <option value="ENVIADO">Enviados</option>
          <option value="PENDENTE">Pendentes</option>
          <option value="FALHOU">Falhas</option>
        </select>
        <button
          onClick={carregar}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-gray-100 text-gray-700 text-[0.8125rem] hover:bg-gray-200"
        >
          <RefreshCw size={13} /> Atualizar
        </button>
        <span className="text-[0.8125rem] text-gray-400 ml-auto">
          {total} disparo{total !== 1 ? 's' : ''} no período
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
          <p className="text-[0.6875rem] uppercase tracking-wider text-emerald-600 font-semibold">Enviados</p>
          <p className="text-xl font-bold text-emerald-700 mt-1">{resumoStatus.ENVIADO || 0}</p>
        </div>
        <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
          <p className="text-[0.6875rem] uppercase tracking-wider text-gray-500 font-semibold">Pendentes</p>
          <p className="text-xl font-bold text-gray-700 mt-1">{resumoStatus.PENDENTE || 0}</p>
        </div>
        <div className="p-3 rounded-xl bg-red-50 border border-red-100">
          <p className="text-[0.6875rem] uppercase tracking-wider text-red-600 font-semibold">Falhas</p>
          <p className="text-xl font-bold text-red-700 mt-1">{resumoStatus.FALHOU || 0}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={22} className="animate-spin text-primary" />
        </div>
      ) : disparos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
          <p className="text-[0.8125rem] text-gray-400">Nenhum disparo no período.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100">
          <div className="grid grid-cols-[1.5fr_1fr_0.8fr_1fr_0.6fr] gap-3 px-5 py-3 text-[0.625rem] uppercase tracking-wider text-gray-300 font-medium border-b border-gray-50">
            <span>Aluno</span>
            <span>Template</span>
            <span>Origem</span>
            <span>Criado em</span>
            <span>Status</span>
          </div>
          {disparos.map(d => (
            <div key={d.id} className="grid grid-cols-[1.5fr_1fr_0.8fr_1fr_0.6fr] gap-3 px-5 py-3 items-center border-t border-gray-50 text-[0.8125rem]">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{d.pessoaNome}</p>
                <p className="text-[0.6875rem] text-gray-400 truncate">{d.telefone}</p>
              </div>
              <p className="text-[0.75rem] font-mono text-gray-500 truncate">{d.templateNomeBlip}</p>
              <span className={`text-[0.6875rem] px-2 py-0.5 rounded inline-block w-fit ${d.origem === 'REGUA_AUTO' ? 'bg-sky-50 text-sky-700' : 'bg-violet-50 text-violet-700'}`}>
                {d.origem === 'REGUA_AUTO' ? 'Régua' : 'Manual'}
              </span>
              <span className="text-[0.75rem] text-gray-500">{formatarDataHora(d.disparadoEm || d.criadoEm)}</span>
              <div className="flex items-center gap-1">
                {iconeStatus(d.status)}
                <span className={`text-[0.6875rem] px-1.5 py-0.5 rounded ${STATUS_DISPARO_COR[d.status]}`}>
                  {STATUS_DISPARO_LABEL[d.status]}
                </span>
              </div>
              {d.status === 'FALHOU' && d.erroMensagem && (
                <div className="col-span-5 text-[0.6875rem] text-red-600 bg-red-50 rounded px-2 py-1 -mt-1">
                  {d.erroMensagem}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
