import type { ReactNode } from 'react';
import { ChevronRight, Receipt } from 'lucide-react';
import type { TituloDaSegmentacao } from '../../services/segmentacao';

interface Props {
  titulos: TituloDaSegmentacao[];
  onSelecionar?: (t: TituloDaSegmentacao) => void;
  renderAcoes?: (t: TituloDaSegmentacao) => ReactNode;
}

function formatarCpf(cpf: string | null) {
  if (!cpf) return '—';
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.***. ${d.slice(6, 9)}-**`;
}

function formatarMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(iso: string | null | undefined) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return '—'; }
}

const SITUACAO_COR: Record<string, string> = {
  AR: 'bg-amber-50 text-amber-700',
  RE: 'bg-emerald-50 text-emerald-700',
  NE: 'bg-sky-50 text-sky-700',
  CF: 'bg-stone-50 text-stone-500',
};
const SITUACAO_LABEL: Record<string, string> = {
  AR: 'A Receber', RE: 'Recebido', NE: 'Negociado', CF: 'Cancelado',
};

function friendlyDias(t: TituloDaSegmentacao) {
  const ate = t.tituloDiasAteVencimento;
  if (ate === 0) return 'Vence hoje';
  if (ate === 1) return 'Vence amanhã';
  if (ate > 1) return `Em ${ate}d`;
  if (ate === -1) return 'Venceu ontem';
  return `Venceu há ${Math.abs(ate)}d`;
}

export default function TitulosDaSegmentacaoTable({ titulos, onSelecionar, renderAcoes }: Props) {
  const gridCols = renderAcoes
    ? 'grid-cols-[1.4fr_0.8fr_0.7fr_1fr_1fr_0.8fr_0.7fr_auto_28px]'
    : 'grid-cols-[1.4fr_0.8fr_0.7fr_1fr_1fr_0.8fr_0.7fr_28px]';

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <div className={`grid ${gridCols} gap-3 px-5 py-3 text-[0.625rem] uppercase tracking-wider text-gray-300 font-medium`}>
        <span>Aluno</span>
        <span>CPF</span>
        <span>Turma</span>
        <span>Valor</span>
        <span>Vencimento</span>
        <span>Quando</span>
        <span>Situação</span>
        {renderAcoes && <span />}
        <span />
      </div>

      {titulos.map((t) => (
        <div
          key={t.tituloCodigo}
          onClick={() => onSelecionar?.(t)}
          className={`grid ${gridCols} gap-3 px-5 py-3 items-center border-t border-gray-50 ${onSelecionar ? 'cursor-pointer hover:bg-gray-50/50' : ''} transition-colors`}
        >
          <div className="min-w-0">
            <p className="text-[0.8125rem] font-medium text-gray-900 truncate">{t.nome}</p>
            <p className="text-[0.6875rem] text-gray-400 truncate flex items-center gap-1">
              <Receipt size={10} /> {t.matricula || '—'} · título {t.tituloCodigo}
            </p>
          </div>

          <span className="text-[0.75rem] text-gray-500 font-mono">{formatarCpf(t.cpf)}</span>
          <span className="text-[0.75rem] text-gray-500 truncate">{t.tituloTurma || '—'}</span>
          <span className={`text-[0.8125rem] font-medium ${t.tituloValor > 0 ? 'text-red-600' : 'text-gray-400'}`}>
            {formatarMoeda(t.tituloValor)}
          </span>
          <span className="text-[0.75rem] text-gray-600">{formatarData(t.tituloDataVencimento)}</span>
          <span className={`text-[0.75rem] ${t.tituloDiasAteVencimento < 0 ? 'text-red-600 font-medium' : t.tituloDiasAteVencimento <= 7 ? 'text-amber-700' : 'text-gray-500'}`}>
            {friendlyDias(t)}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.625rem] font-semibold w-fit ${SITUACAO_COR[t.tituloSituacao] || 'text-gray-500 bg-gray-50'}`}>
            {SITUACAO_LABEL[t.tituloSituacao] || t.tituloSituacao}
          </span>

          {renderAcoes && (
            <span onClick={(e) => e.stopPropagation()} className="shrink-0">
              {renderAcoes(t)}
            </span>
          )}

          <ChevronRight size={14} className="text-gray-200" />
        </div>
      ))}

      {titulos.length === 0 && (
        <div className="px-5 py-12 text-center border-t border-gray-50">
          <p className="text-[0.8125rem] text-gray-400">Nenhum título encontrado.</p>
        </div>
      )}
    </div>
  );
}
