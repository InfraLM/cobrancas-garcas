import { Phone, ExternalLink, Copy } from 'lucide-react';
import type { Componente, ComponenteHeader, ComponenteBody, ComponenteFooter, ComponenteButtons, Botao } from '../../types/templateMeta';

interface Props {
  components: Componente[];
  /** Valores das variaveis para substituir nos placeholders */
  variaveis?: Record<string, string>;
  /** Renderiza dentro de um mockup completo de tela WhatsApp ou apenas a bolha */
  comMockup?: boolean;
}

// Renderiza preview de um template Meta como o aluno verá no WhatsApp.
// Aplica formatação Meta (bold, italic, strike), substitui variáveis,
// renderiza botões e mídia placeholder.
export default function TemplateMetaPreview({ components, variaveis = {}, comMockup = true }: Props) {
  const header = components.find(c => c.type === 'HEADER') as ComponenteHeader | undefined;
  const body = components.find(c => c.type === 'BODY') as ComponenteBody | undefined;
  const footer = components.find(c => c.type === 'FOOTER') as ComponenteFooter | undefined;
  const buttonsComp = components.find(c => c.type === 'BUTTONS') as ComponenteButtons | undefined;

  function resolverTexto(texto: string): string {
    return texto.replace(/\{\{(\d+)\}\}/g, (_m, num) => {
      const val = variaveis[num];
      return val !== undefined ? val : '[Var ' + num + ']';
    });
  }

  const bolha = (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden max-w-sm">
      {header && header.format === 'TEXT' && header.text && (
        <div className="px-3 pt-2.5 text-[0.875rem] font-semibold text-gray-900">
          {resolverTexto(header.text)}
        </div>
      )}
      {header && header.format === 'IMAGE' && (
        <div className="aspect-video bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-400 text-[0.75rem]">
          📷 Imagem
        </div>
      )}
      {header && header.format === 'VIDEO' && (
        <div className="aspect-video bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-gray-100 text-[0.75rem]">
          ▶ Vídeo
        </div>
      )}
      {header && header.format === 'DOCUMENT' && (
        <div className="bg-gray-100 px-3 py-2.5 flex items-center gap-2 text-[0.75rem] text-gray-700 border-b border-gray-200">
          📄 documento.pdf
        </div>
      )}

      {body && body.text && (
        <div className="px-3 pt-2 pb-1 text-[0.8125rem] text-gray-900 whitespace-pre-wrap leading-relaxed">
          {renderizarFormatacao(resolverTexto(body.text))}
        </div>
      )}

      {footer && footer.text && (
        <div className="px-3 pb-2 text-[0.6875rem] text-gray-500">
          {footer.text}
        </div>
      )}

      <div className="px-3 pb-1.5 text-right text-[0.625rem] text-gray-400">12:34</div>

      {buttonsComp && buttonsComp.buttons.length > 0 && (
        <div className="border-t border-gray-200 divide-y divide-gray-200">
          {buttonsComp.buttons.map((btn, i) => (
            <BotaoVisual key={i} botao={btn} />
          ))}
        </div>
      )}
    </div>
  );

  if (!comMockup) return bolha;

  return (
    <div className="bg-[#e5ddd5] rounded-xl p-4 min-h-[480px] flex flex-col items-center justify-start gap-2 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.15) 1px, transparent 0)',
        backgroundSize: '20px 20px',
      }} />
      <div className="text-[0.6875rem] text-gray-600 font-medium uppercase tracking-wider mt-1 mb-2 relative z-10">
        Preview · WhatsApp
      </div>
      <div className="relative z-10 w-full flex justify-start">
        {bolha}
      </div>
    </div>
  );
}

function BotaoVisual({ botao }: { botao: Botao }) {
  const baseClass = 'flex items-center justify-center gap-1.5 py-2.5 text-[0.8125rem] font-medium text-blue-600 bg-white hover:bg-gray-50 transition-colors w-full';
  if (botao.type === 'QUICK_REPLY') {
    return <div className={baseClass}>{botao.text}</div>;
  }
  if (botao.type === 'URL') {
    return (
      <div className={baseClass}>
        <ExternalLink size={13} />
        {botao.text}
      </div>
    );
  }
  if (botao.type === 'PHONE_NUMBER') {
    return (
      <div className={baseClass}>
        <Phone size={13} />
        {botao.text}
      </div>
    );
  }
  if (botao.type === 'COPY_CODE') {
    return (
      <div className={baseClass}>
        <Copy size={13} />
        {botao.text}
      </div>
    );
  }
  return null;
}

// Renderiza formatação Meta: *bold*, _italic_, ~strike~
// (mono com backticks fica fora pra simplicidade — pouco usado em templates)
function renderizarFormatacao(texto: string): React.ReactNode {
  const partes: React.ReactNode[] = [];
  const regex = /(\*[^*\n]+\*)|(_[^_\n]+_)|(~[^~\n]+~)/g;
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(texto)) !== null) {
    if (match.index > lastIndex) partes.push(texto.slice(lastIndex, match.index));
    const tok = match[0];
    if (tok.startsWith('*')) {
      partes.push(<strong key={key++}>{tok.slice(1, -1)}</strong>);
    } else if (tok.startsWith('_')) {
      partes.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    } else if (tok.startsWith('~')) {
      partes.push(<span key={key++} className="line-through">{tok.slice(1, -1)}</span>);
    }
    lastIndex = match.index + tok.length;
  }
  if (lastIndex < texto.length) partes.push(texto.slice(lastIndex));
  return partes.length <= 1 ? partes[0] || texto : <>{partes}</>;
}
