import type { LucideIcon } from 'lucide-react';

interface PlaceholderPageProps {
  icon: LucideIcon;
  titulo: string;
  descricao: string;
  fase?: string;
}

export default function PlaceholderPage({ icon: Icon, titulo, descricao, fase = 'Em breve' }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center">
        <Icon size={28} strokeWidth={1.5} className="text-on-surface-variant" />
      </div>
      <h2 className="text-xl font-semibold text-on-surface">{titulo}</h2>
      <p className="text-sm text-on-surface-variant text-center max-w-sm">{descricao}</p>
      <span className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] px-3 py-1 rounded-full bg-surface-container-highest text-on-surface-variant">
        {fase}
      </span>
    </div>
  );
}
