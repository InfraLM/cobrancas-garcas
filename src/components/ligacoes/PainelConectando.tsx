import { Wifi, LogIn, UserCheck, Loader2 } from 'lucide-react';

interface PainelConectandoProps {
  etapa: 'webrtc' | 'login' | 'aguardando_idle';
  onCancelar: () => void;
}

const etapas = [
  { key: 'webrtc', label: 'WebRTC', desc: 'Ativando ramal web e registrando SIP...', icon: Wifi },
  { key: 'login', label: 'Login', desc: 'Autenticando na campanha...', icon: LogIn },
  { key: 'aguardando_idle', label: 'Pronto', desc: 'Finalizando configuração...', icon: UserCheck },
] as const;

export default function PainelConectando({ etapa, onCancelar }: PainelConectandoProps) {
  const etapaIdx = etapas.findIndex(e => e.key === etapa);
  const etapaAtual = etapas[etapaIdx];
  const IconeAtual = etapaAtual.icon;

  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-[400px]">
      <div className="flex flex-col items-center gap-6">
        {/* Icon */}
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-lg shadow-gray-100/30">
            <IconeAtual size={28} className="text-gray-500" />
          </div>
          <svg className="absolute -inset-2.5" width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="47" fill="none" stroke="#e5e7eb" strokeWidth="2" />
            <circle
              cx="50" cy="50" r="47" fill="none" stroke="#374151" strokeWidth="2"
              strokeDasharray={`${((etapaIdx + 1) / etapas.length) * 295} 295`}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
              className="transition-all duration-700"
            />
          </svg>
        </div>

        {/* Text */}
        <div className="text-center">
          <p className="text-[0.9375rem] font-medium text-gray-900 mb-1">{etapaAtual.desc}</p>
          <p className="text-[0.75rem] text-gray-400">
            Etapa {etapaIdx + 1} de {etapas.length}
          </p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-1.5">
          {etapas.map((e, i) => (
            <div key={e.key} className="flex items-center gap-1.5">
              <div className={`
                w-7 h-7 rounded-full flex items-center justify-center text-[0.625rem] font-bold transition-all duration-500
                ${i < etapaIdx ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : ''}
                ${i === etapaIdx ? 'bg-gray-900 text-white scale-110' : ''}
                ${i > etapaIdx ? 'bg-gray-50 text-gray-300 border border-gray-100' : ''}
              `}>
                {i < etapaIdx ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                ) : i === etapaIdx ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              {i < etapas.length - 1 && (
                <div className={`w-6 h-px transition-colors duration-500 ${i < etapaIdx ? 'bg-emerald-300' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <button
          onClick={onCancelar}
          className="mt-2 h-9 px-6 rounded-lg text-[0.8125rem] text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
