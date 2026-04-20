import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  icone?: LucideIcon;
  contador?: number;
}

interface TabsProps {
  tabs: Tab[];
  children: (tabAtivo: string) => React.ReactNode;
  tabInicial?: string;
}

export default function Tabs({ tabs, children, tabInicial }: TabsProps) {
  const [ativo, setAtivo] = useState(tabInicial || tabs[0]?.id);

  return (
    <div>
      <div className="flex gap-1 px-6 py-2 overflow-x-auto">
        {tabs.map((tab) => {
          const isAtivo = ativo === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setAtivo(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[0.8125rem] transition-all duration-150 whitespace-nowrap ${
                isAtivo
                  ? 'bg-gray-900 text-white font-medium'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.icone && <tab.icone size={14} strokeWidth={isAtivo ? 2 : 1.6} />}
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="px-6 py-4">
        {children(ativo)}
      </div>
    </div>
  );
}
