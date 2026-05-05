import { prisma } from '../config/database.js';

// Atribuicao de tags por aluno (1:N). Soft-delete via removidoEm preserva
// historico para series temporais.
//
// Toda aplicacao/remocao gera Ocorrencia (TAG_APLICADA / TAG_REMOVIDA) na
// timeline do aluno, com tagCodigo nos metadados (nao label) — mantem
// historico coerente mesmo que a tag seja renomeada depois.

async function buscarPessoaNome(pessoaCodigo) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT nome FROM cobranca.pessoa WHERE codigo = $1 LIMIT 1`,
    pessoaCodigo
  );
  return rows[0]?.nome || null;
}

export async function listarPorAluno(req, res, next) {
  try {
    const pessoaCodigo = Number(req.params.codigo);
    if (!Number.isFinite(pessoaCodigo)) {
      return res.status(400).json({ error: 'codigo do aluno invalido' });
    }

    const incluirRemovidas = req.query.incluirRemovidas === 'true';

    const where = { pessoaCodigo };
    if (!incluirRemovidas) where.removidoEm = null;

    const atribuicoes = await prisma.alunoTag.findMany({
      where,
      include: { tag: true },
      orderBy: [{ criadoEm: 'desc' }],
    });

    res.json({ data: atribuicoes });
  } catch (error) {
    next(error);
  }
}

export async function aplicar(req, res, next) {
  try {
    const pessoaCodigo = Number(req.params.codigo);
    if (!Number.isFinite(pessoaCodigo)) {
      return res.status(400).json({ error: 'codigo do aluno invalido' });
    }

    const { tagId, observacao, origemConversaId, origemAcordoId } = req.body;
    if (!tagId) return res.status(400).json({ error: 'tagId obrigatorio' });

    const tag = await prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) return res.status(404).json({ error: 'tag nao encontrada' });
    if (!tag.ativo) return res.status(400).json({ error: 'tag esta desativada' });

    // Idempotencia: se ja existe atribuicao ATIVA da mesma tag para o aluno,
    // retorna a existente (nao duplica).
    const existente = await prisma.alunoTag.findFirst({
      where: { pessoaCodigo, tagId, removidoEm: null },
      include: { tag: true },
    });
    if (existente) return res.status(200).json({ data: existente, ja_existia: true });

    const pessoaNome = await buscarPessoaNome(pessoaCodigo);

    const atrib = await prisma.alunoTag.create({
      data: {
        pessoaCodigo,
        tagId,
        observacao: observacao || null,
        origemConversaId: origemConversaId || null,
        origemAcordoId: origemAcordoId || null,
        criadoPor: req.user?.id || 0,
        criadoPorNome: req.user?.nome || null,
      },
      include: { tag: true },
    });

    // Timeline / auditoria
    try {
      await prisma.ocorrencia.create({
        data: {
          tipo: 'TAG_APLICADA',
          descricao: `Tag aplicada: ${tag.label}${observacao ? ` — ${observacao}` : ''}`,
          origem: 'AGENTE',
          pessoaCodigo,
          pessoaNome,
          agenteNome: req.user?.nome || null,
          acordoId: origemAcordoId || null,
          metadados: {
            tagId: tag.id,
            tagCodigo: tag.codigo,
            tagCategoria: tag.categoria,
            observacao: observacao || null,
          },
        },
      });
    } catch (err) {
      console.warn('[AlunoTag] Falha ao criar ocorrencia TAG_APLICADA:', err.message);
    }

    res.status(201).json({ data: atrib });
  } catch (error) {
    next(error);
  }
}

export async function remover(req, res, next) {
  try {
    const pessoaCodigo = Number(req.params.codigo);
    const atribId = req.params.atribId;

    const atrib = await prisma.alunoTag.findUnique({
      where: { id: atribId },
      include: { tag: true },
    });
    if (!atrib) return res.status(404).json({ error: 'atribuicao nao encontrada' });
    if (atrib.pessoaCodigo !== pessoaCodigo) {
      return res.status(400).json({ error: 'atribuicao nao pertence a este aluno' });
    }
    if (atrib.removidoEm) {
      return res.status(200).json({ data: atrib, ja_removida: true });
    }

    const atualizada = await prisma.alunoTag.update({
      where: { id: atribId },
      data: {
        removidoEm: new Date(),
        removidoPor: req.user?.id || 0,
        removidoPorNome: req.user?.nome || null,
      },
      include: { tag: true },
    });

    const pessoaNome = await buscarPessoaNome(pessoaCodigo);
    try {
      await prisma.ocorrencia.create({
        data: {
          tipo: 'TAG_REMOVIDA',
          descricao: `Tag removida: ${atrib.tag.label}`,
          origem: 'AGENTE',
          pessoaCodigo,
          pessoaNome,
          agenteNome: req.user?.nome || null,
          metadados: {
            tagId: atrib.tag.id,
            tagCodigo: atrib.tag.codigo,
            tagCategoria: atrib.tag.categoria,
          },
        },
      });
    } catch (err) {
      console.warn('[AlunoTag] Falha ao criar ocorrencia TAG_REMOVIDA:', err.message);
    }

    res.json({ data: atualizada });
  } catch (error) {
    next(error);
  }
}
