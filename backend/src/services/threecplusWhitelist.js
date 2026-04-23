/**
 * Whitelist em memoria dos agentes e instancias WhatsApp do nosso time.
 *
 * Motivacao: o Worker do Socket.io conecta com token de gestor, que recebe
 * TODOS os eventos da 3C Plus (empresa inteira). Sem filtro, o banco se
 * enche com eventos de outros departamentos (ex: vendas, suporte).
 *
 * Os handlers usam os helpers sincronos isAgenteNosso() / isInstanciaNossa()
 * ANTES de qualquer persistencia para descartar eventos que nao sao nossos.
 *
 * Refresh:
 * - Carregamento inicial na startup do Worker
 * - Refresh automatico a cada 5 minutos
 * - Invalidacao manual via invalidarWhitelist() ao criar/alterar/excluir user
 */

import { prisma } from '../config/database.js';

const REFRESH_INTERVAL = 5 * 60 * 1000;

const agenteIds = new Set();
const instanciaIds = new Set();
let ultimoRefresh = 0;
let refreshTimer = null;
let carregamentoInicial = null;

async function carregarDoBanco() {
  const users = await prisma.user.findMany({
    where: { ativo: true },
    select: {
      threecplusAgentId: true,
      instanciasWhatsapp: { select: { instanciaId: true } },
    },
  });

  agenteIds.clear();
  instanciaIds.clear();
  for (const u of users) {
    if (u.threecplusAgentId) agenteIds.add(u.threecplusAgentId);
    for (const i of u.instanciasWhatsapp) {
      if (i.instanciaId) instanciaIds.add(String(i.instanciaId));
    }
  }

  ultimoRefresh = Date.now();
  console.log(`[Whitelist] Carregada — agentes: [${[...agenteIds].join(',')}] | instancias: [${[...instanciaIds].join(',')}]`);
}

export async function getWhitelists() {
  if (!carregamentoInicial) {
    carregamentoInicial = carregarDoBanco();
  }
  await carregamentoInicial;
  return { agenteIds: new Set(agenteIds), instanciaIds: new Set(instanciaIds) };
}

export async function invalidarWhitelist() {
  try {
    await carregarDoBanco();
  } catch (err) {
    console.error('[Whitelist] Erro ao invalidar:', err.message);
  }
}

export function iniciarRefreshAutomatico() {
  if (refreshTimer) return;
  refreshTimer = setInterval(() => {
    carregarDoBanco().catch(err => console.error('[Whitelist] Erro no refresh:', err.message));
  }, REFRESH_INTERVAL);
  console.log(`[Whitelist] Refresh automatico agendado (${REFRESH_INTERVAL / 60000} min)`);
}

export function pararRefreshAutomatico() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// Helpers sincronos — chamados dentro dos handlers antes de persistir.
// Se a whitelist estiver vazia (ex: nenhum user com instanciaWhatsappId cadastrado
// ainda), o filtro fica desativado pra aquela categoria — evita que um admin
// esquecido perca mensagens reais. Quando alguem cadastra um agente/instancia
// de verdade, o filtro passa a valer.
let avisouAgenteVazio = false;
let avisouInstanciaVazia = false;

export function isAgenteNosso(agentId) {
  if (agenteIds.size === 0) {
    if (!avisouAgenteVazio) {
      console.warn('[Whitelist] ⚠️ Lista de agentes vazia — filtro de ligacao desativado. Vincule threecplusAgentId aos users.');
      avisouAgenteVazio = true;
    }
    return true;
  }
  avisouAgenteVazio = false;
  if (!agentId) return false;
  return agenteIds.has(Number(agentId));
}

export function isInstanciaNossa(instanciaId) {
  if (instanciaIds.size === 0) {
    if (!avisouInstanciaVazia) {
      console.warn('[Whitelist] ⚠️ Lista de instancias WhatsApp vazia — filtro desativado. Vincule instanciaWhatsappId aos users.');
      avisouInstanciaVazia = true;
    }
    return true;
  }
  avisouInstanciaVazia = false;
  if (!instanciaId) return false;
  return instanciaIds.has(String(instanciaId));
}

// Telemetria para o heartbeat do Worker
let contadorRecebidos = 0;
let contadorProcessados = 0;
let contadorFiltrados = 0;

export function registrarRecebido() { contadorRecebidos++; }
export function registrarProcessado() { contadorProcessados++; }
export function registrarFiltrado() { contadorFiltrados++; }
export function lerContadoresEReset() {
  const r = { recebidos: contadorRecebidos, processados: contadorProcessados, filtrados: contadorFiltrados };
  contadorRecebidos = 0;
  contadorProcessados = 0;
  contadorFiltrados = 0;
  return r;
}
