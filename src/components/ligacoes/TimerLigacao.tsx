import { useState, useEffect } from 'react';

interface TimerLigacaoProps {
  inicio: string | null; // ISO timestamp
  modoEscuro?: boolean;
}

export default function TimerLigacao({ inicio, modoEscuro }: TimerLigacaoProps) {
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    if (!inicio) {
      setSegundos(0);
      return;
    }

    const start = new Date(inicio).getTime();
    const interval = setInterval(() => {
      setSegundos(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [inicio]);

  const minutos = Math.floor(segundos / 60);
  const segs = segundos % 60;
  const formatado = `${String(minutos).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;

  return (
    <span className={`font-mono text-lg font-bold tracking-wider ${
      modoEscuro ? 'text-red-500' : 'text-gray-900'
    }`}>
      {formatado}
    </span>
  );
}
