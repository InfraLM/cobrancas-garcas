import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ROLE_LABELS } from '../../types';
import {
  LayoutDashboard,
  Headset,
  Kanban,
  Users,
  Receipt,
  Handshake,
  Filter,
  Clock,
  FolderOpen,
  Settings,
  Eye,
  MessageSquare,
  PhoneCall,
  Megaphone,
  GitBranch,
  RefreshCw,
  Landmark,
  CalendarCheck,
  type LucideIcon,
} from 'lucide-react';

interface SubMenuItem {
  label: string;
  path: string;
  icone: LucideIcon;
}

interface MenuItem {
  label: string;
  icone: LucideIcon;
  path: string;
  submenu?: SubMenuItem[];
}

const menuPrincipal: MenuItem[] = [
  { label: 'Painel', icone: LayoutDashboard, path: '/dashboard' },
  {
    label: 'Atendimento', icone: Headset, path: '/atendimento',
    submenu: [
      { label: 'Visão Geral', path: '/atendimento', icone: Eye },
      { label: 'Conversas', path: '/atendimento/conversas', icone: MessageSquare },
      { label: 'Ligações Ativas', path: '/atendimento/ligacoes', icone: PhoneCall },
      { label: 'Disparos', path: '/atendimento/disparos', icone: Megaphone },
      { label: 'Atividades', path: '/atendimento/atividades', icone: CalendarCheck },
    ],
  },
  {
    label: 'Workflow', icone: Kanban, path: '/workflow/negociacoes',
    submenu: [
      { label: 'Negociações', path: '/workflow/negociacoes', icone: GitBranch },
      { label: 'Recorrência', path: '/workflow/recorrencia', icone: RefreshCw },
      { label: 'Ficou Fácil', path: '/workflow/ficou-facil', icone: Landmark },
    ],
  },
  { label: 'Alunos', icone: Users, path: '/alunos' },
  { label: 'Títulos', icone: Receipt, path: '/titulos' },
  { label: 'Negociações', icone: Handshake, path: '/negociacoes' },
  { label: 'Segmentação', icone: Filter, path: '/segmentacao' },
  { label: 'Ocorrências', icone: Clock, path: '/ocorrencias' },
  { label: 'Repositório', icone: FolderOpen, path: '/repositorio' },
];

const menuRodape: MenuItem[] = [
  { label: 'Config.', icone: Settings, path: '/configuracoes' },
];

function isPathActive(currentPath: string, itemPath: string, submenu?: SubMenuItem[]): boolean {
  if (submenu) {
    return submenu.some(s => currentPath === s.path) || currentPath.startsWith(itemPath + '/') || currentPath === itemPath;
  }
  return currentPath === itemPath;
}

function SidebarItem({ item }: { item: MenuItem }) {
  const location = useLocation();
  const ativo = isPathActive(location.pathname, item.path, item.submenu);
  const temSubmenu = item.submenu && item.submenu.length > 0;

  // Itens com submenu: div com hover, sem NavLink no botão principal
  // Itens sem submenu: NavLink direto
  if (temSubmenu) {
    return (
      <div className="relative group">
        {/* Barra indicadora */}
        {ativo && (
          <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary z-10" />
        )}

        {/* Botão principal (não navega, só mostra hover) */}
        <div
          className={`flex flex-col items-center gap-1 py-2.5 px-1 mx-1 rounded-xl transition-all duration-150 cursor-pointer ${
            ativo
              ? 'text-primary'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
          }`}
        >
          <item.icone size={20} strokeWidth={ativo ? 2.2 : 1.6} />
          <span className={`text-[0.6rem] leading-tight text-center ${ativo ? 'font-semibold' : 'font-medium'}`}>
            {item.label}
          </span>
        </div>

        {/* Zona invisível que conecta o item ao submenu (evita perder hover) */}
        <div className="absolute left-full top-0 bottom-0 w-3 z-40" />

        {/* Submenu flutuante */}
        <div className="absolute left-full top-0 ml-2 opacity-0 invisible -translate-x-1 group-hover:opacity-100 group-hover:visible group-hover:translate-x-0 transition-all duration-200 ease-out z-50">
          <div className="bg-white rounded-2xl shadow-xl shadow-black/10 py-2 min-w-[210px]">
            <div className="px-4 py-2 mb-1">
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-gray-300">{item.label}</span>
            </div>
            {item.submenu!.map((sub) => {
              const subAtivo = location.pathname === sub.path;
              return (
                <NavLink
                  key={sub.path}
                  to={sub.path}
                  className={`flex items-center gap-3 px-4 py-2.5 text-[0.8125rem] transition-colors ${
                    subAtivo
                      ? 'text-primary font-semibold bg-red-50/50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <sub.icone size={16} strokeWidth={subAtivo ? 2.2 : 1.6} />
                  {sub.label}
                </NavLink>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Item simples (sem submenu)
  return (
    <div className="relative">
      {ativo && (
        <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary z-10" />
      )}
      <NavLink
        to={item.path}
        className={`flex flex-col items-center gap-1 py-2.5 px-1 mx-1 rounded-xl transition-all duration-150 ${
          ativo
            ? 'text-primary'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
        }`}
      >
        <item.icone size={20} strokeWidth={ativo ? 2.2 : 1.6} />
        <span className={`text-[0.6rem] leading-tight text-center ${ativo ? 'font-semibold' : 'font-medium'}`}>
          {item.label}
        </span>
      </NavLink>
    </div>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const iniciais = user?.nome
    ? user.nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  const roleLabel = user?.role ? ROLE_LABELS[user.role] : 'Agente';

  return (
    <aside className="w-[72px] h-screen sticky top-0 flex flex-col bg-[#fafafa] shrink-0 z-30">
      {/* Logo */}
      <div className="flex items-center justify-center h-14 shrink-0">
        <img src="/logo-vermelho.svg" alt="Liberdade Médica" className="h-5 w-auto" />
      </div>

      {/* Menu principal */}
      <nav className="flex-1 flex flex-col gap-0.5 pt-2">
        {menuPrincipal.map((item) => (
          <SidebarItem key={item.label} item={item} />
        ))}
      </nav>

      {/* Rodapé */}
      <div className="flex flex-col gap-0.5 pb-2 shrink-0">
        {menuRodape.map((item) => (
          <SidebarItem key={item.label} item={item} />
        ))}

        {/* Avatar do usuario logado */}
        <div className="flex items-center justify-center py-3 group relative">
          <div className="relative cursor-pointer" onClick={() => navigate('/configuracoes')}>
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-secondary to-secondary-container flex items-center justify-center text-white text-xs font-bold">
                {iniciais}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-[#fafafa]" />
          </div>

          {/* Tooltip com menu */}
          <div className="absolute left-full bottom-0 ml-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
            <div className="bg-white rounded-xl shadow-xl shadow-black/10 py-2 min-w-[180px]">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-[0.8125rem] font-medium text-on-surface">{user?.nome || 'Usuário'}</p>
                <p className="text-[0.6875rem] text-on-surface-variant">{roleLabel}</p>
              </div>
              <button
                onClick={logout}
                className="w-full text-left px-4 py-2 text-[0.8125rem] text-error hover:bg-error/5 transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
