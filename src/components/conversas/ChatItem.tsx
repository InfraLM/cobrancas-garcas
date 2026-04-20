import type { ConversaCobranca } from '../../types/conversa';
import { formatarTimestampChat } from '../../types/conversa';
import { AlertTriangle, Handshake, Clock, Mic, Camera, FileText, Film } from 'lucide-react';

interface ChatItemProps {
  conversa: ConversaCobranca;
  ativo: boolean;
  onClick: () => void;
}

function formatarNumero(num: string): string {
  const clean = num.replace(/^55/, '');
  if (clean.length === 11) return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  return num;
}

function formatarValor(v: number | null): string {
  if (!v) return '';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const iconesTipo: Record<string, typeof Mic> = {
  audio: Mic,
  voice: Mic,
  image: Camera,
  document: FileText,
  video: Film,
};

function previewTipoMidia(tipo: string): string | null {
  const mapa: Record<string, string> = {
    audio: 'Áudio',
    voice: 'Mensagem de voz',
    image: 'Imagem',
    document: 'Documento',
    video: 'Vídeo',
  };
  return mapa[tipo] || null;
}

export default function ChatItem({ conversa, ativo, onClick }: ChatItemProps) {
  const nome = conversa.contatoNome || formatarNumero(conversa.contatoNumero);
  const iniciais = (conversa.contatoNome || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const ultimaMsgTs = conversa.ultimaMensagemCliente
    ? Math.floor(new Date(conversa.ultimaMensagemCliente).getTime() / 1000)
    : Math.floor(new Date(conversa.criadoEm).getTime() / 1000);

  // Preview da ultima mensagem — com suporte a media
  const tipoMidia = conversa.ultimaMensagemTipo || 'chat';
  const IconeTipo = iconesTipo[tipoMidia] || null;
  const labelMidia = previewTipoMidia(tipoMidia);
  const textoMsg = conversa.ultimaMensagemTexto;
  const prefixoFromMe = conversa.ultimaMensagemFromMe ? 'Você: ' : '';

  let preview: string;
  if (textoMsg) {
    preview = prefixoFromMe + textoMsg;
  } else if (labelMidia) {
    preview = prefixoFromMe + labelMidia;
  } else {
    preview = 'Sem mensagens';
  }

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-gray-50 ${
        ativo ? 'bg-gray-50' : 'hover:bg-gray-50/50'
      }`}
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-[0.75rem] font-medium text-gray-400 overflow-hidden">
        {conversa.contatoImagem ? (
          <img src={conversa.contatoImagem} alt="" className="w-full h-full object-cover" />
        ) : (
          iniciais
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[0.8125rem] font-medium text-gray-900 truncate flex items-center gap-1">
            {nome}
            {conversa.status === 'SNOOZE' && (
              <Clock size={11} className="text-amber-500 shrink-0" aria-label="Adiado" />
            )}
          </span>
          <span className="text-[0.625rem] text-gray-400 shrink-0 ml-2">
            {formatarTimestampChat(ultimaMsgTs)}
          </span>
        </div>

        {/* Preview da ultima mensagem */}
        <div className="flex items-center gap-1 min-w-0 mb-0.5">
          {IconeTipo && <IconeTipo size={11} className="text-gray-400 shrink-0" />}
          <span className="text-[0.75rem] text-gray-500 truncate">
            {preview}
          </span>
        </div>

        {/* Linha de cobranca (financeiro + indicadores) */}
        <div className="flex items-center gap-1.5 min-w-0">
          {conversa.valorInadimplente && Number(conversa.valorInadimplente) > 0 ? (
            <>
              <span className="text-[0.6875rem] text-red-600 font-semibold truncate">
                {formatarValor(Number(conversa.valorInadimplente))}
              </span>
              {conversa.diasAtraso != null && conversa.diasAtraso > 0 && (
                <span className="text-[0.625rem] text-gray-400">· {conversa.diasAtraso}d</span>
              )}
            </>
          ) : conversa.pessoaCodigo ? (
            <span className="text-[0.6875rem] text-emerald-600">Em dia</span>
          ) : (
            <span className="text-[0.6875rem] text-gray-400">Não vinculado</span>
          )}

          {conversa.serasaAtivo && (
            <AlertTriangle size={10} className="text-red-500 shrink-0" aria-label="Serasa ativo" />
          )}
          {conversa.temAcordoAtivo && (
            <Handshake size={10} className="text-emerald-500 shrink-0" aria-label="Acordo ativo" />
          )}
        </div>
      </div>
    </div>
  );
}
