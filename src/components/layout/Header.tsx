import { useLocation } from 'react-router-dom';
import { Search, Bell, ChevronRight } from 'lucide-react';

const routeMap: Record<string, { titulo: string; breadcrumb?: string }> = {
  '/dashboard':              { titulo: 'Painel' },
  '/atendimento':            { titulo: 'Visão Geral', breadcrumb: 'Atendimento' },
  '/atendimento/conversas':  { titulo: 'Conversas', breadcrumb: 'Atendimento' },
  '/atendimento/ligacoes':   { titulo: 'Ligações Ativas', breadcrumb: 'Atendimento' },
  '/atendimento/disparos':   { titulo: 'Disparos', breadcrumb: 'Atendimento' },
  '/workflow/negociacoes':   { titulo: 'Negociações', breadcrumb: 'Workflow' },
  '/workflow/recorrencia':   { titulo: 'Recorrência', breadcrumb: 'Workflow' },
  '/alunos':                 { titulo: 'Alunos' },
  '/titulos':                { titulo: 'Títulos' },
  '/negociacoes':            { titulo: 'Negociações' },
  '/segmentacao':            { titulo: 'Segmentação' },
  '/ocorrencias':            { titulo: 'Ocorrências' },
  '/repositorio':            { titulo: 'Repositório' },
  '/configuracoes':          { titulo: 'Configurações' },
  '/configuracoes/usuarios': { titulo: 'Usuários', breadcrumb: 'Configurações' },
};

export default function Header() {
  const location = useLocation();
  const route = routeMap[location.pathname] || { titulo: 'Cobrança' };

  return (
    <header className="h-14 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-1.5">
        {route.breadcrumb && (
          <>
            <span className="text-[0.8125rem] text-gray-400">{route.breadcrumb}</span>
            <ChevronRight size={14} className="text-gray-300" />
          </>
        )}
        <h1 className="text-lg font-semibold text-on-surface tracking-tight">{route.titulo}</h1>
      </div>

      <div className="flex items-center gap-2">
        <button className="flex items-center gap-2.5 h-9 px-4 rounded-xl bg-white hover:bg-gray-50 transition-all text-gray-400 shadow-sm shadow-black/[0.03]">
          <Search size={15} strokeWidth={2} />
          <span className="text-[0.8125rem]">Buscar aluno, CPF...</span>
          <kbd className="ml-3 inline-flex items-center h-5 px-1.5 rounded-md bg-gray-100 text-[0.625rem] font-semibold text-gray-400">
            ⌘K
          </kbd>
        </button>

        <button className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-white hover:bg-gray-50 transition-all shadow-sm shadow-black/[0.03] text-gray-400">
          <Bell size={18} strokeWidth={1.8} />
          <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white text-[0.5625rem] font-bold">
            2
          </span>
        </button>
      </div>
    </header>
  );
}
