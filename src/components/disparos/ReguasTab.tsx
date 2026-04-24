import { useEffect, useState, useCallback } from 'react';
import { Plus, Loader2, Sparkles, Copy, Layers, Clock, Activity, CheckCircle } from 'lucide-react';
import type { ReguaCobranca } from '../../types/reguaCobranca';
import { listarReguas, duplicarRegua, criarReguaDoModelo } from '../../services/reguas';
import ReguaEditorDrawer from './ReguaEditorDrawer';
import NovaReguaModal from './NovaReguaModal';

export default function ReguasTab() {
  const [reguas, setReguas] = useState<ReguaCobranca[]>([]);
  const [loading, setLoading] = useState(true);
  const [reguaEditando, setReguaEditando] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [novaAberta, setNovaAberta] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setReguas(await listarReguas());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  function handleCriadaNova(regua: ReguaCobranca) {
    setNovaAberta(false);
    setReguaEditando(regua.id);
    carregar();
  }

  // Computa proxima execucao da regua no dia atual ou amanha
  function proximaExecucaoTexto(regua: ReguaCobranca): string {
    if (!regua.ativo) return 'Inativa — sem próximos disparos';
    if (!regua.etapas || regua.etapas.length === 0) return 'Sem etapas configuradas';

    const agora = new Date();
    const agoraBRT = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
    const agoraMin = agoraBRT.getUTCHours() * 60 + agoraBRT.getUTCMinutes();

    const horarios = regua.etapas
      .filter(e => e.ativo)
      .map(e => {
        const h = e.horario || regua.horarioPadrao || '09:00';
        const [hh, mm] = h.split(':').map(Number);
        return { min: hh * 60 + (mm || 0), nome: e.nome, str: h };
      })
      .sort((a, b) => a.min - b.min);

    if (horarios.length === 0) return 'Nenhuma etapa ativa';

    const futuroHoje = horarios.find(h => h.min > agoraMin);
    if (futuroHoje) return `Próxima: hoje ${futuroHoje.str} (${futuroHoje.nome})`;

    return `Próxima: amanhã ${horarios[0].str} (${horarios[0].nome})`;
  }

  async function handleCriarDoModelo() {
    if (!confirm('Criar régua de modelo (10 etapas conforme documento)? Requer os 5 templates cadastrados.')) return;
    setCriando(true);
    try {
      const r = await criarReguaDoModelo() as { data?: ReguaCobranca; error?: string; faltantes?: string[] };
      if (r.error) {
        alert(`${r.error}\n\nFaltantes: ${r.faltantes?.join(', ') || 'n/a'}`);
        return;
      }
      if (r.data) {
        setReguaEditando(r.data.id);
        carregar();
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao criar do modelo');
    } finally {
      setCriando(false);
    }
  }

  async function handleDuplicar(id: string) {
    try {
      const nova = await duplicarRegua(id);
      setReguaEditando(nova.id);
      carregar();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao duplicar');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[0.8125rem] text-on-surface-variant">
          Cada régua é um fluxo de cobrança com várias etapas (ex: -7d, -4d, -2d, +2d, +5d...). O scheduler enfileira disparos todo dia.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCriarDoModelo}
            disabled={criando}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-violet-50 text-violet-700 text-[0.8125rem] font-medium hover:bg-violet-100"
          >
            <Sparkles size={14} /> Criar do modelo
          </button>
          <button
            onClick={() => setNovaAberta(true)}
            disabled={criando}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-gray-900 text-white text-[0.8125rem] font-medium hover:bg-gray-800"
          >
            <Plus size={14} /> Nova régua
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-primary" /></div>
      ) : reguas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 py-16 text-center space-y-2">
          <p className="text-[0.8125rem] text-gray-400">Nenhuma régua cadastrada ainda.</p>
          <p className="text-[0.75rem] text-gray-300">
            Clique em <span className="font-semibold">"Criar do modelo"</span> para começar com a régua do documento,<br />
            ou <span className="font-semibold">"Nova régua"</span> para montar do zero.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {reguas.map((r) => {
            const m = r.metricas30d || { total_30d: 0, enviados_30d: 0, falhas_30d: 0, convertidos_30d: 0 };
            const convPct = m.enviados_30d > 0 ? Math.round((m.convertidos_30d / m.enviados_30d) * 100) : 0;
            return (
              <div
                key={r.id}
                onClick={() => setReguaEditando(r.id)}
                className="bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[0.9375rem] font-semibold text-gray-900">{r.nome}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.6875rem] font-medium ${r.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${r.ativo ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        {r.ativo ? 'Ativa' : 'Rascunho'}
                      </span>
                    </div>
                    {r.descricao && <p className="text-[0.8125rem] text-gray-500 mt-0.5">{r.descricao}</p>}
                    <div className="flex items-center gap-4 mt-2 text-[0.75rem] text-gray-500">
                      <span className="inline-flex items-center gap-1"><Layers size={11} /> {r.totalEtapas || 0} etapa{(r.totalEtapas || 0) !== 1 ? 's' : ''}</span>
                      <span className="inline-flex items-center gap-1"><Clock size={11} /> padrão {r.horarioPadrao}</span>
                      {r.ultimaExecucao && <span className="text-gray-400">· última: {new Date(r.ultimaExecucao).toLocaleDateString('pt-BR')}</span>}
                    </div>
                    <div className={`mt-2 inline-flex items-center gap-1.5 text-[0.75rem] ${r.ativo ? 'text-sky-700' : 'text-gray-400'}`}>
                      {r.ativo ? <Clock size={11} /> : <CheckCircle size={11} />}
                      {proximaExecucaoTexto(r)}
                    </div>
                    {m.total_30d > 0 && (
                      <div className="mt-3 flex items-center gap-4 text-[0.75rem]">
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <Activity size={11} /> {m.enviados_30d} enviados
                        </span>
                        {m.falhas_30d > 0 && <span className="text-red-600">{m.falhas_30d} falhas</span>}
                        {m.convertidos_30d > 0 && (
                          <span className="text-violet-700 font-medium">{convPct}% conversão</span>
                        )}
                        <span className="text-gray-400">· últimos 30d</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDuplicar(r.id); }}
                      title="Duplicar"
                      className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-md"
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {reguaEditando && (
        <ReguaEditorDrawer
          reguaId={reguaEditando}
          onFechar={() => setReguaEditando(null)}
          onMudou={carregar}
        />
      )}

      <NovaReguaModal
        aberto={novaAberta}
        onFechar={() => setNovaAberta(false)}
        onCriada={handleCriadaNova}
      />
    </div>
  );
}
