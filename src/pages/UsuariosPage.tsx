import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, MoreVertical, Shield, ShieldCheck, Headset, Pencil, Trash2, Key, Bot, Link2, Lock } from 'lucide-react';
import type { User, UserRole } from '../types';
import { ROLE_LABELS } from '../types';
import { listarUsuarios, excluirUsuario, criarAgente3CPlus, coletarToken3CPlus, vincularAgente3CPlus } from '../services/users';
import UsuarioDrawer from '../components/configuracoes/UsuarioDrawer';
import { useAuth } from '../contexts/AuthContext';

const ROLE_ICONS: Record<UserRole, typeof Shield> = {
  ADMIN: ShieldCheck,
  SUPERVISOR: Shield,
  AGENTE: Headset,
};

const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: 'bg-purple-50 text-purple-700',
  SUPERVISOR: 'bg-blue-50 text-blue-700',
  AGENTE: 'bg-emerald-50 text-emerald-700',
};

export default function UsuariosPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<User | null>(null);
  const [menuAberto, setMenuAberto] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const menuBtnRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const carregarUsuarios = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listarUsuarios();
      setUsuarios(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) carregarUsuarios();
  }, [isAdmin, carregarUsuarios]);

  const usuariosFiltrados = usuarios.filter((u) => {
    const termo = busca.toLowerCase();
    return u.nome.toLowerCase().includes(termo) || u.email.toLowerCase().includes(termo);
  });

  function abrirCriacao() {
    setUsuarioEditando(null);
    setDrawerAberto(true);
  }

  function abrirEdicao(user: User) {
    setUsuarioEditando(user);
    setDrawerAberto(true);
    setMenuAberto(null);
  }

  async function handleExcluir(user: User) {
    if (!confirm(`Excluir ${user.nome}? Esta ação não pode ser desfeita.`)) return;
    setMenuAberto(null);
    try {
      await excluirUsuario(user.id);
      await carregarUsuarios();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir');
    }
  }

  async function handleCriarAgente(user: User) {
    setMenuAberto(null);
    setActionLoading(user.id);
    try {
      await criarAgente3CPlus(user.id);
      await carregarUsuarios();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao criar agente na 3C Plus');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleColetarToken(user: User) {
    setMenuAberto(null);
    setActionLoading(user.id);
    try {
      const atualizado = await coletarToken3CPlus(user.id);
      // Atualiza state local imediatamente com o user retornado (ja vem com threecplusAgentToken='***')
      setUsuarios(prev => prev.map(u => u.id === user.id ? atualizado : u));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao coletar token');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleVincularAgente(user: User) {
    setMenuAberto(null);
    setActionLoading(user.id);
    try {
      await vincularAgente3CPlus(user.id);
      await carregarUsuarios();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao vincular agente');
    } finally {
      setActionLoading(null);
    }
  }

  function handleSalvo() {
    setDrawerAberto(false);
    carregarUsuarios();
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto pt-16 px-6">
        <div className="flex flex-col items-center text-center gap-3 p-10 rounded-2xl bg-white border border-gray-100">
          <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
            <Lock size={20} className="text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-on-surface">Acesso restrito</h2>
          <p className="text-[0.8125rem] text-on-surface-variant max-w-md">
            A gestão de usuários é uma área exclusiva de administradores. Se você precisa de acesso, fale com o administrador do sistema.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pt-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Usuários</h2>
          <p className="text-[0.8125rem] text-on-surface-variant mt-0.5">
            {usuarios.length} {usuarios.length === 1 ? 'usuário cadastrado' : 'usuários cadastrados'}
          </p>
        </div>
        <button
          onClick={abrirCriacao}
          className="flex items-center gap-2 h-9 px-4 rounded-xl bg-primary text-white text-[0.8125rem] font-medium hover:bg-primary-container transition-colors shadow-sm"
        >
          <Plus size={16} strokeWidth={2} />
          Novo usuário
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome ou e-mail..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full h-10 pl-10 pr-4 rounded-xl bg-white border border-gray-200 text-[0.8125rem] text-on-surface placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-error/10 text-error text-[0.8125rem]">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* List */}
      {!loading && (
        <div className="bg-white rounded-2xl shadow-sm shadow-black/[0.04] overflow-hidden">
          {usuariosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
              <p className="text-[0.875rem]">{busca ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-gray-400">Usuário</th>
                  <th className="text-left px-5 py-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-gray-400">Perfil</th>
                  <th className="text-left px-5 py-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-gray-400">3C Plus</th>
                  <th className="text-left px-5 py-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-gray-400">WhatsApp</th>
                  <th className="text-left px-5 py-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-gray-400">Status</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map((user) => {
                  const RoleIcon = ROLE_ICONS[user.role];
                  const iniciais = user.nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

                  return (
                    <tr key={user.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-secondary to-secondary-container flex items-center justify-center text-white text-[0.6875rem] font-bold">
                              {iniciais}
                            </div>
                          )}
                          <div>
                            <p className="text-[0.8125rem] font-medium text-on-surface">{user.nome}</p>
                            <p className="text-[0.6875rem] text-on-surface-variant">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[0.6875rem] font-medium ${ROLE_COLORS[user.role]}`}>
                          <RoleIcon size={12} strokeWidth={2} />
                          {ROLE_LABELS[user.role]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {user.threecplusAgentToken ? (
                          <span className="inline-flex items-center gap-1 text-[0.6875rem] text-emerald-600">
                            <Key size={12} /> Integrado
                          </span>
                        ) : user.threecplusAgentId ? (
                          <span className="inline-flex items-center gap-1 text-[0.6875rem] text-amber-600">
                            <Bot size={12} /> Sem token
                          </span>
                        ) : (
                          <span className="text-[0.6875rem] text-gray-400">Não criado</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {user.instanciaWhatsappNome ? (
                          <span className="text-[0.6875rem] text-on-surface">{user.instanciaWhatsappNome}</span>
                        ) : (
                          <span className="text-[0.6875rem] text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {user.ativo ? (
                          <span className="inline-flex items-center gap-1.5 text-[0.6875rem] text-emerald-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[0.6875rem] text-gray-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        <button
                          ref={el => { menuBtnRefs.current[user.id] = el; }}
                          onClick={() => {
                            if (menuAberto === user.id) {
                              setMenuAberto(null);
                            } else {
                              const rect = menuBtnRefs.current[user.id]?.getBoundingClientRect();
                              if (rect) setMenuPos({ top: rect.bottom + 4, left: rect.right - 208 });
                              setMenuAberto(user.id);
                            }
                          }}
                          disabled={actionLoading === user.id}
                          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition-colors text-gray-400"
                        >
                          {actionLoading === user.id ? (
                            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                          ) : (
                            <MoreVertical size={16} />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Menu de acoes (fixed, fora da tabela para nao ser cortado por overflow) */}
      {menuAberto !== null && menuPos && (() => {
        const user = usuarios.find(u => u.id === menuAberto);
        if (!user) return null;
        return (
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setMenuAberto(null)} />
            <div className="fixed w-52 bg-white rounded-xl shadow-xl shadow-black/10 py-1.5 z-[61]" style={{ top: menuPos.top, left: menuPos.left }}>
              <button onClick={() => abrirEdicao(user)} className="flex items-center gap-2.5 w-full px-4 py-2 text-[0.8125rem] text-on-surface hover:bg-gray-50 transition-colors">
                <Pencil size={14} /> Editar
              </button>
              {!user.threecplusAgentId && (
                <>
                  <button onClick={() => handleVincularAgente(user)} className="flex items-center gap-2.5 w-full px-4 py-2 text-[0.8125rem] text-on-surface hover:bg-gray-50 transition-colors">
                    <Link2 size={14} /> Vincular agente existente
                  </button>
                  <button onClick={() => handleCriarAgente(user)} className="flex items-center gap-2.5 w-full px-4 py-2 text-[0.8125rem] text-on-surface hover:bg-gray-50 transition-colors">
                    <Bot size={14} /> Criar novo agente 3C Plus
                  </button>
                </>
              )}
              {user.threecplusAgentId && !user.threecplusAgentToken && (
                <button onClick={() => handleColetarToken(user)} className="flex items-center gap-2.5 w-full px-4 py-2 text-[0.8125rem] text-on-surface hover:bg-gray-50 transition-colors">
                  <Key size={14} /> Coletar API token
                </button>
              )}
              <div className="border-t border-gray-100 my-1" />
              <button onClick={() => handleExcluir(user)} className="flex items-center gap-2.5 w-full px-4 py-2 text-[0.8125rem] text-error hover:bg-error/5 transition-colors">
                <Trash2 size={14} /> Excluir
              </button>
            </div>
          </>
        );
      })()}

      {/* Drawer */}
      {drawerAberto && (
        <UsuarioDrawer
          usuario={usuarioEditando}
          onClose={() => setDrawerAberto(false)}
          onSalvo={handleSalvo}
        />
      )}
    </div>
  );
}
