import { prisma } from '../config/database.js';

const TURMAS_EXCLUIDAS = '1,10,14,19,22,27,29';
const PESSOAS_EXCECAO = '589';

/**
 * Recalcula aluno_resumo para um conjunto de pessoas especificas.
 * Se codigos vazio, recalcula TODOS (full refresh).
 */
export async function refreshAlunoResumo(codigos = []) {
  const filtro = codigos.length > 0
    ? `AND p.codigo IN (${codigos.join(',')})`
    : '';

  const startTime = Date.now();

  // Buscar dados calculados para as pessoas afetadas
  const rows = await prisma.$queryRawUnsafe(`
    WITH matricula_recente AS (
      SELECT DISTINCT ON (m.aluno) m.aluno, m.matricula, m.curso, m.situacao AS mat_situacao,
             m.naoenviarmensagemcobranca
      FROM cobranca.matricula m
      WHERE m.curso = 1
      ORDER BY m.aluno, m.data DESC NULLS LAST
    )
    SELECT p.codigo, p.nome, p.cpf, p.celular,
      mr.matricula, mr.mat_situacao,
      COALESCE(mr.naoenviarmensagemcobranca, false) AS nao_enviar_msg,
      CASE
        WHEN mr.mat_situacao IN ('IN','CA') THEN 'CANCELADO'
        WHEN EXISTS (
          SELECT 1 FROM cobranca.negociacaocontareceber nc
          WHERE nc.matriculaaluno = mr.matricula AND nc.justificativa ILIKE '%TRANCAMENTO%'
            AND nc.data <= CURRENT_TIMESTAMP
            AND NOT EXISTS (
              SELECT 1 FROM cobranca.contareceber cr3
              WHERE cr3.matriculaaluno = mr.matricula AND cr3.tipoorigem = 'NCR'
                AND TRIM(cr3.codorigem) = nc.codigo::text
                AND cr3.datavencimento <= CURRENT_TIMESTAMP
            )
        ) THEN 'TRANCADO'
        ELSE 'ATIVO'
      END AS situacao,
      COALESCE(fin.valor_devedor, 0) AS valor_devedor,
      COALESCE(fin.parcelas_atraso, 0)::int AS parcelas_atraso,
      COALESCE(fin.valor_pago, 0) AS valor_pago,
      CASE WHEN COALESCE(fin.valor_devedor, 0) > 0 THEN 'INADIMPLENTE' ELSE 'ADIMPLENTE' END AS situacao_financeira,
      turma_info.identificadorturma AS turma
    FROM cobranca.pessoa p
    INNER JOIN matricula_recente mr ON mr.aluno = p.codigo
    LEFT JOIN (
      -- Calculo de inadimplencia operacional. Filtra tipoorigem MAT/OUT
      -- (matricula e outros cursos) para alinhar com a query do Aging Atual
      -- do dashboard. Decisao do user: KPI "Inadimplencia" deve ser igual a
      -- soma do Aging Atual (Q2 = "Devem ser iguais", 2026-05-07).
      SELECT cr.pessoa,
        COALESCE(SUM(CASE WHEN cr.situacao='AR' AND cr.datavencimento < CURRENT_DATE AND cr.valor > COALESCE(cr.valorrecebido,0)
          THEN cr.valor - COALESCE(cr.valorrecebido,0) ELSE 0 END), 0) AS valor_devedor,
        COUNT(*) FILTER (WHERE cr.situacao='AR' AND cr.datavencimento < CURRENT_DATE AND cr.valor > COALESCE(cr.valorrecebido,0)) AS parcelas_atraso,
        COALESCE(SUM(CASE WHEN cr.situacao='RE' THEN COALESCE(cr.valorrecebido,0) ELSE 0 END), 0) AS valor_pago
      FROM cobranca.contareceber cr
      WHERE (cr.turma IS NULL OR cr.turma NOT IN (${TURMAS_EXCLUIDAS}))
        AND COALESCE(cr.tipoorigem, '') NOT IN ('MAT', 'OUT')
      GROUP BY cr.pessoa
    ) fin ON fin.pessoa = p.codigo
    LEFT JOIN LATERAL (
      SELECT DISTINCT t.identificadorturma FROM cobranca.contareceber cr
      JOIN cobranca.turma t ON t.codigo = cr.turma
      WHERE cr.matriculaaluno = mr.matricula AND cr.turma NOT IN (${TURMAS_EXCLUIDAS})
      LIMIT 1
    ) turma_info ON true
    WHERE p.aluno = true AND (COALESCE(p.funcionario, false) = false OR p.codigo IN (${PESSOAS_EXCECAO}))
    ${filtro}
  `);

  if (rows.length === 0) return 0;

  const mapped = rows.map(r => ({
    codigo: r.codigo,
    nome: r.nome,
    cpf: r.cpf,
    celular: r.celular,
    matricula: r.matricula,
    matSituacao: r.mat_situacao,
    naoEnviarMsg: r.nao_enviar_msg || false,
    situacao: r.situacao,
    valorDevedor: r.valor_devedor,
    parcelasAtraso: Number(r.parcelas_atraso) || 0,
    valorPago: r.valor_pago,
    situacaoFinanceira: r.situacao_financeira,
    turma: r.turma,
  }));

  if (codigos.length === 0) {
    // Full refresh: TRUNCATE + createMany (rapido)
    await prisma.$executeRawUnsafe('TRUNCATE TABLE cobranca.aluno_resumo');
    await prisma.alunoResumo.createMany({ data: mapped });
  } else {
    // Incremental: delete + create apenas os afetados (rapido para poucos registros)
    const ids = mapped.map(r => r.codigo);
    await prisma.alunoResumo.deleteMany({ where: { codigo: { in: ids } } });
    await prisma.alunoResumo.createMany({ data: mapped });
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[AlunoResumo] ${rows.length} alunos atualizados (${elapsed}s)`);
  return rows.length;
}

/**
 * Identifica quais pessoas foram afetadas pelo delta sync
 * e recalcula apenas essas.
 */
export async function refreshIncrementalAposSync(syncResults) {
  // Coletar codigos de pessoas afetadas
  const pessoasAfetadas = new Set();

  for (const result of syncResults) {
    if (result.status !== 'fulfilled' || result.value.count === 0) continue;

    const model = result.value.model;

    // Tabelas que afetam o resumo do aluno
    if (['contareceber', 'pessoa', 'matricula', 'negociacaocontareceber'].includes(model)) {
      // Buscar pessoas dos registros alterados (via delta recente)
      try {
        let query;
        if (model === 'contareceber') {
          query = `SELECT DISTINCT pessoa FROM cobranca.contareceber WHERE updated >= CURRENT_TIMESTAMP - INTERVAL '15 minutes'`;
        } else if (model === 'pessoa') {
          query = `SELECT DISTINCT codigo AS pessoa FROM cobranca.pessoa WHERE updated >= CURRENT_TIMESTAMP - INTERVAL '15 minutes' AND aluno = true`;
        } else if (model === 'matricula') {
          query = `SELECT DISTINCT aluno AS pessoa FROM cobranca.matricula WHERE updated >= CURRENT_TIMESTAMP - INTERVAL '15 minutes'`;
        } else if (model === 'negociacaocontareceber') {
          query = `SELECT DISTINCT pessoa FROM cobranca.negociacaocontareceber WHERE updated >= CURRENT_TIMESTAMP - INTERVAL '15 minutes'`;
        }

        if (query) {
          const rows = await prisma.$queryRawUnsafe(query);
          rows.forEach(r => pessoasAfetadas.add(r.pessoa));
        }
      } catch {}
    }
  }

  if (pessoasAfetadas.size === 0) {
    console.log('[AlunoResumo] Nenhuma pessoa afetada, pulando refresh');
    return 0;
  }

  console.log(`[AlunoResumo] ${pessoasAfetadas.size} pessoa(s) afetada(s), recalculando...`);
  return refreshAlunoResumo(Array.from(pessoasAfetadas));
}
