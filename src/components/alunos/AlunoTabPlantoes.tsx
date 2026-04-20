import { useState, useEffect } from 'react';
import type { Aluno, Plantao } from '../../types/aluno';
import DataCard from '../ui/DataCard';
import StatusBadge, { variantePlantao } from '../ui/StatusBadge';
import { Stethoscope, Loader2 } from 'lucide-react';
import { listarPlantoes } from '../../services/alunos';

export default function AlunoTabPlantoes({ aluno }: { aluno: Aluno }) {
  const [plantoes, setPlantoes] = useState<Plantao[]>((aluno as any).plantoes || []);
  const [loading, setLoading] = useState(plantoes.length === 0);

  useEffect(() => {
    if (plantoes.length > 0) return;
    listarPlantoes(aluno.codigo)
      .then(setPlantoes)
      .catch(() => setPlantoes([]))
      .finally(() => setLoading(false));
  }, [aluno.codigo]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (plantoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Stethoscope size={24} className="text-gray-300" />
        <p className="text-[0.8125rem] text-gray-400">Nenhum plantao flexivel registrado.</p>
      </div>
    );
  }

  const realizados = plantoes.filter(p => p.status === 'Realizado').length;
  const cancelados = plantoes.filter(p => p.status === 'Cancelado').length;
  const emAberto = plantoes.filter(p => p.status === 'Em Aberto').length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2.5">
        <DataCard label="Realizados" valor={realizados.toString()} cor="success" />
        <DataCard label="Cancelados" valor={cancelados.toString()} cor="danger" />
        <DataCard label="Em aberto" valor={emAberto.toString()} cor="default" />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
        {plantoes.map((p) => (
          <div key={p.id} className="px-4 py-3 flex items-center justify-between">
            <span className="text-[0.8125rem] text-gray-900">{p.dataPlantao}</span>
            <StatusBadge texto={p.status} variante={variantePlantao(p.status)} comDot />
          </div>
        ))}
      </div>
    </div>
  );
}
