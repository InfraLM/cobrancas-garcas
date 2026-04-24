import { prisma } from '../config/database.js';
import { buildWhereNome } from '../utils/buscaNomeHelper.js';

const TURMAS_EXCLUIDAS = '1,10,14,19,22,27,29';
const PESSOAS_EXCECAO = '589'; // Andre Garcia Ribeiro — testes

/**
 * GET /api/titulos?search=&situacao=&tipoorigem=&vencimentoDe=&vencimentoAte=&turma=&page=1&limit=30
 */
export async function listar(req, res, next) {
  try {
    const { search, situacao, tipoorigem, vencimentoDe, vencimentoAte, turma, page = 1, limit = 30 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let where = `
      WHERE p.aluno = true
        AND (COALESCE(p.funcionario, false) = false OR p.codigo IN (${PESSOAS_EXCECAO}))
        AND (cr.turma IS NULL OR cr.turma NOT IN (${TURMAS_EXCLUIDAS}))
    `;
    const params = [];
    let paramIdx = 1;

    // Busca com helper (nome normalizado + cpf + matricula). Titulos ordenam por
    // vencimento, entao so usamos buildWhereNome (sem ranking).
    const termo = String(search || '').trim();
    if (termo) {
      const busca = buildWhereNome({
        colunaNome: 'p.nome',
        termo,
        extras: { colunaCpf: 'p.cpf', colunaMatricula: 'm.matricula' },
        paramStartIndex: paramIdx,
      });
      if (busca.filterClause) {
        where += ` AND ${busca.filterClause}`;
        params.push(...busca.params);
        paramIdx = busca.nextIndex;
      }
    }

    if (situacao) {
      where += ` AND cr.situacao = $${paramIdx}`;
      params.push(situacao);
      paramIdx++;
    }

    if (tipoorigem) {
      where += ` AND cr.tipoorigem = $${paramIdx}`;
      params.push(tipoorigem);
      paramIdx++;
    }

    if (vencimentoDe) {
      where += ` AND cr.datavencimento >= $${paramIdx}::date`;
      params.push(vencimentoDe);
      paramIdx++;
    }

    if (vencimentoAte) {
      where += ` AND cr.datavencimento <= $${paramIdx}::date`;
      params.push(vencimentoAte);
      paramIdx++;
    }

    if (turma) {
      where += ` AND t.identificadorturma = $${paramIdx}`;
      params.push(turma);
      paramIdx++;
    }

    const sql = `
      SELECT cr.codigo, cr.parcela, cr.valor, cr.valorrecebido, cr.datavencimento,
             cr.situacao, cr.tipoorigem, cr.multa, cr.juro, cr.valordesconto,
             cr.nrdocumento,
             p.codigo AS pessoa_codigo, p.nome, p.cpf, p.celular,
             m.matricula,
             t.identificadorturma AS turma,
             COUNT(*) OVER()::int AS total
      FROM cobranca.contareceber cr
      JOIN cobranca.pessoa p ON p.codigo = cr.pessoa
      LEFT JOIN LATERAL (
        SELECT matricula FROM cobranca.matricula WHERE aluno = p.codigo ORDER BY data DESC NULLS LAST LIMIT 1
      ) m ON true
      LEFT JOIN cobranca.turma t ON t.codigo = cr.turma
      ${where}
      ORDER BY cr.datavencimento DESC
      LIMIT ${Number(limit)} OFFSET ${offset}
    `;

    const rows = await prisma.$queryRawUnsafe(sql, ...params);
    const total = rows.length > 0 ? rows[0].total : 0;

    const data = rows.map(r => ({
      codigo: r.codigo,
      parcela: r.parcela,
      valor: Number(r.valor || 0),
      valorRecebido: Number(r.valorrecebido || 0),
      dataVencimento: r.datavencimento,
      situacao: r.situacao,
      tipoOrigem: r.tipoorigem,
      multa: Number(r.multa || 0),
      juro: Number(r.juro || 0),
      desconto: Number(r.valordesconto || 0),
      nrDocumento: r.nrdocumento,
      saldo: Number(r.valor || 0) - Number(r.valorrecebido || 0),
      pessoaCodigo: r.pessoa_codigo,
      nome: r.nome,
      cpf: r.cpf,
      celular: r.celular,
      matricula: r.matricula,
      turma: r.turma,
    }));

    res.json({ data, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/titulos/metricas
 */
export async function metricas(req, res, next) {
  try {
    const result = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*) FILTER (WHERE cr.situacao = 'AR')::int AS total_ar,
        COALESCE(SUM(CASE WHEN cr.situacao = 'AR' AND cr.datavencimento < CURRENT_DATE AND cr.valor > COALESCE(cr.valorrecebido,0)
          THEN cr.valor - COALESCE(cr.valorrecebido,0) ELSE 0 END), 0) AS valor_inadimplente,
        COUNT(*) FILTER (WHERE cr.situacao = 'AR' AND cr.datavencimento = CURRENT_DATE)::int AS vencendo_hoje,
        COUNT(*) FILTER (WHERE cr.situacao = 'AR' AND cr.datavencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days')::int AS vencendo_semana,
        COUNT(*) FILTER (WHERE cr.situacao = 'RE' AND cr.datavencimento >= date_trunc('month', CURRENT_DATE))::int AS pagos_mes,
        COALESCE(SUM(CASE WHEN cr.situacao = 'RE' AND cr.datavencimento >= date_trunc('month', CURRENT_DATE) THEN COALESCE(cr.valorrecebido,0) ELSE 0 END), 0) AS valor_pago_mes,
        -- Aging
        COUNT(*) FILTER (WHERE cr.situacao = 'AR' AND cr.datavencimento < CURRENT_DATE AND cr.datavencimento >= CURRENT_DATE - INTERVAL '30 days')::int AS aging_0_30,
        COUNT(*) FILTER (WHERE cr.situacao = 'AR' AND cr.datavencimento < CURRENT_DATE - INTERVAL '30 days' AND cr.datavencimento >= CURRENT_DATE - INTERVAL '60 days')::int AS aging_31_60,
        COUNT(*) FILTER (WHERE cr.situacao = 'AR' AND cr.datavencimento < CURRENT_DATE - INTERVAL '60 days' AND cr.datavencimento >= CURRENT_DATE - INTERVAL '90 days')::int AS aging_61_90,
        COUNT(*) FILTER (WHERE cr.situacao = 'AR' AND cr.datavencimento < CURRENT_DATE - INTERVAL '90 days')::int AS aging_90_mais,
        COALESCE(SUM(CASE WHEN cr.situacao = 'AR' AND cr.datavencimento < CURRENT_DATE AND cr.datavencimento >= CURRENT_DATE - INTERVAL '30 days' THEN cr.valor - COALESCE(cr.valorrecebido,0) ELSE 0 END), 0) AS aging_valor_0_30,
        COALESCE(SUM(CASE WHEN cr.situacao = 'AR' AND cr.datavencimento < CURRENT_DATE - INTERVAL '30 days' AND cr.datavencimento >= CURRENT_DATE - INTERVAL '60 days' THEN cr.valor - COALESCE(cr.valorrecebido,0) ELSE 0 END), 0) AS aging_valor_31_60,
        COALESCE(SUM(CASE WHEN cr.situacao = 'AR' AND cr.datavencimento < CURRENT_DATE - INTERVAL '60 days' AND cr.datavencimento >= CURRENT_DATE - INTERVAL '90 days' THEN cr.valor - COALESCE(cr.valorrecebido,0) ELSE 0 END), 0) AS aging_valor_61_90,
        COALESCE(SUM(CASE WHEN cr.situacao = 'AR' AND cr.datavencimento < CURRENT_DATE - INTERVAL '90 days' THEN cr.valor - COALESCE(cr.valorrecebido,0) ELSE 0 END), 0) AS aging_valor_90_mais
      FROM cobranca.contareceber cr
      JOIN cobranca.pessoa p ON p.codigo = cr.pessoa
      WHERE p.aluno = true
        AND (COALESCE(p.funcionario, false) = false OR p.codigo IN (${PESSOAS_EXCECAO}))
        AND (cr.turma IS NULL OR cr.turma NOT IN (${TURMAS_EXCLUIDAS}))
    `);

    const r = result[0];
    res.json({
      totalAR: r.total_ar,
      valorInadimplente: Number(r.valor_inadimplente),
      vencendoHoje: r.vencendo_hoje,
      vencendoSemana: r.vencendo_semana,
      pagosMes: r.pagos_mes,
      valorPagoMes: Number(r.valor_pago_mes),
      aging: [
        { faixa: '0-30 dias', qtd: r.aging_0_30, valor: Number(r.aging_valor_0_30) },
        { faixa: '31-60 dias', qtd: r.aging_31_60, valor: Number(r.aging_valor_31_60) },
        { faixa: '61-90 dias', qtd: r.aging_61_90, valor: Number(r.aging_valor_61_90) },
        { faixa: '90+ dias', qtd: r.aging_90_mais, valor: Number(r.aging_valor_90_mais) },
      ],
    });
  } catch (error) {
    next(error);
  }
}
