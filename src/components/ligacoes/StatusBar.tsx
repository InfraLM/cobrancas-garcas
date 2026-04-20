import type { StatusConexao, EstadoPaginaLigacao } from '../../types/ligacao';
import TimerLigacao from './TimerLigacao';

interface StatusBarProps {
  status: StatusConexao;
  estadoPagina: EstadoPaginaLigacao;
  inicioLigacao: string | null;
}

function Indicador({ ativo, label, conectando }: { ativo: boolean; label: string; conectando?: boolean }) {
  const cor = conectando
    ? 'bg-amber-400'
    : ativo
      ? 'bg-emerald-500'
      : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${cor} ${conectando ? 'animate-pulse' : ''}`} />
      <span className="text-[0.75rem]">{label}</span>
    </div>
  );
}

export default function StatusBar({ status, estadoPagina, inicioLigacao }: StatusBarProps) {
  const modoEscuro = estadoPagina === 'EM_LIGACAO' || estadoPagina === 'QUALIFICACAO';

  return (
    <div className={`flex items-center justify-between px-5 py-2.5 rounded-xl transition-colors duration-500 ${
      modoEscuro
        ? 'bg-gray-900 text-gray-300 border border-gray-800'
        : 'bg-white text-gray-500 border border-gray-100'
    }`}>
      <div className="flex items-center gap-6">
        <Indicador ativo={status.agenteOnline} label="Agente online" />
        <Indicador ativo={status.socketConectado} label="Socket conectado" />
        <Indicador
          ativo={status.webrtcAtivo}
          label={status.sipRegistrado ? 'WebRTC ativo' : status.webrtcAtivo ? 'Registrando SIP...' : 'WebRTC inativo'}
          conectando={status.webrtcAtivo && !status.sipRegistrado}
        />
      </div>

      {inicioLigacao && (
        <TimerLigacao inicio={inicioLigacao} modoEscuro={modoEscuro} />
      )}
    </div>
  );
}
