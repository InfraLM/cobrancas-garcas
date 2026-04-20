import type { QualificacaoLigacao } from '../../types/ligacao';
import { qualificacoesMock } from '../../mocks/ligacoes';
import { CheckCircle } from 'lucide-react';

interface SeletorQualificacaoProps {
  qualificacoes?: QualificacaoLigacao[];
  onSelecionar: (qualificacao: QualificacaoLigacao) => void;
  aberto: boolean;
}

export default function SeletorQualificacao({ qualificacoes, onSelecionar, aberto }: SeletorQualificacaoProps) {
  if (!aberto) return null;

  const lista = qualificacoes && qualificacoes.length > 0 ? qualificacoes : qualificacoesMock;

  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-[400px]">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-md">
        <div className="flex items-center gap-2 mb-5">
          <CheckCircle size={18} className="text-gray-500" />
          <h3 className="text-[0.9375rem] font-semibold text-gray-100">Qualificar Chamada</h3>
        </div>

        <p className="text-[0.75rem] text-gray-500 mb-4">
          Selecione o resultado da ligação para registrar no sistema.
        </p>

        <div className="grid grid-cols-2 gap-2">
          {lista.map((qual) => (
            <button
              key={qual.id}
              onClick={() => onSelecionar(qual)}
              className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-800 hover:border-gray-700 hover:bg-gray-800/50 transition-colors text-left"
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: qual.cor }}
              />
              <span className="text-[0.8125rem] text-gray-200">{qual.nome}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
