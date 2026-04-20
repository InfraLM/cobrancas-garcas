import { useState, useEffect } from 'react';
import type { Aluno, Engajamento } from '../../types/aluno';
import ProgressBar from '../ui/ProgressBar';
import { BookOpen, Loader2 } from 'lucide-react';
import { obterEngajamento } from '../../services/alunos';

function Info({ label, valor }: { label: string; valor?: string | number | null }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[0.8125rem] text-gray-500">{label}</span>
      <span className="text-[0.8125rem] font-medium text-gray-900">{valor ?? '—'}</span>
    </div>
  );
}

export default function AlunoTabEngajamento({ aluno }: { aluno: Aluno }) {
  const [eng, setEng] = useState<Engajamento | null>((aluno as any).engajamento || null);
  const [loading, setLoading] = useState(!eng);

  useEffect(() => {
    if (eng) return;
    obterEngajamento(aluno.codigo)
      .then(setEng)
      .catch(() => setEng(null))
      .finally(() => setLoading(false));
  }, [aluno.codigo]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!eng) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <BookOpen size={24} className="text-gray-300" />
        <p className="text-[0.8125rem] text-gray-400">Dados de engajamento nao disponiveis.</p>
      </div>
    );
  }

  const freq = eng.aulasTotalPorcentagem || 0;
  const corFreq = freq >= 0.75 ? 'success' : freq >= 0.5 ? 'warning' : 'danger';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-[0.8125rem]">
        <span className={`font-medium ${eng.statusFinanceiro === 'ADIMPLENTE' ? 'text-emerald-600' : eng.statusFinanceiro === 'INADIMPLENTE' ? 'text-red-600' : 'text-gray-500'}`}>
          {eng.statusFinanceiro}
        </span>
        {eng.tag && <span className="text-gray-400">· {eng.tag}</span>}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <ProgressBar valor={freq} label={`${eng.aulasAssistidas || 0} aulas assistidas`} cor={corFreq} />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-0">
        <Info label="Dias desde a primeira aula" valor={eng.diasDesdePrimeiraAula} />
        <Info label="Dias desde a ultima aula" valor={eng.diasDesdeUltimaAula} />
        <Info label="Matricula" valor={eng.matricula} />
        <Info label="Turma" valor={eng.turma} />
        <Info label="Cadastro" valor={eng.criadoEm} />
        {eng.cidade && <Info label="Cidade" valor={eng.cidade} />}
      </div>

      {(eng.parcelasPagas != null || eng.parcelasAtraso != null) && (
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-lg font-bold text-emerald-600">{eng.parcelasPagas ?? 0}</p>
            <p className="text-[0.625rem] text-gray-400 mt-0.5">Pagas</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-lg font-bold text-red-600">{eng.parcelasAtraso ?? 0}</p>
            <p className="text-[0.625rem] text-gray-400 mt-0.5">Atraso</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-lg font-bold text-gray-900">{eng.parcelasAberto ?? 0}</p>
            <p className="text-[0.625rem] text-gray-400 mt-0.5">Aberto</p>
          </div>
        </div>
      )}
    </div>
  );
}
