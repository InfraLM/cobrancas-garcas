import { useState, useEffect } from 'react';
import type { Aluno, SuporteBlip } from '../../types/aluno';
import DataCard from '../ui/DataCard';
import StatusBadge from '../ui/StatusBadge';
import { Headphones, Loader2 } from 'lucide-react';
import { obterSuporte } from '../../services/alunos';

function formatarData(data: string) {
  return new Date(data).toLocaleDateString('pt-BR');
}

export default function AlunoTabSuporte({ aluno }: { aluno: Aluno }) {
  const [suporte, setSuporte] = useState<SuporteBlip | null>((aluno as any).suporteBlip || null);
  const [loading, setLoading] = useState(!suporte);

  useEffect(() => {
    if (suporte) return;
    obterSuporte(aluno.codigo)
      .then(setSuporte)
      .catch(() => setSuporte(null))
      .finally(() => setLoading(false));
  }, [aluno.codigo]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!suporte) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Headphones size={24} className="text-gray-300" />
        <p className="text-[0.8125rem] text-gray-400">Nenhum registro de suporte encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2.5">
        <DataCard label="Total tickets" valor={suporte.totalTickets.toString()} cor="default" />
        <DataCard label="Financeiro" valor={suporte.ticketsFinanceiro.toString()} cor={suporte.ticketsFinanceiro > 3 ? 'warning' : 'default'} />
        <DataCard label="Ultimo ticket" valor={suporte.ultimoTicket ? formatarData(suporte.ultimoTicket) : '—'} cor="default" />
      </div>

      {suporte.tickets && suporte.tickets.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          {suporte.tickets.map((t) => (
            <div key={t.id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[0.8125rem] text-gray-900">{t.equipe}</p>
                <p className="text-[0.6875rem] text-gray-400">{t.data ? formatarData(t.data) : '—'}</p>
              </div>
              <StatusBadge
                texto={t.status}
                variante={t.status === 'Fechado' ? 'success' : 'warning'}
                comDot
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
