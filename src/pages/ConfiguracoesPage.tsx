import { useNavigate } from 'react-router-dom';
import { Users, UserCircle, Plug, ListChecks, FileText, type LucideIcon } from 'lucide-react';

interface ConfigCard {
  label: string;
  descricao: string;
  icone: LucideIcon;
  path: string;
  ativo: boolean;
}

interface ConfigSection {
  titulo: string;
  cards: ConfigCard[];
}

const sections: ConfigSection[] = [
  {
    titulo: 'Geral',
    cards: [
      { label: 'Usuários', descricao: 'Cadastre e gerencie usuários', icone: Users, path: '/configuracoes/usuarios', ativo: true },
      { label: 'Meu Perfil', descricao: 'Seus dados e preferências', icone: UserCircle, path: '/configuracoes/perfil', ativo: false },
      { label: 'Integrações', descricao: '3C Plus, Asaas, ClickSign', icone: Plug, path: '/configuracoes/integracoes', ativo: false },
    ],
  },
  {
    titulo: 'Atendimento',
    cards: [
      { label: 'Qualificações', descricao: 'Critérios de tabulação das ligações', icone: ListChecks, path: '/configuracoes/qualificacoes', ativo: false },
      { label: 'Templates', descricao: 'Modelos de documentos e termos', icone: FileText, path: '/configuracoes/templates', ativo: false },
    ],
  },
];

export default function ConfiguracoesPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto pt-2">
      <div className="flex flex-col gap-8">
        {sections.map((section) => (
          <div key={section.titulo} className="bg-white rounded-2xl shadow-sm shadow-black/[0.04] overflow-hidden">
            <div className="px-6 pt-5 pb-3">
              <h2 className="text-[0.9375rem] font-semibold text-on-surface">{section.titulo}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-100/80 border-t border-gray-100">
              {section.cards.map((card) => (
                <button
                  key={card.path}
                  onClick={() => card.ativo && navigate(card.path)}
                  disabled={!card.ativo}
                  className={`flex items-center gap-4 px-6 py-5 bg-white text-left transition-all group ${
                    card.ativo
                      ? 'hover:bg-gray-50/80 cursor-pointer'
                      : 'opacity-40 cursor-not-allowed'
                  }`}
                >
                  <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${
                    card.ativo ? 'bg-primary/[0.06] text-primary' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <card.icone size={20} strokeWidth={1.7} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.875rem] font-semibold text-on-surface">{card.label}</p>
                    <p className="text-[0.75rem] text-on-surface-variant mt-0.5">{card.descricao}</p>
                  </div>
                  {card.ativo && (
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
