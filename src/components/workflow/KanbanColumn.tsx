import type { AcordoFinanceiro, EtapaAcordo } from '../../types/acordo';
import { etapaLabel } from '../../types/acordo';
import KanbanCard from './KanbanCard';

const etapaDot: Record<string, string> = {
  SELECAO: 'bg-gray-400',
  TERMO_ENVIADO: 'bg-blue-500',
  ACORDO_GERADO: 'bg-amber-500',
  SEI_VINCULADO: 'bg-violet-500',
  CHECANDO_PAGAMENTO: 'bg-orange-500',
  CONCLUIDO: 'bg-emerald-500',
};

interface KanbanColumnProps {
  etapa: EtapaAcordo;
  acordos: AcordoFinanceiro[];
  onCardClick: (acordo: AcordoFinanceiro) => void;
}

export default function KanbanColumn({ etapa, acordos, onCardClick }: KanbanColumnProps) {
  return (
    <div className="flex flex-col min-w-[264px] w-[264px] shrink-0">
      <div className="flex items-center gap-2 px-1 pb-3">
        <span className={`w-2 h-2 rounded-full shrink-0 ${etapaDot[etapa] || 'bg-gray-400'}`} />
        <span className="text-[0.75rem] font-medium text-gray-500 truncate">{etapaLabel[etapa]}</span>
        <span className="text-[0.6875rem] text-gray-300 ml-auto">{acordos.length}</span>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto pr-0.5 pb-4" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        {acordos.map((acordo) => (
          <KanbanCard key={acordo.id} acordo={acordo} onClick={() => onCardClick(acordo)} />
        ))}
        {acordos.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-[0.6875rem] text-gray-300">Vazio</p>
          </div>
        )}
      </div>
    </div>
  );
}
