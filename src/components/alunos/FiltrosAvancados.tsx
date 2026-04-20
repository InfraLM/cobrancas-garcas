import { useState, useEffect } from 'react';
import type { RegraSegmentacao } from '../../types/segmentacao';
import { listarRegras } from '../../services/segmentacao';
import { X, Filter, Tag, Loader2 } from 'lucide-react';

interface FiltrosAvancadosProps {
  aberto: boolean;
  onFechar: () => void;
  situacao: string;
  financeiro: string;
  segmentacaoId: string | null;
  onSituacaoChange: (v: string) => void;
  onFinanceiroChange: (v: string) => void;
  onSegmentacaoChange: (id: string | null) => void;
}

export default function FiltrosAvancados({
  aberto, onFechar,
  situacao, financeiro, segmentacaoId,
  onSituacaoChange, onFinanceiroChange, onSegmentacaoChange,
}: FiltrosAvancadosProps) {
  const [regras, setRegras] = useState<RegraSegmentacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!aberto) return;
    listarRegras().then(setRegras).catch(() => setRegras([])).finally(() => setLoading(false));
  }, [aberto]);

  if (!aberto) return null;

  const totalFiltros = (situacao ? 1 : 0) + (financeiro ? 1 : 0) + (segmentacaoId ? 1 : 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/10 z-40" onClick={onFechar} />
      <div className="fixed right-0 top-0 h-full w-[340px] bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-on-surface" />
            <h3 className="text-[0.9375rem] font-semibold text-on-surface">Filtros</h3>
            {totalFiltros > 0 && (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-[0.625rem] font-bold">{totalFiltros}</span>
            )}
          </div>
          <button onClick={onFechar} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Situacao */}
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-gray-400 mb-2">Situacao do aluno</p>
            <div className="flex flex-wrap gap-1.5">
              {['', 'ATIVO', 'TRANCADO', 'CANCELADO'].map(v => (
                <button key={v} onClick={() => onSituacaoChange(v)}
                  className={`h-7 px-3 rounded-lg text-[0.75rem] font-medium transition-colors ${
                    situacao === v ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}>
                  {v || 'Todos'}
                </button>
              ))}
            </div>
          </div>

          {/* Financeiro */}
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-gray-400 mb-2">Situacao financeira</p>
            <div className="flex flex-wrap gap-1.5">
              {['', 'INADIMPLENTE', 'ADIMPLENTE'].map(v => (
                <button key={v} onClick={() => onFinanceiroChange(v)}
                  className={`h-7 px-3 rounded-lg text-[0.75rem] font-medium transition-colors ${
                    financeiro === v ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}>
                  {v || 'Todos'}
                </button>
              ))}
            </div>
          </div>

          {/* Segmentacoes salvas */}
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-gray-400 mb-2">Segmentacoes salvas</p>
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 size={16} className="animate-spin text-gray-400" />
              </div>
            ) : regras.length === 0 ? (
              <p className="text-[0.75rem] text-gray-400">Nenhuma regra criada. Crie em Segmentacao.</p>
            ) : (
              <div className="space-y-1.5">
                <button onClick={() => onSegmentacaoChange(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[0.8125rem] transition-colors ${
                    !segmentacaoId ? 'bg-gray-900 text-white font-medium' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}>
                  Sem segmentacao
                </button>
                {regras.map(r => (
                  <button key={r.id} onClick={() => onSegmentacaoChange(r.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      segmentacaoId === r.id ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[0.8125rem] font-medium">{r.nome}</span>
                      {r.totalAlunos != null && (
                        <span className="flex items-center gap-1 text-[0.625rem] opacity-70">
                          <Tag size={10} /> {r.totalAlunos}
                        </span>
                      )}
                    </div>
                    {r.descricao && <p className="text-[0.6875rem] opacity-60 mt-0.5">{r.descricao}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Limpar */}
        {totalFiltros > 0 && (
          <div className="px-5 py-3 border-t border-gray-100">
            <button onClick={() => { onSituacaoChange(''); onFinanceiroChange(''); onSegmentacaoChange(null); }}
              className="w-full h-9 rounded-lg text-[0.8125rem] font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
              Limpar todos os filtros
            </button>
          </div>
        )}
      </div>
    </>
  );
}
