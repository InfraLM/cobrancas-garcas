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
    // Tenta extrair mensagem estruturada de erro da 3C Plus (title + errors detalhados)
    try {
      const json = JSON.parse(text);
      if (json.errors && typeof json.errors === 'object') {
        const campos = Object.entries(json.errors)
          .map(([campo, msgs]) => `${campo}: ${Array.isArray(msgs) ? msgs.join('; ') : msgs}`)
          .join(' | ');
        throw new Error(`3C Plus ${res.status} — ${json.title || 'Erro'}: ${campos}`);
      }
      if (json.title || json.detail) {
        throw new Error(`3C Plus ${res.status}: ${json.title || ''} ${json.detail || ''}`.trim());
      }
    } catch (parseErr) {
      if (parseErr.message?.startsWith('3C Plus')) throw parseErr;
      // nao era JSON — cai pro fallback abaixo
    }
    const preview = text.slice(0, 500);
    throw new Error(`3C Plus ${res.status}: ${preview}`);
  }

  const text = await res.text();
  if (!text || text.trim().startsWith('<')) {
    throw new Error(`3C Plus retornou HTML em vez de JSON`);
  }

  return JSON.parse(text);
}

/**
 * Gera senha que atende aos criterios da 3C Plus:
 * - Pelo menos uma maiuscula
 * - Pelo menos um numero
 * - Pelo menos um caractere especial
 * - Sem repeticoes ou sequencias iguais (ex: aaa, 111, abc, ABC, 123)
 */
function gerarSenhaAleatoria() {
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const specials = '!@#$%&*';

  function pick(set) { return set[Math.floor(Math.random() * set.length)]; }

  function temSequenciaOuRepeticao(s) {
    for (let i = 0; i < s.length - 2; i++) {
      const a = s.charCodeAt(i), b = s.charCodeAt(i + 1), c = s.charCodeAt(i + 2);
      // Repeticao (aaa, 111)
      if (a === b && b === c) return true;
      // Sequencia crescente (abc, 123)
      if (b === a + 1 && c === b + 1) return true;
      // Sequencia decrescente (cba, 321)
      if (b === a - 1 && c === b - 1) return true;
    }
    return false;
  }

  for (let tentativa = 0; tentativa < 50; tentativa++) {
    // Garantir pelo menos 1 de cada categoria
    const obrigatorios = [pick(lower), pick(upper), pick(digits), pick(specials)];
    const extras = [];
    const todos = lower + upper + digits + specials;
    for (let i = 0; i < 12; i++) extras.push(pick(todos));

    // Embaralhar
    const arr = [...obrigatorios, ...extras];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    const senha = arr.join('');
    if (!temSequenciaOuRepeticao(senha)) return senha;
  }

  // Fallback improvavel
  return `Xx${Date.now().toString(36)}!9`;
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
 * Descobre o proximo extension_number livre, somando 1 ao maior existente.
 * Fallback: 1000.
 */
async function proximoRamalLivre() {
  try {
    const data = await fetchJson(discadorUrl('/users'));
    const users = data.data || data;
    if (!Array.isArray(users)) return 1000;
    const ramais = users
      .map(u => Number(u.extension?.extension_number))
      .filter(n => Number.isFinite(n) && n > 0);
    if (ramais.length === 0) return 1000;
    return Math.max(...ramais) + 1;
  } catch {
    return 1000;
  }
}

/**
 * Cria um agente/usuario na 3C Plus via POST /users
 * Depois habilita o WebPhone (WebRTC)
 * Retorna { userId, agentId, extension, apiToken }
 */
export async function criarAgente3CPlus(user) {
  // Idempotencia: se ja existe agente com esse email na 3C Plus, vincula em vez de criar
  const existente = await buscarAgenteExistente(user.email);
  if (existente) {
    console.log(`[3CPlus] Agente ja existe para ${user.email} — reusando userId=${existente.userId}`);
    return {
      userId: existente.userId,
      agentId: existente.agentId,
      extension: existente.extension,
      apiToken: existente.apiToken,
    };
  }

  const senha = gerarSenhaAleatoria();
  const ramal = await proximoRamalLivre();

  const formData = new URLSearchParams();
  formData.append('name', user.nome);
  formData.append('email', user.email);
  formData.append('password', senha);
  formData.append('password_confirmation', senha);
  formData.append('role', 'agent');
  formData.append('timezone', 'America/Sao_Paulo');
  formData.append('extension_number', String(ramal));

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
        user: user.email,
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
  formData.append('name', user.nome);
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
      user: user.email,
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
 * Retorna as qualificacoes configuradas no dialer da campanha.
 * Usado pelo modo massa: o agente precisa qualificar a chamada apos
 * call-was-finished para sair do ACW e o discador mandar a proxima.
 *
 * Estrutura na 3C Plus: campaign.dialer.qualification_list.qualifications[]
 * { id, name, color, conversion?, is_positive? }
 */
export async function obterQualificacoesCampanha(campaignId) {
  try {
    const data = await fetchJson(discadorUrl(`/campaigns/${campaignId}`));
    const camp = data.data || data;
    const lista = camp?.dialer?.qualification_list?.qualifications
      || camp?.qualification_list?.qualifications
      || [];
    return lista.map(q => ({
      id: q.id,
      nome: q.name,
      cor: q.color || '#6b7280',
      conversion: Boolean(q.conversion),
      is_positive: Boolean(q.is_positive),
    }));
  } catch (err) {
    console.warn(`[3CPlus] Erro ao obter qualificacoes da campanha ${campaignId}: ${err.message}`);
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
