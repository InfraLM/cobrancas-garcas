import { X } from 'lucide-react';
import { useEffect } from 'react';

interface DrawerProps {
  aberto: boolean;
  onFechar: () => void;
  children: React.ReactNode;
  largura?: string;
}

export default function Drawer({ aberto, onFechar, children, largura = 'w-[520px]' }: DrawerProps) {
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
        className="fixed inset-0 bg-black/30 z-40 animate-in fade-in duration-200"
        onClick={onFechar}
      />

      {/* Painel */}
      <div
        className={`fixed top-0 right-0 h-full ${largura} max-w-[92vw] bg-surface z-50 shadow-2xl shadow-black/10 flex flex-col animate-in slide-in-from-right duration-300`}
      >
        {/* Botão fechar */}
        <button
          onClick={onFechar}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors z-10"
        >
          <X size={18} strokeWidth={2} />
        </button>

        {/* Conteúdo com scroll completo */}
        <div className="flex-1 overflow-y-auto overscroll-contain pb-8" style={{ willChange: 'scroll-position' }}>
          {children}
        </div>
      </div>
    </>
  );
}
