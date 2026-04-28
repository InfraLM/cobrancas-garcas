import { useState } from 'react';
import type { LigacaoAtiva, EventoLigacao, QualificacaoLigacao } from '../../types/ligacao';
import { formatarTelefone } from '../../mocks/ligacoes';
import { criarAtividade } from '../../services/atividades';
import LogEventos from './LogEventos';
import TimerLigacao from './TimerLigacao';
import { PhoneCall, PhoneOff, Banknote, PhoneForwarded, ExternalLink, BookOpen, CheckCircle, Activity, X, MessageCircle, Calendar, Loader2 } from 'lucide-react';

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

// Cria atividade rapida (1-clique) para amanha 09:00 BRT
async function criarLembreteRapido(
  tipo: 'LEMBRETE_LIGACAO' | 'LEMBRETE_MENSAGEM',
  ligacao: LigacaoAtiva,
) {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  amanha.setHours(9, 0, 0, 0);
  const nomeAluno = ligacao.aluno?.nome || formatarTelefone(ligacao.telefone);
  const titulo = tipo === 'LEMBRETE_LIGACAO'
    ? `Ligar para ${nomeAluno}`
    : `Mandar WhatsApp para ${nomeAluno}`;
  await criarAtividade({
    tipo,
    titulo,
    dataHora: amanha.toISOString(),
    pessoaCodigo: ligacao.aluno?.codigo,
    pessoaNome: ligacao.aluno?.nome || undefined,
    telefone: ligacao.telefone,
    origem: 'DURANTE_LIGACAO',
    origemRefId: ligacao.callId || undefined,
  });
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
  const [logsAbertos, setLogsAbertos] = useState(false);

  return (
    <div className="flex flex-1 min-h-0 pt-3">
      {/* Conteudo principal — ocupa a largura inteira */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
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

        {/* Buscando aluno (pre-fetch ou fallback ainda em curso) */}
        {emChamada && !aluno && ligacao?.alunoBuscando && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-4 flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-gray-700 border-t-gray-300 rounded-full animate-spin" />
            <p className="text-[0.8125rem] text-gray-400">Buscando dados do aluno...</p>
          </div>
        )}

        {/* Aluno nao encontrado no SEI pelo telefone */}
        {emChamada && !aluno && ligacao?.alunoNaoEncontrado && (
          <div className="bg-amber-950/40 rounded-xl border border-amber-900/50 p-4 mb-4">
            <p className="text-[0.8125rem] font-medium text-amber-300 mb-1">Telefone não vinculado a aluno</p>
            <p className="text-[0.75rem] text-amber-200/70">
              O número {formatarTelefone(ligacao.telefone)} não foi encontrado na base SEI.
              Pergunte o nome/CPF do aluno para identificar manualmente.
            </p>
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
            <BotaoAtividadeRapida
              tipo="LEMBRETE_LIGACAO"
              label="Lembrete: ligar amanhã"
              ligacao={ligacao!}
              icone={<PhoneForwarded size={13} />}
            />
            <BotaoAtividadeRapida
              tipo="LEMBRETE_MENSAGEM"
              label="Lembrete: WhatsApp amanhã"
              ligacao={ligacao!}
              icone={<MessageCircle size={13} />}
            />
            {/* Botao "Agendar retorno" antigo era stub. Mantido oculto; agendamento agora vai para Atividades. */}
            <button
              onClick={onAgendarCallback}
              className="hidden"
              aria-hidden
            >
              {/* legado */}
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

      {/* Botao flutuante para abrir o log */}
      <button
        type="button"
        onClick={() => setLogsAbertos(true)}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 h-10 px-4 rounded-full bg-gray-800 text-gray-200 text-[0.8125rem] font-medium hover:bg-gray-700 shadow-lg border border-gray-700"
      >
        <Activity size={14} />
        Log <span className="text-gray-500">({eventos.length})</span>
      </button>

      {/* Drawer lateral direito com log de eventos */}
      {logsAbertos && (
        <div
          onClick={() => setLogsAbertos(false)}
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          aria-hidden
        />
      )}
      <aside
        className={`fixed top-0 right-0 h-screen w-[400px] z-50 p-3 transition-transform duration-200 ${
          logsAbertos ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between bg-gray-900 rounded-t-xl border border-b-0 border-gray-800 px-3 py-2">
            <span className="text-[0.75rem] text-gray-300 font-medium">Log de eventos</span>
            <button
              type="button"
              onClick={() => setLogsAbertos(false)}
              className="p-1 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800"
              aria-label="Fechar log"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <LogEventos eventos={eventos} />
          </div>
        </div>
      </aside>
    </div>
  );
}

// ----------------------------------------------------------------------
// Botao 1-clique pra criar lembrete (ligacao ou whatsapp) durante a chamada.
// Default: amanha 09:00 BRT, com aluno ja vinculado. Mostra feedback inline.
// ----------------------------------------------------------------------
function BotaoAtividadeRapida({
  tipo, label, ligacao, icone,
}: {
  tipo: 'LEMBRETE_LIGACAO' | 'LEMBRETE_MENSAGEM';
  label: string;
  ligacao: LigacaoAtiva;
  icone: React.ReactNode;
}) {
  const [estado, setEstado] = useState<'idle' | 'salvando' | 'ok' | 'erro'>('idle');

  async function handle() {
    if (estado === 'salvando' || estado === 'ok') return;
    setEstado('salvando');
    try {
      await criarLembreteRapido(tipo, ligacao);
      setEstado('ok');
      setTimeout(() => setEstado('idle'), 2500);
    } catch {
      setEstado('erro');
      setTimeout(() => setEstado('idle'), 2500);
    }
  }

  return (
    <button
      onClick={handle}
      disabled={estado === 'salvando'}
      className={`flex items-center gap-2 h-9 px-4 rounded-lg text-[0.8125rem] font-medium transition-colors border ${
        estado === 'ok' ? 'bg-emerald-900/40 text-emerald-300 border-emerald-800' :
        estado === 'erro' ? 'bg-red-900/40 text-red-300 border-red-800' :
        'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
      }`}
    >
      {estado === 'salvando' ? <Loader2 size={13} className="animate-spin" /> :
       estado === 'ok' ? <CheckCircle size={13} /> :
       icone}
      {estado === 'ok' ? 'Agendado p/ amanhã 9h' :
       estado === 'erro' ? 'Erro ao agendar' :
       label}
    </button>
  );
}
