import { useState, useEffect } from 'react';
import type { TipoLigacao } from '../../types/ligacao';
import { Phone, Users, ArrowRight, X } from 'lucide-react';

interface SeletorTipoLigacaoProps {
  aberto: boolean;
  onSelecionar: (tipo: TipoLigacao, telefone?: string) => void;
  onFechar: () => void;
  telefoneInicial?: string;
}

export default function SeletorTipoLigacao({ aberto, onSelecionar, onFechar, telefoneInicial }: SeletorTipoLigacaoProps) {
  const [modoIndividual, setModoIndividual] = useState(!!telefoneInicial);
  const [telefone, setTelefone] = useState('');

  // Pre-fill phone when coming from Alunos
  useEffect(() => {
    if (telefoneInicial) {
      setTelefone(formatarInput(telefoneInicial));
      setModoIndividual(true);
    }
  }, [telefoneInicial]);

  if (!aberto) return null;

  function formatarInput(valor: string) {
    const digits = valor.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }

  function handleTelefoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatarInput(e.target.value);
    setTelefone(formatted);
  }

  function handleConfirmarIndividual() {
    const digits = telefone.replace(/\D/g, '');
    if (digits.length >= 10) {
      onSelecionar('individual', digits);
    }
  }

  function handleVoltar() {
    setModoIndividual(false);
    setTelefone('');
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-[400px]">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-lg shadow-gray-200/30 p-6 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[0.9375rem] font-semibold text-gray-900">
            {modoIndividual ? 'Ligação Individual' : 'Tipo de ligação'}
          </h3>
          <button onClick={modoIndividual ? handleVoltar : onFechar} className="p-1 text-gray-300 hover:text-gray-500 transition-colors">
            <X size={16} />
          </button>
        </div>

        {!modoIndividual ? (
          /* Selection */
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setModoIndividual(true)}
              className="flex flex-col items-center gap-3 p-5 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition-all cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
                <Phone size={20} className="text-gray-500" />
              </div>
              <div className="text-center">
                <p className="text-[0.8125rem] font-medium text-gray-900">Individual</p>
                <p className="text-[0.6875rem] text-gray-400 mt-0.5">Ligar para um número</p>
              </div>
            </button>

            <button
              onClick={() => onSelecionar('massa')}
              className="flex flex-col items-center gap-3 p-5 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition-all cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
                <Users size={20} className="text-gray-500" />
              </div>
              <div className="text-center">
                <p className="text-[0.8125rem] font-medium text-gray-900">Em massa</p>
                <p className="text-[0.6875rem] text-gray-400 mt-0.5">Campanha automática</p>
              </div>
            </button>
          </div>
        ) : (
          /* Phone input */
          <div className="space-y-4">
            <div>
              <label className="text-[0.75rem] font-medium text-gray-500 mb-1.5 block">
                Número de telefone
              </label>
              <input
                type="tel"
                value={telefone}
                onChange={handleTelefoneChange}
                placeholder="(00) 00000-0000"
                autoFocus
                maxLength={16}
                className="w-full h-12 px-4 rounded-xl bg-white border border-gray-100 text-lg text-gray-900 font-mono tracking-wide placeholder:text-gray-200 outline-none focus:border-gray-300 transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmarIndividual()}
              />
            </div>

            <button
              onClick={handleConfirmarIndividual}
              disabled={telefone.replace(/\D/g, '').length < 10}
              className="w-full h-11 rounded-xl bg-gray-900 text-white font-medium text-[0.8125rem] hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Continuar
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
