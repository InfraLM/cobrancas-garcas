import { MessageSquareQuote } from 'lucide-react';

interface BotaoTemplatesProps {
  onClick: () => void;
  desabilitado?: boolean;
}

export default function BotaoTemplates({ onClick, desabilitado }: BotaoTemplatesProps) {
  return (
    <button
      onClick={onClick}
      disabled={desabilitado}
      className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
      title="Inserir template de mensagem"
    >
      <MessageSquareQuote size={18} />
    </button>
  );
}
