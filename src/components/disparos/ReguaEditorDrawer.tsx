import { useEffect, useState } from 'react';
import { Loader2, Save, Trash2, X, Clock, Layers, ArrowLeft, AlertCircle, Zap } from 'lucide-react';
import type { ReguaCobranca, EtapaRegua, MetricaEtapa } from '../../types/reguaCobranca';
import { obterRegua, atualizarRegua, removerRegua, obterMetricas, executarReguaAgora } from '../../services/reguas';
import TimelineEtapas from './TimelineEtapas';
import EtapaModal from './EtapaModal';

interface Props {
  reguaId: string;
  onFechar: () => void;
  onMudou: () => void;
}

export default function ReguaEditorDrawer({ reguaId, onFechar, onMudou }: Props) {
  const [regua, setRegua] = useState<ReguaCobranca | null>(null);
  const [metricas, setMetricas] = useState<Record<string, MetricaEtapa>>({});
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [etapaAberta, setEtapaAberta] = useState<EtapaRegua | null | 'NOVA'>(null);

  async function carregar() {
    setLoading(true);
    try {
      const [r, m] = await Promise.all([obterRegua(reguaId), obterMetricas(reguaId).catch(() => [])]);
      setRegua(r);
      setMetricas(Object.fromEntries(m.map(x => [x.etapa_id, x])));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, [reguaId]);

  async function patch(campo: keyof ReguaCobranca, valor: unknown) {
    if (!regua) return;
    setRegua({ ...regua, [campo]: valor } as ReguaCobranca);
  }

  async function salvarCabecalho() {
    if (!regua) return;
    setSalvando(true);
    try {
      await atualizarRegua(regua.id, {
        nome: regua.nome,
        descricao: regua.descricao || undefined,
        horarioPadrao: regua.horarioPadrao,
        intervaloDisparoSeg: regua.intervaloDisparoSeg,
      });
      onMudou();
    } finally {
      setSalvando(false);
    }
  }

  async function toggleAtivo() {
    if (!regua) return;
    const proximaAtivo = !regua.ativo;
    if (proximaAtivo && regua.etapas.length === 0) {
      alert('Adicione ao menos 1 etapa antes de ativar a régua.');
      return;
    }
    if (proximaAtivo) {
      if (!confirm(`Ativar "${regua.nome}"?\n\nAo ativar:\n• Disparos serão enfileirados imediatamente pra todas as etapas elegíveis agora.\n• Scheduler verifica a cada 1 min — etapas rodam no horário configurado.`)) return;
    } else {
      if (!confirm(`Desativar "${regua.nome}"? Disparos pendentes desta régua serão cancelados.`)) return;
    }
    setSalvando(true);
    try {
      await atualizarRegua(regua.id, { ativo: proximaAtivo });
      setRegua({ ...regua, ativo: proximaAtivo });
      if (proximaAtivo) {
        // Aguarda alguns segundos antes de recarregar pra pegar disparos enfileirados
        setTimeout(() => carregar(), 2000);
      }
      onMudou();
    } finally {
      setSalvando(false);
    }
  }

  async function handleExecutarAgora() {
    if (!regua) return;
    if (!regua.ativo) {
      alert('Ative a régua antes de executar agora.');
      return;
    }
    const confirmou = confirm(
      `Executar "${regua.nome}" agora?\n\n` +
      `Disparos serão enfileirados imediatamente (ignorando horário). ` +
      `Worker processa respeitando rate limit da Blip (~2s entre mensagens).`
    );
    if (!confirmou) return;
    setSalvando(true);
    try {
      const r = await executarReguaAgora(regua.id);
      alert(`${r.enfileirados} disparo${r.enfileirados !== 1 ? 's' : ''} enfileirado${r.enfileirados !== 1 ? 's' : ''} em ${r.etapasProcessadas} etapa${r.etapasProcessadas !== 1 ? 's' : ''}. Acompanhe no Histórico.`);
      carregar();
      onMudou();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao executar');
    } finally {
      setSalvando(false);
    }
  }

  async function handleRemover() {
    if (!regua) return;
    if (!confirm(`Excluir régua "${regua.nome}" permanentemente? Segmentações embutidas também serão removidas (globais vinculadas não).`)) return;
    await removerRegua(regua.id);
    onMudou();
    onFechar();
  }

  if (loading || !regua) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-white" />
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onFechar} />
      <div className="fixed top-0 right-0 bottom-0 w-[min(880px,92vw)] bg-white z-50 shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 border-b border-gray-100 px-6 py-4 flex items-center gap-3">
          <button onClick={onFechar} className="p-1.5 rounded-lg hover:bg-gray-100">
            <ArrowLeft size={18} />
          </button>
          <input
            value={regua.nome}
            onChange={e => patch('nome', e.target.value)}
            onBlur={salvarCabecalho}
            className="text-lg font-semibold text-on-surface bg-transparent outline-none border-b border-transparent focus:border-gray-200 flex-1"
          />
          <div className="flex items-center gap-2">
            {regua.ativo && (
              <button
                onClick={handleExecutarAgora}
                disabled={salvando}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[0.75rem] font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                title="Enfileirar disparos de todas as etapas agora (ignora horário)"
              >
                <Zap size={13} /> Executar agora
              </button>
            )}
            <button
              onClick={toggleAtivo}
              disabled={salvando}
              className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[0.8125rem] font-medium transition ${
                regua.ativo
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${regua.ativo ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              {regua.ativo ? 'Ativa' : 'Inativa'}
            </button>
            <button onClick={handleRemover} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Excluir régua">
              <Trash2 size={16} />
            </button>
            <button onClick={onFechar} className="p-2 hover:bg-gray-100 rounded-lg">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Cabecalho expandido */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <label className="block text-[0.75rem] font-medium text-gray-600 mb-1">Descrição</label>
              <input
                value={regua.descricao || ''}
                onChange={e => patch('descricao', e.target.value)}
                onBlur={salvarCabecalho}
                placeholder="Descrição opcional"
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-[0.8125rem]"
              />
            </div>
            <div>
              <label className="block text-[0.75rem] font-medium text-gray-600 mb-1">
                <Clock size={11} className="inline mr-1" /> Horário padrão
              </label>
              <input
                type="time"
                value={regua.horarioPadrao}
                onChange={e => patch('horarioPadrao', e.target.value)}
                onBlur={salvarCabecalho}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-[0.8125rem]"
              />
            </div>
            <div>
              <label className="block text-[0.75rem] font-medium text-gray-600 mb-1">Intervalo entre disparos (seg)</label>
              <input
                type="number"
                min={1}
                value={regua.intervaloDisparoSeg}
                onChange={e => patch('intervaloDisparoSeg', Number(e.target.value) || 2)}
                onBlur={salvarCabecalho}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-[0.8125rem]"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={salvarCabecalho}
                disabled={salvando}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-gray-900 text-white text-[0.75rem]"
              >
                {salvando ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Salvar
              </button>
            </div>
          </div>

          {/* Timeline visual */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[0.875rem] font-semibold text-on-surface">
                <Layers size={14} className="inline mr-1" />
                Etapas da régua ({regua.etapas.length})
              </h3>
            </div>
            <TimelineEtapas
              etapas={regua.etapas}
              onClickEtapa={(e) => setEtapaAberta(e)}
              onAdicionar={() => setEtapaAberta('NOVA')}
            />
          </div>

          {/* Lista textual */}
          {regua.etapas.length > 0 && (
            <div className="space-y-2">
              {regua.etapas.map((e) => {
                const m = metricas[e.id];
                const incompleta = !e.templateBlipId || !e.segmentacaoId;
                return (
                  <div
                    key={e.id}
                    onClick={() => setEtapaAberta(e)}
                    className={`p-4 rounded-xl border cursor-pointer hover:bg-gray-50/50 transition-colors ${
                      !e.ativo ? 'border-gray-200 bg-gray-50/30 opacity-60' : incompleta ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`shrink-0 w-14 text-center py-2 rounded-lg font-mono text-[0.8125rem] font-semibold ${
                        e.diasRelativoVenc < 0 ? 'bg-sky-50 text-sky-700' : e.diasRelativoVenc === 0 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {e.diasRelativoVenc >= 0 ? '+' : ''}{e.diasRelativoVenc}d
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-[0.875rem] font-semibold text-gray-900 truncate">{e.nome}</h4>
                          {!e.ativo && <span className="text-[0.625rem] px-2 py-0.5 rounded bg-gray-200 text-gray-600">Inativa</span>}
                          {incompleta && <span className="inline-flex items-center gap-0.5 text-[0.625rem] px-2 py-0.5 rounded bg-amber-100 text-amber-700"><AlertCircle size={10}/> Incompleta</span>}
                        </div>
                        <div className="mt-1 space-y-0.5 text-[0.75rem] text-gray-500">
                          {e.template && <div>🏷️ <span className="font-mono">{e.template.nomeBlip}</span></div>}
                          {e.segmentacao && (
                            <div>🎯 {e.segmentacao.nome} <span className="text-[0.625rem] text-gray-400">({e.segmentacao.escopoUso === 'GLOBAL' ? 'global' : 'embutida'})</span></div>
                          )}
                          <div>⏰ {e.horario || regua.horarioPadrao}</div>
                        </div>
                        {m && m.total_30d > 0 && (
                          <div className="mt-2 flex items-center gap-3 text-[0.6875rem]">
                            <span className="text-emerald-700">✓ {m.enviados_30d} enviados</span>
                            {m.falhas_30d > 0 && <span className="text-red-600">✗ {m.falhas_30d} falhas</span>}
                            {m.pendentes_30d > 0 && <span className="text-gray-500">⏳ {m.pendentes_30d} pendentes</span>}
                            <span className="text-gray-400">· 30d</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {etapaAberta !== null && (
        <EtapaModal
          aberto={true}
          regua={regua}
          etapaEditando={etapaAberta === 'NOVA' ? null : etapaAberta}
          onFechar={() => setEtapaAberta(null)}
          onSalvo={() => {
            setEtapaAberta(null);
            carregar();
            onMudou();
          }}
        />
      )}
    </>
  );
}
