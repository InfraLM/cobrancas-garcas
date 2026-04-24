import { prisma } from '../config/database.js';
import {
  criarPausa,
  removerPausa,
  listarHistoricoPorPessoa,
  removerEmMassaPorCodigos,
  MOTIVOS_VALIDOS,
} from '../services/pausaLigacaoService.js';

async function resolverPessoaNome(pessoaCodigo) {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT nome FROM cobranca.pessoa WHERE codigo = $1 LIMIT 1`,
      Number(pessoaCodigo)
    );
    return rows?.[0]?.nome || null;
  } catch {
    return null;
  }
}

// POST /api/pausas-ligacao
export async function criar(req, res, next) {
  try {
    const { pessoaCodigo, motivo, observacao, pausaAte } = req.body || {};
    if (!pessoaCodigo) return res.status(400).json({ error: 'pessoaCodigo obrigatorio' });
    if (!MOTIVOS_VALIDOS.includes(motivo)) {
      return res.status(400).json({ error: `Motivo invalido. Use: ${MOTIVOS_VALIDOS.join(', ')}` });
    }

    const pessoaNome = await resolverPessoaNome(pessoaCodigo);

    const usuario = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { nome: true },
    });
    const nomeAgente = usuario?.nome || req.user.email || 'Agente';

    const pausa = await criarPausa({
      pessoaCodigo: Number(pessoaCodigo),
      pessoaNome,
      motivo,
      observacao,
      origem: 'AGENTE',
      pausadoPor: req.user.id,
      pausadoPorNome: nomeAgente,
      pausaAte: pausaAte || null,
    });

    res.status(201).json(pausa);
  } catch (error) {
    next(error);
  }
}

// DELETE /api/pausas-ligacao/:id
export async function remover(req, res, next) {
  try {
    const { motivoRemocao } = req.body || {};
    const usuario = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { nome: true },
    });
    const nomeAgente = usuario?.nome || req.user.email || 'Agente';

    const pausa = await removerPausa({
      pausaId: req.params.id,
      removidoPor: req.user.id,
      removidoPorNome: nomeAgente,
      motivoRemocao,
    });
    res.json(pausa);
  } catch (error) {
    if (/nao encontrada/i.test(error?.message || '')) {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
}

// GET /api/pausas-ligacao/por-aluno/:codigo
export async function historicoPorAluno(req, res, next) {
  try {
    const historico = await listarHistoricoPorPessoa(req.params.codigo);
    res.json({ data: historico });
  } catch (error) {
    next(error);
  }
}

// POST /api/pausas-ligacao/remover-em-massa
export async function removerEmMassa(req, res, next) {
  try {
    const { codigos, motivoRemocao } = req.body || {};
    if (!Array.isArray(codigos) || codigos.length === 0) {
      return res.status(400).json({ error: 'codigos deve ser array nao-vazio' });
    }

    const usuario = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { nome: true },
    });
    const nomeAgente = usuario?.nome || req.user.email || 'Agente';

    const removidas = await removerEmMassaPorCodigos({
      codigos,
      removidoPor: req.user.id,
      removidoPorNome: nomeAgente,
      motivoRemocao,
    });

    res.json({ removidas });
  } catch (error) {
    next(error);
  }
}
