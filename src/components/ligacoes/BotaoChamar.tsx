import { useState } from 'react';
import { PhoneCall, LogOut } from 'lucide-react';

interface BotaoChamarProps {
  onClick: () => void;
  desabilitado?: boolean;
  onEncerrarTurno?: () => void;
}

export default function BotaoChamar({ onClick, desabilitado, onEncerrarTurno }: BotaoChamarProps) {
  const [ripple, setRipple] = useState(false);

  function handleClick() {
    if (desabilitado) return;
    setRipple(true);
    setTimeout(() => {
      setRipple(false);
      onClick();
    }, 900);
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-[400px]">
      <div className="relative flex items-center justify-center">
        {/* Ripple rings */}
        {ripple && (
          <>
            <div className="absolute w-32 h-32 rounded-full border-2 border-red-500/40 animate-ripple" />
            <div className="absolute w-32 h-32 rounded-full border-2 border-red-500/30 animate-ripple-delay-1" />
            <div className="absolute w-32 h-32 rounded-full border-2 border-red-500/20 animate-ripple-delay-2" />
          </>
        )}

        {/* Main button */}
        <button
          onClick={handleClick}
          disabled={desabilitado}
          className={`
            relative z-10 w-32 h-32 rounded-full flex items-center justify-center
            bg-white border-2 border-gray-100
            shadow-lg shadow-gray-200/50
            transition-all duration-300 cursor-pointer
            ${desabilitado ? 'opacity-40 cursor-not-allowed' : 'animate-breathe hover:scale-110 hover:shadow-xl hover:border-red-200 hover:shadow-red-100/30'}
          `}
        >
          <PhoneCall
            size={40}
            strokeWidth={1.5}
            className={`transition-colors duration-300 ${
              desabilitado ? 'text-gray-300' : 'text-gray-600 group-hover:text-red-500'
            }`}
          />
        </button>
      </div>

      <p className="mt-6 text-[0.8125rem] text-gray-400">
        Clique para iniciar uma ligação
      </p>

      {onEncerrarTurno && (
        <button
          onClick={onEncerrarTurno}
          className="mt-8 flex items-center gap-2 h-9 px-5 rounded-lg text-gray-400 text-[0.75rem] hover:text-red-500 hover:bg-red-50/50 transition-colors"
        >
          <LogOut size={13} />
          Encerrar turno
        </button>
      )}
    </div>
  );
}
