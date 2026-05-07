import { useState, useEffect, useCallback } from 'react';
import { Save, Loader2, Key, Bot, Wifi, Megaphone, CheckCircle2, MessageSquare, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import Drawer from '../ui/Drawer';
import type { User, UserRole, InstanciaWhatsappUser } from '../../types';
import { ROLE_LABELS } from '../../types';
import {
  criarUsuario, atualizarUsuario, buscarAgente3CPlus,
  listarCampanhasVinculadas, syncCampanhas,
  listarEquipesVinculadas, syncEquipes,
  listarInstanciasUser, adicionarInstanciaUser, editarInstanciaUser, removerInstanciaUser,
} from '../../services/users';
import type { Agente3CPlus, CampanhaVinculada, EquipeVinculada } from '../../services/users';

interface UsuarioDrawerProps {
  usuario: User | null;
  onClose: () => void;
  onSalvo: () => void;
}

export default function UsuarioDrawer({ usuario, onClose, onSalvo }: UsuarioDrawerProps) {
  const editando = !!usuario;

  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [role, setRole] = useState<UserRole>(usuario?.role ?? 'AGENTE');
  const [ativo, setAtivo] = useState(usuario?.ativo ?? true);
  const [equipes, setEquipes] = useState<EquipeVinculada[]>([]);
  const [equipesSelecionadas, setEquipesSelecionadas] = useState<Set<number>>(new Set());
  const [campanhas, setCampanhas] = useState<CampanhaVinculada[]>([]);
  const [campanhasSelecionadas, setCampanhasSelecionadas] = useState<Set<number>>(new Set());
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agenteDetectado, setAgenteDetectado] = useState<Agente3CPlus | null>(null);
  const [buscandoAgente, setBuscandoAgente] = useState(false);

  // Instancias WhatsApp do user
  const [instancias, setInstancias] = useState<InstanciaWhatsappUser[]>([]);
  const [loadingInstancias, setLoadingInstancias] = useState(false);
  const [novaInstanciaId, setNovaInstanciaId] = useState('');
  const [novoApelido, setNovoApelido] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novoTipo, setNovoTipo] = useState<'whatsapp-3c' | 'waba'>('whatsapp-3c');
  const [salvandoNovaInstancia, setSalvandoNovaInstancia] = useState(false);
  const [instanciaEditando, setInstanciaEditando] = useState<string | null>(null);
  const [editApelido, setEditApelido] = useState('');
  const [editTelefone, setEditTelefone] = useState('');
  const [editInstanciaId, setEditInstanciaId] = useState('');
  const [instanciaError, setInstanciaError] = useState<string | null>(null);

  const buscarAgente = useCallback(async (emailBusca: string) => {
    if (!emailBusca || !emailBusca.includes('@') || editando) return;
    setBuscandoAgente(true);
    try {
      const agente = await buscarAgente3CPlus(emailBusca);
      setAgenteDetectado(agente);
    } catch {
      setAgenteDetectado(null);
    } finally {
      setBuscandoAgente(false);
    }
  }, [editando]);

  useEffect(() => {
    if (editando || !email || !email.includes('@')) return;
    const timer = setTimeout(() => buscarAgente(email), 600);
    return () => clearTimeout(timer);
  }, [email, editando, buscarAgente]);

  useEffect(() => {
    async function load() {
      try {
        const uid = editando && usuario?.id ? usuario.id : 0;
        const [campanhasData, equipesData] = await Promise.all([
          listarCampanhasVinculadas(uid).catch(() => []),
          listarEquipesVinculadas(uid).catch(() => []),
        ]);
        setCampanhas(campanhasData);
        setCampanhasSelecionadas(new Set(campanhasData.filter(c => c.vinculado).map(c => c.id)));
        setEquipes(equipesData);
        setEquipesSelecionadas(new Set(equipesData.filter(e => e.vinculado).map(e => e.id)));
      } finally {
        setLoadingOptions(false);
      }
    }
    load();
  }, [editando, usuario?.id]);

  // Carrega instancias do user (so em modo edicao)
  useEffect(() => {
    if (!editando || !usuario?.id) return;
    setLoadingInstancias(true);
    listarInstanciasUser(usuario.id)
      .then(setInstancias)
      .catch(() => setInstancias([]))
      .finally(() => setLoadingInstancias(false));
  }, [editando, usuario?.id]);

  async function handleAdicionarInstancia() {
    if (!usuario) return;
    setInstanciaError(null);
    const instanciaId = novaInstanciaId.trim();
    const apelido = novoApelido.trim();
    if (!instanciaId || instanciaId.length < 3) {
      setInstanciaError('Informe o instanciaId (min 3 chars)');
      return;
    }
    if (!apelido) {
      setInstanciaError('Informe um apelido');
      return;
    }
    setSalvandoNovaInstancia(true);
    try {
      const nova = await adicionarInstanciaUser(usuario.id, {
        instanciaId,
        apelido,
        telefone: novoTelefone.trim() || undefined,
        tipo: novoTipo,
      });
      setInstancias(prev => [...prev, nova]);
      setNovaInstanciaId('');
      setNovoApelido('');
      setNovoTelefone('');
      setNovoTipo('whatsapp-3c');
    } catch (err) {
      setInstanciaError(err instanceof Error ? err.message : 'Erro ao adicionar instancia');
    } finally {
      setSalvandoNovaInstancia(false);
    }
  }

  function iniciarEdicao(inst: InstanciaWhatsappUser) {
    setInstanciaEditando(inst.id);
    setEditInstanciaId(inst.instanciaId);
    setEditApelido(inst.apelido);
    setEditTelefone(inst.telefone || '');
    setInstanciaError(null);
  }

  function cancelarEdicao() {
    setInstanciaEditando(null);
    setEditInstanciaId('');
    setEditApelido('');
    setEditTelefone('');
  }

  async function salvarEdicao() {
    if (!usuario || !instanciaEditando) return;
    try {
      const atualizada = await editarInstanciaUser(usuario.id, instanciaEditando, {
        instanciaId: editInstanciaId.trim(),
        apelido: editApelido.trim(),
        telefone: editTelefone.trim() || undefined,
      });
      setInstancias(prev => prev.map(i => (i.id === atualizada.id ? atualizada : i)));
      cancelarEdicao();
    } catch (err) {
      setInstanciaError(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  }

  async function handleRemoverInstancia(id: string) {
    if (!usuario) return;
    if (!confirm('Remover esta instancia?')) return;
    try {
      await removerInstanciaUser(usuario.id, id);
      setInstancias(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      setInstanciaError(err instanceof Error ? err.message : 'Erro ao remover');
    }
  }

  function toggleCampanha(id: number) {
    setCampanhasSelecionadas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleEquipe(id: number) {
    setEquipesSelecionadas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !email.trim()) {
      setError('Nome e e-mail são obrigatórios');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const data = {
        nome: nome.trim(),
        email: email.trim(),
        role,
        ativo,
      };

      let savedUser: User;
      if (editando) {
        savedUser = await atualizarUsuario(usuario.id, data);
      } else {
        savedUser = await criarUsuario(data);
      }

      if (savedUser.threecplusAgentId) {
        // Sync campanhas
        if (campanhas.length > 0) {
          const originais = new Set(campanhas.filter(c => c.vinculado).map(c => c.id));
          const adicionar = [...campanhasSelecionadas].filter(id => !originais.has(id));
          const remover = [...originais].filter(id => !campanhasSelecionadas.has(id));

          if (adicionar.length > 0 || remover.length > 0) {
            try {
              await syncCampanhas(savedUser.id, adicionar, remover);
            } catch (err) {
              console.warn('Erro ao sincronizar campanhas:', err);
            }
          }
        }

        // Sync equipes
        if (equipes.length > 0) {
          const originais = new Set(equipes.filter(e => e.vinculado).map(e => e.id));
          const mudou = [...equipesSelecionadas].some(id => !originais.has(id)) ||
                        [...originais].some(id => !equipesSelecionadas.has(id));

          if (mudou) {
            try {
              await syncEquipes(savedUser.id, [...equipesSelecionadas]);
            } catch (err) {
              console.warn('Erro ao sincronizar equipes:', err);
            }
          }
        }
      }

      onSalvo();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer aberto onFechar={onClose} largura="w-[480px]">
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold text-on-surface">
            {editando ? 'Editar usuário' : 'Novo usuário'}
          </h2>
          <p className="text-[0.8125rem] text-on-surface-variant mt-1">
            {editando ? 'Altere os dados do usuário' : 'Preencha os dados para cadastrar'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 space-y-6">
          {/* Dados basicos */}
          <section>
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-gray-400 mb-3">Dados básicos</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[0.75rem] font-medium text-on-surface mb-1">Nome completo</label>
                <input
                  type="text"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="w-full h-10 px-3.5 rounded-xl bg-white border border-gray-200 text-[0.8125rem] text-on-surface placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                />
              </div>
              <div>
                <label className="block text-[0.75rem] font-medium text-on-surface mb-1">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="joao@liberdademedicaedu.com.br"
                  disabled={editando}
                  className="w-full h-10 px-3.5 rounded-xl bg-white border border-gray-200 text-[0.8125rem] text-on-surface placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {buscandoAgente && (
                  <p className="mt-1.5 text-[0.6875rem] text-on-surface-variant flex items-center gap-1">
                    <Loader2 size={10} className="animate-spin" /> Buscando na 3C Plus...
                  </p>
                )}
                {agenteDetectado && !buscandoAgente && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[0.6875rem] text-emerald-600">
                    <CheckCircle2 size={12} />
                    Agente encontrado: {agenteDetectado.name} (ID: {agenteDetectado.agentId}, Ext: {agenteDetectado.extension || '—'})
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[0.75rem] font-medium text-on-surface mb-1">Perfil</label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as UserRole)}
                    className="w-full h-10 px-3.5 rounded-xl bg-white border border-gray-200 text-[0.8125rem] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                  >
                    {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[0.75rem] font-medium text-on-surface mb-1">Status</label>
                  <select
                    value={ativo ? 'true' : 'false'}
                    onChange={e => setAtivo(e.target.value === 'true')}
                    className="w-full h-10 px-3.5 rounded-xl bg-white border border-gray-200 text-[0.8125rem] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* 3C Plus */}
          {editando && (
            <section>
              <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                <span className="flex items-center gap-1.5"><Bot size={12} /> 3C Plus</span>
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                  <div>
                    <p className="text-[0.8125rem] font-medium text-on-surface">Agente 3C Plus</p>
                    <p className="text-[0.6875rem] text-on-surface-variant mt-0.5">
                      {usuario.threecplusAgentId
                        ? `ID: ${usuario.threecplusAgentId} · Ext: ${usuario.threecplusExtension || '—'}`
                        : 'Agente ainda não vinculado'}
                    </p>
                  </div>
                  {usuario.threecplusAgentId ? (
                    <span className="flex items-center gap-1 text-[0.6875rem] text-emerald-600 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Vinculado
                    </span>
                  ) : (
                    <span className="text-[0.6875rem] text-gray-400">Pendente</span>
                  )}
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                  <div>
                    <p className="text-[0.8125rem] font-medium text-on-surface">API Token</p>
                    <p className="text-[0.6875rem] text-on-surface-variant mt-0.5">
                      {usuario.threecplusAgentToken && usuario.threecplusAgentToken !== '***'
                        ? `${usuario.threecplusAgentToken.slice(0, 12)}...`
                        : usuario.threecplusAgentToken === '***' ? 'Configurado' : 'Não coletado'}
                    </p>
                  </div>
                  {usuario.threecplusAgentToken ? (
                    <Key size={14} className="text-emerald-600" />
                  ) : (
                    <Key size={14} className="text-gray-300" />
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Campanhas */}
          <section>
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-gray-400 mb-3">
              <span className="flex items-center gap-1.5"><Megaphone size={12} /> Campanhas</span>
            </h3>
            {loadingOptions ? (
              <div className="space-y-2">
                <div className="h-10 rounded-xl bg-gray-50 animate-pulse" />
                <div className="h-10 rounded-xl bg-gray-50 animate-pulse" />
              </div>
            ) : campanhas.length === 0 ? (
              <p className="text-[0.75rem] text-on-surface-variant">Nenhuma campanha disponível</p>
            ) : (
              <div className="space-y-1.5">
                {campanhas.map(c => (
                  <label
                    key={c.id}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-all ${
                      campanhasSelecionadas.has(c.id)
                        ? 'border-primary/30 bg-primary/[0.04]'
                        : 'border-gray-100 bg-gray-50 hover:bg-gray-100/80'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={campanhasSelecionadas.has(c.id)}
                      onChange={() => toggleCampanha(c.id)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.8125rem] text-on-surface">{c.name}</p>
                    </div>
                    {c.vinculado && (
                      <span className="text-[0.6rem] font-medium uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                        Atual
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </section>

          {/* Equipes WhatsApp */}
          <section>
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-gray-400 mb-3">
              <span className="flex items-center gap-1.5"><Wifi size={12} /> Equipes WhatsApp</span>
            </h3>
            {loadingOptions ? (
              <div className="space-y-2">
                <div className="h-10 rounded-xl bg-gray-50 animate-pulse" />
                <div className="h-10 rounded-xl bg-gray-50 animate-pulse" />
              </div>
            ) : equipes.length === 0 ? (
              <p className="text-[0.75rem] text-on-surface-variant">Nenhuma equipe disponível</p>
            ) : (
              <div className="space-y-1.5">
                {equipes.map(eq => (
                  <label
                    key={eq.id}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-all ${
                      equipesSelecionadas.has(eq.id)
                        ? 'border-blue-300 bg-blue-50/50'
                        : 'border-gray-100 bg-gray-50 hover:bg-gray-100/80'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={equipesSelecionadas.has(eq.id)}
                      onChange={() => toggleEquipe(eq.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500/20"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.8125rem] text-on-surface">{eq.name}</p>
                    </div>
                    {eq.vinculado && (
                      <span className="text-[0.6rem] font-medium uppercase tracking-wider text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        Atual
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
            <p className="mt-2 text-[0.6875rem] text-on-surface-variant">
              Equipes controlam acesso aos grupos de canais e instâncias WhatsApp
            </p>
          </section>

          {/* Instancias WhatsApp vinculadas ao user */}
          {editando && (
            <section>
              <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                <span className="flex items-center gap-1.5"><MessageSquare size={12} /> Instâncias WhatsApp vinculadas</span>
              </h3>

              {instanciaError && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[0.75rem] text-red-700">
                  {instanciaError}
                </div>
              )}

              {loadingInstancias ? (
                <div className="h-10 rounded-xl bg-gray-50 animate-pulse" />
              ) : (
                <div className="space-y-2">
                  {instancias.length === 0 && (
                    <p className="text-[0.75rem] text-on-surface-variant">Nenhuma instância vinculada ainda.</p>
                  )}

                  {instancias.map(inst => (
                    <div key={inst.id} className="px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50">
                      {instanciaEditando === inst.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editApelido}
                            onChange={(e) => setEditApelido(e.target.value)}
                            placeholder="Apelido"
                            className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-[0.8125rem] focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <input
                            type="text"
                            value={editTelefone}
                            onChange={(e) => setEditTelefone(e.target.value)}
                            placeholder="Telefone (opcional)"
                            className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-[0.8125rem] focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <input
                            type="text"
                            value={editInstanciaId}
                            onChange={(e) => setEditInstanciaId(e.target.value)}
                            placeholder="Instance ID"
                            className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-[0.75rem] font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <div className="flex gap-2 justify-end">
                            <button type="button" onClick={cancelarEdicao} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[0.75rem] text-gray-600 hover:bg-gray-100">
                              <X size={12} /> Cancelar
                            </button>
                            <button type="button" onClick={salvarEdicao} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-white text-[0.75rem] hover:bg-primary-container">
                              <Check size={12} /> Salvar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-[0.8125rem] font-medium text-on-surface truncate">{inst.apelido}</p>
                              <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[0.625rem] font-medium border ${
                                inst.tipo === 'waba'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-gray-50 text-gray-600 border-gray-200'
                              }`}>
                                {inst.tipo === 'waba' ? 'WABA' : 'WhatsApp 3C+'}
                              </span>
                            </div>
                            <p className="text-[0.75rem] text-on-surface-variant">
                              {inst.telefone || 'Sem telefone'}
                            </p>
                            <p className="text-[0.6875rem] text-gray-400 font-mono truncate mt-0.5" title={inst.instanciaId}>
                              {inst.instanciaId.slice(0, 8)}…{inst.instanciaId.slice(-6)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button type="button" onClick={() => iniciarEdicao(inst)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100" title="Editar">
                              <Pencil size={13} />
                            </button>
                            <button type="button" onClick={() => handleRemoverInstancia(inst.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50" title="Remover">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Form de nova instancia */}
                  <div className="px-3 py-3 rounded-xl border border-dashed border-gray-200 space-y-2">
                    <p className="text-[0.6875rem] font-medium text-gray-500">Adicionar instância</p>
                    <select
                      value={novoTipo}
                      onChange={(e) => setNovoTipo(e.target.value as 'whatsapp-3c' | 'waba')}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-[0.8125rem] bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="whatsapp-3c">WhatsApp 3C+ (não oficial)</option>
                      <option value="waba">WABA (oficial)</option>
                    </select>
                    <input
                      type="text"
                      value={novoApelido}
                      onChange={(e) => setNovoApelido(e.target.value)}
                      placeholder="Apelido (ex: WhatsApp Cobrança)"
                      maxLength={80}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-[0.8125rem] focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                      type="text"
                      value={novoTelefone}
                      onChange={(e) => setNovoTelefone(e.target.value)}
                      placeholder="Telefone vinculado (opcional)"
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-[0.8125rem] focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                      type="text"
                      value={novaInstanciaId}
                      onChange={(e) => setNovaInstanciaId(e.target.value)}
                      placeholder="Instance ID (copie do log do backend)"
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-[0.75rem] font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={handleAdicionarInstancia}
                      disabled={salvandoNovaInstancia}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary/[0.08] text-primary text-[0.75rem] font-medium hover:bg-primary/[0.12] disabled:opacity-50"
                    >
                      {salvandoNovaInstancia ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                      Adicionar
                    </button>
                  </div>
                </div>
              )}

              <p className="mt-2 text-[0.6875rem] text-on-surface-variant">
                Só mensagens vindas destas instâncias são processadas. O Instance ID aparece nos logs do backend quando uma mensagem chega (buscar por <span className="font-mono">[Whatsapp] 📬 Instancia vista</span>).
              </p>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          {error && (
            <p className="text-[0.75rem] text-error flex-1 mr-3">{error}</p>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl text-[0.8125rem] font-medium text-on-surface-variant hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 h-9 px-5 rounded-xl bg-primary text-white text-[0.8125rem] font-medium hover:bg-primary-container transition-colors shadow-sm disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {editando ? 'Salvar' : 'Criar usuário'}
            </button>
          </div>
        </div>
      </form>
    </Drawer>
  );
}
