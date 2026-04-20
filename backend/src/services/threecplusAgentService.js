/**
 * Service para gestao de agentes na 3C Plus
 *
 * APIs utilizadas:
 * - Discador API: https://liberdademedica.3c.plus/api/v1 (?api_token=MANAGER)
 * - Omni API legada: https://app.3c.fluxoti.com/omni-api/v1/whatsapp (?api_token=MANAGER) — agents, teams
 * - Chat API nova: https://app.3c.plus/omni-chat-api/v1/whatsapp (Bearer) — instances, chats
 */

const COMPANY_DOMAIN = process.env.THREECPLUS_SUBDOMAIN || 'liberdademedica';
const DISCADOR_API = `https://${COMPANY_DOMAIN}.3c.plus/api/v1`;
const OMNI_API = 'https://app.3c.fluxoti.com/omni-api/v1/whatsapp';
const CHAT_API = 'https://app.3c.plus/omni-chat-api/v1/whatsapp';

function getManagerToken() {
  return process.env.THREECPLUS_MANAGER_TOKEN;
}

function discadorUrl(path) {
  return `${DISCADOR_API}${path}?api_token=${getManagerToken()}`;
}

function omniUrl(path) {
  return `${OMNI_API}${path}?api_token=${getManagerToken()}`;
}

function chatUrl(path) {
  return `${CHAT_API}${path}`;
}

function chatHeaders() {
  return {
    'Accept': 'application/json',
    'Authorization': `Bearer ${getManagerToken()}`,
  };
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Accept': 'application/json', ...options.headers },
  });

  if (!res.ok) {
    const text = await res.text();
    const preview = text.slice(0, 120);
    throw new Error(`3C Plus ${res.status}: ${preview}`);
  }

  const text = await res.text();
  if (!text || text.trim().startsWith('<')) {
    throw new Error(`3C Plus retornou HTML em vez de JSON`);
  }

  return JSON.parse(text);
}

function gerarSenhaAleatoria() {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  let senha = '';
  for (let i = 0; i < 16; i++) {
    senha += chars[Math.floor(Math.random() * chars.length)];
  }
  return senha;
}

/**
 * Busca usuario existente na 3C Plus pelo email.
 * Usa GET /users (retorna email, api_token, extension como objeto).
 * Retorna { userId, agentId, extension, name, apiToken } ou null.
 */
export async function buscarAgenteExistente(email) {
  const data = await fetchJson(discadorUrl('/users'));
  const users = data.data || data;

  if (!Array.isArray(users)) return null;

  const user = users.find(u =>
    u.email?.toLowerCase() === email.toLowerCase()
  );

  if (!user) {
    const byName = users.find(u =>
      u.name?.toLowerCase().includes(email.split('@')[0].replace('.', ' ').toLowerCase())
    );
    if (!byName) return null;
    return {
      userId: byName.id,
      agentId: byName.id,
      extension: byName.extension?.extension_number ? String(byName.extension.extension_number) : null,
      name: byName.name,
      apiToken: byName.api_token || null,
    };
  }

  return {
    userId: user.id,
    agentId: user.id,
    extension: user.extension?.extension_number ? String(user.extension.extension_number) : null,
    name: user.name,
    apiToken: user.api_token || null,
  };
}

/**
 * Cria um agente/usuario na 3C Plus via POST /users
 * Depois habilita o WebPhone (WebRTC)
 * Retorna { userId, agentId, extension, apiToken }
 */
export async function criarAgente3CPlus(user) {
  const senha = gerarSenhaAleatoria();

  const formData = new URLSearchParams();
  formData.append('name', user.nome);
  formData.append('email', user.email);
  formData.append('password', senha);
  formData.append('password_confirmation', senha);

  const createData = await fetchJson(discadorUrl('/users'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });

  const userId = createData.data?.id || createData.id;
  if (!userId) {
    throw new Error('Resposta da 3C Plus não contém ID do usuário');
  }

  try {
    await fetch(discadorUrl(`/users/${userId}/enable/web_extension`), { method: 'PUT' });
  } catch {
    console.warn(`[3CPlus] Não conseguiu habilitar WebPhone para userId=${userId}`);
  }

  let agentId = null;
  let extension = null;
  try {
    const found = await buscarAgenteExistente(user.email);
    if (found) {
      agentId = found.agentId;
      extension = found.extension;
    }
  } catch {
    console.warn(`[3CPlus] Não conseguiu obter dados do agente para userId=${userId}`);
  }

  let apiToken = null;
  try {
    const authData = await fetchJson(`${DISCADOR_API}/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        password: senha,
        company_domain: COMPANY_DOMAIN,
      }),
    });
    apiToken = authData.api_token || authData.data?.api_token;
  } catch {
    console.warn(`[3CPlus] Não conseguiu autenticar agente ${user.email}`);
  }

  return {
    userId,
    agentId: agentId || userId,
    extension,
    apiToken,
  };
}

/**
 * Autentica agente existente na 3C Plus para coletar API token.
 * Reset de senha via API do gestor + authenticate.
 */
export async function autenticarAgente3CPlus(user) {
  const senha = gerarSenhaAleatoria();

  const formData = new URLSearchParams();
  formData.append('password', senha);
  formData.append('password_confirmation', senha);

  await fetchJson(discadorUrl(`/users/${user.threecplusUserId || user.threecplusAgentId}/basic-data`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });

  const authData = await fetchJson(`${DISCADOR_API}/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: user.email,
      password: senha,
      company_domain: COMPANY_DOMAIN,
    }),
  });

  const token = authData.api_token || authData.data?.api_token;
  if (!token) throw new Error('Resposta da 3C Plus não contém api_token');

  return token;
}

/**
 * Lista instancias WhatsApp da empresa.
 * Tenta Chat API (Bearer) e Omni API (token) como fallback.
 */
export async function listarInstancias() {
  const tentativas = [
    () => fetchJson(chatUrl('/instances'), { headers: chatHeaders() }),
    () => fetchJson(omniUrl('/instances')),
    () => fetchJson(omniUrl('/instance')),
  ];

  for (const tentativa of tentativas) {
    try {
      const data = await tentativa();
      const instances = data.data || data;
      if (Array.isArray(instances) && instances.length > 0) {
        return instances.map(i => ({
          id: i.id || i.instance_id,
          name: i.name,
          phone: i.phone || i.number || '',
          status: i.status || 'unknown',
        }));
      }
    } catch { /* tenta proximo */ }
  }

  return [];
}

/**
 * Lista equipes WhatsApp (teams).
 * GET /teams retorna equipes com id, name, color.
 */
export async function listarEquipes() {
  try {
    const data = await fetchJson(omniUrl('/teams'));
    const teams = data.data || data;
    return Array.isArray(teams) ? teams.map(t => ({
      id: t.id,
      name: t.name,
    })) : [];
  } catch (err) {
    console.warn(`[3CPlus] Erro ao listar equipes: ${err.message}`);
    return [];
  }
}

// Alias para compatibilidade
export const listarGruposCanais = listarEquipes;

/**
 * Adiciona agente a uma campanha na 3C Plus.
 * POST /campaigns/{campaignId}/agents — body: { agents: [agentId] }
 */
export async function adicionarAgenteCampanha(campaignId, agentId) {
  const data = await fetchJson(discadorUrl(`/campaigns/${campaignId}/agents`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agents: [agentId] }),
  });

  console.log(`[3CPlus] Agente ${agentId} adicionado à campanha ${campaignId}`);
  return data;
}

/**
 * Remove agente de uma campanha na 3C Plus.
 * DELETE /campaigns/{campaignId}/agents/{agentId}
 */
export async function removerAgenteCampanha(campaignId, agentId) {
  await fetchJson(discadorUrl(`/campaigns/${campaignId}/agents/${agentId}`), {
    method: 'DELETE',
  });
  console.log(`[3CPlus] Agente ${agentId} removido da campanha ${campaignId}`);
}

/**
 * Atualiza equipes (teams) de um usuario na 3C Plus.
 * PUT /users/{userId} com campo teams: [teamId1, teamId2]
 * Requer todos os campos obrigatorios (name, email, role, timezone, extension_number).
 */
export async function atualizarEquipesUsuario(user3cplusId, teamIds, userData) {
  const data = await fetchJson(discadorUrl(`/users/${user3cplusId}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: userData.name,
      email: userData.email,
      role: userData.role || 'agent',
      timezone: 'America/Sao_Paulo',
      extension_number: Number(userData.extension) || 0,
      teams: teamIds,
    }),
  });
  console.log(`[3CPlus] Equipes atualizadas para user ${user3cplusId}: [${teamIds.join(',')}]`);
  return data;
}

/**
 * Retorna equipes com flag de vinculacao para um agente.
 */
export async function listarEquipesComVinculo(agentId) {
  const equipes = await listarEquipes();
  if (!agentId || equipes.length === 0) {
    return equipes.map(e => ({ ...e, vinculado: false }));
  }

  try {
    const agentsData = await fetchJson(omniUrl('/team/agents'));
    const agents = agentsData.data || agentsData;

    if (Array.isArray(agents)) {
      const agente = agents.find(a => a.id === agentId);
      const teamsDoAgente = new Set(
        (agente?.team || []).map(t => t.id)
      );
      return equipes.map(e => ({ ...e, vinculado: teamsDoAgente.has(e.id) }));
    }
  } catch {
    // fallback sem vinculacao
  }

  return equipes.map(e => ({ ...e, vinculado: false }));
}

/**
 * Lista TODAS as campanhas (percorre paginacao).
 */
export async function listarCampanhas() {
  try {
    const todas = [];
    let page = 1;

    while (page <= 20) {
      const data = await fetchJson(`${discadorUrl('/campaigns')}&page=${page}`);
      const items = data.data || data;
      if (!Array.isArray(items) || items.length === 0) break;
      todas.push(...items.map(c => ({ id: c.id, name: c.name })));
      if (items.length < 15) break;
      page++;
    }

    return todas;
  } catch (err) {
    console.warn(`[3CPlus] Erro ao listar campanhas: ${err.message}`);
    return [];
  }
}

/**
 * Lista agentes de uma campanha especifica.
 * GET /campaigns/{campaignId}/agents
 */
export async function listarAgentesDaCampanha(campaignId) {
  try {
    const data = await fetchJson(discadorUrl(`/campaigns/${campaignId}/agents`));
    const agents = data.data || data;
    return Array.isArray(agents) ? agents.map(a => a.id) : [];
  } catch {
    return [];
  }
}

/**
 * Retorna campanhas com flag de vinculacao para um agente.
 */
export async function listarCampanhasComVinculo(agentId) {
  const campanhas = await listarCampanhas();
  if (!agentId || campanhas.length === 0) {
    return campanhas.map(c => ({ ...c, vinculado: false }));
  }

  const resultados = await Promise.all(
    campanhas.map(async (c) => {
      const agentes = await listarAgentesDaCampanha(c.id);
      return { ...c, vinculado: agentes.includes(agentId) };
    })
  );

  return resultados;
}
