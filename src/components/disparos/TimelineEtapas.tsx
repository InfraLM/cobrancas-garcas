import { Plus } from 'lucide-react';
import type { EtapaRegua } from '../../types/reguaCobranca';

interface Props {
  etapas: EtapaRegua[];
  onClickEtapa: (etapa: EtapaRegua) => void;
  onAdicionar: () => void;
}

/**
 * Visualizacao linear das etapas da regua. Linha horizontal com marcos
 * posicionados proporcionalmente pelo diasRelativoVenc.
 */
export default function TimelineEtapas({ etapas, onClickEtapa, onAdicionar }: Props) {
  if (etapas.length === 0) {
    return (
      <div className="py-8 text-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
        <p className="text-[0.875rem] text-gray-500 mb-2">Nenhuma etapa ainda</p>
        <button
          type="button"
          onClick={onAdicionar}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-white text-[0.8125rem] font-medium hover:bg-primary/90"
        >
          <Plus size={14} /> Adicionar primeira etapa
        </button>
      </div>
    );
  }

  const dias = etapas.map(e => e.diasRelativoVenc);
  const min = Math.min(...dias, 0);
  const max = Math.max(...dias, 0);
  const range = Math.max(max - min, 1);

  // Posicao percentual na linha (10%..90% pra deixar padding)
  const posPct = (d: number) => 10 + ((d - min) / range) * 80;

  return (
    <div className="py-6">
      <div className="relative h-24 px-2">
        {/* Linha base */}
        <div className="absolute left-[10%] right-[10%] top-1/2 h-px bg-gray-200" />

        {/* Marco VENCIMENTO (0) */}
        {min <= 0 && max >= 0 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center"
            style={{ left: `${posPct(0)}%`, transform: 'translate(-50%, -50%)' }}
          >
            <div className="w-0.5 h-8 bg-red-400" />
            <span className="mt-1 text-[0.625rem] font-semibold uppercase tracking-wider text-red-500">
              Vencimento
            </span>
          </div>
        )}

        {/* Marcos das etapas */}
        {etapas.map((e) => {
          const cor = !e.ativo
            ? 'bg-gray-300'
            : e.segmentacaoId && e.templateBlipId
              ? 'bg-emerald-500'
              : 'bg-amber-400';
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onClickEtapa(e)}
              style={{ left: `${posPct(e.diasRelativoVenc)}%`, transform: 'translate(-50%, -50%)' }}
              className={`absolute top-1/2 w-4 h-4 rounded-full ${cor} shadow-md ring-4 ring-white hover:scale-125 transition-transform cursor-pointer group`}
              title={`${e.nome} · ${e.diasRelativoVenc >= 0 ? '+' : ''}${e.diasRelativoVenc}d`}
            >
              <span className={`absolute top-5 left-1/2 -translate-x-1/2 text-[0.625rem] whitespace-nowrap font-mono ${e.diasRelativoVenc < 0 ? 'text-sky-700' : e.diasRelativoVenc === 0 ? 'text-red-600' : 'text-amber-700'}`}>
                {e.diasRelativoVenc >= 0 ? '+' : ''}{e.diasRelativoVenc}d
              </span>
              <span className="absolute top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[0.625rem] text-gray-600 bg-white px-1 py-0.5 rounded shadow border border-gray-100 whitespace-nowrap z-10">
                {e.nome}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end mt-2">
        <button
          type="button"
          onClick={onAdicionar}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-gray-100 text-gray-700 text-[0.75rem] hover:bg-gray-200"
        >
          <Plus size={12} /> Adicionar etapa
        </button>
      </div>
    </div>
  );
}
