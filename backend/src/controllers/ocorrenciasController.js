import { prisma } from '../config/database.js';
import { buildWhereNome, normalizarBusca } from '../utils/buscaNomeHelper.js';

/**
 * GET /api/ocorrencias?tipo=&search=&page=1&limit=50&de=&ate=
 * Timeline global de ocorrencias de todos os alunos
 */
export async function listarGlobal(req, res, next) {
  try {
    const { tipo, search, page = 1, limit = 50, de, ate } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const termo = String(search || '').trim();

    // Sem busca: Prisma puro, ordenado por criadoEm desc.
    if (!termo) {
      const where = {};
      if (tipo) where.tipo = tipo;
      if (de || ate) {
        where.criadoEm = {};
        if (de) where.criadoEm.gte = new Date(de);
        if (ate) where.criadoEm.lte = new Date(ate + 'T23:59:59');
      }
      const [ocorrencias, total] = await Promise.all([
        prisma.ocorrencia.findMany({
          where, orderBy: { criadoEm: 'desc' }, skip: offset, take: Number(limit),
        }),
        prisma.ocorrencia.count({ where }),
      ]);
      return res.json({ data: ocorrencias, total, page: Number(page), limit: Number(limit) });
    }

    // Com busca: raw query combinando helper de nome + fallback em descricao (ILIKE normalizado).
    const busca = buildWhereNome({
      colunaNome: '"pessoaNome"',
      termo,
      paramStartIndex: 1,
    });

    const params = [...busca.params];
    let idx = busca.nextIndex;

    // Fallback na descricao: ILIKE normalizado (sem ranking, so filtro adicional)
    const termoNorm = normalizarBusca(termo);
    params.push(`%${termoNorm}%`);
    const descricaoClause = `cobranca.normalizar_busca(descricao) LIKE $${idx++}`;

    // Combina nome OR descricao
    const filtros = [];
    if (busca.filterClause) {
      filtros.push(`(${busca.filterClause} OR ${descricaoClause})`);
    } else {
      filtros.push(descricaoClause);
    }

    if (tipo) { filtros.push(`tipo = $${idx++}`); params.push(tipo); }
    if (de) { filtros.push(`"criadoEm" >= $${idx++}`); params.push(new Date(de)); }
    if (ate) { filtros.push(`"criadoEm" <= $${idx++}`); params.push(new Date(ate + 'T23:59:59')); }

    params.push(Number(limit), offset);
    const limitIdx = idx++;
    const offsetIdx = idx++;

    const rows = await prisma.$queryRawUnsafe(`
      SELECT *, COUNT(*) OVER()::int AS _total
      FROM cobranca.ocorrencia
      WHERE ${filtros.join(' AND ')}
      ORDER BY "criadoEm" DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `, ...params);

    const total = rows.length > 0 ? rows[0]._total : 0;
    const data = rows.map(({ _total, ...rest }) => rest);

    res.json({ data, total, page: Number(page), limit: Number(limit) });
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
