import type { ReactNode } from 'react';
import { ChevronRight, Pause } from 'lucide-react';
import type { AlunoListItem } from '../../services/alunos';
import { motivoPausaLabel } from '../../types/pausaLigacao';

interface AlunosTableProps {
  alunos: AlunoListItem[];
  onSelecionar: (aluno: AlunoListItem) => void;
  renderAcoes?: (aluno: AlunoListItem) => ReactNode;
}

function formatarCpf(cpf: string | null) {
  if (!cpf) return '—';
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.***. ${d.slice(6, 9)}-**`;
}

function formatarMoeda(valor: number) {
  if (valor === 0) return '—';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const SITUACAO_STYLE: Record<string, string> = {
  ATIVO: 'text-emerald-700 bg-emerald-50',
  TRANCADO: 'text-amber-700 bg-amber-50',
  CANCELADO: 'text-red-700 bg-red-50',
};

const SITUACAO_LABEL: Record<string, string> = {
  ATIVO: 'Ativo',
  TRANCADO: 'Trancado',
  CANCELADO: 'Cancelado',
};

const FIN_STYLE: Record<string, string> = {
  ADIMPLENTE: 'text-emerald-700 bg-emerald-50',
  INADIMPLENTE: 'text-red-700 bg-red-50',
};

export default function AlunosTable({ alunos, onSelecionar, renderAcoes }: AlunosTableProps) {
  const gridCols = renderAcoes
    ? 'grid-cols-[2fr_0.9fr_1.2fr_0.8fr_0.9fr_1fr_auto_28px]'
    : 'grid-cols-[2fr_0.9fr_1.2fr_0.8fr_0.9fr_1fr_28px]';

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <div className={`grid ${gridCols} gap-3 px-5 py-3 text-[0.625rem] uppercase tracking-wider text-gray-300 font-medium`}>
        <span>Aluno</span>
        <span>CPF</span>
        <span>Turma</span>
        <span>Situacao</span>
        <span>Financeiro</span>
        <span className="text-right">Valor devedor</span>
        {renderAcoes && <span />}
        <span />
      </div>

      {alunos.map((aluno) => (
        <div
          key={aluno.codigo}
          onClick={() => onSelecionar(aluno)}
          className={`grid ${gridCols} gap-3 px-5 py-3 items-center cursor-pointer hover:bg-gray-50/50 transition-colors border-t border-gray-50`}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-[0.8125rem] font-medium text-gray-900 truncate">{aluno.nome}</p>
              {aluno.pausaAtiva && (
                <span
                  className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-px rounded bg-amber-50 text-amber-700 text-[0.625rem] font-semibold"
                  title={`Pausado · ${motivoPausaLabel[aluno.pausaAtiva.motivo]}${aluno.pausaAtiva.pausaAte ? ` · até ${new Date(aluno.pausaAtiva.pausaAte).toLocaleDateString('pt-BR')}` : ''}`}
                >
                  <Pause size={9} />
                  Pausado
                </span>
              )}
            </div>
            <p className="text-[0.6875rem] text-gray-400 truncate">{aluno.matricula || '—'}</p>
          </div>

          <span className="text-[0.75rem] text-gray-500 font-mono">{formatarCpf(aluno.cpf)}</span>

          <span className="text-[0.75rem] text-gray-500 truncate">{aluno.turma || '—'}</span>

          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.625rem] font-semibold ${SITUACAO_STYLE[aluno.situacao] || 'text-gray-500 bg-gray-50'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
            {SITUACAO_LABEL[aluno.situacao] || aluno.situacao}
          </span>

          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.625rem] font-semibold ${FIN_STYLE[aluno.situacaoFinanceira] || 'text-gray-500 bg-gray-50'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
            {aluno.situacaoFinanceira === 'INADIMPLENTE' ? 'Inadimpl.' : 'Adimpl.'}
          </span>

          <span className={`text-[0.8125rem] font-medium text-right ${aluno.valorDevedor > 0 ? 'text-red-600' : 'text-gray-300'}`}>
            {aluno.valorDevedor > 0 ? formatarMoeda(aluno.valorDevedor) : '—'}
          </span>

          {renderAcoes && (
            <span onClick={(e) => e.stopPropagation()} className="shrink-0">
              {renderAcoes(aluno)}
            </span>
          )}

          <ChevronRight size={14} className="text-gray-200" />
        </div>
      ))}

      {alunos.length === 0 && (
        <div className="px-5 py-12 text-center border-t border-gray-50">
          <p className="text-[0.8125rem] text-gray-400">Nenhum aluno encontrado.</p>
        </div>
      )}
    </div>
  );
}
