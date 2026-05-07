import { useState, useRef } from 'react';
import type { Mensagem3CPlus } from '../../types/conversa';
import { Check, CheckCheck, Lock, FileText, Play, Pause, Download, BadgeCheck, MessageCircle } from 'lucide-react';

interface BolhaMensagemProps {
  mensagem: Mensagem3CPlus;
}

function formatarHora(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function BolhaMensagem({ mensagem }: BolhaMensagemProps) {
  const { tipo, corpo, fromMe, timestamp, ack, interno, mediaUrl, mediaNome, deletado, templateMetaId, templateMetaNome, instanciaTipo } = mensagem;
  const eTemplateMeta = !!templateMetaId;

  // System messages (protocol, transfer, qualification, snooze)
  if (['protocol-message', 'transfer', 'qualification-message', 'snooze-message'].includes(tipo)) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[0.625rem] text-gray-400 bg-white/80 px-3 py-1 rounded-lg shadow-sm">
          {corpo || tipo.replace(/-/g, ' ')}
        </span>
      </div>
    );
  }

  // Internal message
  if (interno || tipo === 'internal-message') {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2 max-w-[70%]">
          <div className="flex items-center gap-1.5 mb-1">
            <Lock size={10} className="text-amber-500" />
            <span className="text-[0.625rem] font-medium text-amber-600">Nota interna</span>
            {mensagem.agenteNome && (
              <span className="text-[0.625rem] text-amber-400">— {mensagem.agenteNome}</span>
            )}
          </div>
          <p className="text-[0.8125rem] text-amber-900">{corpo}</p>
          <span className="text-[0.5625rem] text-amber-400 mt-1 block text-right">
            {formatarHora(timestamp)}
          </span>
        </div>
      </div>
    );
  }

  if (deletado) {
    return (
      <div className={`flex ${fromMe ? 'justify-end' : 'justify-start'} my-0.5 px-4`}>
        <div className="bg-gray-100 rounded-xl px-3 py-1.5 italic text-[0.75rem] text-gray-400">
          Mensagem apagada
        </div>
      </div>
    );
  }

  const bolhaCor = fromMe ? 'bg-[#dcf8c6]' : 'bg-white';
  const alinhamento = fromMe ? 'justify-end' : 'justify-start';

  return (
    <div className={`flex flex-col ${alinhamento} items-${fromMe ? 'end' : 'start'} my-0.5 px-4`}>
      {/* Badge indicador de template Meta WABA — aparece acima da bolha */}
      {eTemplateMeta && (
        <div className="flex items-center gap-1 mb-0.5 mr-1 text-[0.625rem] text-emerald-600">
          <BadgeCheck size={10} />
          <span>Template{templateMetaNome ? `: ${templateMetaNome}` : ''}</span>
        </div>
      )}
      {/* Badge de canal — em ambos os lados (sem ser template Meta, que tem badge proprio).
          Permite o agente saber por qual canal o aluno respondeu / por qual ele enviou. */}
      {!eTemplateMeta && instanciaTipo && (
        <div className={`flex items-center gap-1 mb-0.5 text-[0.625rem] text-gray-500 ${fromMe ? 'mr-1' : 'ml-1'}`}>
          {instanciaTipo === 'waba' ? (
            <>
              <BadgeCheck size={10} className="text-emerald-600" />
              <span className="text-emerald-600">WABA</span>
            </>
          ) : (
            <>
              <MessageCircle size={10} className="text-gray-400" />
              <span>WhatsApp 3C+</span>
            </>
          )}
        </div>
      )}
      <div className={`flex ${alinhamento} w-full`}>
      <div className={`${bolhaCor} rounded-xl px-3 py-1.5 max-w-[65%] shadow-sm ${eTemplateMeta ? 'border border-emerald-200' : ''}`}>
        {/* Quoted message */}
        {mensagem.mensagemCitada?.corpo && (
          <div className="bg-black/5 rounded-lg px-2.5 py-1.5 mb-1.5 border-l-2 border-gray-400">
            <p className="text-[0.6875rem] text-gray-500 line-clamp-2">{mensagem.mensagemCitada.corpo}</p>
          </div>
        )}

        {/* Agent name for sent messages */}
        {fromMe && mensagem.agenteNome && (
          <p className="text-[0.625rem] font-medium text-emerald-700 mb-0.5">{mensagem.agenteNome}</p>
        )}

        {/* Text — chat livre ou template ja resolvido (badge "Template: ..." aparece acima da bolha) */}
        {(tipo === 'chat' || tipo === 'template') && corpo && (
          <p className="text-[0.8125rem] text-gray-900 whitespace-pre-wrap break-words">{corpo}</p>
        )}

        {/* Audio — real player */}
        {(tipo === 'audio' || tipo === 'voice') && (
          <AudioPlayer src={mediaUrl} />
        )}

        {/* Image — real image */}
        {tipo === 'image' && (
          <ImagePreview src={mediaUrl} />
        )}

        {/* Document */}
        {tipo === 'document' && (
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 mb-1">
            <FileText size={20} className="text-gray-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[0.75rem] font-medium text-gray-700 truncate">{mediaNome || 'Documento'}</p>
            </div>
            {mediaUrl && (
              <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                <Download size={14} className="text-gray-400 cursor-pointer hover:text-gray-600" />
              </a>
            )}
          </div>
        )}

        {/* Video */}
        {tipo === 'video' && (
          <div className="rounded-lg overflow-hidden mb-1 bg-gray-800 relative">
            {mediaUrl ? (
              <video src={mediaUrl} controls className="w-[220px] max-h-[200px]" />
            ) : (
              <div className="w-[220px] h-[140px] flex items-center justify-center">
                <Play size={32} className="text-white/70" />
              </div>
            )}
          </div>
        )}

        {/* Caption for media with text */}
        {tipo !== 'chat' && tipo !== 'template' && corpo && (
          <p className="text-[0.8125rem] text-gray-900 whitespace-pre-wrap break-words mt-1">{corpo}</p>
        )}

        {/* Timestamp + ack */}
        <div className="flex items-center justify-end gap-1 mt-0.5">
          <span className="text-[0.5625rem] text-gray-500">{formatarHora(timestamp)}</span>
          {fromMe && (
            ack === 'read' ? (
              <CheckCheck size={12} className="text-blue-500" />
            ) : ack === 'device' ? (
              <CheckCheck size={12} className="text-gray-400" />
            ) : (
              <Check size={12} className="text-gray-400" />
            )
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── Audio Player ─────────────────────────────────────────
function AudioPlayer({ src }: { src: string | null }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
    setPlaying(!playing);
  }

  function formatDur(s: number) {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  if (!src) {
    return (
      <div className="flex items-center gap-2 py-1 text-[0.75rem] text-gray-400">
        Áudio indisponível
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-1 min-w-[180px]">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (a && a.duration) setProgress((a.currentTime / a.duration) * 100);
        }}
        onEnded={() => { setPlaying(false); setProgress(0); }}
      />
      <button
        onClick={toggle}
        className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0 hover:bg-gray-300 transition-colors"
      >
        {playing
          ? <Pause size={14} className="text-gray-600" />
          : <Play size={14} className="text-gray-600 ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-0.5">
        <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-gray-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <span className="text-[0.625rem] text-gray-400 shrink-0">{formatDur(playing ? (audioRef.current?.currentTime || 0) : duration)}</span>
    </div>
  );
}

// ─── Image Preview ────────────────────────────────────────
function ImagePreview({ src }: { src: string | null }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!src) {
    return (
      <div className="w-[220px] h-[160px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-[0.75rem] mb-1">
        Imagem indisponível
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg overflow-hidden mb-1 bg-gray-100 cursor-pointer" onClick={() => setExpanded(true)}>
        {!loaded && !error && (
          <div className="w-[220px] h-[160px] flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="w-[220px] h-[160px] flex items-center justify-center text-gray-400 text-[0.75rem]">
            Falha ao carregar
          </div>
        )}
        <img
          src={src}
          alt=""
          className={`max-w-[280px] max-h-[300px] object-contain ${loaded ? '' : 'hidden'}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      </div>

      {/* Fullscreen overlay */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center cursor-pointer"
          onClick={() => setExpanded(false)}
        >
          <img src={src} alt="" className="max-w-[90vw] max-h-[90vh] object-contain" />
        </div>
      )}
    </>
  );
}
