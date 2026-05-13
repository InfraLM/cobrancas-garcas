import { useState, useRef, useMemo, type KeyboardEvent } from 'react';
import { Send, Paperclip, Mic, Lock, Image, FileText, Square, X, BadgeCheck, Trash2 } from 'lucide-react';
import BotaoTemplates from './BotaoTemplates';
import ModalSelecionarTemplate from './ModalSelecionarTemplate';
import SelecionarTemplateMetaModal from './SelecionarTemplateMetaModal';
import SeletorCanal from './SeletorCanal';
import type { DadosResolucao } from '../../utils/resolverTemplate';
import type { Aluno } from '../../types/aluno';
import type { InstanciaWhatsappUser } from '../../types';
import type { Mensagem3CPlus, ConversaIrma } from '../../types/conversa';

interface InputMensagemProps {
  onEnviar: (texto: string, interno: boolean, templateWhatsappId?: number | null, instanciaIdOverride?: string, chatIdOverride?: string | number) => void;
  onEnviarArquivo?: (file: File, tipo: 'image' | 'document') => void;
  onEnviarAudio?: (blob: Blob) => void;
  desabilitado?: boolean;
  dadosTemplate?: DadosResolucao;
  // Janela 24h e historico unificado: o calculo correto vem de filtrar
  // mensagens carregadas pelo canal (instanciaTipo) e fromMe=false.
  mensagens?: Mensagem3CPlus[];
  // Conversas "irmas" do mesmo aluno em outras instancias. Permite resolver
  // o chatId correto ao enviar pela instancia selecionada.
  conversasIrmas?: ConversaIrma[];
  chatId?: string | number;  // chatId da conversa ativa (default quando nao ha irma)
  aluno?: Aluno | null;
  onTemplateMetaEnviado?: () => void;
  // Seletor de canal: agente troca entre instâncias vinculadas ao perfil
  instanciasDisponiveis?: InstanciaWhatsappUser[];
  instanciaSelecionada?: string;  // instanciaId da escolhida atualmente
  onTrocarInstancia?: (instanciaId: string) => void;
}

const VINTE_QUATRO_HORAS_MS = 24 * 60 * 60 * 1000;

export default function InputMensagem({
  onEnviar,
  onEnviarArquivo,
  onEnviarAudio,
  desabilitado,
  dadosTemplate,
  mensagens = [],
  conversasIrmas = [],
  chatId,
  aluno,
  onTemplateMetaEnviado,
  instanciasDisponiveis = [],
  instanciaSelecionada,
  onTrocarInstancia,
}: InputMensagemProps) {
  const [texto, setTexto] = useState('');
  const [interno, setInterno] = useState(false);
  const [menuAnexo, setMenuAnexo] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [tempoGravacao, setTempoGravacao] = useState(0);
  // Pre-escuta: ao parar gravacao, em vez de enviar direto, armazena
  // pra agente escutar antes de mandar (igual WhatsApp original).
  const [audioPreview, setAudioPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const [modalTemplateAberto, setModalTemplateAberto] = useState(false);
  const [modalTemplateMetaAberto, setModalTemplateMetaAberto] = useState(false);

  // Tipo do canal selecionado — derivado da instancia escolhida no seletor.
  const instAtual = instanciasDisponiveis.find(i => i.instanciaId === instanciaSelecionada);
  const ehWaba = instAtual?.tipo === 'waba';

  // Resolve a conversa "irma" correspondente a instancia selecionada.
  // Ela contem o chatId correto pra rotear o envio pelo canal escolhido.
  const irmaSelecionada = useMemo(() => {
    if (!instAtual?.tipo) return null;
    return conversasIrmas.find(i => i.instanciaTipo === instAtual.tipo) || null;
  }, [conversasIrmas, instAtual?.tipo]);

  // Calcula janela 24h pela ultima mensagem RECEBIDA via WABA dentro do
  // historico unificado. Cobre tanto a conversa primaria quanto as irmas.
  const ultimaMsgWabaClienteMs = useMemo(() => {
    if (!ehWaba) return 0;
    let max = 0;
    for (const m of mensagens) {
      if (!m.fromMe && m.instanciaTipo === 'waba') {
        const ms = m.timestamp * 1000;
        if (ms > max) max = ms;
      }
    }
    return max;
  }, [mensagens, ehWaba]);

  const janelaFechada = ehWaba && (Date.now() - ultimaMsgWabaClienteMs > VINTE_QUATRO_HORAS_MS);

  // Modo template Meta: pode enviar quando WABA + janela fechada + tem chat (proprio ou irma).
  // O modal usa chatId da irma WABA quando existe, caso contrario do chat primario — a 3C Plus
  // aceita send_template num chat 3C+ existente roteando pela instance_id WABA do body.
  const podeEnviarTemplate = ehWaba && janelaFechada && !!chatId && !!instanciaSelecionada;

  // Tracking de template: setado quando agente seleciona um template no modal.
  // Zera apenas quando o textarea fica completamente vazio (regra acordada).
  // Mensagem enviada com este ID setado eh contabilizada como uso do template,
  // mesmo se o texto foi parcialmente editado.
  const [templateAtivoId, setTemplateAtivoId] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function handleEnviar() {
    const msg = texto.trim();
    if (!msg) return;
    // Notas internas nao tracam template (nao sao mensagem real ao aluno)
    const tplId = interno ? null : templateAtivoId;
    // O instanciaId vem do seletor (fonte da verdade pra qual canal o agente
    // escolheu enviar). Nao usar irmaSelecionada.instanciaId porque o upsertConversa
    // nao atualiza instanciaId quando o canal muda — so instanciaTipo. Resultado
    // seria enviar com instance_id antigo apesar do seletor mostrar outro canal.
    const chatIdRoteado = irmaSelecionada?.chatId ?? chatId;
    onEnviar(msg, interno, tplId, instanciaSelecionada, chatIdRoteado);
    setTexto('');
    setTemplateAtivoId(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEnviar();
    }
  }

  function handleInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  // ─── File upload ───────────────────────────────────────
  function handleImageSelect() {
    setMenuAnexo(false);
    fileInputRef.current?.click();
  }

  function handleDocSelect() {
    setMenuAnexo(false);
    docInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, tipo: 'image' | 'document') {
    const file = e.target.files?.[0];
    if (file && onEnviarArquivo) {
      onEnviarArquivo(file, tipo);
    }
    e.target.value = '';
  }

  // ─── Audio recording ──────────────────────────────────
  async function iniciarGravacao() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        // Mantem o mimetype real do MediaRecorder (audio/webm;codecs=opus em
        // Chrome/Firefox). Nao "renomeia" para audio/ogg porque a Meta WABA
        // e rigorosa e rejeita webm com label de ogg silenciosamente (size=0
        // no response).
        const mimetype = mediaRecorder.mimeType || 'audio/webm;codecs=opus';
        const blob = new Blob(chunksRef.current, { type: mimetype });
        console.log('[Audio] gravacao parada — blob size:', blob.size, 'mimetype:', mimetype);
        if (blob.size > 0) {
          setAudioPreview({ url: URL.createObjectURL(blob), blob });
        }
        chunksRef.current = [];
      };

      mediaRecorder.start(1000);
      setGravando(true);
      setTempoGravacao(0);
      timerRef.current = setInterval(() => setTempoGravacao(t => t + 1), 1000);
    } catch (err) {
      console.error('Erro ao acessar microfone:', err);
    }
  }

  function pararGravacao() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setGravando(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function cancelarGravacao() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current = null;
      };
      mediaRecorderRef.current.stop();
    }
    chunksRef.current = [];
    setGravando(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function formatTempo(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  function handleInserirTemplate(textoResolvido: string, templateId: number) {
    setTexto(textoResolvido);
    setTemplateAtivoId(templateId);
    // Ajusta altura do textarea para mostrar o conteudo inserido
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
        el.focus();
      }
    });
  }

  // ─── Modo WABA com janela 24h fechada — só template aprovado ──
  // Templates Meta exigem instancia WABA oficial (tipo='waba'). Se a `instanciaSelecionada`
  // for whatsapp-3c (canal nao oficial), o send_template falha na 3C Plus com 400 generico.
  // Solucao: aqui sempre forcamos uma instancia WABA disponivel, mesmo que o user
  // tenha selecionado whatsapp-3c para texto livre.
  if (podeEnviarTemplate && !gravando) {
    const irmaEhWaba = irmaSelecionada?.instanciaId
      ? instanciasDisponiveis.find(i => i.instanciaId === irmaSelecionada.instanciaId)?.tipo === 'waba'
      : false;
    const wabaDisponivel = instanciasDisponiveis.find(i => i.tipo === 'waba');
    const chatIdParaTemplate = irmaEhWaba ? irmaSelecionada!.chatId : chatId!;
    // Prioridade: irma WABA (mesmo numero, instancia oficial) > qualquer WABA disponivel
    // > fallback para instanciaSelecionada (backend rejeita se nao for waba).
    const instanciaIdParaTemplate = irmaEhWaba
      ? irmaSelecionada!.instanciaId
      : (wabaDisponivel?.instanciaId ?? instanciaSelecionada!);
    return (
      <>
        <div className="bg-white border-t border-gray-100 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <BadgeCheck size={13} className="text-emerald-600" />
              <p className="text-[0.6875rem] text-gray-600">
                Janela de 24h da WABA fechada. Envie um template aprovado pela Meta.
              </p>
            </div>
            {instanciasDisponiveis.length > 0 && instanciaSelecionada && onTrocarInstancia && (
              <SeletorCanal
                instancias={instanciasDisponiveis}
                selecionadaId={instanciaSelecionada}
                onSelecionar={onTrocarInstancia}
                desabilitado={desabilitado}
              />
            )}
          </div>
          <button
            onClick={() => setModalTemplateMetaAberto(true)}
            disabled={desabilitado}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-[0.875rem] font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <BadgeCheck size={16} />
            Selecione um modelo de mensagem
          </button>
        </div>
        <SelecionarTemplateMetaModal
          aberto={modalTemplateMetaAberto}
          onFechar={() => setModalTemplateMetaAberto(false)}
          chatId={chatIdParaTemplate}
          instanciaId={instanciaIdParaTemplate}
          aluno={aluno}
          onEnviado={onTemplateMetaEnviado}
        />
      </>
    );
  }

  // ─── Recording mode ───────────────────────────────────
  if (gravando) {
    return (
      <div className="bg-white border-t border-gray-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={cancelarGravacao}
            className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Cancelar"
          >
            <X size={18} />
          </button>

          <div className="flex-1 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[0.8125rem] text-gray-700 font-medium">{formatTempo(tempoGravacao)}</span>
            <span className="text-[0.75rem] text-gray-400">Gravando...</span>
          </div>

          <button
            onClick={pararGravacao}
            className="p-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors"
            title="Parar e revisar"
          >
            <Square size={14} fill="white" />
          </button>
        </div>
      </div>
    );
  }

  // ─── Audio preview (pre-escuta antes de enviar) ─────────
  if (audioPreview) {
    return (
      <div className="bg-white border-t border-gray-100">
        <div className="flex items-center gap-2 px-4 py-3">
          <button
            onClick={() => {
              URL.revokeObjectURL(audioPreview.url);
              setAudioPreview(null);
            }}
            className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Descartar áudio"
          >
            <Trash2 size={16} />
          </button>
          <audio src={audioPreview.url} controls className="flex-1 h-9" />
          <button
            onClick={() => {
              if (onEnviarAudio) onEnviarAudio(audioPreview.blob);
              URL.revokeObjectURL(audioPreview.url);
              setAudioPreview(null);
            }}
            disabled={desabilitado}
            className="p-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
            title="Enviar áudio"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-t border-gray-100">
      {/* Seletor de canal no modo de digitacao normal */}
      {instanciasDisponiveis.length > 1 && instanciaSelecionada && onTrocarInstancia && (
        <div className="flex items-center justify-end px-4 pt-2">
          <SeletorCanal
            instancias={instanciasDisponiveis}
            selecionadaId={instanciaSelecionada}
            onSelecionar={onTrocarInstancia}
            desabilitado={desabilitado}
          />
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileChange(e, 'image')}
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar"
        className="hidden"
        onChange={(e) => handleFileChange(e, 'document')}
      />

      {/* Internal note toggle */}
      {interno && (
        <div className="flex items-center gap-1.5 px-4 pt-2 pb-0">
          <Lock size={11} className="text-amber-500" />
          <span className="text-[0.625rem] font-medium text-amber-600">Nota interna — não será enviada ao contato</span>
        </div>
      )}

      <div className="flex items-end gap-2 px-4 py-3">
        {/* Attachment button */}
        <div className="relative">
          <button
            onClick={() => setMenuAnexo(!menuAnexo)}
            disabled={desabilitado}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
            title="Anexar arquivo"
          >
            <Paperclip size={18} />
          </button>

          {menuAnexo && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuAnexo(false)} />
              <div className="absolute bottom-full left-0 mb-1 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20 w-40">
                <button
                  onClick={handleImageSelect}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[0.75rem] text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Image size={14} className="text-gray-400" />
                  Imagem
                </button>
                <button
                  onClick={handleDocSelect}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[0.75rem] text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <FileText size={14} className="text-gray-400" />
                  Documento
                </button>
              </div>
            </>
          )}
        </div>

        {/* Template button */}
        {dadosTemplate && (
          <BotaoTemplates
            onClick={() => setModalTemplateAberto(true)}
            desabilitado={desabilitado}
          />
        )}

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={(e) => {
              const novo = e.target.value;
              setTexto(novo);
              // Apagou tudo? Considera que o template foi descartado.
              if (novo.length === 0 && templateAtivoId !== null) setTemplateAtivoId(null);
            }}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            disabled={desabilitado}
            placeholder={interno ? 'Escreva uma nota interna...' : 'Digite uma mensagem...'}
            rows={1}
            className={`w-full resize-none rounded-xl px-4 py-2.5 text-[0.8125rem] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 transition-colors ${
              interno
                ? 'bg-amber-50 border border-amber-200 focus:ring-amber-300 focus:border-amber-300'
                : 'bg-gray-50 border border-gray-100 focus:ring-gray-300 focus:border-gray-300'
            } disabled:opacity-40`}
            style={{ maxHeight: '120px' }}
          />
        </div>

        {/* Internal note toggle button */}
        <button
          onClick={() => setInterno(!interno)}
          disabled={desabilitado}
          title={interno ? 'Voltar para mensagem normal' : 'Enviar como nota interna'}
          className={`p-2 rounded-lg transition-colors disabled:opacity-40 ${
            interno
              ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Lock size={18} />
        </button>

        {/* Audio button */}
        <button
          onClick={iniciarGravacao}
          disabled={desabilitado}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
          title="Gravar áudio"
        >
          <Mic size={18} />
        </button>

        {/* Send button */}
        <button
          onClick={handleEnviar}
          disabled={desabilitado || !texto.trim()}
          className={`p-2.5 rounded-xl transition-colors disabled:opacity-30 ${
            interno
              ? 'bg-amber-500 text-white hover:bg-amber-600'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}
          title="Enviar"
        >
          <Send size={16} />
        </button>
      </div>

      {/* Modal de templates */}
      {dadosTemplate && (
        <ModalSelecionarTemplate
          aberto={modalTemplateAberto}
          onFechar={() => setModalTemplateAberto(false)}
          onInserir={handleInserirTemplate}
          dados={dadosTemplate}
        />
      )}
    </div>
  );
}
