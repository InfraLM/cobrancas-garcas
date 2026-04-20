/**
 * Service REST para 3C Plus (ligacoes).
 *
 * Apenas chamadas REST: WebRTC iframe, login/logout em campanha, Click2Call,
 * qualificacao de chamada, status do agente.
 *
 * Eventos Socket.io NAO sao mais conectados aqui — backend tem worker 24/7
 * e frontend usa RealtimeContext para receber via /ws.
 */

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { 'Accept': 'application/json', ...extra };
  const token = localStorage.getItem('auth_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// --- Configuração (populada pelo backend via GET /api/ligacoes/config) ---
const CONFIG = {
  subdomain: 'liberdademedica',
  campaignIdIndividual: 257943,
  campaignIdMassa: 257976,
  agentToken: '',
  managerToken: '',
  agentExtension: 0,
};

// --- Configurar tokens (chamado pela UI de configuração) ---
export function setConfig(config: {
  agentToken?: string;
  managerToken?: string;
  agentExtension?: number;
  campaignIdIndividual?: number;
  campaignIdMassa?: number;
}) {
  if (config.agentToken) CONFIG.agentToken = config.agentToken;
  if (config.managerToken) CONFIG.managerToken = config.managerToken;
  if (config.agentExtension) CONFIG.agentExtension = config.agentExtension;
  if (config.campaignIdIndividual) CONFIG.campaignIdIndividual = config.campaignIdIndividual;
  if (config.campaignIdMassa) CONFIG.campaignIdMassa = config.campaignIdMassa;
}

export function getConfig() {
  return { ...CONFIG };
}

export function isConfigurado() {
  return !!CONFIG.agentToken;
}

// --- Preparar áudio proativamente (ANTES de abrir iframe WebRTC) ---
export async function prepararAudio(): Promise<boolean> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const jabra = devices.find(d =>
      d.kind === 'audioinput' &&
      d.label.toLowerCase().includes('jabra')
    );

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: jabra ? { exact: jabra.deviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
        sampleRate: { ideal: 48000 },
        sampleSize: { ideal: 16 },
        channelCount: { ideal: 1 },
      }
    });

    // Liberar stream — a permissão fica cacheada
    stream.getTracks().forEach(track => track.stop());
    console.log('[3C+] Permissão de microfone concedida', jabra ? '(Jabra detectado)' : '');
    return true;
  } catch (err) {
    console.error('[3C+] Erro ao preparar áudio:', err);
    return false;
  }
}

// --- Carregar config do backend (usa JWT do usuario logado) ---
export async function carregarConfigDoBackend(): Promise<boolean> {
  try {
    const response = await fetch('/api/ligacoes/config', { headers: authHeaders() });
    if (!response.ok) {
      console.error('[3C+] Falha ao carregar config:', response.status);
      return false;
    }
    const data = await response.json();
    setConfig({
      agentToken: data.agentToken,
      agentExtension: data.agentExtension,
      campaignIdIndividual: data.campaignIdIndividual,
      campaignIdMassa: data.campaignIdMassa,
    });
    console.log('[3C+] Config carregada:', { extension: data.agentExtension, individual: data.campaignIdIndividual, massa: data.campaignIdMassa });
    return true;
  } catch (error) {
    console.error('[3C+] Erro ao carregar config:', error);
    return false;
  }
}

// --- Socket.io ---
// REMOVIDO: conectarSocket/desconectarSocket/isSocketConectado.
// O frontend nao conecta mais direto ao socket.3c.plus. Em vez disso:
// - Backend mantem worker 24/7 conectado (backend/src/workers/socket3cplusWorker.js)
// - Frontend usa src/contexts/RealtimeContext.tsx para escutar eventos via /ws.
// Veja LigacoesContext.tsx para o padrao de uso.

// --- WebRTC iframe URL ---
export function getWebRTCUrl(): string | null {
  if (!CONFIG.agentToken) return null;
  return `https://${CONFIG.subdomain}.3c.plus/extension?api_token=${CONFIG.agentToken}`;
}

// --- Login na campanha ---
export async function loginCampanha(tipo: 'individual' | 'massa' = 'individual'): Promise<boolean> {
  if (!CONFIG.agentToken) return false;

  const campaignId = tipo === 'massa' ? CONFIG.campaignIdMassa : CONFIG.campaignIdIndividual;

  try {
    const response = await fetch(
      `https://${CONFIG.subdomain}.3c.plus/api/v1/agent/login?api_token=${CONFIG.agentToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `campaign=${campaignId}`,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[3C+] Login falhou:', response.status, error);
      return false;
    }

    console.log('[3C+] Login na campanha OK — verificando webphone...');

    // Dar tempo pro iframe WebRTC registrar antes de fazer polling
    await new Promise(r => setTimeout(r, 3000));

    // Poll agent status until webphone=true (max 25s)
    const pronto = await aguardarWebphone(25000);
    if (!pronto) {
      console.warn('[3C+] Webphone não registrou a tempo. Click2Call pode falhar.');
    }

    return true;
  } catch (error) {
    console.error('[3C+] Erro no login:', error);
    return false;
  }
}

// --- Aguardar webphone ficar true (polling) ---
async function aguardarWebphone(timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await getAgentStatus();
    console.log('[3C+] Agent status:', { webphone: status?.webphone, status: status?.agent_status?.status });

    if (status?.webphone === true) {
      console.log('[3C+] Webphone ativo — agente pronto para Click2Call');
      return true;
    }

    // Wait 2s before next poll
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

// --- Logout ---
export async function logoutCampanha(): Promise<void> {
  if (!CONFIG.agentToken) return;

  try {
    await fetch(
      `https://${CONFIG.subdomain}.3c.plus/api/v1/agent/logout?api_token=${CONFIG.agentToken}`,
      { method: 'POST' }
    );
    console.log('[3C+] Logout OK');
  } catch (error) {
    console.error('[3C+] Erro no logout:', error);
  }
}

// --- Click2Call (via proxy backend) ---
export async function click2call(telefone: string): Promise<boolean> {
  try {
    // Passa pelo proxy do backend para não expor token do gestor
    const response = await fetch('/api/ligacoes/click2call', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        phone: telefone,
        extension: CONFIG.agentExtension,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[3C+] Click2Call falhou:', response.status, error);
      return false;
    }

    console.log('[3C+] Click2Call iniciado para', telefone);
    return true;
  } catch (error) {
    console.error('[3C+] Erro no Click2Call:', error);
    return false;
  }
}

// --- Status do agente ---
export async function getAgentStatus(): Promise<any> {
  if (!CONFIG.agentToken) return null;

  try {
    const response = await fetch(
      `https://${CONFIG.subdomain}.3c.plus/api/v1/agent/status?api_token=${CONFIG.agentToken}`
    );
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// --- Qualificar chamada ---
export async function qualificarChamada(callId: string, qualificationId: number): Promise<boolean> {
  if (!CONFIG.agentToken) return false;

  try {
    const response = await fetch(
      `https://${CONFIG.subdomain}.3c.plus/api/v1/agent/call/${callId}/qualify?api_token=${CONFIG.agentToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `qualification_id=${qualificationId}`,
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

// --- Desligar chamada (via proxy backend) ---
export async function hangup(callId: string): Promise<boolean> {
  if (!callId) return false;
  try {
    const response = await fetch(`/api/ligacoes/hangup/${encodeURIComponent(callId)}`, { method: 'POST', headers: authHeaders() });
    if (!response.ok) {
      const err = await response.text();
      console.error('[3C+] Hangup falhou:', response.status, err);
      return false;
    }
    console.log('[3C+] Hangup OK para', callId);
    return true;
  } catch (error) {
    console.error('[3C+] Erro no Hangup:', error);
    return false;
  }
}

// --- Buscar aluno real pelo telefone ---
export interface AlunoLigacao {
  codigo: number;
  nome: string;
  cpf: string | null;
  celular: string | null;
  email: string | null;
  matricula: string | null;
  valorInadimplente: number;
  diasAtraso: number | null;
  parcelasAtraso: number;
  serasaAtivo: boolean;
}

export async function buscarAlunoPorTelefone(phone: string): Promise<AlunoLigacao | null> {
  if (!phone) return null;
  try {
    const response = await fetch(`/api/ligacoes/aluno-por-telefone?phone=${encodeURIComponent(phone)}`, { headers: authHeaders() });
    if (!response.ok) return null;
    const { data } = await response.json();
    return data || null;
  } catch (error) {
    console.error('[3C+] Erro ao buscar aluno:', error);
    return null;
  }
}
