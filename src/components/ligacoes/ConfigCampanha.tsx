import { useState, useMemo, useEffect } from 'react';
import type { ConfiguracaoCampanha, ListaCampanha } from '../../types/ligacao';
import type { RegraSegmentacao } from '../../types/segmentacao';
import { listarRegras } from '../../services/segmentacao';
import { Check, ArrowRight, ArrowLeft, Users, Loader2 } from 'lucide-react';

interface ConfigCampanhaProps {
  onConfirmar: (config: ConfiguracaoCampanha) => void;
  onVoltar: () => void;
}

export default function ConfigCampanha({ onConfirmar, onVoltar }: ConfigCampanhaProps) {
  const [regras, setRegras] = useState<RegraSegmentacao[]>([]);
  const [loadingRegras, setLoadingRegras] = useState(true);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [pesosRaw, setPesosRaw] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    listarRegras().then(setRegras).catch(() => setRegras([])).finally(() => setLoadingRegras(false));
  }, []);

  // Calcular percentuais automaticamente
  const percentuais = useMemo(() => {
    const ids = Array.from(selecionadas);
    if (ids.length === 0) return new Map<string, number>();

    const totalPeso = ids.reduce((sum, id) => sum + (pesosRaw.get(id) || 1), 0);
    const result = new Map<string, number>();
    ids.forEach(id => {
      const peso = pesosRaw.get(id) || 1;
      result.set(id, Math.round((peso / totalPeso) * 100));
    });

    // Ajustar arredondamento para somar exatamente 100
    const somaAtual = Array.from(result.values()).reduce((a, b) => a + b, 0);
    if (somaAtual !== 100 && ids.length > 0) {
      const primeiro = ids[0];
      result.set(primeiro, (result.get(primeiro) || 0) + (100 - somaAtual));
    }

    return result;
  }, [selecionadas, pesosRaw]);

  function toggleRegra(regraId: string) {
    setSelecionadas(prev => {
      const next = new Set(prev);
      if (next.has(regraId)) {
        next.delete(regraId);
      } else {
        next.add(regraId);
        if (!pesosRaw.has(regraId)) {
          setPesosRaw(p => new Map(p).set(regraId, 1));
        }
      }
      return next;
    });
  }

  function alterarPeso(regraId: string, peso: number) {
    setPesosRaw(prev => new Map(prev).set(regraId, peso));
  }

  function handleConfirmar() {
    const listas: ListaCampanha[] = [];
    selecionadas.forEach((regraId) => {
      const regra = regras.find(r => r.id === regraId);
      if (regra) {
        listas.push({
          regraId: regra.id,
          regraNome: regra.nome,
          totalAlunos: regra.totalAlunos || 0,
          peso: percentuais.get(regraId) || 0,
        });
      }
    });

    onConfirmar({
      nome: `Campanha ${new Date().toLocaleDateString('pt-BR')}`,
      listas,
      totalContatos: listas.reduce((sum, l) => sum + l.totalAlunos, 0),
    });
  }

  const totalContatos = Array.from(selecionadas).reduce((sum, id) => {
    const regra = regras.find(r => r.id === id);
    return sum + (regra?.totalAlunos || 0);
  }, 0);

  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-[400px]">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-lg shadow-gray-200/30 p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[0.9375rem] font-semibold text-gray-900">Configurar Campanha</h3>
          <button onClick={onVoltar} className="flex items-center gap-1.5 text-[0.75rem] text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={14} />
            Voltar
          </button>
        </div>

        <p className="text-[0.625rem] uppercase tracking-wider text-gray-300 font-medium mb-3">
          Selecione as segmentacoes e ajuste a prioridade
        </p>

        {loadingRegras ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
        ) : regras.length === 0 ? (
          <p className="py-8 text-center text-[0.8125rem] text-gray-400">Nenhuma segmentacao criada. Crie em Segmentacao.</p>
        ) : null}

        <div className="space-y-2 mb-4">
          {regras.map((regra) => {
            const isSelected = selecionadas.has(regra.id);
            const pct = percentuais.get(regra.id) || 0;
            return (
              <div
                key={regra.id}
                className={`rounded-xl border p-3.5 transition-colors cursor-pointer ${
                  isSelected ? 'border-gray-300 bg-gray-50/50' : 'border-gray-100 hover:border-gray-200'
                }`}
                onClick={() => toggleRegra(regra.id)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                    isSelected ? 'bg-gray-900 border-gray-900' : 'border-gray-200'
                  }`}>
                    {isSelected && <Check size={12} className="text-white" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[0.8125rem] font-medium text-gray-900">{regra.nome}</p>
                    <p className="text-[0.6875rem] text-gray-400 truncate">{regra.descricao}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1">
                      <Users size={12} className="text-gray-300" />
                      <span className="text-[0.8125rem] font-medium text-gray-900">{regra.totalAlunos ?? '—'}</span>
                    </div>
                    {isSelected && (
                      <span className="text-[0.8125rem] font-bold text-gray-900 w-10 text-right">
                        {pct}%
                      </span>
                    )}
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-3 ml-8 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[0.6875rem] text-gray-400 shrink-0">Prioridade</span>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={pesosRaw.get(regra.id) || 1}
                      onChange={(e) => alterarPeso(regra.id, Number(e.target.value))}
                      className="flex-1 h-1.5 accent-gray-900"
                    />
                    {/* Visual bar showing percentage */}
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-900 rounded-full transition-all duration-200"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary */}
        {selecionadas.size > 0 && (
          <div className="bg-gray-50 rounded-xl p-3.5 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[0.75rem] text-gray-400">Distribuição</span>
              <span className="text-[0.75rem] font-mono font-medium text-gray-900">100%</span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden gap-px">
              {Array.from(selecionadas).map((id, i) => {
                const pct = percentuais.get(id) || 0;
                const colors = ['bg-gray-900', 'bg-gray-600', 'bg-gray-400', 'bg-gray-300', 'bg-gray-200'];
                return (
                  <div
                    key={id}
                    className={`${colors[i % colors.length]} transition-all duration-300`}
                    style={{ width: `${pct}%` }}
                  />
                );
              })}
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {Array.from(selecionadas).map((id, i) => {
                const regra = regras.find(r => r.id === id);
                const pct = percentuais.get(id) || 0;
                const colors = ['bg-gray-900', 'bg-gray-600', 'bg-gray-400', 'bg-gray-300', 'bg-gray-200'];
                return (
                  <div key={id} className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${colors[i % colors.length]}`} />
                    <span className="text-[0.625rem] text-gray-500">{regra?.nome} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Total */}
        <div className="flex items-center justify-between py-3 border-t border-gray-100 mb-4">
          <span className="text-[0.8125rem] text-gray-400">Total de contatos</span>
          <span className="text-[0.9375rem] font-bold text-gray-900">{totalContatos}</span>
        </div>

        <button
          onClick={handleConfirmar}
          disabled={selecionadas.size === 0}
          className="w-full h-11 rounded-xl bg-gray-900 text-white font-medium text-[0.8125rem] hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          Ativar WebRTC e continuar
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
