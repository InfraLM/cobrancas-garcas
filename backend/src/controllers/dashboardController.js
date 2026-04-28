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

    // recorrentesHistorico aqui usa SEMPRE granularidade=semana e janela
    // expandindo desde 2026-02-08, pra calcular a taxaRecorrencia do KPI
    // (mesmo universo do grafico "Composicao"). O grafico em si vem do
    // endpoint /dashboard/recorrentes-historico (parametrizado).
    const [aging, agingHistorico, recorrentesHistorico, ficouFacil, pagoPorAging, pagoPorForma] = await Promise.all([
      calcularAging(),
      calcularAgingHistorico(),
      calcularRecorrentesHistorico(),
      calcularFicouFacil(),
      calcularPagoPorAging(),
      calcularPagoPorForma(),
    ]);
    const kpis = await calcularKPIs(recorrentesHistorico);

    // recorrentesHistorico e acumuladoAlunos NAO vao no payload — endpoints
    // proprios os servem com filtros dinamicos (granularidade + periodo).
    const data = { kpis, aging, agingHistorico, ficouFacil, pagoPorAging, pagoPorForma, atualizadoEm: new Date().toISOString() };

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
async function calcularKPIs(recorrentesHistorico) {
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

  // Acordos + Ficou Facil concluidos somam para "Recuperado"
  const acordos = await prisma.$queryRawUnsafe(`
    WITH a AS (
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE etapa = 'CONCLUIDO')::int AS concluidos,
        COALESCE(SUM(CASE WHEN etapa = 'CONCLUIDO' THEN "valorAcordo" ELSE 0 END), 0)::numeric AS valor
      FROM cobranca.acordo_financeiro
    ),
    f AS (
      SELECT
        COUNT(*) FILTER (WHERE etapa = 'CONCLUIDO')::int AS concluidos,
        COALESCE(SUM(CASE WHEN etapa = 'CONCLUIDO' THEN "valorInadimplenteMJ" ELSE 0 END), 0)::numeric AS valor
      FROM cobranca.ficou_facil
    )
    SELECT
      a.total,
      (a.concluidos + f.concluidos)::int AS concluidos,
      (a.valor + f.valor)::numeric AS valor_recuperado
    FROM a, f
  `);

  // KPI de recorrencia usa a ULTIMA SEMANA do calcularRecorrentesHistorico —
  // mesmo universo (turmas whitelist + cancelamento/trancamento) — para que o
  // numero do card "Recorrencia" bate com o grafico "Composicao".
  const ultimaSemana = recorrentesHistorico[recorrentesHistorico.length - 1];
  const alunosComRecorrencia = ultimaSemana?.recorrentes || 0;
  const totalAtivosRecorrencia = ultimaSemana?.totalAtivos || 0;
  const taxaRecorrencia = totalAtivosRecorrencia > 0
    ? (alunosComRecorrencia / totalAtivosRecorrencia * 100).toFixed(1)
    : '0.0';

  return {
    totalAlunos: r.total_alunos,
    inadimplentes: r.inadimplentes,
    adimplentes: r.adimplentes,
    valorInadimplente: Number(r.valor_inadimplente),
    valorPago: Number(r.valor_pago),
    acordosTotal: acordos[0].total,
    acordosConcluidos: acordos[0].concluidos,
    valorRecuperado: Number(acordos[0].valor_recuperado),
    alunosComRecorrencia,
    taxaRecorrencia,
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
// Helper: gera o CTE `semanas` parametrizado.
//   granularidade='semana' -> buckets dom→sáb (alinhados ao domingo de inicio)
//   granularidade='mes'    -> buckets 1→último dia do mês
// `inicio` e `fim` são datas YYYY-MM-DD (já validadas pelo handler).
// O alias da coluna é mantido como `semana` pra compatibilidade com o resto
// das CTEs já existentes — frontend só vê o `idx`.
// -----------------------------------------------
function gerarCteBuckets(granularidade, inicio, fim) {
  if (granularidade === 'mes') {
    return `
    semanas AS (
      SELECT
        ROW_NUMBER() OVER (ORDER BY gs)::int AS semana,
        gs::date AS inicio,
        LEAST(
          (gs + INTERVAL '1 month' - INTERVAL '1 day')::date,
          DATE '${fim}'
        ) AS fim
      FROM generate_series(
        date_trunc('month', DATE '${inicio}')::date,
        date_trunc('month', DATE '${fim}')::date,
        INTERVAL '1 month'
      ) AS gs
    )`;
  }
  // semana (default): alinhado em domingo
  return `
    semanas AS (
      SELECT
        ROW_NUMBER() OVER (ORDER BY gs)::int AS semana,
        gs::date AS inicio,
        LEAST((gs + INTERVAL '6 days')::date, DATE '${fim}') AS fim
      FROM generate_series(
        (DATE '${inicio}' - EXTRACT(DOW FROM DATE '${inicio}')::int * INTERVAL '1 day')::date,
        DATE '${fim}',
        INTERVAL '7 days'
      ) AS gs
    )`;
}

function parsearOptsBucket(req) {
  const granularidade = req.query.granularidade === 'mes' ? 'mes' : 'semana';
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const inicioParam = String(req.query.inicio || '');
  const fimParam = String(req.query.fim || '');
  const inicio = re.test(inicioParam) ? inicioParam : '2026-02-08';
  // Default fim: hoje (CURRENT_DATE) — formatado como YYYY-MM-DD em BRT
  const hojeBrt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const fim = re.test(fimParam) ? fimParam : hojeBrt;
  return { granularidade, inicio, fim };
}

function formatarLabelBucket(granularidade, inicioISO, fimISO) {
  if (granularidade === 'mes') {
    const d = new Date(inicioISO);
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${meses[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(-2)}`;
  }
  // Para semana: rotula com o ULTIMO dia (sabado), igual ao padrao da query do
  // usuario (a barra "14/02" representa a semana 08-14/02).
  return new Date(fimISO).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
}

// -----------------------------------------------
// Recorrentes vs nao-recorrentes por semana — portado literal do
// dashboard/query-recorrentes-vs-outros.txt
//
// Logica preservada:
//   - Whitelist turma IN (2,4,8,11,21,28)
//   - Exclui tipoorigem OUT (e MAT em CTEs de data-base/gap)
//   - Funcionario = false
//   - Trata cancelamento (com override 2025-02-04)
//   - Trata trancamento via NEGOCIACAO (ILIKE TRANCAMENTO) e gap de 5 meses
//   - Retorno de trancamento via NCR ou via gap
//
// Adaptacao: janela expandindo desde 08/02/2026 ate ultimo sabado completo
// (igual ao calcularAcumuladoAlunos).
// -----------------------------------------------
async function calcularRecorrentesHistorico(opts = {}) {
  const granularidade = opts.granularidade === 'mes' ? 'mes' : 'semana';
  const inicio = opts.inicio || '2026-02-08';
  const fim = opts.fim || new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const cteBuckets = gerarCteBuckets(granularidade, inicio, fim);
  const rows = await prisma.$queryRawUnsafe(`
    WITH
    base_matriculas AS (
      SELECT DISTINCT cr.matriculaaluno AS matricula, cr.turma AS turma_codigo
      FROM cobranca.contareceber cr
      WHERE cr.turma IN (2,4,8,11,21,28) AND COALESCE(cr.tipoorigem, '') <> 'OUT'
    ),
    cadastro AS (
      SELECT bm.matricula, mt."data"::date AS data_matricula, p.codigo AS pessoa_id
      FROM base_matriculas bm
      JOIN cobranca.matricula mt ON mt.matricula = bm.matricula
      JOIN cobranca.pessoa p ON p.codigo = mt.aluno
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
    base_matricula AS (
      SELECT c.matricula, c.pessoa_id, c.data_matricula,
        CASE WHEN db.situacao_aluno = 'AT' AND ca.data_cancelamento = DATE '2025-02-04' THEN NULL
          ELSE ca.data_cancelamento END AS data_cancelamento,
        COALESCE(t.data_trancamento, tg.data_trancamento) AS data_trancamento,
        COALESCE(rt.data_retorno_trancamento, tg.data_retorno_trancamento) AS data_retorno_trancamento
      FROM cadastro c
      LEFT JOIN data_base db ON db.matricula = c.matricula
      LEFT JOIN cancelamento ca ON ca.matricula = c.matricula
      LEFT JOIN trancamento t ON t.matricula = c.matricula
      LEFT JOIN retorno_trancamento rt ON rt.matricula = c.matricula
      LEFT JOIN trancamento_gap tg ON tg.matricula = c.matricula
    ),
    recorrencia AS (
      SELECT cc.pessoa AS pessoa_id,
        cc.datacadastro::date AS datacadastro,
        cc.datainativacao::date AS datainativacao
      FROM cobranca.cartaocreditodebitorecorrenciapessoa cc
    ),
    ${cteBuckets},
    ativos_por_semana AS (
      SELECT s.semana, s.inicio, s.fim, COUNT(*) AS alunos_ativos
      FROM base_matricula bm CROSS JOIN semanas s
      WHERE bm.data_matricula <= s.fim
        AND (bm.data_cancelamento IS NULL OR bm.data_cancelamento > s.fim)
        AND NOT (bm.data_trancamento IS NOT NULL AND bm.data_trancamento <= s.fim
          AND (bm.data_retorno_trancamento IS NULL OR bm.data_retorno_trancamento > s.fim))
      GROUP BY s.semana, s.inicio, s.fim
    ),
    recorrentes_por_semana AS (
      SELECT s.semana, s.inicio, s.fim, COUNT(*) AS alunos_recorrentes
      FROM recorrencia r CROSS JOIN semanas s
      WHERE r.datacadastro <= s.fim
        AND (r.datainativacao IS NULL OR r.datainativacao > s.fim)
      GROUP BY s.semana, s.inicio, s.fim
    )
    SELECT a.semana, a.inicio, a.fim,
      (a.alunos_ativos - COALESCE(r.alunos_recorrentes, 0))::int AS sem_recorrencia,
      COALESCE(r.alunos_recorrentes, 0)::int AS recorrentes,
      a.alunos_ativos::int AS total_ativos,
      CASE WHEN a.alunos_ativos > 0
        THEN ROUND(COALESCE(r.alunos_recorrentes, 0)::numeric / a.alunos_ativos * 100, 1)
        ELSE 0 END AS percentual
    FROM ativos_por_semana a
    LEFT JOIN recorrentes_por_semana r ON r.semana = a.semana
    ORDER BY a.semana
  `);

  return rows.map(r => ({
    semana: Number(r.semana),
    inicio: r.inicio,
    fim: r.fim,
    label: formatarLabelBucket(granularidade, r.inicio, r.fim),
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
async function calcularAcumuladoAlunos(opts = {}) {
  const granularidade = opts.granularidade === 'mes' ? 'mes' : 'semana';
  const inicio = opts.inicio || '2026-02-08';
  const fim = opts.fim || new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const cteBuckets = gerarCteBuckets(granularidade, inicio, fim);
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
    ${cteBuckets},
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
      inicio: r.inicio,
      fim: r.fim,
      label: formatarLabelBucket(granularidade, r.inicio, r.fim),
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
// Funil de cobranca historico — foto do periodo [inicio, fim].
//
// 5 etapas, restritas ao subset de alunos que estavam na BASE INADIMPLENTE
// na data `inicio` (snapshot diario gravado por snapshotService.js):
//   - Base Inadimplente: COUNT/SUM da snapshot do dia `inicio`.
//   - Tentativa de Contato: ligacao OU whatsapp enviado por agente em [inicio,fim],
//     APENAS para alunos da base de `inicio`.
//   - Contato Realizado: subset da tentativa onde ligacao teve fala >= 4s
//     ou aluno respondeu whatsapp.
//   - Negociado: acordos criados em [inicio,fim] (exceto cancelados),
//     restrito a alunos da base.
//   - Recuperado: acordos concluidos em [inicio,fim] (concluidoEm), restrito a base.
//
// Snapshot indisponivel: se `inicio` < primeira_data ou > ultima_data,
// usa a data mais proxima e retorna `aviso` na resposta.
//
// Compatibilidade: aceita `?periodo=30d` (legado) que e convertido para
// inicio=hoje-30d, fim=hoje.
// -----------------------------------------------
export async function obterFunil(req, res, next) {
  try {
    let { inicio, fim } = req.query;

    // Compatibilidade com chamada legada `?periodo=30d`
    if (!inicio || !fim) {
      const dias = Number(String(req.query.periodo || '30d').replace(/\D/g, '')) || 30;
      const fimD = new Date();
      const iniD = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
      inicio = iniD.toISOString().slice(0, 10);
      fim = fimD.toISOString().slice(0, 10);
    }

    // Validacao basica
    if (inicio > fim) {
      return res.status(400).json({ error: 'inicio nao pode ser depois de fim' });
    }

    // Range de snapshots disponiveis
    const range = await prisma.$queryRawUnsafe(`
      SELECT MIN(data)::text AS min_data, MAX(data)::text AS max_data
      FROM cobranca.snapshot_inadimplencia_diario
    `);
    const minSnap = range[0]?.min_data;
    const maxSnap = range[0]?.max_data;

    if (!minSnap) {
      return res.json({
        inicio, fim,
        snapshotData: null,
        aviso: 'Nenhum snapshot disponivel ainda. Aguarde o primeiro ciclo diario.',
        funil: [
          { etapa: 'Base Inadimplente', qtd: 0, valor: 0 },
          { etapa: 'Tentativa de Contato', qtd: 0, valor: 0 },
          { etapa: 'Contato Realizado', qtd: 0, valor: 0 },
          { etapa: 'Negociado', qtd: 0, valor: 0 },
          { etapa: 'Recuperado', qtd: 0, valor: 0 },
        ],
      });
    }

    // Resolver data efetiva da snapshot
    let snapshotData = inicio;
    let aviso = null;
    // Formata YYYY-MM-DD -> DD/MM/YYYY sem passar por Date (evita problema de fuso)
    const fmtBr = (iso) => iso.split('-').reverse().join('/');
    if (inicio < minSnap) {
      snapshotData = minSnap;
      aviso = `Snapshot disponivel apenas a partir de ${fmtBr(minSnap)} — exibindo a foto mais antiga.`;
    } else if (inicio > maxSnap) {
      snapshotData = maxSnap;
      aviso = `Snapshot mais recente e de ${fmtBr(maxSnap)} — exibindo essa foto.`;
    }

    // Bordas de timestamp para queries com TIMESTAMP (mensagens, ligacoes, acordos)
    const inicioTs = `${inicio} 00:00:00`;
    const fimTs = `${fim} 23:59:59`;

    const [base, tentativa, realizado, negociado, recuperado] = await Promise.all([
      // Base = snapshot do dia
      prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int AS qtd, COALESCE(SUM("valorDevedor"), 0)::numeric AS valor
        FROM cobranca.snapshot_inadimplencia_diario WHERE data = $1::date
      `, snapshotData),
      // Tentativa: contactados em [inicio,fim] que estavam na base de inicio
      prisma.$queryRawUnsafe(`
        WITH base AS (
          SELECT "pessoaCodigo", "valorDevedor"
          FROM cobranca.snapshot_inadimplencia_diario WHERE data = $1::date
        ),
        contactados AS (
          SELECT DISTINCT "pessoaCodigo" AS pessoa
          FROM cobranca.registro_ligacao
          WHERE "pessoaCodigo" IS NOT NULL
            AND "dataHoraChamada" BETWEEN $2::timestamp AND $3::timestamp
          UNION
          SELECT DISTINCT "pessoaCodigo" AS pessoa
          FROM cobranca.mensagem_whatsapp
          WHERE "pessoaCodigo" IS NOT NULL AND "fromMe" = true
            AND "timestamp" BETWEEN $2::timestamp AND $3::timestamp
        )
        SELECT COUNT(*)::int AS qtd,
          COALESCE(SUM(b."valorDevedor"), 0)::numeric AS valor
        FROM base b
        WHERE b."pessoaCodigo" IN (SELECT pessoa FROM contactados)
      `, snapshotData, inicioTs, fimTs),
      // Contato Realizado: ligacao com fala >= 4s OU whatsapp recebido, restrito a base
      prisma.$queryRawUnsafe(`
        WITH base AS (
          SELECT "pessoaCodigo", "valorDevedor"
          FROM cobranca.snapshot_inadimplencia_diario WHERE data = $1::date
        ),
        efetivos AS (
          SELECT DISTINCT "pessoaCodigo" AS pessoa
          FROM cobranca.registro_ligacao
          WHERE "pessoaCodigo" IS NOT NULL
            AND "dataHoraChamada" BETWEEN $2::timestamp AND $3::timestamp
            AND COALESCE("tempoFalando", 0) >= 4
          UNION
          SELECT DISTINCT "pessoaCodigo" AS pessoa
          FROM cobranca.mensagem_whatsapp
          WHERE "pessoaCodigo" IS NOT NULL AND "fromMe" = false
            AND "timestamp" BETWEEN $2::timestamp AND $3::timestamp
        )
        SELECT COUNT(*)::int AS qtd,
          COALESCE(SUM(b."valorDevedor"), 0)::numeric AS valor
        FROM base b
        WHERE b."pessoaCodigo" IN (SELECT pessoa FROM efetivos)
      `, snapshotData, inicioTs, fimTs),
      // Negociado: acordo criado em [inicio,fim], restrito a base de inicio
      prisma.$queryRawUnsafe(`
        WITH base AS (
          SELECT DISTINCT "pessoaCodigo"
          FROM cobranca.snapshot_inadimplencia_diario WHERE data = $1::date
        ),
        neg AS (
          SELECT "pessoaCodigo" AS pessoa, "valorAcordo"::numeric AS valor
          FROM cobranca.acordo_financeiro
          WHERE etapa != 'CANCELADO' AND "criadoEm" BETWEEN $2::timestamp AND $3::timestamp
            AND "pessoaCodigo" IN (SELECT "pessoaCodigo" FROM base)
          UNION ALL
          SELECT "pessoaCodigo" AS pessoa, "valorInadimplenteMJ"::numeric AS valor
          FROM cobranca.ficou_facil
          WHERE etapa != 'CANCELADO' AND "criadoEm" BETWEEN $2::timestamp AND $3::timestamp
            AND "pessoaCodigo" IN (SELECT "pessoaCodigo" FROM base)
        )
        SELECT COUNT(DISTINCT pessoa)::int AS qtd,
          COALESCE(SUM(valor), 0)::numeric AS valor
        FROM neg
      `, snapshotData, inicioTs, fimTs),
      // Recuperado: acordo concluido em [inicio,fim], restrito a base
      prisma.$queryRawUnsafe(`
        WITH base AS (
          SELECT DISTINCT "pessoaCodigo"
          FROM cobranca.snapshot_inadimplencia_diario WHERE data = $1::date
        ),
        rec AS (
          SELECT "pessoaCodigo" AS pessoa, "valorAcordo"::numeric AS valor
          FROM cobranca.acordo_financeiro
          WHERE etapa = 'CONCLUIDO' AND "concluidoEm" BETWEEN $2::timestamp AND $3::timestamp
            AND "pessoaCodigo" IN (SELECT "pessoaCodigo" FROM base)
          UNION ALL
          SELECT "pessoaCodigo" AS pessoa, "valorInadimplenteMJ"::numeric AS valor
          FROM cobranca.ficou_facil
          WHERE etapa = 'CONCLUIDO' AND "concluidoEm" BETWEEN $2::timestamp AND $3::timestamp
            AND "pessoaCodigo" IN (SELECT "pessoaCodigo" FROM base)
        )
        SELECT COUNT(DISTINCT pessoa)::int AS qtd,
          COALESCE(SUM(valor), 0)::numeric AS valor
        FROM rec
      `, snapshotData, inicioTs, fimTs),
    ]);

    res.json({
      inicio,
      fim,
      snapshotData,
      aviso,
      funil: [
        { etapa: 'Base Inadimplente', qtd: base[0].qtd, valor: Number(base[0].valor) },
        { etapa: 'Tentativa de Contato', qtd: tentativa[0].qtd, valor: Number(tentativa[0].valor) },
        { etapa: 'Contato Realizado', qtd: realizado[0].qtd, valor: Number(realizado[0].valor) },
        { etapa: 'Negociado', qtd: negociado[0].qtd, valor: Number(negociado[0].valor) },
        { etapa: 'Recuperado', qtd: recuperado[0].qtd, valor: Number(recuperado[0].valor) },
      ],
    });
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// Handlers HTTP dos graficos parametrizados
// -----------------------------------------------
export async function obterRecorrentesHistorico(req, res, next) {
  try {
    const opts = parsearOptsBucket(req);
    const data = await calcularRecorrentesHistorico(opts);
    res.json({ ...opts, data });
  } catch (error) {
    next(error);
  }
}

export async function obterAcumuladoAlunos(req, res, next) {
  try {
    const opts = parsearOptsBucket(req);
    const data = await calcularAcumuladoAlunos(opts);
    res.json({ ...opts, data });
  } catch (error) {
    next(error);
  }
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
// Recuperado por forma de pagamento — duas visoes:
//   - competencia: TODO valor confirmado (mesmo se parcelado em 6x — soma o
//     valor total reconhecido como receita do acordo)
//   - caixa: apenas o valor que efetivamente entrou (parcelas confirmadas)
//
// Ambas filtram acordos != CANCELADO. Diferenca esta na semantica do "valor".
// -----------------------------------------------
function caseFormaPagamento() {
  return `
    CASE
      WHEN pa."formaPagamento" = 'CREDIT_CARD' AND pa.parcelas >= 12 THEN 'Cartão em 12x'
      WHEN pa."formaPagamento" = 'CREDIT_CARD' AND pa.parcelas = 6 THEN 'Cartão em 6x'
      WHEN pa."formaPagamento" = 'CREDIT_CARD' AND pa.parcelas = 5 THEN 'Cartão em 5x'
      WHEN pa."formaPagamento" = 'CREDIT_CARD' AND pa.parcelas = 2 THEN 'Cartão em 2x'
      WHEN pa."formaPagamento" = 'CREDIT_CARD' AND pa.parcelas <= 1 THEN 'Cartão à vista'
      WHEN pa."formaPagamento" = 'PIX' THEN 'PIX'
      WHEN pa."formaPagamento" = 'BOLETO' THEN 'Boleto'
      ELSE 'Outros'
    END
  `;
}

async function calcularPagoPorForma() {
  // Competencia: 1 row por pagamento_acordo CONFIRMADO, somando o valor nominal
  // do acordo (o cartao em 6x conta o total mesmo que so 1 parcela tenha caido).
  const competencia = await prisma.$queryRawUnsafe(`
    SELECT ${caseFormaPagamento()} AS forma,
      COUNT(*)::int AS qtd,
      COALESCE(SUM(pa.valor), 0)::numeric AS valor
    FROM cobranca.pagamento_acordo pa
    JOIN cobranca.acordo_financeiro af ON af.id = pa."acordoId"
    WHERE af.etapa != 'CANCELADO' AND pa.situacao = 'CONFIRMADO'
    GROUP BY forma
    ORDER BY valor DESC
  `);

  // Caixa: o que de fato entrou (valorPago, com fallback no nominal apenas
  // quando valorPago nao foi gravado pelo Asaas).
  const caixa = await prisma.$queryRawUnsafe(`
    SELECT ${caseFormaPagamento()} AS forma,
      COUNT(*)::int AS qtd,
      COALESCE(SUM(COALESCE(pa."valorPago", pa.valor)), 0)::numeric AS valor
    FROM cobranca.pagamento_acordo pa
    JOIN cobranca.acordo_financeiro af ON af.id = pa."acordoId"
    WHERE af.etapa != 'CANCELADO' AND pa.situacao = 'CONFIRMADO'
    GROUP BY forma
    ORDER BY valor DESC
  `);

  // Ficou Facil concluidos — valor recuperado entra nas duas visoes
  const ff = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS qtd, COALESCE(SUM("valorInadimplenteMJ"), 0)::numeric AS valor
    FROM cobranca.ficou_facil WHERE etapa = 'CONCLUIDO'
  `);

  const mapearComFf = (rows) => {
    const out = rows.map(r => ({ forma: r.forma, qtd: r.qtd, valor: Number(r.valor) }));
    if (ff[0]?.qtd > 0) out.push({ forma: 'Ficou Fácil', qtd: ff[0].qtd, valor: Number(ff[0].valor) });
    return out;
  };

  return {
    competencia: mapearComFf(competencia),
    caixa: mapearComFf(caixa),
  };
}
