import { prisma } from '../config/database.js';

/**
 * GET /api/ocorrencias?tipo=&search=&page=1&limit=50&de=&ate=
 * Timeline global de ocorrencias de todos os alunos
 */
export async function listarGlobal(req, res, next) {
  try {
    const { tipo, search, page = 1, limit = 50, de, ate } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Construir filtros
    const where = {};
    if (tipo) where.tipo = tipo;
    if (search) {
      where.OR = [
        { pessoaNome: { contains: search, mode: 'insensitive' } },
        { descricao: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (de || ate) {
      where.criadoEm = {};
      if (de) where.criadoEm.gte = new Date(de);
      if (ate) where.criadoEm.lte = new Date(ate + 'T23:59:59');
    }

    const [ocorrencias, total] = await Promise.all([
      prisma.ocorrencia.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip: offset,
        take: Number(limit),
      }),
      prisma.ocorrencia.count({ where }),
    ]);

    res.json({ data: ocorrencias, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/ocorrencias/tipos
 * Lista tipos distintos de ocorrencias existentes (para filtro)
 */
export async function listarTipos(req, res, next) {
  try {
    const tipos = await prisma.$queryRawUnsafe(`
      SELECT tipo, COUNT(*)::int AS count
      FROM cobranca.ocorrencia
      GROUP BY tipo
      ORDER BY count DESC
    `);
    res.json(tipos);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/ocorrencias/metricas
 * Metricas resumidas de ocorrencias
 */
export async function metricas(req, res, next) {
  try {
    const result = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE "criadoEm" >= CURRENT_DATE)::int AS hoje,
        COUNT(*) FILTER (WHERE "criadoEm" >= CURRENT_DATE - INTERVAL '7 days')::int AS semana
      FROM cobranca.ocorrencia
    `);
    res.json(result[0] || { total: 0, hoje: 0, semana: 0 });
  } catch (error) {
    next(error);
  }
}
