import type { RegraSegmentacao } from '../../types/segmentacao';
import { ChevronRight, Users, Trash2, Pencil } from 'lucide-react';

function formatarMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

interface RegrasTableProps {
  regras: RegraSegmentacao[];
  onSelecionar: (regra: RegraSegmentacao) => void;
  onEditar?: (regra: RegraSegmentacao) => void;
  onExcluir?: (regra: RegraSegmentacao) => void;
  podeEditar?: (regra: RegraSegmentacao) => boolean;
}

export default function RegrasTable({ regras, onSelecionar, onEditar, onExcluir, podeEditar }: RegrasTableProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100">
      {/* Header */}
      <div className="grid grid-cols-[2fr_2.5fr_0.8fr_1.2fr_1fr_28px] gap-4 px-5 py-3 text-[0.625rem] uppercase tracking-wider text-gray-300 font-medium">
        <span>Nome</span>
        <span>Descrição</span>
        <span className="text-right">Alunos</span>
        <span className="text-right">Valor inadimplente</span>
        <span>Última execução</span>
        <span />
      </div>

      {regras.map((regra) => (
        <div
          key={regra.id}
          onClick={() => onSelecionar(regra)}
          className="grid grid-cols-[2fr_2.5fr_0.8fr_1.2fr_1fr_28px] gap-4 px-5 py-3.5 items-center cursor-pointer hover:bg-gray-50/50 transition-colors border-t border-gray-50"
        >
          {/* Nome */}
          <div className="min-w-0">
            <p className="text-[0.8125rem] font-medium text-gray-900 truncate">{regra.nome}</p>
            <p className="text-[0.6875rem] text-gray-400">{regra.condicoes.length} condições · {regra.criadoPorNome}</p>
          </div>

          {/* Descrição */}
          <p className="text-[0.8125rem] text-gray-500 truncate">{regra.descricao || '—'}</p>

          {/* Alunos */}
          <div className="flex items-center justify-end gap-1.5">
            <Users size={12} className="text-gray-300" />
            <span className="text-[0.8125rem] font-medium text-gray-900">{regra.totalAlunos}</span>
          </div>

          {/* Valor */}
          <span className={`text-[0.8125rem] font-medium text-right ${Number(regra.valorInadimplente || 0) > 0 ? 'text-red-600' : 'text-gray-300'}`}>
            {formatarMoeda(Number(regra.valorInadimplente || 0))}
          </span>

          {/* Última execução */}
          <span className="text-[0.75rem] text-gray-400">{formatarData(regra.ultimaExecucao)}</span>

          {/* Acoes */}
          <div className="flex items-center gap-1">
            {(() => {
              const habilitado = podeEditar ? podeEditar(regra) : true;
              const titulo = habilitado ? undefined : 'Apenas o criador ou um administrador pode editar';
              return (
                <>
                  {onEditar && (
                    <button
                      onClick={(e) => { e.stopPropagation(); if (habilitado) onEditar(regra); }}
                      disabled={!habilitado}
                      title={titulo}
                      className={`p-1 rounded transition-colors ${habilitado ? 'text-gray-300 hover:text-gray-600' : 'text-gray-100 cursor-not-allowed'}`}
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                  {onExcluir && (
                    <button
                      onClick={(e) => { e.stopPropagation(); if (habilitado) onExcluir(regra); }}
                      disabled={!habilitado}
                      title={titulo}
                      className={`p-1 rounded transition-colors ${habilitado ? 'text-gray-300 hover:text-red-500' : 'text-gray-100 cursor-not-allowed'}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </>
              );
            })()}
            <ChevronRight size={14} className="text-gray-200" />
          </div>
        </div>
      ))}

      {regras.length === 0 && (
        <div className="px-5 py-12 text-center border-t border-gray-50">
          <p className="text-[0.8125rem] text-gray-400">Nenhuma regra de segmentação criada.</p>
        </div>
      )}
    </div>
  );
}
