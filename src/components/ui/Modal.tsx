import { X } from 'lucide-react';
import { useEffect } from 'react';

interface ModalProps {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  children: React.ReactNode;
  largura?: string;
}

export default function Modal({ aberto, onFechar, titulo, children, largura = 'max-w-2xl' }: ModalProps) {
  useEffect(() => {
    if (aberto) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [aberto]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    if (aberto) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-[60] animate-in fade-in duration-200"
        onClick={onFechar}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none">
        <div
          className={`${largura} w-full bg-white rounded-3xl shadow-2xl shadow-black/15 pointer-events-auto flex flex-col max-h-[90vh] animate-in zoom-in-95 fade-in duration-300`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-7 pt-6 pb-4 shrink-0">
            <h2 className="text-xl font-bold text-on-surface">{titulo}</h2>
            <button
              onClick={onFechar}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          {/* Conteúdo com scroll */}
          <div className="flex-1 overflow-y-auto px-7 pb-7 overscroll-contain">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
