import { useMemo } from 'react';
import type { AcordoFinanceiro, EtapaAcordo } from '../../types/acordo';
import { ETAPAS_KANBAN } from '../../types/acordo';
import KanbanColumn from './KanbanColumn';

interface KanbanBoardProps {
  acordos: AcordoFinanceiro[];
  onCardClick: (acordo: AcordoFinanceiro) => void;
}

export default function KanbanBoard({ acordos, onCardClick }: KanbanBoardProps) {
  const acordosPorEtapa = useMemo(() => {
    const mapa: Record<string, AcordoFinanceiro[]> = {};
    for (const etapa of ETAPAS_KANBAN) {
      mapa[etapa] = [];
    }
    for (const acordo of acordos) {
      if (mapa[acordo.etapa]) {
        mapa[acordo.etapa].push(acordo);
      }
    }
    return mapa;
  }, [acordos]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2" style={{ height: 'calc(100vh - 180px)' }}>
      {ETAPAS_KANBAN.map((etapa) => (
        <KanbanColumn
          key={etapa}
          etapa={etapa as EtapaAcordo}
          acordos={acordosPorEtapa[etapa] || []}
          onCardClick={onCardClick}
        />
      ))}
    </div>
  );
}
