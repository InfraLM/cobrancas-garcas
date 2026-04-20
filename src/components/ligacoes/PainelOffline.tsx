import { Headphones, Wifi, LogIn } from 'lucide-react';

interface PainelOfflineProps {
  onIrOnline: () => void;
  telefonePendente?: string;
}

export default function PainelOffline({ onIrOnline, telefonePendente }: PainelOfflineProps) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-[500px]">
      <div className="flex flex-col items-center gap-8 max-w-sm text-center">
        {/* Icon */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-white border-2 border-gray-100 flex items-center justify-center shadow-lg shadow-gray-100/50">
            <Headphones size={36} strokeWidth={1.5} className="text-gray-400" />
          </div>
        </div>

        {/* Text */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Ligações Ativas</h2>
          <p className="text-[0.8125rem] text-gray-400 leading-relaxed">
            Para realizar ligações, ative sua sessão. Isso registrará seu ramal WebRTC e fará login na campanha.
          </p>
          {telefonePendente && (
            <p className="text-[0.8125rem] text-gray-600 mt-2 bg-gray-50 rounded-lg px-3 py-2">
              Número pendente: <span className="font-mono font-medium">{telefonePendente}</span>
            </p>
          )}
        </div>

        {/* Steps preview */}
        <div className="flex items-center gap-6 text-[0.6875rem] text-gray-400">
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
              <Wifi size={14} className="text-gray-400" />
            </div>
            <span>WebRTC</span>
          </div>
          <div className="w-6 h-px bg-gray-200" />
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
              <LogIn size={14} className="text-gray-400" />
            </div>
            <span>Login</span>
          </div>
          <div className="w-6 h-px bg-gray-200" />
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
              <Headphones size={14} className="text-gray-400" />
            </div>
            <span>Áudio</span>
          </div>
        </div>

        {/* Go Online button */}
        <button
          onClick={onIrOnline}
          className="w-full h-12 rounded-xl bg-gray-900 text-white font-medium text-[0.875rem] hover:bg-gray-800 transition-colors flex items-center justify-center gap-2.5 shadow-lg shadow-gray-900/20"
        >
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          Ir Online
        </button>
      </div>
    </div>
  );
}
