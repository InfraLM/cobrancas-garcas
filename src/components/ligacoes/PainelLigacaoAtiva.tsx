import type { LigacaoAtiva, EventoLigacao, QualificacaoLigacao } from '../../types/ligacao';
import { formatarTelefone } from '../../mocks/ligacoes';
import LogEventos from './LogEventos';
import TimerLigacao from './TimerLigacao';
import { PhoneCall, PhoneOff, Banknote, PhoneForwarded, ExternalLink, BookOpen, CheckCircle } from 'lucide-react';

interface PainelLigacaoAtivaProps {
  ligacao: LigacaoAtiva | null;
  ligacaoEncerrada: LigacaoAtiva | null;
  qualificacoes: QualificacaoLigacao[];
  eventos: EventoLigacao[];
  onCriarNegociacao: () => void;
  onAgendarCallback: () => void;
  onDesligarChamada: () => void;
  onDesativarWebRTC: () => void;
  onVerMaisAluno: () => void;
  onQualificarInline: (q: QualificacaoLigacao) => void;
}

function formatarMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PainelLigacaoAtiva({
  ligacao,
  ligacaoEncerrada,
  qualificacoes,
  eventos,
  onCriarNegociacao,
  onAgendarCallback,
  onDesligarChamada,
  onDesativarWebRTC,
  onVerMaisAluno,
  onQualificarInline,
}: PainelLigacaoAtivaProps) {
  const emChamada = ligacao?.status === 'conectada';
  const podeDesligar = ligacao && ['discando', 'tocando', 'conectada'].includes(ligacao.status) && !!ligacao.callId;
  const aluno = ligacao?.aluno;
  const fin = aluno?.financeiro;

  return (
    <div className="flex gap-4 flex-1 min-h-[500px] pt-3">
      {/* Coluna esquerda — chamada + info do aluno inline */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Call status header */}
        <div className="flex items-center gap-4 mb-5">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${
            emChamada ? 'bg-red-600 animate-call-pulse' : 'bg-gray-800'
          }`}>
            <PhoneCall size={24} className="text-white" strokeWidth={1.5} />
          </div>

          <div className="min-w-0">
            {ligacao ? (
              <>
                <p className="text-lg font-bold text-gray-100 truncate">
                  {emChamada && aluno ? aluno.nome : formatarTelefone(ligacao.telefone)}
                </p>
                <div className="flex items-center gap-3">
                  {emChamada && (
                    <span className="text-[0.75rem] text-gray-500">{formatarTelefone(ligacao.telefone)}</span>
                  )}
                  {ligacao.status === 'discando' && (
                    <span className="text-[0.75rem] text-amber-400">Discando...</span>
                  )}
                  {ligacao.status === 'tocando' && (
                    <span className="text-[0.75rem] text-blue-400">Tocando...</span>
                  )}
                  {emChamada && (
                    <TimerLigacao inicio={ligacao.inicio} modoEscuro />
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-lg font-medium text-gray-400">Aguardando chamadas...</p>
                <p className="text-[0.75rem] text-gray-600">O discador está ativo — próxima chamada em breve.</p>
              </>
            )}
          </div>
        </div>

        {/* Inline student info — replaces popup */}
        {emChamada && aluno && fin && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-4 space-y-4">
            {/* Financeiro — compact grid */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <p className="text-2xl font-bold text-gray-100">{fin.parcelasEmAtraso}</p>
                <p className="text-[0.625rem] text-gray-500 uppercase tracking-wider">em atraso</p>
              </div>
              <div>
                <p className={`text-2xl font-bold ${fin.valorInadimplente > 0 ? 'text-red-500' : 'text-gray-600'}`}>
                  {formatarMoeda(fin.valorInadimplente)}
                </p>
                <p className="text-[0.625rem] text-gray-500 uppercase tracking-wider">inadimplente</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-300">{formatarMoeda(fin.valorPago)}</p>
                <p className="text-[0.625rem] text-gray-500 uppercase tracking-wider">pago</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-300">
                  {fin.vencimentoMaisAntigo
                    ? new Date(fin.vencimentoMaisAntigo).toLocaleDateString('pt-BR', { month: '2-digit', year: '2-digit' })
                    : '—'}
                </p>
                <p className="text-[0.625rem] text-gray-500 uppercase tracking-wider">venc. antigo</p>
              </div>
            </div>

            {/* Quick info row */}
            <div className="flex items-center gap-4 text-[0.75rem] text-gray-500 border-t border-gray-800 pt-3">
              <div className="flex items-center gap-1.5">
                <BookOpen size={12} className="text-gray-600" />
                <span>{aluno.cursoNome}</span>
              </div>
              {aluno.turmaIdentificador && (
                <span className="text-gray-700">|</span>
              )}
              {aluno.turmaIdentificador && (
                <span>{aluno.turmaIdentificador}</span>
              )}
              {aluno.serasa && (
                <>
                  <span className="text-gray-700">|</span>
                  <span className="text-red-400 font-medium">Serasa</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Botao desligar — sempre disponivel enquanto a chamada estiver ativa */}
        {podeDesligar && (
          <div className="mb-3">
            <button
              onClick={onDesligarChamada}
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-red-600 text-white text-[0.8125rem] font-medium hover:bg-red-700 transition-colors"
            >
              <PhoneOff size={13} />
              Desligar chamada
            </button>
          </div>
        )}

        {/* Action buttons — so depois que humano atende */}
        {emChamada && (
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <button
              onClick={onVerMaisAluno}
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-gray-800 text-gray-300 text-[0.8125rem] font-medium hover:bg-gray-700 transition-colors border border-gray-700"
            >
              <ExternalLink size={13} />
              Mais informações do aluno
            </button>
            <button
              onClick={onCriarNegociacao}
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-gray-800 text-gray-300 text-[0.8125rem] font-medium hover:bg-gray-700 transition-colors border border-gray-700"
            >
              <Banknote size={13} />
              Criar negociação
            </button>
            <button
              onClick={onAgendarCallback}
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-gray-800 text-gray-300 text-[0.8125rem] font-medium hover:bg-gray-700 transition-colors border border-gray-700"
            >
              <PhoneForwarded size={13} />
              Agendar retorno
            </button>
          </div>
        )}

        {/* Qualificacao inline — modo massa, chamada recém-encerrada */}
        {!ligacao && ligacaoEncerrada && (
          <div className="bg-gray-900/80 rounded-xl border border-gray-800 p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={14} className="text-gray-500" />
              <span className="text-[0.8125rem] text-gray-400">
                Qualificar: <span className="text-gray-200 font-medium">{ligacaoEncerrada.aluno?.nome || formatarTelefone(ligacaoEncerrada.telefone)}</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {qualificacoes.map((qual) => (
                <button
                  key={qual.id}
                  onClick={() => onQualificarInline(qual)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-800 hover:border-gray-700 hover:bg-gray-800/50 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: qual.cor }} />
                  <span className="text-[0.75rem] text-gray-300">{qual.nome}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Spacer + parar */}
        <div className="mt-auto pt-4">
          <button
            onClick={onDesativarWebRTC}
            className="flex items-center gap-2 h-9 px-5 rounded-lg text-red-400 text-[0.8125rem] font-medium hover:bg-red-500/10 transition-colors"
          >
            <PhoneOff size={14} />
            Parar ligações
          </button>
        </div>
      </div>

      {/* Coluna direita — Log de eventos */}
      <div className="w-[360px] shrink-0">
        <LogEventos eventos={eventos} />
      </div>
    </div>
  );
}
