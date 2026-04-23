/**
 * Handler de eventos de Ligacao vindos do Socket 3C Plus.
 *
 * IMPORTANTE: mapeamento de campos baseado em payloads reais capturados em 2026-04-15:
 * - call-was-created:   call.{call_mode, campaign_id, phone, agent (number), id, telephony_id, sid}
 * - call-was-connected: + agent{id,name} top-level + campaign{id,name} top-level + call.connected_time
 * - call-was-answered:  call.answered_time (unix)
 * - call-was-hung-up:   call.hangup_cause, call.hangup_cause_txt (NAO _text!), call.hangup_time
 * - call-was-finished:  similar ao hung-up, com agent top-level
 * - call-history-was-created: TUDO em callHistory.* (billed_time, speaking_time, qualification, etc.)
 */

import { prisma } from '../../config/database.js';
import { getRealtimeIo } from '../../realtime.js';
import { vincularPessoa } from '../../services/conversaCobrancaService.js';
import {
  isAgenteNosso,
  registrarRecebido,
  registrarProcessado,
  registrarFiltrado,
} from '../../services/threecplusWhitelist.js';

/**
 * Decide se um evento deve ser processado baseado no agentId no payload.
 * Quando o evento tem agentId explicito, filtra por whitelist.
 * Quando nao tem (call-history-was-created, call-was-abandoned, as vezes created/answered),
 * faz lookup do registro_ligacao existente pelo telephonyId para herdar o agentId.
 *
 * Retorna true se deve processar, false se deve descartar.
 */
async function deveProcessar({ agentIdPayload, telephonyId }) {
  if (agentIdPayload) {
    return isAgenteNosso(agentIdPayload);
  }
  if (!telephonyId) return false;
  const existente = await prisma.registroLigacao.findUnique({
    where: { telephonyId },
    select: { agenteId: true },
  });
  return !!(existente?.agenteId && isAgenteNosso(existente.agenteId));
}

// Persiste evento bruto para auditoria (append-only)
async function persistirEventoRaw(tipo, payload) {
  try {
    const call = payload?.call || {};
    await prisma.eventoLigacaoRaw.create({
      data: {
        tipo,
        telephonyId: String(call.telephony_id || payload?.telephony_id || '') || null,
        telefone: call.phone || payload?.phone || null,
        agenteId: Number(payload?.agent?.id || call.agent) || null,
        payload,
      },
    });
  } catch (e) {
    console.warn('[Worker/Ligacao] Falha ao persistir raw:', e.message);
  }
}

// Upsert do RegistroLigacao por telephonyId
async function upsertRegistro(telephonyId, patch, defaultsCreate = {}) {
  if (!telephonyId) return null;
  try {
    return await prisma.registroLigacao.upsert({
      where: { telephonyId },
      // No create, combinamos: campos sempre exigidos (via defaults) + patch atual
      create: {
        telephonyId,
        modo: 'click2call',
        telefone: '',
        dataHoraChamada: new Date(),
        status: 0,
        ...defaultsCreate,
        ...patch,
      },
      update: patch,
    });
  } catch (e) {
    console.warn('[Worker/Ligacao] Falha ao upsert registro:', e.message);
    return null;
  }
}

function emitirEvento(tipo, data) {
  const io = getRealtimeIo();
  if (io) io.emit('ligacao:evento', { tipo, data });
}

// Converte unix timestamp (segundos) para Date, lidando com string ou number
function unixParaDate(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000);
}

// ─── Handlers individuais ──────────────────────────────────

export async function onCallCreated(payload) {
  registrarRecebido();
  const call = payload?.call || {};
  const telId = String(call.telephony_id || payload?.telephony_id || '');
  const agentIdPayload = Number(call.agent) || Number(payload?.agent?.id) || null;
  if (!(await deveProcessar({ agentIdPayload, telephonyId: telId }))) {
    registrarFiltrado();
    return;
  }
  registrarProcessado();
  await persistirEventoRaw('call-was-created', payload);
  const telefone = call.phone || '';

  // Vincular pessoa pelo telefone
  let pessoaCodigo = null;
  if (telefone) {
    try {
      const pessoa = await vincularPessoa(telefone);
      pessoaCodigo = pessoa?.codigo || null;
    } catch { /* ignora */ }
  }

  await upsertRegistro(telId, {
    callId: String(call.id || '') || null,
    campanhaId: Number(call.campaign_id) || null,
    modo: call.call_mode || 'click2call',
    telefone,
    agenteId: Number(call.agent) || null,
    dataHoraChamada: new Date(),
    status: Number(call.status) || 0,
    pessoaCodigo,
  });
  emitirEvento('call-was-created', payload);
}

export async function onCallAnswered(payload) {
  registrarRecebido();
  const call = payload?.call || {};
  const telId = String(call.telephony_id || payload?.telephony_id || '');
  const agentIdPayload = Number(payload?.agent?.id) || Number(call.agent) || null;
  if (!(await deveProcessar({ agentIdPayload, telephonyId: telId }))) {
    registrarFiltrado();
    return;
  }
  registrarProcessado();
  await persistirEventoRaw('call-was-answered', payload);

  const dataAnsw = unixParaDate(call.answered_time) || new Date();

  await upsertRegistro(telId, {
    dataHoraAtendida: dataAnsw,
  });
  emitirEvento('call-was-answered', payload);
}

export async function onCallConnected(payload) {
  registrarRecebido();
  const call = payload?.call || {};
  const agent = payload?.agent || {};
  const campaign = payload?.campaign || {};
  const telId = String(call.telephony_id || payload?.telephony_id || '');
  const agentIdPayload = Number(agent.id) || Number(call.agent) || null;
  if (!(await deveProcessar({ agentIdPayload, telephonyId: telId }))) {
    registrarFiltrado();
    return;
  }
  registrarProcessado();
  await persistirEventoRaw('call-was-connected', payload);

  const dataConn = unixParaDate(call.connected_time) || new Date();

  // Evento "connected" eh rico: enriquece o registro com nome do agente e campanha
  await upsertRegistro(telId, {
    callId: String(call.id || '') || null,
    campanhaId: Number(call.campaign_id) || Number(campaign.id) || null,
    campanhaNome: campaign.name || null,
    modo: call.call_mode || 'click2call',
    telefone: call.phone || '',
    agenteId: Number(agent.id) || Number(call.agent) || null,
    agenteNome: agent.name || null,
    dataHoraConectada: dataConn,
    status: Number(call.status) || 3,
  });
  emitirEvento('call-was-connected', payload);
}

export async function onCallHungUp(payload) {
  registrarRecebido();
  const call = payload?.call || {};
  const telId = String(call.telephony_id || payload?.telephony_id || '');
  const agentIdPayload = Number(payload?.agent?.id) || Number(call.agent) || null;
  if (!(await deveProcessar({ agentIdPayload, telephonyId: telId }))) {
    registrarFiltrado();
    return;
  }
  registrarProcessado();
  await persistirEventoRaw('call-was-hung-up', payload);

  const dataHang = unixParaDate(call.hangup_time) || new Date();

  await upsertRegistro(telId, {
    dataHoraDesligada: dataHang,
    hangupCause: Number(call.hangup_cause) || null,
    hangupCauseTexto: call.hangup_cause_txt || call.hangup_cause_text || null,
  });
  emitirEvento('call-was-hung-up', payload);
}

export async function onCallFinished(payload) {
  registrarRecebido();
  const call = payload?.call || {};
  const agent = payload?.agent || {};
  const telId = String(call.telephony_id || payload?.telephony_id || '');
  const agentIdPayload = Number(agent.id) || Number(call.agent) || null;
  if (!(await deveProcessar({ agentIdPayload, telephonyId: telId }))) {
    registrarFiltrado();
    return;
  }
  registrarProcessado();
  await persistirEventoRaw('call-was-finished', payload);

  const dataHang = unixParaDate(call.hangup_time);

  await upsertRegistro(telId, {
    agenteId: Number(agent.id) || Number(call.agent) || undefined,
    agenteNome: agent.name || undefined,
    dataHoraDesligada: dataHang || undefined,
    hangupCause: Number(call.hangup_cause) || undefined,
    hangupCauseTexto: call.hangup_cause_txt || call.hangup_cause_text || undefined,
  });
  emitirEvento('call-was-finished', payload);
}

export async function onCallUnanswered(payload) {
  registrarRecebido();
  const call = payload?.call || {};
  const telId = String(call.telephony_id || payload?.telephony_id || '');
  const agentIdPayload = Number(payload?.agent?.id) || Number(call.agent) || null;
  if (!(await deveProcessar({ agentIdPayload, telephonyId: telId }))) {
    registrarFiltrado();
    return;
  }
  registrarProcessado();
  await persistirEventoRaw('call-was-unanswered', payload);
  await upsertRegistro(telId, { statusTexto: 'unanswered' });
  emitirEvento('call-was-unanswered', payload);
}

export async function onCallAbandoned(payload) {
  registrarRecebido();
  const call = payload?.call || {};
  const telId = String(call.telephony_id || payload?.telephony_id || '');
  const agentIdPayload = Number(payload?.agent?.id) || Number(call.agent) || null;
  if (!(await deveProcessar({ agentIdPayload, telephonyId: telId }))) {
    registrarFiltrado();
    return;
  }
  registrarProcessado();
  await persistirEventoRaw('call-was-abandoned', payload);
  await upsertRegistro(telId, { statusTexto: 'abandoned' });
  emitirEvento('call-was-abandoned', payload);
}

export async function onCallHistoryCreated(payload) {
  registrarRecebido();
  const hist = payload?.callHistory || {};
  const telId = String(hist.telephony_id || payload?.telephony_id || '');
  // call-history-was-created sempre chega com agent.id=0 — decide pelo registro existente
  if (!(await deveProcessar({ agentIdPayload: null, telephonyId: telId }))) {
    registrarFiltrado();
    return;
  }
  registrarProcessado();
  await persistirEventoRaw('call-history-was-created', payload);

  await upsertRegistro(telId, {
    telefone: hist.number || undefined,
    modo: hist.call_mode || undefined,
    campanhaId: Number(hist.campaign?.id) || undefined,
    campanhaNome: hist.campaign?.name || undefined,
    agenteId: Number(hist.agent?.id) || undefined,
    agenteNome: hist.agent?.name || undefined,
    tempoTotal: Number(hist.billed_time) || null,
    tempoEspera: Number(hist.calling_time) || null,
    tempoFalando: Number(hist.speaking_time) || null,
    tempoComAgente: Number(hist.speaking_with_agent_time) || null,
    tempoAcw: Number(hist.acw_time) || null,
    gravada: Boolean(hist.recorded),
    encerradaPeloAgente: Boolean(hist.ended_by_agent),
    qualificacaoId: Number(hist.qualification?.id) || null,
    qualificacaoNome: hist.qualification?.name || null,
    qualificacaoPositiva: hist.qualification?.is_positive ?? null,
    status: Number(hist.status) || undefined,
    hangupCause: Number(hist.hangup_cause) || undefined,
    amdStatus: hist.amd_status || null,
  });
  emitirEvento('call-history-was-created', payload);

  // Registrar ocorrencia
  try {
    const registro = await prisma.registroLigacao.findFirst({ where: { telephonyId: telId } });
    if (registro?.pessoaCodigo) {
      const atendida = Number(hist.speaking_time) > 0;
      await prisma.ocorrencia.create({
        data: {
          tipo: atendida ? 'LIGACAO_EFETUADA' : 'LIGACAO_NAO_ATENDIDA',
          descricao: atendida
            ? `Ligação ${hist.call_mode || ''} — ${hist.speaking_time || 0}s${hist.qualification?.name ? ` — ${hist.qualification.name}` : ''}`
            : `Ligação ${hist.call_mode || ''} — não atendida`,
          origem: 'SOCKET_3CPLUS',
          pessoaCodigo: registro.pessoaCodigo,
          pessoaNome: registro.pessoaNome,
          agenteNome: hist.agent?.name || registro.agenteNome,
          registroLigacaoId: registro.id,
        },
      });
    }
  } catch {}
}

// Eventos de estado do agente (apenas retransmite + raw)
export async function onAgentIsIdle(payload) {
  registrarRecebido();
  const agentId = Number(payload?.agent?.id) || Number(payload?.id) || null;
  if (!agentId || !isAgenteNosso(agentId)) {
    registrarFiltrado();
    return;
  }
  registrarProcessado();
  await persistirEventoRaw('agent-is-idle', payload);
  emitirEvento('agent-is-idle', payload);
}

export async function onAgentInAcw(payload) {
  registrarRecebido();
  const agentId = Number(payload?.agent?.id) || Number(payload?.id) || null;
  if (!agentId || !isAgenteNosso(agentId)) {
    registrarFiltrado();
    return;
  }
  registrarProcessado();
  await persistirEventoRaw('agent-in-acw', payload);
  emitirEvento('agent-in-acw', payload);
}

export async function onAgentLoginFailed(payload) {
  registrarRecebido();
  const agentId = Number(payload?.agent?.id) || Number(payload?.id) || null;
  if (!agentId || !isAgenteNosso(agentId)) {
    registrarFiltrado();
    return;
  }
  registrarProcessado();
  await persistirEventoRaw('agent-login-failed', payload);
  emitirEvento('agent-login-failed', payload);
}
