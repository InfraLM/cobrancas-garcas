import type { ConversaCobranca } from '../../types/conversa';
import { ArrowRightLeft, CheckSquare, Clock, User, Handshake } from 'lucide-react';
import AlunoTagsSection from '../tags/AlunoTagsSection';

interface HeaderChatProps {
  conversa: ConversaCobranca;
  agenteLogadoId: number;
  onAssumir: () => void;
  onTransferir: () => void;
  onEncerrar: () => void;
  onSnooze: () => void;
  onTogglePainelAluno: () => void;
  painelAlunoAberto: boolean;
}

function formatarNumero(num: string): string {
  const clean = num.replace(/^55/, '');
  if (clean.length === 11) return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  return num;
}

export default function HeaderChat({
  conversa,
  agenteLogadoId,
  onAssumir,
  onTransferir,
  onEncerrar,
  onSnooze,
  onTogglePainelAluno,
  painelAlunoAberto,
}: HeaderChatProps) {
  const nome = conversa.contatoNome || formatarNumero(conversa.contatoNumero);
  const ehMeu = conversa.agenteId === agenteLogadoId;
  const disponivel = conversa.status === 'AGUARDANDO';
  const encerrada = conversa.status === 'ENCERRADA';

  return (
    <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-100">
      {/* Left: contact info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-[0.6875rem] font-medium text-gray-400 overflow-hidden">
          {conversa.contatoImagem ? (
            <img src={conversa.contatoImagem} alt="" className="w-full h-full object-cover" />
          ) : (
            (conversa.contatoNome || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-semibold text-gray-900 truncate">{nome}</p>
          <div className="flex items-center gap-2">
            <span className="text-[0.6875rem] text-gray-400">{formatarNumero(conversa.contatoNumero)}</span>
            {conversa.agenteNome && (
              <>
                <span className="text-gray-200">·</span>
                <span className="text-[0.6875rem] text-gray-400">
                  {ehMeu ? 'Você' : conversa.agenteNome}
                </span>
              </>
            )}
            {conversa.status === 'SNOOZE' && (
              <span className="flex items-center gap-0.5 text-[0.625rem] text-amber-500">
                <Clock size={10} />
                Adiado
              </span>
            )}
            {encerrada && (
              <span className="text-[0.625rem] text-gray-400">Encerrada</span>
            )}
          </div>
          {conversa.pessoaCodigo && (
            <button
              type="button"
              onClick={onTogglePainelAluno}
              className="mt-1 hover:opacity-80 transition-opacity"
              title="Clique para gerenciar tags no painel do aluno"
            >
              <AlunoTagsSection
                pessoaCodigo={conversa.pessoaCodigo}
                compacto
                editavel={false}
              />
            </button>
          )}
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1">
        {disponivel && (
          <button
            onClick={onAssumir}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-gray-900 text-white text-[0.75rem] font-medium hover:bg-gray-800 transition-colors"
          >
            <Handshake size={13} />
            Assumir
          </button>
        )}

        {!encerrada && ehMeu && (
          <>
            <button
              onClick={onTransferir}
              title="Transferir para outro cobrador"
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <ArrowRightLeft size={15} />
            </button>

            <button
              onClick={onSnooze}
              title="Adiar (snooze)"
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Clock size={15} />
            </button>

            <button
              onClick={onEncerrar}
              title="Encerrar conversa"
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <CheckSquare size={15} />
            </button>
          </>
        )}

        <button
          onClick={onTogglePainelAluno}
          title={painelAlunoAberto ? 'Fechar painel do aluno' : 'Abrir painel do aluno'}
          className={`p-2 rounded-lg transition-colors ${
            painelAlunoAberto ? 'text-gray-900 bg-gray-100' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
          }`}
        >
          <User size={15} />
        </button>
      </div>
    </div>
  );
}
