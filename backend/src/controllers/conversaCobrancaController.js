/**
 * Controller de ConversaCobranca.
 *
 * Endpoints:
 * - GET    /                  listar (filtros: status, agenteId, instanciaId)
 * - GET    /:id               detalhes + mensagens
 * - POST   /:id/assumir       atribui ao agente, status → EM_ATENDIMENTO
 * - POST   /:id/encerrar      { motivo, observacao } → ENCERRADA
 * - POST   /:id/transferir    { agenteId }
 * - POST   /:id/snooze        { reativarEm } → SNOOZE
 * - POST   /:id/reativar      → AGUARDANDO
 */

import { prisma } from '../config/database.js';
import { getRealtimeIo } from '../realtime.js';

function broadcastAtualizacao(conversa) {
  const io = getRealtimeIo();
  if (io) io.emit('conversa:atualizada', conversa);
}

// ─── Listagem ─────────────────────────────────────────────
export async function listar(req, res, next) {
  try {
    const { status, agenteId, instanciaId } = req.query;
    const where = {};
    if (status) where.status = status;
    if (agenteId) where.agenteId = Number(agenteId);
    if (instanciaId) where.instanciaId = String(instanciaId);

    const conversas = await prisma.conversaCobranca.findMany({
      where,
      orderBy: [
        { status: 'asc' },
        { ultimaMensagemCliente: 'desc' },
      ],
      take: 200,
    });

    // Enriquecer com pessoaNome do SEI (conversa_cobranca so tem contatoNome,
    // que pode ser o numero quando o aluno nao tem nome no contato WhatsApp).
    const codigos = [...new Set(conversas.map(c => c.pessoaCodigo).filter(Boolean))];
    const pessoas = codigos.length > 0
      ? await prisma.pessoa.findMany({
          where: { codigo: { in: codigos } },
          select: { codigo: true, nome: true, cpf: true },
        })
      : [];
    const mapa = new Map(pessoas.map(p => [p.codigo, p]));

    const enriquecidas = conversas.map(c => {
      const p = c.pessoaCodigo ? mapa.get(c.pessoaCodigo) : null;
      return {
        ...c,
        pessoaNome: p?.nome || null,
        pessoaCpf: p?.cpf || null,
      };
    });

    res.json({ data: enriquecidas });
  } catch (error) {
    next(error);
  }
}

// ─── Detalhes + mensagens ─────────────────────────────────
export async function obter(req, res, next) {
  try {
    const { id } = req.params;
    const conversa = await prisma.conversaCobranca.findUnique({ where: { id } });
    if (!conversa) return res.status(404).json({ error: 'Conversa nao encontrada' });

    const mensagens = await prisma.mensagemWhatsapp.findMany({
      where: { chatId: Number(conversa.chatId) },
      orderBy: { timestamp: 'asc' },
      take: 500,
    });

    res.json({ data: { conversa, mensagens } });
  } catch (error) {
    next(error);
  }
}

// ─── Assumir (AGUARDANDO → EM_ATENDIMENTO) ─────────────────
export async function assumir(req, res, next) {
  try {
    const { id } = req.params;
    const { agenteId, agenteNome } = req.body;

    if (!agenteId) return res.status(400).json({ error: 'agenteId obrigatorio' });

    const conversa = await prisma.conversaCobranca.update({
      where: { id },
      data: {
        status: 'EM_ATENDIMENTO',
        agenteId: Number(agenteId),
        agenteNome: agenteNome || null,
        assumidoEm: new Date(),
      },
    });
    broadcastAtualizacao(conversa);
    res.json(conversa);
  } catch (error) {
    next(error);
  }
}

// ─── Encerrar ─────────────────────────────────────────────
export async function encerrar(req, res, next) {
  try {
    const { id } = req.params;
    const { motivo, observacao } = req.body;

    const motivosValidos = [
      'ACORDO_FECHADO', 'PAGO_AVISTA', 'SEM_RETORNO',
      'RECUSOU', 'NAO_E_DEVEDOR', 'TRANSFERIDO_JURIDICO', 'OUTRO',
    ];
    if (!motivo || !motivosValidos.includes(motivo)) {
      return res.status(400).json({ error: `motivo invalido. Use: ${motivosValidos.join(', ')}` });
    }

    const conversa = await prisma.conversaCobranca.update({
      where: { id },
      data: {
        status: 'ENCERRADA',
        motivoEncerramento: motivo,
        observacaoEncerramento: observacao || null,
        encerradoEm: new Date(),
      },
    });
    broadcastAtualizacao(conversa);
    res.json(conversa);
  } catch (error) {
    next(error);
  }
}

// ─── Transferir ───────────────────────────────────────────
export async function transferir(req, res, next) {
  try {
    const { id } = req.params;
    const { agenteId, agenteNome } = req.body;

    if (!agenteId) return res.status(400).json({ error: 'agenteId obrigatorio' });

    const conversa = await prisma.conversaCobranca.update({
      where: { id },
      data: {
        agenteId: Number(agenteId),
        agenteNome: agenteNome || null,
        status: 'EM_ATENDIMENTO',
        assumidoEm: new Date(),
      },
    });
    broadcastAtualizacao(conversa);
    res.json(conversa);
  } catch (error) {
    next(error);
  }
}

// ─── Snooze ───────────────────────────────────────────────
export async function snooze(req, res, next) {
  try {
    const { id } = req.params;
    const { reativarEm } = req.body;

    if (!reativarEm) return res.status(400).json({ error: 'reativarEm obrigatorio (ISO date)' });

    const conversa = await prisma.conversaCobranca.update({
      where: { id },
      data: {
        status: 'SNOOZE',
        reativarEm: new Date(reativarEm),
      },
    });
    broadcastAtualizacao(conversa);
    res.json(conversa);
  } catch (error) {
    next(error);
  }
}

// ─── Reativar ─────────────────────────────────────────────
export async function reativar(req, res, next) {
  try {
    const { id } = req.params;

    const conversa = await prisma.conversaCobranca.update({
      where: { id },
      data: {
        status: 'AGUARDANDO',
        reativarEm: null,
      },
    });
    broadcastAtualizacao(conversa);
    res.json(conversa);
  } catch (error) {
    next(error);
  }
}
