import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import type {
  EstadoPaginaLigacao,
  TipoLigacao,
  StatusConexao,
  ConfiguracaoCampanha,
  LigacaoAtiva,
  EventoLigacao,
  TipoEventoLigacao,
  QualificacaoLigacao,
  AgendamentoCallback,
} from '../types/ligacao';
import type { DebugLog } from '../components/ligacoes/PainelDebugLogs';
import type { Aluno } from '../types/aluno';
import { qualificacoesMock } from '../mocks/ligacoes';
import * as real3c from '../services/ligacoes3cplus';
import { useRealtime } from './RealtimeContext';

export type EstadoSessao = 'OFFLINE' | 'CONECTANDO_SESSAO' | 'TESTE_AUDIO' | 'ONLINE';

interface LigacoesContextType {
  sessao: EstadoSessao;
  etapaConectando: 'webrtc' | 'login' | 'aguardando_idle';
  statusConexao: StatusConexao;
  estadoPagina: EstadoPaginaLigacao;
  tipoLigacao: TipoLigacao | null;
  telefoneIndividual: string;
  configuracaoCampanha: ConfiguracaoCampanha | null;
  ligacaoAtiva: LigacaoAtiva | null;
  ligacaoEncerrada: LigacaoAtiva | null;
  eventos: EventoLigacao[];
  qualificacoes: QualificacaoLigacao[];
  modoAtivo: boolean;
  callbackAberto: boolean;
  negociacaoAberta: boolean;
  ilhaAtiva: boolean;
  debugLogs: DebugLog[];
  webrtcUrl: string | null;

  irOnline: () => void;
  irOffline: () => void;
  desativarRamal: () => void;
  confirmarAudio: () => void;
  abrirSeletorTipo: () => void;
  selecionarTipo: (tipo: TipoLigacao, telefone?: string) => void;
  confirmarCampanha: (config: ConfiguracaoCampanha) => void;
  voltarParaSelecao: () => void;
  setTelefoneIndividual: (tel: string) => void;
  qualificarLigacao: (q: QualificacaoLigacao) => void;
  qualificarLigacaoInline: (q: QualificacaoLigacao) => void;
  agendarCallback: (a: AgendamentoCallback) => void;
  cancelarChamada: () => void;
  desligarChamada: () => Promise<void>;
  minimizarParaIlha: () => void;
  voltarDaIlha: () => void;
  setCallbackAberto: (v: boolean) => void;
  setNegociacaoAberta: (v: boolean) => void;
  iniciarLigacaoComTelefone: (telefone: string) => void;
  limparDebugLogs: () => void;
}

const LigacoesContext = createContext<LigacoesContextType | null>(null);

export function useLigacoesContext() {
  const ctx = useContext(LigacoesContext);
  if (!ctx) throw new Error('useLigacoesContext must be used inside LigacoesProvider');
  return ctx;
}

let logCounter = 0;

// Normaliza o payload de ligacao:evento do nosso backend realtime para o formato EventoLigacao.
// Backend emite { tipo, data } onde data eh o payload bruto da 3C Plus.
function normalizarEventoRealtime(tipo: TipoEventoLigacao, data: any): EventoLigacao {
  const call = data?.call || data;
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tipo,
    timestamp: new Date().toISOString(),
    telefone: call?.phone || data?.phone || undefined,
    pessoaNome: call?.mailing?.data?.name || data?.agent?.name || undefined,
    metadados: data,
  };
}

export function LigacoesProvider({ children }: { children: ReactNode }) {
  const realtime = useRealtime();
  const [sessao, setSessao] = useState<EstadoSessao>('OFFLINE');
  const [etapaConectando, setEtapaConectando] = useState<'webrtc' | 'login' | 'aguardando_idle'>('webrtc');

  const [statusConexao, setStatusConexao] = useState<StatusConexao>({
    agenteOnline: false, socketConectado: false, webrtcAtivo: false, sipRegistrado: false,
  });

  const [estadoPagina, setEstadoPagina] = useState<EstadoPaginaLigacao>('IDLE');
  const [tipoLigacao, setTipoLigacao] = useState<TipoLigacao | null>(null);
  const [telefoneIndividual, setTelefoneIndividual] = useState('');
  const [configuracaoCampanha, setConfiguracaoCampanha] = useState<ConfiguracaoCampanha | null>(null);
  const [ligacaoAtiva, setLigacaoAtiva] = useState<LigacaoAtiva | null>(null);
  const [ligacaoEncerrada, setLigacaoEncerrada] = useState<LigacaoAtiva | null>(null);
  const ligacaoAtivaRef = useRef<LigacaoAtiva | null>(null);
  const ligacaoEncerradaRef = useRef<LigacaoAtiva | null>(null);
  // Timer do auto-qualify em modo massa: se o agente nao classificar em 30s,
  // o sistema qualifica com a primeira qualificacao "neutra" para tirar o
  // agente do ACW e o discador mandar a proxima chamada.
  const autoQualifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cache de alunos pre-fetched por telephonyId. Permite ter os dados prontos no
  // momento exato que o discador conecta a chamada ao agente (call-was-connected).
  const alunoCacheRef = useRef<Map<string, Aluno>>(new Map());
  const [eventos, setEventos] = useState<EventoLigacao[]>([]);
  // Qualificacoes da campanha — comeca com mock e e substituido pelos IDs reais
  // do dialer 3C Plus quando o agente entra em modo massa.
  const [qualificacoes, setQualificacoes] = useState<QualificacaoLigacao[]>(qualificacoesMock);
  const [callbackAberto, setCallbackAberto] = useState(false);
  const [negociacaoAberta, setNegociacaoAberta] = useState(false);
  const [ilhaAtiva, setIlhaAtiva] = useState(false);
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [webrtcUrl, setWebrtcUrl] = useState<string | null>(null);

  const cleanupRef = useRef<(() => void) | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const modoAtivo = sessao === 'ONLINE' && (estadoPagina === 'EM_LIGACAO' || estadoPagina === 'QUALIFICACAO');

  // === DEBUG LOG ===
  const log = useCallback((categoria: DebugLog['categoria'], mensagem: string, dados?: unknown) => {
    logCounter++;
    const entry: DebugLog = {
      id: `log-${Date.now()}-${logCounter}`,
      timestamp: new Date().toISOString(),
      categoria,
      mensagem,
      dados,
    };
    setDebugLogs(prev => [...prev, entry]);
    // Also console.log for DevTools
    const prefix = `[3C+ ${categoria.toUpperCase()}]`;
    if (dados) { console.log(prefix, mensagem, dados); }
    else { console.log(prefix, mensagem); }
  }, []);

  function limparDebugLogs() { setDebugLogs([]); }

  function addTimer(fn: () => void, ms: number) {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
    return t;
  }

  function clearAllTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  // Ref para handler mais recente (evita resubscribe no realtime ao trocar tipoLigacao)
  const handlerRef = useRef<((e: EventoLigacao) => void) | null>(null);

  // ─── Realtime: escuta eventos de ligacao vindos do backend worker 24/7 ──
  // O backend emite 'ligacao:evento' com { tipo, data } para cada evento recebido
  // do socket.3c.plus. Frontend nao conecta mais direto ao socket deles.
  useEffect(() => {
    const off = realtime.on<{ tipo: TipoEventoLigacao; data: any }>('ligacao:evento', (payload) => {
      const evento = normalizarEventoRealtime(payload.tipo, payload.data);
      handlerRef.current?.(evento);
    });
    return off;
  }, [realtime]);

  // Reflete estado de conexao do realtime em statusConexao.socketConectado
  useEffect(() => {
    setStatusConexao(prev => ({ ...prev, socketConectado: realtime.conectado }));
  }, [realtime.conectado]);

  // Keep ref in sync with ligacaoAtiva for use in event handlers
  useEffect(() => { ligacaoAtivaRef.current = ligacaoAtiva; }, [ligacaoAtiva]);
  useEffect(() => { ligacaoEncerradaRef.current = ligacaoEncerrada; }, [ligacaoEncerrada]);

  useEffect(() => {
    return () => { cleanupRef.current?.(); clearAllTimers(); };
  }, []);

  // === EVENT HANDLING ===
  const adicionarEvento = useCallback((evento: EventoLigacao) => {
    setEventos(prev => [...prev, evento]);
  }, []);

  // Converte AlunoLigacao (parcial, vindo do endpoint /aluno-por-telefone)
  // para o tipo Aluno completo usado pela UI.
  function adaptarAluno(alunoLig: any): Aluno {
    return {
      codigo: alunoLig.codigo,
      nome: alunoLig.nome,
      cpf: alunoLig.cpf || '',
      celular: alunoLig.celular || undefined,
      email: alunoLig.email || undefined,
      matricula: alunoLig.matricula || '',
      situacaoMatricula: 'AT',
      serasa: alunoLig.serasaAtivo,
      bloquearContatoCrm: false,
      naoEnviarMensagemCobranca: false,
      cursoNome: '',
      financeiro: {
        totalParcelas: 0,
        parcelasEmAtraso: alunoLig.parcelasAtraso,
        parcelasAVencer: 0,
        parcelasPagas: 0,
        parcelasNegociadas: 0,
        parcelasCanceladas: 0,
        valorEmAberto: alunoLig.valorInadimplente,
        valorInadimplente: alunoLig.valorInadimplente,
        valorPago: 0,
      },
      plantoes: [],
      serasaDetalhes: [],
      parcelas: [],
    };
  }

  // Pre-fetch: busca aluno por telefone e coloca no cache (alunoCacheRef) indexado
  // pelo telephonyId da chamada. Usado no call-was-created (modo massa) para ter
  // os dados prontos quando o discador conectar a ligacao ao agente.
  const preFetchAluno = useCallback((telefone: string, callId: string) => {
    if (!telefone || !callId) return;
    real3c.buscarAlunoPorTelefone(telefone).then(alunoLig => {
      if (!alunoLig) return;
      alunoCacheRef.current.set(callId, adaptarAluno(alunoLig));
    }).catch(() => { /* silencioso no pre-fetch */ });
  }, []);

  // Popula ligacaoAtiva com aluno. Usa cache de pre-fetch se disponivel,
  // fallback para fetch imediato. Protege contra race (descarta retorno se
  // a chamada atual nao e mais essa callId).
  const carregarAlunoNaLigacao = useCallback((telefone: string, callId: string) => {
    if (!telefone || !callId) return;

    // Cache hit (pre-fetch ja resolveu)
    const cached = alunoCacheRef.current.get(callId);
    if (cached) {
      log('sistema', `Aluno (cache): ${cached.nome}`, { callId });
      setLigacaoAtiva(prev => (prev && prev.callId === callId
        ? { ...prev, aluno: cached, alunoBuscando: false, alunoNaoEncontrado: false }
        : prev));
      return;
    }

    // Cache miss: busca agora
    setLigacaoAtiva(prev => (prev && prev.callId === callId ? { ...prev, alunoBuscando: true } : prev));
    real3c.buscarAlunoPorTelefone(telefone).then(alunoLig => {
      if (!alunoLig) {
        log('sistema', 'Telefone nao vinculado a aluno SEI', { telefone });
        setLigacaoAtiva(prev => (prev && prev.callId === callId
          ? { ...prev, alunoBuscando: false, alunoNaoEncontrado: true }
          : prev));
        return;
      }
      log('sistema', `Aluno vinculado: ${alunoLig.nome} (${alunoLig.matricula})`, alunoLig);
      const aluno = adaptarAluno(alunoLig);
      alunoCacheRef.current.set(callId, aluno);
      setLigacaoAtiva(prev => (prev && prev.callId === callId
        ? { ...prev, aluno, alunoBuscando: false, alunoNaoEncontrado: false }
        : prev));
    }).catch(err => {
      log('erro', 'Falha ao buscar aluno por telefone', { error: String(err) });
      setLigacaoAtiva(prev => (prev && prev.callId === callId ? { ...prev, alunoBuscando: false } : prev));
    });
  }, [log]);

  const handleEventoSocket = useCallback((evento: EventoLigacao) => {
    adicionarEvento(evento);
    log('socket', `Evento: ${evento.tipo}`, { telefone: evento.telefone, pessoaNome: evento.pessoaNome, metadados: evento.metadados });

    const md: any = evento.metadados || {};
    const call = md.call || {};

    switch (evento.tipo) {
      case 'agent-is-idle':
        log('sistema', 'Agente está IDLE — pronto para chamadas');
        setSessao(prev => prev === 'CONECTANDO_SESSAO' ? 'TESTE_AUDIO' : prev);
        break;

      case 'agent-login-failed':
        log('erro', 'Login na campanha FALHOU via Socket', evento.metadados);
        break;

      case 'agent-was-logged-out':
        // A 3C Plus deslogou o agente da campanha (timeout ACW, kick remoto, etc).
        // Limpa a UI e marca offline da campanha — o agente precisa clicar em
        // "Online" / re-selecionar tipo para voltar a operar.
        log('erro', 'Agente foi DESLOGADO da campanha pela 3C Plus', evento.metadados);
        if (autoQualifyTimerRef.current) {
          clearTimeout(autoQualifyTimerRef.current);
          autoQualifyTimerRef.current = null;
        }
        setStatusConexao(prev => ({ ...prev, agenteOnline: false }));
        setLigacaoAtiva(null);
        setLigacaoEncerrada(null);
        setEstadoPagina('IDLE');
        setTipoLigacao(null);
        setConfiguracaoCampanha(null);
        break;

      case 'call-was-created': {
        const callId = call.telephony_id || call.id || undefined;
        const telefone = evento.telefone || call.phone || '';

        if (tipoLigacao === 'massa') {
          // Modo dialer: o discador dispara varias chamadas em paralelo.
          // NAO popular ligacaoAtiva ainda — so quando call-was-connected (com
          // agent_id nosso) chegar, eh que o agente realmente recebe a chamada.
          // Pre-fetch do aluno no cache para ter os dados prontos nessa hora.
          if (telefone && callId) preFetchAluno(telefone, String(callId));
          setEstadoPagina('EM_LIGACAO');
        } else {
          // Modo click2call (individual): o agente iniciou a chamada, fluxo linear.
          setLigacaoEncerrada(null);
          setLigacaoAtiva({
            id: evento.id,
            callId,
            telefone,
            inicio: evento.timestamp,
            aluno: null,
            status: 'discando',
          });
          // Pre-fetch tambem (mesmo sabendo o aluno, garante consistencia)
          if (telefone && callId) carregarAlunoNaLigacao(telefone, String(callId));
        }
        break;
      }

      case 'call-was-connected': {
        const callId = call.telephony_id || call.id || undefined;
        const telefone = evento.telefone || call.phone || '';

        if (tipoLigacao === 'massa') {
          // Modo dialer: ESTE eh o evento onde o agente recebe a chamada de verdade
          // (o 3C Plus so emite call-was-connected com agent.id quando transfere
          // a chamada pro agente apos AMD). Cria a ligacaoAtiva AQUI.
          setLigacaoEncerrada(null);
          setLigacaoAtiva({
            id: evento.id,
            callId,
            telefone,
            inicio: evento.timestamp,
            aluno: null,
            status: 'conectada',
          });
          // Popula aluno — usa cache de pre-fetch se disponivel, senao busca agora.
          if (telefone && callId) carregarAlunoNaLigacao(telefone, String(callId));
        } else {
          // Modo click2call: rede conectou, celular do destinatario tocando.
          setLigacaoAtiva(prev => prev ? { ...prev, status: 'tocando' } : prev);
        }
        break;
      }

      case 'call-was-answered': {
        if (tipoLigacao === 'massa') {
          // Em modo dialer, call-was-answered eh apenas "audio detectado" — pode
          // ser secretaria eletronica. Ignoramos: so mostramos ligacao quando
          // call-was-connected chegar (quando o discador transfere pro agente).
          break;
        }
        // Modo individual: humano atendeu — conversa comecou.
        setLigacaoAtiva(prev => prev ? { ...prev, status: 'conectada', inicio: evento.timestamp } : prev);
        // Fallback se pre-fetch nao trouxe o aluno
        const atual = ligacaoAtivaRef.current;
        const telefone = evento.telefone || call.phone || '';
        const callId = call.telephony_id || call.id;
        if (telefone && callId && atual && !atual.aluno && !atual.alunoBuscando) {
          carregarAlunoNaLigacao(telefone, String(callId));
        }
        break;
      }

      case 'call-was-hung-up':
      case 'call-was-finished': {
        // Quando o desligamento vem via API (POST /agent/call/:id/hangup),
        // a 3C Plus pula call-was-hung-up e emite direto call-was-finished.
        const callId = call.telephony_id || call.id;
        if (callId) alunoCacheRef.current.delete(String(callId));
        if (tipoLigacao === 'massa') {
          // Massa: salva chamada encerrada para qualificacao inline, limpa ativa,
          // permanece em EM_LIGACAO aguardando proxima chamada do discador
          const prev = ligacaoAtivaRef.current;
          if (prev) {
            setLigacaoEncerrada({ ...prev, status: 'encerrada' });
            // Auto-qualify timer: a 3C Plus desloga o agente da campanha apos
            // ~60s em ACW sem qualificar. Usamos 12s para dar margem de seguranca.
            // Tenta a primeira qualificacao "neutra" (is_positive=false) e cai
            // para a primeira disponivel se nao houver.
            if (autoQualifyTimerRef.current) clearTimeout(autoQualifyTimerRef.current);
            autoQualifyTimerRef.current = setTimeout(async () => {
              const enc = ligacaoEncerradaRef.current;
              if (!enc?.callId) {
                log('sistema', 'Auto-qualify pulado: sem callId');
                autoQualifyTimerRef.current = null;
                return;
              }
              const lista = qualificacoes.length > 0 ? qualificacoes : qualificacoesMock;
              const padrao = lista.find(q => q.is_positive === false) || lista[0];
              if (!padrao) {
                log('erro', 'Auto-qualify pulado: nenhuma qualificacao disponivel');
                autoQualifyTimerRef.current = null;
                return;
              }
              log('sistema', `Auto-qualify (12s): ${padrao.nome} (id=${padrao.id})`);
              const ok = await real3c.qualificarChamada(enc.callId, padrao.id);
              log('http', ok ? `Auto-qualify OK — discador liberado` : `Auto-qualify FALHOU — agente pode ser deslogado da campanha`);
              setLigacaoEncerrada(null);
              autoQualifyTimerRef.current = null;
            }, 12000);
          }
          setLigacaoAtiva(null);
          setIlhaAtiva(false);
        } else {
          // Individual: fluxo original — vai para tela de qualificacao
          setLigacaoAtiva(prev => prev ? { ...prev, status: 'encerrada' } : prev);
          setEstadoPagina(prev => prev === 'EM_LIGACAO' ? 'QUALIFICACAO' : prev);
          setIlhaAtiva(false);
        }
        break;
      }

      case 'call-was-unanswered':
      case 'call-was-abandoned': {
        // Em modo massa, esse evento pode vir de uma chamada paralela que nao
        // chegou a conectar com o agente. Se o callId NAO bate com a ligacaoAtiva
        // atual, apenas limpa o cache de pre-fetch. Caso contrario, limpa a UI.
        const callId = call.telephony_id || call.id;
        if (callId) alunoCacheRef.current.delete(String(callId));
        const atual = ligacaoAtivaRef.current;
        if (atual && callId && atual.callId !== String(callId)) {
          // Chamada abandonada eh de outra tentativa do discador (paralela).
          // Nao mexe na UI.
          break;
        }
        setLigacaoAtiva(null);
        if (tipoLigacao === 'massa') {
          setLigacaoEncerrada(null);
        } else {
          setEstadoPagina('IDLE');
        }
        break;
      }

      default: break;
    }
  }, [adicionarEvento, tipoLigacao, log, preFetchAluno, carregarAlunoNaLigacao, qualificacoes]);

  // Atualiza ref do handler para o ultimo valor, sem resubscrever o realtime.
  useEffect(() => {
    handlerRef.current = handleEventoSocket;
  }, [handleEventoSocket]);

  // === SESSION (WebRTC persistente) ===

  function irOnline() {
    setSessao('CONECTANDO_SESSAO');
    setEtapaConectando('webrtc');
    setStatusConexao(prev => ({ ...prev, webrtcAtivo: true }));
    log('sistema', 'Ativando ramal...');
    ativarWebRTC();
  }

  async function ativarWebRTC() {
    try {
      log('webrtc', 'Solicitando permissao de microfone...');
      await real3c.prepararAudio();

      log('http', 'Carregando config...');
      const configOk = await real3c.carregarConfigDoBackend();
      if (!configOk) { log('erro', 'Falha ao carregar config'); desativarRamal(); return; }
      const cfg = real3c.getConfig();
      log('http', 'Config OK', { extension: cfg.agentExtension });

      const iframeUrl = real3c.getWebRTCUrl();
      setWebrtcUrl(iframeUrl);
      log('webrtc', 'WebRTC montado — aguardando SIP...');

      addTimer(async () => {
        setStatusConexao(prev => ({ ...prev, sipRegistrado: true }));
        log('webrtc', 'SIP registrado');

        // Login automatico na campanha individual
        log('http', 'Login campanha individual...');
        const loginOk = await real3c.loginCampanha('individual');
        if (loginOk) {
          log('http', 'Login OK — pronto para ligar');
          setStatusConexao(prev => ({ ...prev, agenteOnline: true }));
        } else {
          log('erro', 'Login falhou — tente ligar mesmo assim');
        }

        setSessao('ONLINE');
        setEstadoPagina('IDLE');
      }, 18000); // 18s para o iframe WebRTC registrar SIP antes de minimizar
    } catch (error) {
      log('erro', 'Falha ao ativar ramal', { error: String(error) });
      desativarRamal();
    }
  }

  function confirmarAudio() {
    // Mantido para compatibilidade — se TESTE_AUDIO ainda existir
    setSessao('ONLINE');
    setEstadoPagina('IDLE');
  }

  // Parar ligacoes: logout da campanha atual e re-logar na individual.
  // Se houver chamada pendente sem qualificar, qualifica primeiro (com a
  // padrao) para tirar o agente do ACW antes do logout — evita estado preso.
  async function irOffline() {
    log('http', 'Parando ligacoes...');

    if (autoQualifyTimerRef.current) {
      clearTimeout(autoQualifyTimerRef.current);
      autoQualifyTimerRef.current = null;
    }

    const enc = ligacaoEncerradaRef.current;
    if (enc?.callId) {
      const lista = qualificacoes.length > 0 ? qualificacoes : qualificacoesMock;
      const padrao = lista.find(q => q.is_positive === false) || lista[0];
      if (padrao) {
        log('http', `Qualificando pendente antes de sair: ${padrao.nome}`);
        await real3c.qualificarChamada(enc.callId, padrao.id);
      }
    }

    await real3c.logoutCampanha();
    setLigacaoAtiva(null);
    setLigacaoEncerrada(null);
    setEstadoPagina('IDLE');
    setTipoLigacao(null);
    setConfiguracaoCampanha(null);
    setTelefoneIndividual('');
    setIlhaAtiva(false);

    // Re-logar na campanha individual para ficar pronto para click2call
    log('http', 'Re-logando na campanha individual...');
    const loginOk = await real3c.loginCampanha('individual');
    setStatusConexao(prev => ({ ...prev, agenteOnline: loginOk }));
    log('sistema', loginOk ? 'Pronto para novas ligacoes' : 'Re-login falhou — aguarde e tente novamente');
  }

  // Desativa tudo (fim do expediente)
  function desativarRamal() {
    cleanupRef.current?.();
    cleanupRef.current = null;
    clearAllTimers();
    if (autoQualifyTimerRef.current) {
      clearTimeout(autoQualifyTimerRef.current);
      autoQualifyTimerRef.current = null;
    }
    real3c.logoutCampanha();
    log('sistema', 'Ramal desativado — OFFLINE');
    setSessao('OFFLINE');
    setStatusConexao({ agenteOnline: false, socketConectado: false, webrtcAtivo: false, sipRegistrado: false });
    setLigacaoAtiva(null);
    setLigacaoEncerrada(null);
    setEventos([]);
    setEstadoPagina('IDLE');
    setTipoLigacao(null);
    setConfiguracaoCampanha(null);
    setTelefoneIndividual('');
    setCallbackAberto(false);
    setNegociacaoAberta(false);
    setIlhaAtiva(false);
    setWebrtcUrl(null);
  }

  // === CALL ACTIONS ===

  function abrirSeletorTipo() { setEstadoPagina('SELECAO_TIPO'); }

  async function selecionarTipo(tipo: TipoLigacao, telefone?: string) {
    setTipoLigacao(tipo);

    if (tipo === 'individual') {
      // Ja esta logado na campanha individual (login no ativarWebRTC)
      if (telefone) {
        setTelefoneIndividual(telefone);
        setEstadoPagina('EM_LIGACAO');
        log('http', `Click2Call: ${telefone}`);
        real3c.click2call(telefone).then(ok => {
          if (!ok) {
            log('erro', 'Click2Call falhou');
            setEstadoPagina('IDLE');
          }
        });
      } else {
        setEstadoPagina('IDLE');
      }
    } else if (tipo === 'massa') {
      // Logout da individual antes de ir para config da massa
      log('http', 'Logout da campanha individual para preparar massa...');
      await real3c.logoutCampanha();
      setStatusConexao(prev => ({ ...prev, agenteOnline: false }));
      setEstadoPagina('CONFIG_CAMPANHA');
    }
  }

  async function confirmarCampanha(config: ConfiguracaoCampanha) {
    setConfiguracaoCampanha(config);

    // Mostrar tela de ligacao IMEDIATAMENTE (botao parar disponivel)
    setEstadoPagina('EM_LIGACAO');
    log('sistema', 'Preparando campanha de massa...');

    // Carrega as qualificacoes REAIS da campanha (IDs do dialer 3C Plus).
    // Sem isso, qualify falha com ID invalido e o agente fica preso em ACW.
    const cfg = real3c.getConfig();
    const campId = cfg.campaignIdMassa;
    if (campId) {
      real3c.obterQualificacoesCampanha(campId).then(reais => {
        if (reais.length > 0) {
          log('http', `${reais.length} qualificacoes da campanha carregadas`);
          setQualificacoes(reais);
        } else {
          log('erro', 'Sem qualificacoes da campanha — usando mock (qualify pode falhar)');
        }
      });
    }

    const tokenAuth = localStorage.getItem('auth_token');
    const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (tokenAuth) authHeaders['Authorization'] = `Bearer ${tokenAuth}`;

    // 1. Limpar listas anteriores
    try {
      await fetch(`${import.meta.env.VITE_API_URL || '/api'}/segmentacoes/limpar-campanha`, { method: 'POST', headers: authHeaders });
      log('http', 'Listas anteriores removidas');
    } catch (err) {
      log('erro', 'Falha ao limpar listas: ' + String(err));
    }

    // 2. Subir cada segmentacao selecionada
    for (const lista of config.listas) {
      try {
        log('http', `Subindo "${lista.regraNome}"...`);
        const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/segmentacoes/${lista.regraId}/subir-campanha`, {
          method: 'POST', headers: authHeaders,
        });
        const resText = await res.text();
        if (!res.ok) {
          log('erro', `Falha: ${resText.slice(0, 100)}`);
        } else {
          try {
            const result = JSON.parse(resText);
            log('http', `"${lista.regraNome}": ${result.data?.totalSubidos || '?'} contatos`);
          } catch {
            log('http', `"${lista.regraNome}" subida`);
          }
        }
      } catch (err) {
        log('erro', `Excecao: ${String(err)}`);
      }
    }

    // 3. Login na campanha de massa — discador comeca imediatamente
    log('http', 'Logando na campanha de massa...');
    const loginOk = await real3c.loginCampanha('massa');
    if (!loginOk) {
      log('erro', 'Falha no login massa');
      return;
    }
    log('sistema', 'DISCADOR ATIVO — ligacoes em andamento');
    setStatusConexao(prev => ({ ...prev, agenteOnline: true }));
  }

  function voltarParaSelecao() {
    setEstadoPagina('SELECAO_TIPO');
    setTipoLigacao(null);
    setConfiguracaoCampanha(null);
    setTelefoneIndividual('');
  }

  function qualificarLigacao(qualificacao: QualificacaoLigacao) {
    // Usado apenas no modo individual (tela QUALIFICACAO full-page)
    adicionarEvento({
      id: `evt-qual-${Date.now()}`, tipo: 'call-history-was-created', timestamp: new Date().toISOString(),
      qualificacao: qualificacao.nome, telefone: ligacaoAtiva?.telefone, pessoaNome: ligacaoAtiva?.aluno?.nome,
    });
    setLigacaoAtiva(null);
    setEstadoPagina('IDLE');
    setTipoLigacao(null);
    setTelefoneIndividual('');
  }

  // Qualificacao inline no modo massa — nao muda de pagina.
  //
  // CRITICO: ApOs call-was-finished o agente entra em ACW (status 3) na 3C Plus.
  // O discador SO manda nova chamada para agentes IDLE (status 1). O POST
  // /agent/call/{id}/qualify e o que tira o agente do ACW. Sem isso, o discador
  // fica parado e o agente preso "aguardando".
  async function qualificarLigacaoInline(qualificacao: QualificacaoLigacao) {
    const enc = ligacaoEncerradaRef.current || ligacaoEncerrada;
    if (!enc) return;

    // Limpa timer de auto-qualify (se estiver em curso)
    if (autoQualifyTimerRef.current) {
      clearTimeout(autoQualifyTimerRef.current);
      autoQualifyTimerRef.current = null;
    }

    adicionarEvento({
      id: `evt-qual-${Date.now()}`, tipo: 'call-history-was-created', timestamp: new Date().toISOString(),
      qualificacao: qualificacao.nome, telefone: enc.telefone, pessoaNome: enc.aluno?.nome,
    });

    if (enc.callId) {
      log('http', `Qualificando: ${qualificacao.nome}`);
      const ok = await real3c.qualificarChamada(enc.callId, qualificacao.id);
      log('http', ok ? 'Qualify OK — discador liberado' : 'Qualify falhou');
    }
    setLigacaoEncerrada(null);
  }

  function agendarCallback(agendamento: AgendamentoCallback) {
    log('sistema', 'Callback agendado', agendamento);
    setCallbackAberto(false);
  }

  function cancelarChamada() {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setLigacaoAtiva(null);
    setLigacaoEncerrada(null);
    setEstadoPagina('IDLE');
    setTipoLigacao(null);
    setConfiguracaoCampanha(null);
    setTelefoneIndividual('');
  }

  // Desliga a chamada ATIVA na 3C Plus (REST POST /agent/call/{id}/hangup)
  // O socket vai emitir call-was-hung-up em sequencia, que leva ao estado QUALIFICACAO.
  async function desligarChamada() {
    const callId = ligacaoAtiva?.callId;
    if (!callId) {
      log('erro', 'desligarChamada: callId ausente');
      return;
    }
    log('http', `POST /api/ligacoes/hangup/${callId}...`);
    const ok = await real3c.hangup(callId);
    log('http', ok ? 'Hangup OK — aguardando call-was-hung-up' : 'Hangup falhou');
  }

  function minimizarParaIlha() { setIlhaAtiva(true); }
  function voltarDaIlha() { setIlhaAtiva(false); }

  async function iniciarLigacaoComTelefone(telefone: string) {
    if (sessao !== 'ONLINE') {
      log('erro', 'Ramal nao ativo — ative primeiro');
      return;
    }

    if (ligacaoAtiva && ['discando', 'tocando', 'conectada'].includes(ligacaoAtiva.status)) {
      log('erro', 'Ja existe uma chamada em andamento');
      return;
    }

    setTelefoneIndividual(telefone);
    setTipoLigacao('individual');

    // Click2Call direto (agente ja esta logado na campanha individual)
    log('http', `Click2Call: ${telefone}`);
    const ok = await real3c.click2call(telefone);
    if (!ok) {
      log('erro', 'Click2Call falhou');
    } else {
      log('http', 'Click2Call OK');
    }
  }

  return (
    <LigacoesContext.Provider value={{
      sessao, etapaConectando, statusConexao,
      estadoPagina, tipoLigacao, telefoneIndividual, configuracaoCampanha,
      ligacaoAtiva, ligacaoEncerrada, eventos, qualificacoes, modoAtivo,
      callbackAberto, negociacaoAberta, ilhaAtiva, debugLogs, webrtcUrl,
      irOnline, irOffline, desativarRamal, confirmarAudio,
      abrirSeletorTipo, selecionarTipo, confirmarCampanha, voltarParaSelecao,
      setTelefoneIndividual, qualificarLigacao, qualificarLigacaoInline, agendarCallback,
      cancelarChamada, desligarChamada, minimizarParaIlha, voltarDaIlha,
      setCallbackAberto, setNegociacaoAberta, iniciarLigacaoComTelefone,
      limparDebugLogs,
    }}>
      {children}
    </LigacoesContext.Provider>
  );
}
