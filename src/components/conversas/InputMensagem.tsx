import { useState, useRef, type KeyboardEvent } from 'react';
import { Send, Paperclip, Mic, Lock, Image, FileText, Square, X } from 'lucide-react';
import BotaoTemplates from './BotaoTemplates';
import ModalSelecionarTemplate from './ModalSelecionarTemplate';
import type { DadosResolucao } from '../../utils/resolverTemplate';

interface InputMensagemProps {
  onEnviar: (texto: string, interno: boolean, templateWhatsappId?: number | null) => void;
  onEnviarArquivo?: (file: File, tipo: 'image' | 'document') => void;
  onEnviarAudio?: (blob: Blob) => void;
  desabilitado?: boolean;
  dadosTemplate?: DadosResolucao;
}

export default function InputMensagem({
  onEnviar,
  onEnviarArquivo,
  onEnviarAudio,
  desabilitado,
  dadosTemplate,
}: InputMensagemProps) {
  const [texto, setTexto] = useState('');
  const [interno, setInterno] = useState(false);
  const [menuAnexo, setMenuAnexo] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [tempoGravacao, setTempoGravacao] = useState(0);
  const [modalTemplateAberto, setModalTemplateAberto] = useState(false);
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
    onEnviar(msg, interno, tplId);
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
        const blob = new Blob(chunksRef.current, { type: 'audio/ogg; codecs=opus' });
        if (onEnviarAudio && blob.size > 0) {
          onEnviarAudio(blob);
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
            title="Enviar áudio"
          >
            <Square size={14} fill="white" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-t border-gray-100">
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
