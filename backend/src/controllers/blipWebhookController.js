import { prisma } from '../config/database.js';

function sanitizarCpf(raw) {
  if (!raw) return null;
  const match = raw.replace(/[.\-\/]/g, '').match(/\d{11}/);
  if (!match) return null;
  const d = match[0];
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9,11)}`;
}

function sanitizarTelefone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0,2)}) ${local.slice(2,7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0,2)}) ${local.slice(2,6)}-${local.slice(6)}`;
  }
  return null;
}

export async function handleBlipWebhook(req, res, next) {
  // Retorna 200 imediatamente (requisito Blip - evita bloqueio de 4h)
  res.status(200).json({ ok: true });

  try {
    const payload = req.body;

    // Ticket criado/atualizado
    if (payload?.id && payload?.customerIdentity) {
      await prisma.blipTicket.upsert({
        where: { id: String(payload.id) },
        update: {
          sequentialId:     payload.sequentialId != null ? parseInt(payload.sequentialId, 10) : null,
          customerIdentity: payload.customerIdentity?.trim() || null,
          agentIdentity:    payload.agentIdentity?.trim() || null,
          status:           payload.status?.trim() || null,
          storageDate:      payload.storageDate?.trim() || null,
          team:             payload.team?.trim() || null,
          closed:           payload.closed != null ? (payload.closed ? 1 : 0) : null,
          priority:         payload.priority != null ? parseInt(payload.priority, 10) : null,
        },
        create: {
          id:               String(payload.id).trim(),
          sequentialId:     payload.sequentialId != null ? parseInt(payload.sequentialId, 10) : null,
          customerIdentity: payload.customerIdentity?.trim() || null,
          agentIdentity:    payload.agentIdentity?.trim() || null,
          status:           payload.status?.trim() || null,
          storageDate:      payload.storageDate?.trim() || null,
          team:             payload.team?.trim() || null,
          closed:           payload.closed != null ? (payload.closed ? 1 : 0) : null,
          priority:         payload.priority != null ? parseInt(payload.priority, 10) : null,
        },
      });
    }

    // Contato criado/atualizado
    if (payload?.identity && !payload?.customerIdentity) {
      const cpfRaw = payload.extras?.cpfCnpj?.trim() || null;
      const phoneRaw = payload.phoneNumber?.trim() || null;

      await prisma.blipContact.upsert({
        where: { identity: payload.identity.trim() },
        update: {
          name:                payload.name?.trim() || null,
          phoneNumber:         phoneRaw,
          cpf:                 cpfRaw,
          cpf_sanitizado:      sanitizarCpf(cpfRaw),
          telefone_sanitizado: sanitizarTelefone(phoneRaw),
        },
        create: {
          identity:            payload.identity.trim(),
          name:                payload.name?.trim() || null,
          phoneNumber:         phoneRaw,
          cpf:                 cpfRaw,
          cpf_sanitizado:      sanitizarCpf(cpfRaw),
          telefone_sanitizado: sanitizarTelefone(phoneRaw),
        },
      });
    }
  } catch (err) {
    console.error('Erro ao processar webhook Blip:', err.message);
  }
}
