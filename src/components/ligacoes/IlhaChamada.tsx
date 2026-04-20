import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneCall, PhoneOff } from 'lucide-react';

interface IlhaChamadaProps {
  telefone: string;
  pessoaNome?: string;
  inicio: string;
  status: string;
  onClick: () => void;
  onDesligar: () => Promise<void>;
}

function formatarTelefone(tel: string): string {
  const clean = tel.replace(/^55/, '');
  if (clean.length === 11) return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  if (clean.length === 10) return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  return tel;
}

const STATUS_LABEL: Record<string, string> = {
  discando: 'Discando...',
  tocando: 'Tocando...',
  conectada: 'Em chamada',
};

const STATUS_COLOR: Record<string, string> = {
  discando: 'bg-amber-500',
  tocando: 'bg-blue-500',
  conectada: 'bg-red-600',
};

export default function IlhaChamada({ telefone, pessoaNome, inicio, status, onClick, onDesligar }: IlhaChamadaProps) {
  const [segundos, setSegundos] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (status !== 'conectada') return;
    const start = new Date(inicio).getTime();
    const interval = setInterval(() => {
      setSegundos(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [inicio, status]);

  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  const timer = `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;

  function handleClick() {
    navigate('/atendimento/ligacoes');
    onClick();
  }

  function handleDesligar(e: React.MouseEvent) {
    e.stopPropagation();
    onDesligar();
  }

  const dotColor = STATUS_COLOR[status] || 'bg-gray-500';

  return (
    <div
      className="
        fixed top-3 left-1/2 -translate-x-1/2 z-[100]
        flex items-center gap-2 h-11 pl-3 pr-2
        bg-gray-950 rounded-full
        border border-gray-800
        shadow-2xl shadow-black/40
        animate-[slideDown_0.4s_ease-out]
      "
    >
      {/* Area clicavel — abre tela de ligacoes */}
      <button onClick={handleClick} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
        <div className="relative">
          <div className={`w-8 h-8 rounded-full ${dotColor} flex items-center justify-center`}>
            <PhoneCall size={14} className="text-white" />
          </div>
          {status === 'conectada' && (
            <div className="absolute -inset-0.5 rounded-full bg-red-500/30 animate-ping" />
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-left">
            <p className="text-[0.75rem] font-medium text-gray-100 leading-tight">
              {pessoaNome || formatarTelefone(telefone)}
            </p>
            <p className="text-[0.625rem] text-gray-500 leading-tight">
              {status === 'conectada' ? formatarTelefone(telefone) : STATUS_LABEL[status] || status}
            </p>
          </div>
          {status === 'conectada' && (
            <span className="font-mono text-[0.8125rem] font-bold text-red-500 tabular-nums">{timer}</span>
          )}
        </div>
      </button>

      {/* Botao desligar — separado */}
      <button
        onClick={handleDesligar}
        className="w-7 h-7 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors ml-1"
        title="Desligar chamada"
      >
        <PhoneOff size={12} className="text-white" />
      </button>
    </div>
  );
}
