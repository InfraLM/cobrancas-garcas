import { useState, useEffect, useRef, useCallback } from 'react';
import type { DispositivoAudio } from '../../types/ligacao';
import { dispositivosMock } from '../../mocks/ligacoes';
import { Mic, Square, Play, Check, ArrowLeft, ArrowRight } from 'lucide-react';

interface TesteAudioProps {
  onIniciar: () => void;
  onCancelar: () => void;
}

export default function TesteAudio({ onIniciar, onCancelar }: TesteAudioProps) {
  const [dispositivos, setDispositivos] = useState<DispositivoAudio[]>([]);
  const [dispositivoId, setDispositivoId] = useState<string | null>(null);
  const [nivelAudio, setNivelAudio] = useState(0);
  const [gravando, setGravando] = useState(false);
  const [gravacaoUrl, setGravacaoUrl] = useState<string | null>(null);
  const [reproduzindo, setReproduzindo] = useState(false);
  const [micPermitido, setMicPermitido] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const animFrameRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Detectar dispositivos
  useEffect(() => {
    async function detectar() {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
            sampleRate: { ideal: 48000 },
            sampleSize: { ideal: 16 },
            channelCount: { ideal: 1 },
          },
        });
        tempStream.getTracks().forEach(t => t.stop());
        setMicPermitido(true);

        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices
          .filter(d => d.kind === 'audioinput' && d.deviceId)
          .map(d => ({
            deviceId: d.deviceId,
            label: d.label || `Microfone ${d.deviceId.slice(0, 6)}`,
            isJabra: d.label.toLowerCase().includes('jabra'),
          }));

        if (mics.length > 0) {
          setDispositivos(mics);
          const jabra = mics.find(m => m.isJabra);
          setDispositivoId(jabra?.deviceId || mics[0].deviceId);
        } else {
          setDispositivos(dispositivosMock);
          setDispositivoId(dispositivosMock[0].deviceId);
        }
      } catch {
        setDispositivos(dispositivosMock);
        setDispositivoId(dispositivosMock[0].deviceId);
      }
    }
    detectar();
  }, []);

  // Monitor de nível de áudio
  const startMonitoring = useCallback(async () => {
    if (!dispositivoId || !micPermitido) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: dispositivoId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: { ideal: 48000 },
          sampleSize: { ideal: 16 },
          channelCount: { ideal: 1 },
        },
      });

      streamRef.current = stream;
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      function updateLevel() {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setNivelAudio(Math.min(100, Math.round(avg * 1.5)));
        animFrameRef.current = requestAnimationFrame(updateLevel);
      }
      updateLevel();
    } catch {
      const interval = setInterval(() => {
        setNivelAudio(Math.floor(Math.random() * 40 + 10));
      }, 150);
      return () => clearInterval(interval);
    }
  }, [dispositivoId, micPermitido]);

  useEffect(() => {
    startMonitoring();
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioContextRef.current?.close();
    };
  }, [startMonitoring]);

  function handleGravar() {
    if (!streamRef.current) return;
    const recorder = new MediaRecorder(streamRef.current);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      setGravacaoUrl(URL.createObjectURL(blob));
    };
    recorder.start();
    recorderRef.current = recorder;
    setGravando(true);

    setTimeout(() => {
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.stop();
        setGravando(false);
      }
    }, 5000);
  }

  function handlePararGravacao() {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
      setGravando(false);
    }
  }

  function handleReproduzir() {
    if (!gravacaoUrl) return;
    const audio = new Audio(gravacaoUrl);
    audioRef.current = audio;
    setReproduzindo(true);
    audio.onended = () => setReproduzindo(false);
    audio.play();
  }

  const jabraDetectado = dispositivos.some(d => d.isJabra);

  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-[400px]">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-lg shadow-gray-200/30 p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[0.9375rem] font-semibold text-gray-900">Teste de Áudio</h3>
          <button onClick={onCancelar} className="flex items-center gap-1.5 text-[0.75rem] text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={14} />
            Cancelar
          </button>
        </div>
        <p className="text-[0.6875rem] text-gray-400 mb-5">
          WebRTC ativo — teste seu microfone antes de iniciar as ligações.
        </p>

        <div className="space-y-5">
          {/* Dispositivo */}
          <div>
            <label className="text-[0.625rem] uppercase tracking-wider text-gray-300 font-medium mb-2 block">
              Microfone
            </label>
            <select
              value={dispositivoId || ''}
              onChange={(e) => setDispositivoId(e.target.value)}
              className="w-full h-10 px-4 rounded-xl bg-white border border-gray-100 text-[0.8125rem] text-gray-900 outline-none focus:border-gray-300 transition-colors appearance-none cursor-pointer"
            >
              {dispositivos.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.isJabra ? '\u2605 ' : ''}{d.label}
                </option>
              ))}
            </select>
            {jabraDetectado && (
              <p className="text-[0.6875rem] text-emerald-600 mt-1.5 flex items-center gap-1">
                <Check size={12} />
                Jabra detectado — autoGainControl desativado, 48kHz
              </p>
            )}
          </div>

          {/* Nível de áudio */}
          <div>
            <label className="text-[0.625rem] uppercase tracking-wider text-gray-300 font-medium mb-2 block">
              Nível de áudio
            </label>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-100"
                style={{
                  width: `${nivelAudio}%`,
                  background: nivelAudio > 80 ? '#ef4444' : nivelAudio > 50 ? '#f59e0b' : '#22c55e',
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[0.625rem] text-gray-300">Baixo</span>
              <span className="text-[0.625rem] text-gray-300">Alto</span>
            </div>
          </div>

          {/* Gravação */}
          <div>
            <label className="text-[0.625rem] uppercase tracking-wider text-gray-300 font-medium mb-2 block">
              Teste de gravação
            </label>
            <div className="flex items-center gap-3">
              {!gravando ? (
                <button
                  onClick={handleGravar}
                  className="flex items-center gap-2 h-9 px-4 rounded-lg bg-red-50 text-red-600 text-[0.8125rem] font-medium hover:bg-red-100 transition-colors"
                >
                  <Mic size={14} />
                  Gravar (5s)
                </button>
              ) : (
                <button
                  onClick={handlePararGravacao}
                  className="flex items-center gap-2 h-9 px-4 rounded-lg bg-red-500 text-white text-[0.8125rem] font-medium animate-pulse"
                >
                  <Square size={14} />
                  Gravando...
                </button>
              )}

              {gravacaoUrl && !gravando && (
                <button
                  onClick={handleReproduzir}
                  disabled={reproduzindo}
                  className="flex items-center gap-2 h-9 px-4 rounded-lg bg-gray-50 text-gray-600 text-[0.8125rem] font-medium hover:bg-gray-100 transition-colors disabled:opacity-40"
                >
                  <Play size={14} />
                  {reproduzindo ? 'Reproduzindo...' : 'Ouvir teste'}
                </button>
              )}
            </div>
          </div>

          {/* Iniciar */}
          <button
            onClick={onIniciar}
            className="w-full h-12 rounded-xl bg-gray-900 text-white font-medium text-[0.8125rem] hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 mt-2"
          >
            Iniciar ligações
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
