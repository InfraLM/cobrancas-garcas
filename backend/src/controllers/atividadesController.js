/**
 * Atividades — MVP
 *
 * Lembretes simples para o agente nao esquecer de retornar contato com aluno
 * (mensagem WhatsApp ou ligacao). Tipos no MVP:
 *  - LEMBRETE_MENSAGEM
 *  - LEMBRETE_LIGACAO
 */

import { prisma } from '../config/database.js';

const TIPOS_VALIDOS = ['LEMBRETE_MENSAGEM', 'LEMBRETE_LIGACAO'];
const STATUS_VALIDOS = ['PENDENTE', 'CONCLUIDA', 'CANCELADA'];

// GET /api/atividades?status=&tipo=&inicio=&fim=&pessoaCodigo=
export async function listar(req, res, next) {
  try {
    const { status, tipo, inicio, fim, pessoaCodigo } = req.query;
    const where = {
      // MVP: cada agente ve apenas as proprias atividades
      agenteId: req.user.id,
    };
    if (status) where.status = String(status);
    if (tipo) where.tipo = String(tipo);
    if (pessoaCodigo) where.pessoaCodigo = Number(pessoaCodigo);
    if (inicio || fim) {
      where.dataHora = {};
      if (inicio) where.dataHora.gte = new Date(String(inicio));
      if (fim) where.dataHora.lte = new Date(String(fim));
    }

    const atividades = await prisma.atividade.findMany({
      where,
      orderBy: { dataHora: 'asc' },
    });
    res.json(atividades);
  } catch (error) {
    next(error);
  }
}

// POST /api/atividades
export async function criar(req, res, next) {
  try {
    const {
      tipo, titulo, descricao, dataHora,
      pessoaCodigo, pessoaNome, telefone,
      origem, origemRefId, metadados,
    } = req.body;

    if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ error: `tipo deve ser um de: ${TIPOS_VALIDOS.join(', ')}` });
    }
    if (!titulo) return res.status(400).json({ error: 'titulo obrigatorio' });
    if (!dataHora) return res.status(400).json({ error: 'dataHora obrigatorio' });

    const atividade = await prisma.atividade.create({
      data: {
        tipo,
        titulo,
        descricao: descricao || null,
        dataHora: new Date(dataHora),
        agenteId: req.user.id,
        agenteNome: req.user.nome,
        pessoaCodigo: pessoaCodigo ? Number(pessoaCodigo) : null,
        pessoaNome: pessoaNome || null,
        telefone: telefone || null,
        origem: origem || 'MANUAL',
        origemRefId: origemRefId || null,
        metadados: metadados || null,
      },
    });
    res.status(201).json(atividade);
  } catch (error) {
    next(error);
  }
}

// PATCH /api/atividades/:id — editar campos basicos
export async function atualizar(req, res, next) {
  try {
    const { titulo, descricao, dataHora, status } = req.body;
    const data = {};
    if (titulo !== undefined) data.titulo = titulo;
    if (descricao !== undefined) data.descricao = descricao;
    if (dataHora !== undefined) data.dataHora = new Date(dataHora);
    if (status !== undefined) {
      if (!STATUS_VALIDOS.includes(status)) {
        return res.status(400).json({ error: `status invalido` });
      }
      data.status = status;
      if (status === 'CONCLUIDA') data.concluidoEm = new Date();
    }

    // Garante que so o dono altera
    const existente = await prisma.atividade.findUnique({ where: { id: req.params.id } });
    if (!existente) return res.status(404).json({ error: 'Atividade nao encontrada' });
    if (existente.agenteId !== req.user.id) return res.status(403).json({ error: 'Sem permissao' });

    const atividade = await prisma.atividade.update({
      where: { id: req.params.id },
      data,
    });
    res.json(atividade);
  } catch (error) {
    next(error);
  }
}

// POST /api/atividades/:id/concluir — atalho
export async function concluir(req, res, next) {
  try {
    const existente = await prisma.atividade.findUnique({ where: { id: req.params.id } });
    if (!existente) return res.status(404).json({ error: 'Atividade nao encontrada' });
    if (existente.agenteId !== req.user.id) return res.status(403).json({ error: 'Sem permissao' });

    const atividade = await prisma.atividade.update({
      where: { id: req.params.id },
      data: { status: 'CONCLUIDA', concluidoEm: new Date() },
    });
    res.json(atividade);
  } catch (error) {
    next(error);
  }
}

// DELETE /api/atividades/:id — cancelar (mantem registro)
export async function cancelar(req, res, next) {
  try {
    const existente = await prisma.atividade.findUnique({ where: { id: req.params.id } });
    if (!existente) return res.status(404).json({ error: 'Atividade nao encontrada' });
    if (existente.agenteId !== req.user.id) return res.status(403).json({ error: 'Sem permissao' });

    await prisma.atividade.update({
      where: { id: req.params.id },
      data: { status: 'CANCELADA' },
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// GET /api/atividades/resumo — contadores rapidos para o sino do header
export async function resumo(req, res, next) {
  try {
    const agora = new Date();
    const em30min = new Date(agora.getTime() + 30 * 60 * 1000);

    const [vencidas, vencendoAgora] = await Promise.all([
      prisma.atividade.count({
        where: { agenteId: req.user.id, status: 'PENDENTE', dataHora: { lt: agora } },
      }),
      prisma.atividade.count({
        where: {
          agenteId: req.user.id,
          status: 'PENDENTE',
          dataHora: { gte: agora, lte: em30min },
        },
      }),
    ]);

    res.json({ vencidas, vencendoAgora });
  } catch (error) {
    next(error);
  }
}
