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
 * - POST   /:id/marcar-lido   zera contador de mensagens nao lidas
 */

import { prisma } from '../config/database.js';
import { getRealtimeIo } from '../realtime.js';

function broadcastAtualizacao(conversa) {
  const io = getRealtimeIo();
  if (io) io.emit('conversa:atualizada', conversa);
}

// ─── Listagem ─────────────────────────────────────────────
// Agrupa conversas por aluno (pessoaCodigo quando vinculado, contatoNumero senao).
// Retorna a "campea" (mais recente) por grupo, com instanciasTipo:string[]
// indicando quais canais o aluno tem chat.
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
        { ultimaAtividadeEm: 'desc' },
      ],
      take: 400,  // dobrado pq agrupamento abaixo pode reduzir o set
    });

    // Agrupar por chave (pessoaCodigo:N | numero:contato). Manter a "campea"
    // (primeira do array — ja vem ordenada por ultimaAtividadeEm desc dentro do mesmo status).
    const grupos = new Map();
    for (const c of conversas) {
      const chave = c.pessoaCodigo ? `pessoa:${c.pessoaCodigo}` : `numero:${c.contatoNumero}`;
      if (!grupos.has(chave)) {
        grupos.set(chave, { campea: c, instanciasTipo: new Set() });
      }
      if (c.instanciaTipo) grupos.get(chave).instanciasTipo.add(c.instanciaTipo);
    }

    const agregadas = [...grupos.values()].slice(0, 200).map(g => ({
      ...g.campea,
      instanciasTipo: [...g.instanciasTipo],
    }));

    // Enriquecer com pessoaNome do SEI
    const codigos = [...new Set(agregadas.map(c => c.pessoaCodigo).filter(Boolean))];
    const pessoas = codigos.length > 0
      ? await prisma.pessoa.findMany({
          where: { codigo: { in: codigos } },
          select: { codigo: true, nome: true, cpf: true },
        })
      : [];
    const mapa = new Map(pessoas.map(p => [p.codigo, p]));

    const enriquecidas = agregadas.map(c => {
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

// ─── Detalhes + mensagens unificadas (do mesmo aluno em todas as instancias) ──
export async function obter(req, res, next) {
  try {
    const { id } = req.params;
    const conversa = await prisma.conversaCobranca.findUnique({ where: { id } });
    if (!conversa) return res.status(404).json({ error: 'Conversa nao encontrada' });

    // Conversas "irmas" do mesmo aluno: vincula por pessoaCodigo (preferencial,
    // robusto a numero diferente de telefone) ou por contatoNumero quando ainda
    // nao ha pessoa vinculada.
    const irmas = await prisma.conversaCobranca.findMany({
      where: conversa.pessoaCodigo
        ? { pessoaCodigo: conversa.pessoaCodigo }
        : { contatoNumero: conversa.contatoNumero },
      select: {
        id: true,
        chatId: true,
        instanciaId: true,
        instanciaTipo: true,
        ultimaMensagemCliente: true,
      },
    });

    const chatIds = irmas.map(c => Number(c.chatId)).filter(n => !Number.isNaN(n));
    const mensagens = await prisma.mensagemWhatsapp.findMany({
      where: { chatId: { in: chatIds } },
      orderBy: { timestamp: 'asc' },
      take: 1000,
    });

    res.json({ data: { conversa, mensagens, conversasIrmas: irmas } });
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

// ─── Marcar como lido (zera contador) ─────────────────────
export async function marcarLido(req, res, next) {
  try {
    const { id } = req.params;

    const conversa = await prisma.conversaCobranca.update({
      where: { id },
      data: { naoLidos: 0 },
    });
    broadcastAtualizacao(conversa);
    res.json(conversa);
  } catch (error) {
    next(error);
  }
}
