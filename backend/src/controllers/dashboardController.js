import { prisma } from '../config/database.js';

const TURMAS_EXCLUIDAS = '1,10,14,19,22,27,29';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Cache em memoria
let cache = { data: null, timestamp: 0 };

/**
 * GET /api/dashboard?forcar=true
 * Retorna todas as metricas do dashboard em um unico request.
 * Usa cache de 5 minutos para nao sobrecarregar o banco.
 */
export async function obterDashboard(req, res, next) {
  try {
    const forcar = req.query.forcar === 'true';
    const agora = Date.now();

    // Retornar cache se valido
    if (!forcar && cache.data && (agora - cache.timestamp) < CACHE_TTL) {
      return res.json(cache.data);
    }

    console.log('[Dashboard] Calculando metricas...');
    const startTime = Date.now();

    // Rodar todas as queries em paralelo
    const [kpis, aging, agingHistorico, recorrentesHistorico, acumuladoAlunos, ficouFacil, funil, pagoPorAging, pagoPorForma] = await Promise.all([
      calcularKPIs(),
      calcularAging(),
      calcularAgingHistorico(),
      calcularRecorrentesHistorico(),
      calcularAcumuladoAlunos(),
      calcularFicouFacil(),
      calcularFunil(),
      calcularPagoPorAging(),
      calcularPagoPorForma(),
    ]);

    const data = { kpis, aging, agingHistorico, recorrentesHistorico, acumuladoAlunos, ficouFacil, funil, pagoPorAging, pagoPorForma, atualizadoEm: new Date().toISOString() };

    // Salvar cache
    cache = { data, timestamp: agora };

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Dashboard] Metricas calculadas em ${elapsed}s`);

    res.json(data);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// KPIs principais
// -----------------------------------------------
async function calcularKPIs() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS total_alunos,
      COUNT(*) FILTER (WHERE "situacaoFinanceira" = 'INADIMPLENTE')::int AS inadimplentes,
      COUNT(*) FILTER (WHERE "situacaoFinanceira" = 'ADIMPLENTE')::int AS adimplentes,
      COALESCE(SUM("valorDevedor"), 0) AS valor_inadimplente,
      COALESCE(SUM("valorPago"), 0) AS valor_pago
    FROM cobranca.aluno_resumo
  `);

  const r = rows[0];

  // Acordos
  const acordos = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE etapa = 'CONCLUIDO')::int AS concluidos,
      COALESCE(SUM(CASE WHEN etapa = 'CONCLUIDO' THEN "valorAcordo" ELSE 0 END), 0) AS valor_recuperado
    FROM cobranca.acordo_financeiro
  `);

  // Recorrencia ativa restrita ao mesmo universo de alunos do KPI totalAlunos
  // (alunos matriculados em curso=1, nao-funcionarios) — pra taxaRecorrencia bater.
  const recorrencia = await prisma.$queryRawUnsafe(`
    WITH ultima_rec AS (
      SELECT DISTINCT ON (pessoa) pessoa, datacadastro, datainativacao
      FROM cobranca.cartaocreditodebitorecorrenciapessoa
      WHERE pessoa IS NOT NULL
      ORDER BY pessoa, datacadastro DESC NULLS LAST
    )
    SELECT COUNT(*)::int AS total_com_recorrencia
    FROM ultima_rec ur
    JOIN cobranca.aluno_resumo ar ON ar.codigo = ur.pessoa
    WHERE ur.datainativacao IS NULL OR ur.datainativacao > CURRENT_TIMESTAMP
  `);

  return {
    totalAlunos: r.total_alunos,
    inadimplentes: r.inadimplentes,
    adimplentes: r.adimplentes,
    valorInadimplente: Number(r.valor_inadimplente),
    valorPago: Number(r.valor_pago),
    acordosTotal: acordos[0].total,
    acordosConcluidos: acordos[0].concluidos,
    valorRecuperado: Number(acordos[0].valor_recuperado),
    alunosComRecorrencia: recorrencia[0].total_com_recorrencia,
    taxaRecorrencia: r.total_alunos > 0 ? (recorrencia[0].total_com_recorrencia / r.total_alunos * 100).toFixed(1) : 0,
  };
}

// -----------------------------------------------
// Aging atual (distribuicao de inadimplencia)
// -----------------------------------------------
async function calcularAging() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*) FILTER (WHERE dias BETWEEN 0 AND 5)::int AS f_0_5,
      COUNT(*) FILTER (WHERE dias BETWEEN 6 AND 30)::int AS f_6_30,
      COUNT(*) FILTER (WHERE dias BETWEEN 31 AND 90)::int AS f_31_90,
      COUNT(*) FILTER (WHERE dias > 90)::int AS f_90_mais,
      COALESCE(SUM(saldo) FILTER (WHERE dias BETWEEN 0 AND 5), 0) AS v_0_5,
      COALESCE(SUM(saldo) FILTER (WHERE dias BETWEEN 6 AND 30), 0) AS v_6_30,
      COALESCE(SUM(saldo) FILTER (WHERE dias BETWEEN 31 AND 90), 0) AS v_31_90,
      COALESCE(SUM(saldo) FILTER (WHERE dias > 90), 0) AS v_90_mais
    FROM (
      SELECT
        (CURRENT_DATE - cr.datavencimento::date) AS dias,
        (cr.valor - COALESCE(cr.valorrecebido, 0)) AS saldo
      FROM cobranca.contareceber cr
      JOIN cobranca.pessoa p ON p.codigo = cr.pessoa
      WHERE cr.situacao = 'AR'
        AND cr.datavencimento < CURRENT_DATE
        AND cr.valor > COALESCE(cr.valorrecebido, 0)
        AND (cr.turma IS NULL OR cr.turma NOT IN (${TURMAS_EXCLUIDAS}))
        AND COALESCE(cr.tipoorigem, '') NOT IN ('MAT', 'OUT')
        AND p.aluno = true
        AND (COALESCE(p.funcionario, false) = false OR p.codigo = 589)
    ) sub
  `);

  const r = rows[0];
  return [
    { faixa: '0-5 dias', qtd: r.f_0_5, valor: Number(r.v_0_5) },
    { faixa: '6-30 dias', qtd: r.f_6_30, valor: Number(r.v_6_30) },
    { faixa: '31-90 dias', qtd: r.f_31_90, valor: Number(r.v_31_90) },
    { faixa: '90+ dias', qtd: r.f_90_mais, valor: Number(r.v_90_mais) },
  ];
}

// -----------------------------------------------
// Aging historico por semana (barras empilhadas)
// -----------------------------------------------
async function calcularAgingHistorico() {
  // Gerar ultimas 12 semanas dinamicamente
  const rows = await prisma.$queryRawUnsafe(`
    WITH semanas AS (
      SELECT
        generate_series(0, 11) AS idx,
        (date_trunc('week', CURRENT_DATE) - (generate_series(0, 11) * INTERVAL '1 week'))::date AS inicio,
        (date_trunc('week', CURRENT_DATE) - (generate_series(0, 11) * INTERVAL '1 week') + INTERVAL '6 days')::date AS fim
    ),
    base AS (
      SELECT
        s.idx,
        s.inicio,
        s.fim,
        cr.codigo,
        cr.datavencimento::date AS vencimento,
        COALESCE(cr.valordescontocalculadoprimeirafaixadescontos, cr.valor - COALESCE(cr.valorrecebido, 0))::numeric AS saldo,
        (s.fim - cr.datavencimento::date) AS dias_atraso
      FROM cobranca.contareceber cr
      JOIN cobranca.pessoa p ON p.codigo = cr.pessoa
      CROSS JOIN semanas s
      WHERE cr.datavencimento::date <= s.fim
        AND cr.situacao IN ('AR', 'RE', 'CF')
        AND COALESCE(cr.tipoorigem, '') NOT IN ('MAT', 'OUT')
        AND (cr.turma IS NULL OR cr.turma NOT IN (${TURMAS_EXCLUIDAS}))
        AND p.aluno = true
        AND (COALESCE(p.funcionario, false) = false OR p.codigo = 589)
        -- Nao havia sido pago ate o fim da semana
        AND NOT EXISTS (
          SELECT 1 FROM cobranca.contarecebernegociacaorecebimento crnr
          JOIN cobranca.negociacaorecebimento nr ON nr.codigo = crnr.negociacaorecebimento
          WHERE crnr.contareceber = cr.codigo AND nr.data::date <= s.fim
        )
        -- Nao havia sido cancelado ate o fim da semana
        AND (cr.datacancelamento IS NULL OR cr.datacancelamento::date > s.fim)
    )
    SELECT
      12 - idx AS semana,
      inicio,
      fim,
      COALESCE(SUM(saldo) FILTER (WHERE dias_atraso BETWEEN 0 AND 5), 0)::numeric AS faixa_0_5,
      COALESCE(SUM(saldo) FILTER (WHERE dias_atraso BETWEEN 6 AND 30), 0)::numeric AS faixa_6_30,
      COALESCE(SUM(saldo) FILTER (WHERE dias_atraso BETWEEN 31 AND 90), 0)::numeric AS faixa_31_90,
      COALESCE(SUM(saldo) FILTER (WHERE dias_atraso > 90), 0)::numeric AS faixa_90_mais
    FROM base
    GROUP BY idx, inicio, fim
    ORDER BY inicio
  `);

  return rows.map(r => ({
    semana: Number(r.semana),
    inicio: r.inicio,
    fim: r.fim,
    label: `${new Date(r.inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`,
    faixa_0_5: Number(r.faixa_0_5),
    faixa_6_30: Number(r.faixa_6_30),
    faixa_31_90: Number(r.faixa_31_90),
    faixa_90_mais: Number(r.faixa_90_mais),
  }));
}

// -----------------------------------------------
// Recorrentes vs nao-recorrentes por semana
// -----------------------------------------------
async function calcularRecorrentesHistorico() {
  const rows = await prisma.$queryRawUnsafe(`
    WITH semanas AS (
      SELECT
        generate_series(0, 11) AS idx,
        (date_trunc('week', CURRENT_DATE) - (generate_series(0, 11) * INTERVAL '1 week'))::date AS inicio,
        (date_trunc('week', CURRENT_DATE) - (generate_series(0, 11) * INTERVAL '1 week') + INTERVAL '6 days')::date AS fim
    ),
    alunos_ativos AS (
      SELECT DISTINCT ON (m.aluno, s.idx)
        m.aluno AS pessoa,
        s.idx, s.inicio, s.fim
      FROM cobranca.matricula m
      JOIN cobranca.pessoa p ON p.codigo = m.aluno
      CROSS JOIN semanas s
      WHERE m.curso = 1
        AND m.data::date <= s.fim
        AND p.aluno = true AND COALESCE(p.funcionario, false) = false
    ),
    recorrentes AS (
      SELECT DISTINCT
        cc.pessoa, s.idx
      FROM cobranca.cartaocreditodebitorecorrenciapessoa cc
      CROSS JOIN semanas s
      WHERE cc.datacadastro::date <= s.fim
        AND (cc.datainativacao IS NULL OR cc.datainativacao::date > s.fim)
    )
    SELECT
      12 - s.idx AS semana,
      s.inicio,
      s.fim,
      COUNT(DISTINCT a.pessoa)::int AS total_ativos,
      COUNT(DISTINCT r.pessoa)::int AS recorrentes,
      (COUNT(DISTINCT a.pessoa) - COUNT(DISTINCT r.pessoa))::int AS sem_recorrencia,
      CASE WHEN COUNT(DISTINCT a.pessoa) > 0
        THEN ROUND(COUNT(DISTINCT r.pessoa)::numeric / COUNT(DISTINCT a.pessoa) * 100, 1)
        ELSE 0
      END AS percentual
    FROM semanas s
    LEFT JOIN alunos_ativos a ON a.idx = s.idx
    LEFT JOIN recorrentes r ON r.pessoa = a.pessoa AND r.idx = s.idx
    GROUP BY s.idx, s.inicio, s.fim
    ORDER BY s.inicio
  `);

  return rows.map(r => ({
    semana: Number(r.semana),
    label: `${new Date(r.inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`,
    totalAtivos: r.total_ativos,
    recorrentes: r.recorrentes,
    semRecorrencia: r.sem_recorrencia,
    percentual: Number(r.percentual),
  }));
}

// -----------------------------------------------
// Novos alunos acumulados + % recorrencia (query portada literal do
// arquivo dashboard/query-acumulado-alunos-recorrencia.txt)
//
// Logica preservada:
//   - Whitelist de turmas (2,4,8,11,21,28) — cohort de medicina ativa
//   - Exclui tipoorigem OUT (e MAT em CTEs de data-base/gap)
//   - Funcionario = false
//   - Trata cancelamento (com override da data magica 2025-02-04)
//   - Trata trancamento via NEGOCIACAO (ILIKE TRANCAMENTO) e gap de 5 meses
//   - Retorno de trancamento via NCR ou via gap
//   - Acumulado SUM OVER dentro da janela
//
// Adaptacoes pra dashboard dinamico:
//   - Janela rolling: ultimas 9 semanas completas, inicio no sabado
//     (mesma "largura de semana" do original: sab -> sex)
// -----------------------------------------------
async function calcularAcumuladoAlunos() {
  const rows = await prisma.$queryRawUnsafe(`
    WITH
    base_matriculas AS (
      SELECT DISTINCT cr.matriculaaluno AS matricula, cr.turma AS turma_codigo
      FROM cobranca.contareceber cr
      WHERE cr.turma IN (2,4,8,11,21,28)
        AND COALESCE(cr.tipoorigem, '') <> 'OUT'
    ),
    cadastro AS (
      SELECT bm.matricula, bm.turma_codigo, tr.identificadorturma AS turma,
        mt."data"::date AS data_matricula, p.cpf, p.nome AS nome_aluno, p.codigo AS pessoa_id
      FROM base_matriculas bm
      JOIN cobranca.matricula mt ON mt.matricula = bm.matricula
      JOIN cobranca.pessoa p ON p.codigo = mt.aluno
      JOIN cobranca.turma tr ON tr.codigo = bm.turma_codigo
      WHERE COALESCE(p.funcionario, false) = false
    ),
    mp_ultimo AS (
      SELECT DISTINCT ON (mp.matricula) mp.matricula,
        mp.databasegeracaoparcelas::date AS data_base_parcelas,
        mp.situacaomatriculaperiodo AS situacao_aluno
      FROM cobranca.matriculaperiodo mp
      ORDER BY mp.matricula, mp.databasegeracaoparcelas DESC NULLS LAST
    ),
    primeiro_venc_nao_mat AS (
      SELECT cr.matriculaaluno AS matricula, MIN(cr.datavencimento::date) AS data_base_fallback
      FROM cobranca.contareceber cr
      WHERE cr.turma IN (2,4,8,11,21,28) AND COALESCE(cr.tipoorigem, '') NOT IN ('MAT','OUT')
      GROUP BY cr.matriculaaluno
    ),
    data_base AS (
      SELECT c.matricula,
        COALESCE(mu.data_base_parcelas, pv.data_base_fallback, (c.data_matricula + INTERVAL '31 days')::date) AS data_base_parcelas,
        mu.situacao_aluno
      FROM cadastro c
      LEFT JOIN mp_ultimo mu ON mu.matricula = c.matricula
      LEFT JOIN primeiro_venc_nao_mat pv ON pv.matricula = c.matricula
    ),
    cancelamento AS (
      SELECT cr.matriculaaluno AS matricula, MIN(cr.datacancelamento::date) AS data_cancelamento
      FROM cobranca.contareceber cr
      WHERE cr.turma IN (2,4,8,11,21,28) AND cr.datacancelamento IS NOT NULL AND COALESCE(cr.tipoorigem, '') <> 'OUT'
      GROUP BY cr.matriculaaluno
    ),
    trancamento AS (
      SELECT DISTINCT ON (nc.matriculaaluno) nc.matriculaaluno AS matricula,
        nc.codigo AS codigo_trancamento, nc."data"::date AS data_trancamento
      FROM cobranca.negociacaocontareceber nc
      WHERE nc.justificativa ILIKE '%TRANCAMENTO%'
      ORDER BY nc.matriculaaluno, nc."data" DESC NULLS LAST, nc.codigo DESC
    ),
    retorno_trancamento AS (
      SELECT t.matricula, MIN(cr.datavencimento::date) AS data_retorno_trancamento
      FROM trancamento t
      JOIN cobranca.contareceber cr ON cr.matriculaaluno = t.matricula
        AND cr.tipoorigem = 'NCR' AND TRIM(cr.codorigem) = t.codigo_trancamento::text
      WHERE cr.turma IN (2,4,8,11,21,28) AND COALESCE(cr.tipoorigem, '') <> 'OUT'
      GROUP BY t.matricula
    ),
    trancamento_gap_base AS (
      SELECT cr.matriculaaluno AS matricula,
        LAG(cr.datavencimento::date) OVER (PARTITION BY cr.matriculaaluno ORDER BY cr.datavencimento::date, cr.codigo) AS data_trancamento,
        cr.datavencimento::date AS data_retorno_trancamento
      FROM cobranca.contareceber cr
      WHERE cr.turma IN (2,4,8,11,21,28) AND cr.situacao IN ('AR','RE','CF')
        AND COALESCE(cr.tipoorigem, '') NOT IN ('MAT','OUT')
    ),
    trancamento_gap AS (
      SELECT DISTINCT ON (tgb.matricula) tgb.matricula, tgb.data_trancamento, tgb.data_retorno_trancamento
      FROM trancamento_gap_base tgb
      WHERE tgb.data_trancamento IS NOT NULL
        AND tgb.data_retorno_trancamento >= (tgb.data_trancamento + INTERVAL '5 months')
      ORDER BY tgb.matricula, tgb.data_retorno_trancamento DESC NULLS LAST, tgb.data_trancamento DESC NULLS LAST
    ),
    recorrencia_ultimo AS (
      SELECT DISTINCT ON (cc.pessoa) cc.pessoa AS pessoa_id,
        cc.datacadastro::date AS data_cadastro_recorrencia,
        cc.datainativacao::date AS datainativacao_recorrencia
      FROM cobranca.cartaocreditodebitorecorrenciapessoa cc
      ORDER BY cc.pessoa, cc.datacadastro DESC NULLS LAST, cc.codigo DESC
    ),
    base_matricula AS (
      SELECT c.matricula, c.pessoa_id, c.nome_aluno, c.cpf, c.turma, c.data_matricula,
        CASE WHEN db.situacao_aluno = 'AT' AND ca.data_cancelamento = DATE '2025-02-04' THEN NULL
          ELSE ca.data_cancelamento END AS data_cancelamento,
        COALESCE(t.data_trancamento, tg.data_trancamento) AS data_trancamento,
        COALESCE(rt.data_retorno_trancamento, tg.data_retorno_trancamento) AS data_retorno_trancamento,
        ru.data_cadastro_recorrencia, ru.datainativacao_recorrencia
      FROM cadastro c
      LEFT JOIN data_base db ON db.matricula = c.matricula
      LEFT JOIN cancelamento ca ON ca.matricula = c.matricula
      LEFT JOIN trancamento t ON t.matricula = c.matricula
      LEFT JOIN retorno_trancamento rt ON rt.matricula = c.matricula
      LEFT JOIN trancamento_gap tg ON tg.matricula = c.matricula
      LEFT JOIN recorrencia_ultimo ru ON ru.pessoa_id = c.pessoa_id
    ),
    -- Janela "expandindo" desde 08/02/2026 ate o ultimo sabado completo.
    -- Formato da semana: domingo -> sabado (ex: 2026-02-08 a 2026-02-14).
    -- Conforme o tempo passa, novas semanas sao adicionadas automaticamente.
    -- EXTRACT(DOW): domingo=0, sabado=6.
    semanas AS (
      SELECT
        ROW_NUMBER() OVER (ORDER BY gs)::int AS semana,
        gs::date AS inicio,
        (gs + INTERVAL '6 days')::date AS fim
      FROM generate_series(
        DATE '2026-02-08',
        (CURRENT_DATE - ((EXTRACT(DOW FROM CURRENT_DATE)::int + 1) % 7) * INTERVAL '1 day')::date,
        INTERVAL '7 days'
      ) AS gs
    ),
    janela AS (SELECT MIN(inicio) AS inicio_janela, MAX(fim) AS fim_janela FROM semanas),
    novos_alunos_semana AS (
      SELECT s.semana, s.inicio, s.fim, COUNT(*) AS novos_alunos_semana
      FROM base_matricula bm CROSS JOIN semanas s
      WHERE bm.data_matricula >= s.inicio AND bm.data_matricula <= s.fim
        AND (bm.data_cancelamento IS NULL OR bm.data_cancelamento > s.fim)
        AND NOT (bm.data_trancamento IS NOT NULL AND bm.data_trancamento <= s.fim
          AND (bm.data_retorno_trancamento IS NULL OR bm.data_retorno_trancamento > s.fim))
      GROUP BY s.semana, s.inicio, s.fim
    ),
    novos_alunos_recorrentes_semana AS (
      SELECT s.semana, s.inicio, s.fim, COUNT(*) AS novos_alunos_recorrentes_semana
      FROM base_matricula bm CROSS JOIN semanas s CROSS JOIN janela j
      WHERE bm.data_matricula >= j.inicio_janela AND bm.data_matricula <= j.fim_janela
        AND bm.data_cadastro_recorrencia IS NOT NULL
        AND bm.data_cadastro_recorrencia >= s.inicio AND bm.data_cadastro_recorrencia <= s.fim
        AND (bm.data_cancelamento IS NULL OR bm.data_cancelamento > s.fim)
        AND NOT (bm.data_trancamento IS NOT NULL AND bm.data_trancamento <= s.fim
          AND (bm.data_retorno_trancamento IS NULL OR bm.data_retorno_trancamento > s.fim))
      GROUP BY s.semana, s.inicio, s.fim
    )
    SELECT s.semana, s.inicio, s.fim,
      COALESCE(n.novos_alunos_semana, 0)::int AS novos_semana,
      SUM(COALESCE(n.novos_alunos_semana, 0)) OVER (ORDER BY s.semana ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::int AS novos_acumulado,
      COALESCE(r.novos_alunos_recorrentes_semana, 0)::int AS rec_semana,
      SUM(COALESCE(r.novos_alunos_recorrentes_semana, 0)) OVER (ORDER BY s.semana ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::int AS rec_acumulado
    FROM semanas s
    LEFT JOIN novos_alunos_semana n ON n.semana = s.semana
    LEFT JOIN novos_alunos_recorrentes_semana r ON r.semana = s.semana
    ORDER BY s.semana
  `);

  return rows.map(r => {
    const acumulado = Number(r.novos_acumulado);
    const acumuladoRec = Number(r.rec_acumulado);
    return {
      semana: Number(r.semana),
      label: `${new Date(r.inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`,
      novos: Number(r.novos_semana),
      acumulado,
      recorrentesSemana: Number(r.rec_semana),
      acumuladoRecorrentes: acumuladoRec,
      percentualRecorrentes: acumulado > 0 ? Number((acumuladoRec / acumulado * 100).toFixed(1)) : 0,
    };
  });
}

// -----------------------------------------------
// Ficou Facil resumo
// -----------------------------------------------
async function calcularFicouFacil() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      etapa,
      COUNT(*)::int AS qtd,
      COALESCE(SUM("valorPos" - "valorRecebido"), 0)::numeric AS valor_financiado,
      COALESCE(SUM("valorInadimplenteMJ"), 0)::numeric AS valor_recuperavel
    FROM cobranca.ficou_facil
    WHERE etapa != 'CANCELADO'
    GROUP BY etapa
    ORDER BY
      CASE etapa
        WHEN 'AGUARDANDO_DOCUMENTACAO' THEN 1
        WHEN 'ANALISE_CREDITO' THEN 2
        WHEN 'ASSINATURA_CONTRATO_1' THEN 3
        WHEN 'ASSINATURA_CONTRATO_2' THEN 4
        WHEN 'ASSINATURA_CONTRATO_3' THEN 5
        WHEN 'ASSINATURA_LM' THEN 6
        WHEN 'CONCLUIDO' THEN 7
      END
  `);

  const concluidos = rows.find(r => r.etapa === 'CONCLUIDO');

  return {
    porEtapa: rows.map(r => ({
      etapa: r.etapa,
      qtd: r.qtd,
      valorFinanciado: Number(r.valor_financiado),
    })),
    totalAtivos: rows.filter(r => r.etapa !== 'CONCLUIDO').reduce((s, r) => s + r.qtd, 0),
    totalConcluidos: concluidos?.qtd || 0,
    valorRecuperado: Number(concluidos?.valor_recuperavel || 0),
    valorTotalFinanciado: rows.reduce((s, r) => s + Number(r.valor_financiado), 0),
  };
}

// -----------------------------------------------
// Funil de cobranca (simplificado)
// -----------------------------------------------
async function calcularFunil() {
  const [inadimplentes, tentativas, negociados, pagos] = await Promise.all([
    // Base inadimplente
    prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS qtd, COALESCE(SUM("valorDevedor"), 0)::numeric AS valor
      FROM cobranca.aluno_resumo WHERE "situacaoFinanceira" = 'INADIMPLENTE'
    `),
    // Tentativa de contato (alunos contatados via ligacao ou WhatsApp)
    prisma.$queryRawUnsafe(`
      SELECT COUNT(DISTINCT pessoa)::int AS qtd, 0::numeric AS valor FROM (
        SELECT "pessoaCodigo" AS pessoa FROM cobranca.registro_ligacao WHERE "pessoaCodigo" IS NOT NULL
        UNION
        SELECT "pessoaCodigo" AS pessoa FROM cobranca.conversa_cobranca WHERE "pessoaCodigo" IS NOT NULL
      ) sub
    `),
    // Negociado (tem acordo criado)
    prisma.$queryRawUnsafe(`
      SELECT COUNT(DISTINCT "pessoaCodigo")::int AS qtd,
        COALESCE(SUM("valorAcordo"), 0)::numeric AS valor
      FROM cobranca.acordo_financeiro WHERE etapa != 'CANCELADO'
    `),
    // Pago (acordo concluido)
    prisma.$queryRawUnsafe(`
      SELECT COUNT(DISTINCT "pessoaCodigo")::int AS qtd,
        COALESCE(SUM("valorAcordo"), 0)::numeric AS valor
      FROM cobranca.acordo_financeiro WHERE etapa = 'CONCLUIDO'
    `),
  ]);

  return [
    { etapa: 'Base Inadimplente', qtd: inadimplentes[0].qtd, valor: Number(inadimplentes[0].valor) },
    { etapa: 'Tentativa de Contato', qtd: tentativas[0].qtd, valor: Number(tentativas[0].valor) },
    { etapa: 'Negociado', qtd: negociados[0].qtd, valor: Number(negociados[0].valor) },
    { etapa: 'Recuperado', qtd: pagos[0].qtd, valor: Number(pagos[0].valor) },
  ];
}

// -----------------------------------------------
// Pago por aging (faixa de inadimplencia)
// -----------------------------------------------
async function calcularPagoPorAging() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT faixa, qtd_parcelas, valor_recebido, valor_negociado FROM (
      SELECT
        CASE
          WHEN dias BETWEEN 0 AND 30 THEN '0-30'
          WHEN dias BETWEEN 31 AND 60 THEN '31-60'
          WHEN dias BETWEEN 61 AND 90 THEN '61-90'
          WHEN dias > 90 THEN '90+'
          ELSE 'A vencer'
        END AS faixa,
        COUNT(*)::int AS qtd_parcelas,
        COALESCE(SUM(valor_pago), 0)::numeric AS valor_recebido,
        COALESCE(SUM(valor_acordo), 0)::numeric AS valor_negociado,
        CASE
          WHEN dias BETWEEN 0 AND 30 THEN 1
          WHEN dias BETWEEN 31 AND 60 THEN 2
          WHEN dias BETWEEN 61 AND 90 THEN 3
          WHEN dias > 90 THEN 4
          ELSE 5
        END AS ordem
      FROM (
        SELECT
          pa.id,
          CASE WHEN pa.situacao = 'CONFIRMADO' THEN COALESCE(pa."valorPago", pa.valor) ELSE 0 END AS valor_pago,
          pa.valor AS valor_acordo,
          COALESCE(
            (SELECT MAX(CURRENT_DATE - po."dataVencimento"::date)
             FROM cobranca.parcela_original_acordo po WHERE po."acordoId" = pa."acordoId"),
            0
          ) AS dias
        FROM cobranca.pagamento_acordo pa
        JOIN cobranca.acordo_financeiro af ON af.id = pa."acordoId"
        WHERE af.etapa != 'CANCELADO'
      ) sub
      GROUP BY 1, 5
    ) grouped
    ORDER BY ordem
  `);

  return rows.map(r => ({
    faixa: r.faixa,
    qtdParcelas: r.qtd_parcelas,
    valorRecebido: Number(r.valor_recebido),
    valorNegociado: Number(r.valor_negociado),
  }));
}

// -----------------------------------------------
// Recuperado por forma de pagamento
// -----------------------------------------------
async function calcularPagoPorForma() {
  // Pagamentos do Asaas — so contabiliza pagamentos CONFIRMADOS (dinheiro em caixa).
  // qtd = pagamentos confirmados, valor = valorPago real (fallback em valor nominal).
  const asaas = await prisma.$queryRawUnsafe(`
    SELECT
      CASE
        WHEN pa."formaPagamento" = 'CREDIT_CARD' AND pa.parcelas >= 12 THEN 'Cartão em 12x'
        WHEN pa."formaPagamento" = 'CREDIT_CARD' AND pa.parcelas = 6 THEN 'Cartão em 6x'
        WHEN pa."formaPagamento" = 'CREDIT_CARD' AND pa.parcelas = 5 THEN 'Cartão em 5x'
        WHEN pa."formaPagamento" = 'CREDIT_CARD' AND pa.parcelas = 2 THEN 'Cartão em 2x'
        WHEN pa."formaPagamento" = 'CREDIT_CARD' AND pa.parcelas <= 1 THEN 'Cartão à vista'
        WHEN pa."formaPagamento" = 'PIX' THEN 'PIX'
        WHEN pa."formaPagamento" = 'BOLETO' THEN 'Boleto'
        ELSE 'Outros'
      END AS forma,
      COUNT(*)::int AS qtd,
      COALESCE(SUM(COALESCE(pa."valorPago", pa.valor)), 0)::numeric AS valor
    FROM cobranca.pagamento_acordo pa
    JOIN cobranca.acordo_financeiro af ON af.id = pa."acordoId"
    WHERE af.etapa != 'CANCELADO'
      AND pa.situacao = 'CONFIRMADO'
    GROUP BY forma
    ORDER BY valor DESC
  `);

  // Ficou Facil concluidos
  const ff = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS qtd, COALESCE(SUM("valorInadimplenteMJ"), 0)::numeric AS valor
    FROM cobranca.ficou_facil WHERE etapa = 'CONCLUIDO'
  `);

  const resultado = asaas.map(r => ({ forma: r.forma, qtd: r.qtd, valor: Number(r.valor) }));
  if (ff[0]?.qtd > 0) {
    resultado.push({ forma: 'Ficou Fácil', qtd: ff[0].qtd, valor: Number(ff[0].valor) });
  }

  return resultado;
}
