import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ConversaCobranca, ConversaIrma, Mensagem3CPlus, MotivoEncerramento } from '../types/conversa';
import type { Aluno } from '../types/aluno';
import { obterAluno } from '../services/alunos';
import ListaChats from '../components/conversas/ListaChats';
import HeaderChat from '../components/conversas/HeaderChat';
import AreaMensagens from '../components/conversas/AreaMensagens';
import InputMensagem from '../components/conversas/InputMensagem';
import PainelAluno from '../components/conversas/PainelAluno';
import ModalEncerrarConversa from '../components/conversas/ModalEncerrarConversa';
import { MessageSquare, Radio, Plus, Loader2, X } from 'lucide-react';
import * as conversasService from '../services/conversas3cplus';
import * as conversasCobrancaService from '../services/conversasCobranca';
import { listarInstanciasUser } from '../services/users';
import type { InstanciaWhatsappUser } from '../types';
import { useRealtime } from '../contexts/RealtimeContext';
import { useAuth } from '../contexts/AuthContext';



export default function ConversasPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const AGENTE_ID_LOGADO = user?.threecplusAgentId ?? user?.id ?? 0;
  const AGENTE_NOME_LOGADO = user?.nome ?? 'Agente';
  const realtime = useRealtime();
  const [conversas, setConversas] = useState<ConversaCobranca[]>([]);
  const [conversaAtiva, setConversaAtiva] = useState<ConversaCobranca | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem3CPlus[]>([]);
  // Conversas irmas do mesmo aluno (mesma pessoa em outras instancias).
  // Permite roteamento correto do envio + calculo de janela 24h.
  const [conversasIrmas, setConversasIrmas] = useState<ConversaIrma[]>([]);
  const [painelAlunoAberto, setPainelAlunoAberto] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [modalEncerrar, setModalEncerrar] = useState(false);
  const [modalNovaConversa, setModalNovaConversa] = useState(false);
  const [novoTelefone, setNovoTelefone] = useState('');

  // Refs para handlers de realtime que precisam de leitura sincrona do state atual.
  const conversaAtivaRef = useRef(conversaAtiva);
  conversaAtivaRef.current = conversaAtiva;
  // Realtime cross-chat: msgs do mesmo aluno chegam em chatIds distintos (3C+ vs WABA).
  // Handler precisa saber quais chatIds das irmas sao aceitos no historico unificado.
  const conversasIrmasRef = useRef<ConversaIrma[]>([]);
  conversasIrmasRef.current = conversasIrmas;

  const [alunoVinculado, setAlunoVinculado] = useState<Aluno | null>(null);
  const alunoCache = useRef<Record<number, Aluno>>({});

  // Instancias vinculadas ao agente logado (seletor de canal no rodape do chat)
  const [instanciasDisponiveis, setInstanciasDisponiveis] = useState<InstanciaWhatsappUser[]>([]);
  const [instanciaSelecionada, setInstanciaSelecionada] = useState<string>('');

  useEffect(() => {
    if (!user?.id) { setInstanciasDisponiveis([]); return; }
    listarInstanciasUser(user.id)
      .then(setInstanciasDisponiveis)
      .catch(() => setInstanciasDisponiveis([]));
  }, [user?.id]);

  // Quando troca de conversa, sincroniza o seletor com a instancia da conversa
  useEffect(() => {
    if (conversaAtiva?.instanciaId) setInstanciaSelecionada(conversaAtiva.instanciaId);
  }, [conversaAtiva?.id, conversaAtiva?.instanciaId]);

  useEffect(() => {
    const codigo = conversaAtiva?.pessoaCodigo;
    if (!codigo) { setAlunoVinculado(null); return; }

    // Cache hit: mostrar imediato
    if (alunoCache.current[codigo]) {
      setAlunoVinculado(alunoCache.current[codigo]);
      return;
    }

    // Cache miss: buscar e cachear
    setAlunoVinculado(null);
    obterAluno(codigo).then(a => {
      const aluno = a as Aluno;
      alunoCache.current[codigo] = aluno;
      setAlunoVinculado(aluno);
    }).catch(() => setAlunoVinculado(null));
  }, [conversaAtiva?.pessoaCodigo]);

  // ─── Carregar conversas iniciais ─────────────────────────
  const carregarConversas = useCallback(async () => {
    try {
      const filtros: Record<string, string> = {};
      if (user?.instanciaWhatsappId && user.role !== 'ADMIN') {
        filtros.instanciaId = user.instanciaWhatsappId;
      }
      const lista = await conversasCobrancaService.listarConversas(filtros);
      setConversas(lista);
    } catch (err) {
      console.error('[ConversasPage] Erro ao listar:', err);
    } finally {
      setCarregando(false);
    }
  }, [user]);

  useEffect(() => {
    carregarConversas();
  }, [carregarConversas]);

  // Funcao para abrir nova conversa por telefone
  const abrirNovaConversa = useCallback(async (telefone: string) => {
    try {
      setCarregando(true);
      await conversasService.abrirChatNovo(telefone);
      // Worker cria ConversaCobranca e emite conversa:atualizada via realtime
      // A nova conversa aparece automaticamente via onConversaAtualizada
    } catch (err) {
      console.error('[ConversasPage] Erro ao abrir chat:', err);
      alert(err instanceof Error ? err.message : 'Erro ao abrir conversa');
    } finally {
      setCarregando(false);
    }
  }, []);

  // Abrir chat quando vem de outra pagina com ?telefone=
  const telefoneProcessado = useRef('');
  useEffect(() => {
    const telefone = searchParams.get('telefone');
    if (!telefone || telefoneProcessado.current === telefone) return;
    telefoneProcessado.current = telefone;
    setSearchParams({}, { replace: true });
    abrirNovaConversa(telefone);
  }, [searchParams, setSearchParams, abrirNovaConversa]);

  // ─── Realtime: inscricao nos eventos globais (provider gerencia conexao) ──
  useEffect(() => {
    const onMensagemNova = (payload: { mensagem: any; conversa: ConversaCobranca }) => {
      const { conversa } = payload;

      // Atualiza a lista de conversas (upsert)
      setConversas(prev => {
        const idx = prev.findIndex(c => c.id === conversa.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = conversa;
          return next;
        }
        return [conversa, ...prev];
      });

      // Se a mensagem pertence a conversa ativa OU a uma das irmas do mesmo aluno
      // (historico unificado), adiciona ou atualiza (para ack)
      const ativa = conversaAtivaRef.current;
      const chatIdsAceitos = ativa
        ? new Set([ativa.chatId, ...conversasIrmasRef.current.map(i => i.chatId)])
        : new Set<string>();
      if (ativa && chatIdsAceitos.has(conversa.chatId)) {
        // Mensagem nova chegou em chat ja aberto pelo agente — marca como lida
        // imediatamente. Mantem o badge visualmente em zero (idempotente).
        const msgFromMe = payload.mensagem?.fromMe ?? false;
        if (!msgFromMe && conversa.naoLidos > 0) {
          setConversas(prev => prev.map(x => x.id === conversa.id ? { ...x, naoLidos: 0 } : x));
          conversasCobrancaService.marcarLido(conversa.id).catch(() => {});
        }
        const msg = payload.mensagem;
        const idReal = msg.mensagemExternaId || msg.id;
        const normalizada: Mensagem3CPlus = {
          id: idReal,
          chatId: String(msg.chatId || conversa.chatId),
          tipo: msg.tipo || 'chat',
          corpo: msg.corpo || '',
          mediaUrl: msg.mediaUrl || null,
          mediaNome: msg.mediaNome || null,
          fromMe: msg.fromMe ?? false,
          agenteId: msg.agenteId || null,
          agenteNome: msg.agenteNome || null,
          timestamp: Math.floor(new Date(msg.timestamp).getTime() / 1000),
          ack: msg.ack || null,
          interno: false,
          deletado: false,
          templateWhatsappId: msg.templateWhatsappId ?? null,
          templateMetaId: msg.templateMetaId ?? null,
          templateMetaNome: msg.templateMetaNome ?? null,
          instanciaTipo: msg.instanciaTipo ?? null,
        };
        setMensagens(prev => {
          const idx = prev.findIndex(m => m.id === idReal);
          if (idx >= 0) {
            // Atualiza (geralmente para ack)
            const next = [...prev];
            next[idx] = { ...next[idx], ...normalizada };
            return next;
          }
          // Tenta substituir optimistic pelo id real (match por texto + fromMe + tempo proximo)
          if (normalizada.fromMe && normalizada.corpo) {
            const optIdx = prev.findIndex(m =>
              m.id.startsWith('optimistic-') &&
              m.fromMe &&
              m.corpo === normalizada.corpo &&
              Math.abs(m.timestamp - normalizada.timestamp) < 30
            );
            if (optIdx >= 0) {
              const next = [...prev];
              next[optIdx] = normalizada;
              return next;
            }
          }
          return [...prev, normalizada];
        });
      }
    };

    const onConversaAtualizada = (conversa: ConversaCobranca) => {
      setConversas(prev => {
        const idx = prev.findIndex(c => c.id === conversa.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = conversa;
          return next;
        }
        return [conversa, ...prev];
      });

      // Se a conversa atualizada e do mesmo aluno da conversa ativa, mantem irmas
      // atualizadas — cobre o caso de agente ter clicado "Iniciar via WABA" e o
      // worker ter persistido a nova conversa: ela vira irma da ativa e o seletor
      // passa a roteia mensagens corretamente.
      const ativa = conversaAtivaRef.current;
      if (ativa && conversa.id !== ativa.id) {
        const mesmoAluno = ativa.pessoaCodigo
          ? ativa.pessoaCodigo === conversa.pessoaCodigo
          : ativa.contatoNumero === conversa.contatoNumero;
        if (mesmoAluno) {
          setConversasIrmas(prev => {
            const idx = prev.findIndex(i => i.id === conversa.id);
            const irma: ConversaIrma = {
              id: conversa.id,
              chatId: conversa.chatId,
              instanciaId: conversa.instanciaId,
              instanciaTipo: conversa.instanciaTipo,
              ultimaMensagemCliente: conversa.ultimaMensagemCliente,
            };
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = irma;
              return next;
            }
            return [...prev, irma];
          });
        }
      }
      if (conversaAtivaRef.current?.id === conversa.id) {
        setConversaAtiva(conversa);
      }
    };

    const off1 = realtime.on('mensagem:nova', onMensagemNova);
    const off2 = realtime.on('conversa:atualizada', onConversaAtualizada);

    return () => {
      off1();
      off2();
    };
  }, [realtime]);

  // ─── Selecionar conversa → carregar mensagens do banco ───
  const handleSelecionar = useCallback(async (c: ConversaCobranca) => {
    setConversaAtiva(c);
    setMensagens([]);
    setConversasIrmas([]);

    // Zera contador de nao lidas no servidor + update otimista local
    if (c.naoLidos > 0) {
      setConversas(prev => prev.map(x => x.id === c.id ? { ...x, naoLidos: 0 } : x));
      conversasCobrancaService.marcarLido(c.id).catch(err => {
        console.error('[ConversasPage] Erro ao marcar como lido:', err);
      });
    }

    try {
      const { mensagens: msgs, conversasIrmas: irmas } = await conversasCobrancaService.obterConversa(c.id);
      setConversasIrmas(irmas || []);
      const normalizadas: Mensagem3CPlus[] = msgs.map((m: any) => ({
        id: m.mensagemExternaId || m.id,
        chatId: String(m.chatId),
        tipo: m.tipo || 'chat',
        corpo: m.corpo || '',
        mediaUrl: m.mediaUrl || null,
        mediaNome: m.mediaNome || null,
        fromMe: m.fromMe ?? false,
        agenteId: m.agenteId || null,
        agenteNome: m.agenteNome || null,
        timestamp: Math.floor(new Date(m.timestamp).getTime() / 1000),
        ack: m.ack || null,
        mensagemCitada: m.mensagemCitadaCorpo ? { corpo: m.mensagemCitadaCorpo, id: m.mensagemCitadaId } : undefined,
        interno: false,
        deletado: false,
        templateWhatsappId: m.templateWhatsappId ?? null,
        templateMetaId: m.templateMetaId ?? null,
        templateMetaNome: m.templateMetaNome ?? null,
        instanciaTipo: m.instanciaTipo ?? null,
      }));
      normalizadas.sort((a, b) => a.timestamp - b.timestamp);
      setMensagens(normalizadas);
    } catch (err) {
      console.error('[ConversasPage] Erro ao carregar mensagens:', err);
    }
  }, []);

  // ─── Ações da conversa ───────────────────────────────────
  const handleAssumir = useCallback(async () => {
    if (!conversaAtiva) return;
    try {
      const c = await conversasCobrancaService.assumirConversa(conversaAtiva.id, AGENTE_ID_LOGADO, AGENTE_NOME_LOGADO);
      setConversaAtiva(c);
    } catch (err) {
      console.error('[ConversasPage] Erro ao assumir:', err);
    }
  }, [conversaAtiva]);

  const handleEncerrar = useCallback(async (motivo: MotivoEncerramento, observacao: string) => {
    if (!conversaAtiva) return;
    try {
      const c = await conversasCobrancaService.encerrarConversa(conversaAtiva.id, motivo, observacao);
      setConversaAtiva(c);
    } catch (err) {
      console.error('[ConversasPage] Erro ao encerrar:', err);
    }
  }, [conversaAtiva]);

  const handleSnooze = useCallback(async () => {
    if (!conversaAtiva) return;
    // Simples: adia 4h. Futuro: modal com opções.
    const reativarEm = new Date(Date.now() + 4 * 60 * 60 * 1000);
    try {
      const c = await conversasCobrancaService.snoozeConversa(conversaAtiva.id, reativarEm);
      setConversaAtiva(c);
    } catch (err) {
      console.error('[ConversasPage] Erro ao snooze:', err);
    }
  }, [conversaAtiva]);

  // ─── Envio de mensagens ──────────────────────────────────
  const handleEnviarMensagem = useCallback((
    texto: string,
    interno: boolean,
    templateWhatsappId?: number | null,
    instanciaIdOverride?: string,
    chatIdOverride?: string | number,
  ) => {
    if (!conversaAtiva) return;
    const inst = instanciaIdOverride || instanciaSelecionada || conversaAtiva.instanciaId;
    // chatId roteado vem do InputMensagem quando troca de canal: usa o chatId
    // da conversa "irma" da instancia selecionada (e nao o da conversa primaria).
    const chat = chatIdOverride ?? conversaAtiva.chatId;
    const promise = interno
      ? conversasService.enviarInterno(String(chat), texto)
      : conversasService.enviarTexto(String(chat), texto, inst, templateWhatsappId);

    const optimistic: Mensagem3CPlus = {
      id: `optimistic-${Date.now()}`,
      chatId: conversaAtiva.chatId,
      tipo: interno ? 'internal-message' : 'chat',
      corpo: texto,
      mediaUrl: null,
      mediaNome: null,
      fromMe: true,
      agenteId: AGENTE_ID_LOGADO,
      agenteNome: AGENTE_NOME_LOGADO,
      timestamp: Math.floor(Date.now() / 1000),
      ack: null,
      interno,
      deletado: false,
    };
    setMensagens(prev => [...prev, optimistic]);

    promise.catch((err) => console.error('[ConversasPage] Erro ao enviar:', err));
  }, [conversaAtiva, instanciaSelecionada]);

  const handleEnviarArquivo = useCallback((file: File, tipo: 'image' | 'document') => {
    if (!conversaAtiva) return;
    const inst = instanciaSelecionada || conversaAtiva.instanciaId;
    const promise = tipo === 'image'
      ? conversasService.enviarImagem(conversaAtiva.chatId, file, inst)
      : conversasService.enviarDocumento(conversaAtiva.chatId, file, inst);

    const optimistic: Mensagem3CPlus = {
      id: `optimistic-file-${Date.now()}`,
      chatId: conversaAtiva.chatId,
      tipo: tipo === 'image' ? 'image' : 'document',
      corpo: '',
      mediaUrl: URL.createObjectURL(file),
      mediaNome: file.name,
      fromMe: true,
      agenteId: AGENTE_ID_LOGADO,
      agenteNome: AGENTE_NOME_LOGADO,
      timestamp: Math.floor(Date.now() / 1000),
      ack: null,
      interno: false,
      deletado: false,
    };
    setMensagens(prev => [...prev, optimistic]);
    promise.catch((err) => console.error('[ConversasPage] Erro ao enviar arquivo:', err));
  }, [conversaAtiva, instanciaSelecionada]);

  const handleEnviarAudio = useCallback((blob: Blob) => {
    if (!conversaAtiva) return;
    const inst = instanciaSelecionada || conversaAtiva.instanciaId;
    const optimistic: Mensagem3CPlus = {
      id: `optimistic-audio-${Date.now()}`,
      chatId: conversaAtiva.chatId,
      tipo: 'audio',
      corpo: '',
      mediaUrl: URL.createObjectURL(blob),
      mediaNome: 'audio.ogg',
      fromMe: true,
      agenteId: AGENTE_ID_LOGADO,
      agenteNome: AGENTE_NOME_LOGADO,
      timestamp: Math.floor(Date.now() / 1000),
      ack: null,
      interno: false,
      deletado: false,
    };
    setMensagens(prev => [...prev, optimistic]);
    conversasService.enviarAudio(conversaAtiva.chatId, blob, inst)
      .catch((err) => console.error('[ConversasPage] Erro ao enviar áudio:', err));
  }, [conversaAtiva, instanciaSelecionada]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden -mx-6 -mb-6">
      {/* Left column */}
      <div className="w-[280px] shrink-0 flex flex-col">
        <div className="flex items-center justify-between px-4 pt-3 pb-1 bg-white border-r border-gray-100">
          <span className={`flex items-center gap-1 text-[0.625rem] ${
            realtime.conectado ? 'text-emerald-500' : 'text-gray-400'
          }`}>
            <Radio size={10} className={realtime.conectado ? 'animate-pulse' : ''} />
            {realtime.conectado ? 'Tempo real ativo' : 'Conectando...'}
          </span>
          <button
            onClick={() => setModalNovaConversa(true)}
            title="Nova conversa"
            className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <Plus size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Mini-modal nova conversa */}
        {modalNovaConversa && (
          <div className="px-3 py-2 bg-white border-r border-b border-gray-100">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={novoTelefone}
                onChange={e => setNovoTelefone(e.target.value)}
                placeholder="DDD + numero (ex: 62991088407)"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && novoTelefone.replace(/\D/g, '').length >= 10) {
                    abrirNovaConversa(novoTelefone.replace(/\D/g, ''));
                    setNovoTelefone('');
                    setModalNovaConversa(false);
                  }
                }}
                className="flex-1 h-8 px-3 rounded-lg bg-gray-50 border border-gray-200 text-[0.75rem] text-on-surface placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
              />
              <button
                onClick={() => {
                  const digits = novoTelefone.replace(/\D/g, '');
                  if (digits.length >= 10) {
                    abrirNovaConversa(digits);
                    setNovoTelefone('');
                    setModalNovaConversa(false);
                  }
                }}
                disabled={novoTelefone.replace(/\D/g, '').length < 10}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-white disabled:opacity-30 hover:bg-primary-container transition-colors"
              >
                <MessageSquare size={14} />
              </button>
              <button
                onClick={() => { setModalNovaConversa(false); setNovoTelefone(''); }}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {carregando ? (
          <div className="flex-1 flex items-center justify-center bg-white border-r border-gray-100">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <ListaChats
              conversas={conversas}
              conversaAtivaId={conversaAtiva?.id ?? null}
              onSelecionar={handleSelecionar}
              agenteIdLogado={AGENTE_ID_LOGADO}
            />
          </div>
        )}
      </div>

      {/* Center column */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#f0ede8]">
        {conversaAtiva ? (
          <>
            <HeaderChat
              conversa={conversaAtiva}
              agenteLogadoId={AGENTE_ID_LOGADO}
              onAssumir={handleAssumir}
              onTransferir={() => {
                // TODO: abrir modal de transferência
                console.log('Transferir — modal não implementado ainda');
              }}
              onEncerrar={() => setModalEncerrar(true)}
              onSnooze={handleSnooze}
              onTogglePainelAluno={() => setPainelAlunoAberto(prev => !prev)}
              painelAlunoAberto={painelAlunoAberto}
            />
            <AreaMensagens mensagens={mensagens} carregando={false} />
            <InputMensagem
              onEnviar={handleEnviarMensagem}
              onEnviarArquivo={handleEnviarArquivo}
              onEnviarAudio={handleEnviarAudio}
              desabilitado={conversaAtiva.status === 'ENCERRADA'}
              dadosTemplate={{
                aluno: alunoVinculado,
                conversa: conversaAtiva,
                agente: user,
              }}
              mensagens={mensagens}
              conversasIrmas={conversasIrmas}
              chatId={conversaAtiva.chatId}
              aluno={alunoVinculado}
              instanciasDisponiveis={instanciasDisponiveis}
              instanciaSelecionada={instanciaSelecionada}
              onTrocarInstancia={setInstanciaSelecionada}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-white/60 flex items-center justify-center">
              <MessageSquare size={28} className="text-gray-300" />
            </div>
            <div className="text-center">
              <p className="text-[0.9375rem] font-medium text-gray-500">Selecione uma conversa</p>
              <p className="text-[0.75rem] text-gray-400 mt-1">
                Novas mensagens chegam em tempo real
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right column */}
      {conversaAtiva && painelAlunoAberto && (
        <div className="w-[340px] shrink-0">
          <PainelAluno
            aluno={alunoVinculado}
            contatoNumero={conversaAtiva.contatoNumero}
            onFechar={() => setPainelAlunoAberto(false)}
          />
        </div>
      )}

      {/* Modal encerrar */}
      <ModalEncerrarConversa
        aberto={modalEncerrar}
        onFechar={() => setModalEncerrar(false)}
        onConfirmar={handleEncerrar}
      />
    </div>
  );
}
