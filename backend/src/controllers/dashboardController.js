import { prisma } from '../config/database.js';
import { getOrSet, chaveDe } from '../utils/memCache.js';

const TURMAS_EXCLUIDAS = '1,10,14,19,22,27,29';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Cache em memoria (so para o caminho sem filtro de agente)
let cache = { data: null, timestamp: 0 };

// Parse query param `agenteIds` ("1,2,3") -> [1,2,3]. Retorna null se vazio (sem filtro).
function parseAgenteIds(raw) {
  if (!raw) return null;
  const arr = String(raw).split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0);
  return arr.length > 0 ? arr : null;
}

/**
 * GET /api/dashboard?forcar=true
 * Retorna todas as metricas do dashboard em um unico request.
 * Usa cache de 5 minutos para nao sobrecarregar o banco.
 */
export async function obterDashboard(req, res, next) {
  try {
    const forcar = req.query.forcar === 'true';
    const agenteIds = parseAgenteIds(req.query.agenteIds);
    const agora = Date.now();

    // Cache global so vale para o caminho SEM filtro de agente. Quando ha
    // filtro, recalculamos sem cache (fluxo raro, custo aceitavel).
    if (!forcar && !agenteIds && cache.data && (agora - cache.timestamp) < CACHE_TTL) {
      return res.json(cache.data);
    }

    console.log(`[Dashboard] Calculando metricas${agenteIds ? ` (filtro agentes: ${agenteIds.join(',')})` : ''}...`);
    const startTime = Date.now();

    // recorrentesHistorico aqui usa SEMPRE granularidade=semana e janela
    // expandindo desde 2026-02-08, pra calcular a taxaRecorrencia do KPI
    // (mesmo universo do grafico "Composicao"). O grafico em si vem do
    // endpoint /dashboard/recorrentes-historico (parametrizado).
    //
    // Filtro de agenteIds afeta SO pagoPorAging — KPIs sao numeros globais.
    // Aging Atual, Aging Historico e Pago Por Forma vem por endpoints proprios
    // (/dashboard/aging, /dashboard/aging-historico, /dashboard/pago-por-forma)
    // pra evitar re-renderizar quando o user muda o filtro de agente ou periodo.
    const [recorrentesHistorico, ficouFacil, pagoPorAging] = await Promise.all([
      calcularRecorrentesHistorico(),
      calcularFicouFacil(),
      calcularPagoPorAging(agenteIds),
    ]);
    const kpis = await calcularKPIs(recorrentesHistorico);

    // recorrentesHistorico, acumuladoAlunos, aging, agingHistorico e pagoPorForma
    // NAO vao no payload — endpoints proprios.
    const data = { kpis, ficouFacil, pagoPorAging, atualizadoEm: new Date().toISOString() };

    // So salva cache global no caminho sem filtro
    if (!agenteIds) {
      cache = { data, timestamp: agora };
    }

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
  // Universo do KPI "Alunos" (decisao do user 2026-05-08):
  //   - aluno_resumo (matricula em medicina + nao funcionario etc — ja filtrados)
  //   - situacao != 'CANCELADO' (TRANCADO eh aceito)
  //   - turma != null (exclui alunos cuja unica matricula caiu em turma da blacklist 1,10,14,19,22,27,29)
  //   - assinou contrato (mesma logica do drawer em alunosController.obter):
  //     * documentoassinadopessoa.dataassinatura preenchida
  //       (com documentoassinado.documentoassinadoinvalido = false)
  //     OU
  //     * aluno na turma 3 (matriculaperiodo.turma = 2 no SEI) — assinaram
  //       contrato externamente via ClickSign
  //
  // Inadimplentes seguem o mesmo universo (consistencia entre KPI Alunos e
  // KPI Inadimplencia).
  const rows = await prisma.$queryRawUnsafe(`
    WITH alunos_validos AS (
      SELECT ar.codigo, ar."situacaoFinanceira", ar."valorDevedor", ar."valorPago"
      FROM cobranca.aluno_resumo ar
      WHERE ar.situacao = 'ATIVO'  -- exclui CANCELADO E TRANCADO (decisao 2026-05-09)
        AND ar.turma IS NOT NULL
        AND (
          EXISTS (
            SELECT 1 FROM cobranca.documentoassinadopessoa dap
            JOIN cobranca.documentoassinado da ON da.codigo = dap.documentoassinado
            WHERE dap.pessoa = ar.codigo
              AND dap.dataassinatura IS NOT NULL
              AND COALESCE(da.documentoassinadoinvalido, false) = false
          )
          OR EXISTS (
            -- Turma 3 (codigo=2): assinaram contrato pela ClickSign, fora do SEI.
            -- Usamos contareceber.turma (nao matriculaperiodo.turma) porque 38%
            -- das matriculas no SEI nao tem registro em matriculaperiodo —
            -- ai esses alunos sumiriam erroneamente.
            SELECT 1 FROM cobranca.contareceber cr
            WHERE cr.pessoa = ar.codigo AND cr.turma = 2
          )
        )
    )
    SELECT
      COUNT(*)::int AS total_alunos,
      COUNT(*) FILTER (WHERE "situacaoFinanceira" = 'INADIMPLENTE')::int AS inadimplentes,
      COUNT(*) FILTER (WHERE "situacaoFinanceira" = 'ADIMPLENTE')::int AS adimplentes,
      COALESCE(SUM("valorDevedor"), 0) AS valor_inadimplente,
      COALESCE(SUM("valorPago"), 0) AS valor_pago
    FROM alunos_validos
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
  // Aging Atual segue o mesmo universo do KPI Alunos (decisao do user 2026-05-08):
  //   - Alunos ATIVOS ou TRANCADOS (nao CANCELADOS)
  //   - Com matricula em medicina (curso=1)
  //   - Com turma valida (NOT IN blacklist 1,10,14,19,22,27,29)
  //   - Que assinaram contrato no SEI OU sao da turma 3 (ClickSign)
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
      JOIN cobranca.aluno_resumo ar ON ar.codigo = cr.pessoa
      WHERE cr.situacao = 'AR'
        AND cr.datavencimento < CURRENT_DATE
        AND cr.valor > COALESCE(cr.valorrecebido, 0)
        AND (cr.turma IS NULL OR cr.turma NOT IN (${TURMAS_EXCLUIDAS}))
        AND COALESCE(cr.tipoorigem, '') NOT IN ('MAT', 'OUT')
        AND ar.situacao = 'ATIVO'  -- exclui CANCELADO E TRANCADO (decisao 2026-05-09)
        AND ar.turma IS NOT NULL
        AND (
          EXISTS (
            SELECT 1 FROM cobranca.documentoassinadopessoa dap
            JOIN cobranca.documentoassinado da ON da.codigo = dap.documentoassinado
            WHERE dap.pessoa = ar.codigo
              AND dap.dataassinatura IS NOT NULL
              AND COALESCE(da.documentoassinadoinvalido, false) = false
          )
          OR EXISTS (
            -- Turma 3 (codigo=2): assinaram contrato pela ClickSign, fora do SEI.
            -- Usamos contareceber.turma (nao matriculaperiodo.turma) porque 38%
            -- das matriculas no SEI nao tem registro em matriculaperiodo —
            -- ai esses alunos sumiriam erroneamente.
            SELECT 1 FROM cobranca.contareceber cr
            WHERE cr.pessoa = ar.codigo AND cr.turma = 2
          )
        )
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
async function calcularAgingHistorico(opts = {}) {
  // Granularidade (semana/mes) + periodo customizavel via gerarCteBuckets (helper
  // ja usado por calcularRecorrentesHistorico e calcularAcumuladoAlunos).
  // Default usado pelo frontend: hoje - 12 semanas → hoje (preserva visual atual).
  const granularidade = opts.granularidade === 'mes' ? 'mes' : 'semana';
  const hojeBrt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const inicio = opts.inicio || '2026-02-08';
  const fim = opts.fim || hojeBrt;
  const cteBuckets = gerarCteBuckets(granularidade, inicio, fim);

  const rows = await prisma.$queryRawUnsafe(`
    WITH ${cteBuckets},
    base AS (
      SELECT
        s.semana,
        s.inicio,
        s.fim,
        cr.codigo,
        cr.datavencimento::date AS vencimento,
        (cr.valor - COALESCE(cr.valorrecebido, 0))::numeric AS saldo,
        (s.fim - cr.datavencimento::date) AS dias_atraso,
        -- Cohort de matricula: classificado por TITULO (matricula vinculada ao proprio
        -- contareceber). m.curso=1 e redundancia de seguranca pois a whitelist de turmas
        -- (2,4,8,11,21,28,35) ja garante que sao todas turmas de curso=1. NULL em m.data
        -- (raro) cai em 'antes2026' (false).
        (m.data IS NOT NULL AND m.data >= DATE '2026-01-01') AS cohort_2026
      FROM cobranca.contareceber cr
      JOIN cobranca.pessoa p ON p.codigo = cr.pessoa
      LEFT JOIN cobranca.matricula m
        ON m.matricula = cr.matriculaaluno
       AND m.curso = 1
      CROSS JOIN semanas s
      WHERE cr.datavencimento::date <= s.fim
        AND cr.situacao IN ('AR', 'RE', 'CF')
        AND COALESCE(cr.tipoorigem, '') NOT IN ('MAT', 'OUT')
        -- Whitelist alinhada com a query original do "aging empilhado" (curso=1 garantido).
        -- Filtravel via opts.turmas — default = whitelist canonica.
        AND cr.turma IN ${turmasIN(opts.turmas)}
        AND p.aluno = true
        AND (COALESCE(p.funcionario, false) = false OR p.codigo = 589)
        -- Nao havia sido pago ate o fim do bucket
        AND NOT EXISTS (
          SELECT 1 FROM cobranca.contarecebernegociacaorecebimento crnr
          JOIN cobranca.negociacaorecebimento nr ON nr.codigo = crnr.negociacaorecebimento
          WHERE crnr.contareceber = cr.codigo AND nr.data::date <= s.fim
        )
        -- Nao havia sido cancelado ate o fim do bucket
        AND (cr.datacancelamento IS NULL OR cr.datacancelamento::date > s.fim)
    )
    SELECT
      semana,
      inicio,
      fim,
      -- TOTAL (alias legado preservado)
      COALESCE(SUM(saldo) FILTER (WHERE dias_atraso BETWEEN 0 AND 5), 0)::numeric AS faixa_0_5,
      COALESCE(SUM(saldo) FILTER (WHERE dias_atraso BETWEEN 6 AND 30), 0)::numeric AS faixa_6_30,
      COALESCE(SUM(saldo) FILTER (WHERE dias_atraso BETWEEN 31 AND 90), 0)::numeric AS faixa_31_90,
      COALESCE(SUM(saldo) FILTER (WHERE dias_atraso > 90), 0)::numeric AS faixa_90_mais,
      -- ANTES 2026
      COALESCE(SUM(saldo) FILTER (WHERE dias_atraso BETWEEN 0 AND 5 AND NOT cohort_2026), 0)::numeric AS faixa_0_5_antes2026,
      COALESCE(SUM(saldo) FILTER (WHERE dias_atraso BETWEEN 6 AND 30 AND NOT cohort_2026), 0)::numeric AS faixa_6_30_antes2026,
      COALESCE(SUM(saldo) FILTER (WHERE dias_atraso BETWEEN 31 AND 90 AND NOT cohort_2026), 0)::numeric AS faixa_31_90_antes2026,
      COALESCE(SUM(saldo) FILTER (WHERE dias_atraso > 90 AND NOT cohort_2026), 0)::numeric AS faixa_90_mais_antes2026,
      -- 2026
      COALESCE(SUM(saldo) FILTER (WHERE dias_atraso BETWEEN 0 AND 5 AND cohort_2026), 0)::numeric AS faixa_0_5_2026,
      COALESCE(SUM(saldo) FILTER (WHERE dias_atraso BETWEEN 6 AND 30 AND cohort_2026), 0)::numeric AS faixa_6_30_2026,
      COALESCE(SUM(saldo) FILTER (WHERE dias_atraso BETWEEN 31 AND 90 AND cohort_2026), 0)::numeric AS faixa_31_90_2026,
      COALESCE(SUM(saldo) FILTER (WHERE dias_atraso > 90 AND cohort_2026), 0)::numeric AS faixa_90_mais_2026
    FROM base
    GROUP BY semana, inicio, fim
    ORDER BY semana
  `);

  return rows.map(r => ({
    semana: Number(r.semana),
    inicio: r.inicio,
    fim: r.fim,
    label: formatarLabelBucket(granularidade, r.inicio, r.fim),
    faixa_0_5: Number(r.faixa_0_5),
    faixa_6_30: Number(r.faixa_6_30),
    faixa_31_90: Number(r.faixa_31_90),
    faixa_90_mais: Number(r.faixa_90_mais),
    faixa_0_5_antes2026: Number(r.faixa_0_5_antes2026),
    faixa_6_30_antes2026: Number(r.faixa_6_30_antes2026),
    faixa_31_90_antes2026: Number(r.faixa_31_90_antes2026),
    faixa_90_mais_antes2026: Number(r.faixa_90_mais_antes2026),
    faixa_0_5_2026: Number(r.faixa_0_5_2026),
    faixa_6_30_2026: Number(r.faixa_6_30_2026),
    faixa_31_90_2026: Number(r.faixa_31_90_2026),
    faixa_90_mais_2026: Number(r.faixa_90_mais_2026),
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

// Whitelist canonica de turmas para os 3 graficos cohort de medicina ativa.
// 2=TURMA 3, 4=TURMA 3-V2, 8=TURMA 4, 11=TURMA 4-V2, 21=TURMA 5A, 28=TURMA 5B,
// 35=TURMA 6 PRESENCIAL PADRAO. Frontend pode filtrar via ?turmas=2,35 etc.
const TURMAS_COHORT_WHITELIST = [2, 4, 8, 11, 21, 28, 35];

function parsearOptsBucket(req) {
  const granularidade = req.query.granularidade === 'mes' ? 'mes' : 'semana';
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const inicioParam = String(req.query.inicio || '');
  const fimParam = String(req.query.fim || '');
  const inicio = re.test(inicioParam) ? inicioParam : '2026-02-08';
  // Default fim: hoje (CURRENT_DATE) — formatado como YYYY-MM-DD em BRT
  const hojeBrt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const fim = re.test(fimParam) ? fimParam : hojeBrt;
  // Turmas: CSV de int (?turmas=2,35). Validamos contra a whitelist para evitar
  // injecao em SQL. Default (sem filtro) = whitelist inteira.
  const turmasParam = String(req.query.turmas || '').trim();
  let turmas = TURMAS_COHORT_WHITELIST;
  if (turmasParam) {
    const arr = turmasParam.split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && TURMAS_COHORT_WHITELIST.includes(n));
    if (arr.length > 0) turmas = arr;
  }
  return { granularidade, inicio, fim, turmas };
}

// Constroi a clausula SQL "IN (...)" para turmas. Valores ja sao ints validados
// (whitelist) — seguro contra SQL injection.
function turmasIN(turmas) {
  const lista = (turmas && turmas.length > 0) ? turmas : TURMAS_COHORT_WHITELIST;
  return `(${lista.join(',')})`;
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
//   - Whitelist turma IN (2,4,8,11,21,28,35) — filtravel via opts.turmas (subset)
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
      WHERE cr.turma IN ${turmasIN(opts.turmas)} AND COALESCE(cr.tipoorigem, '') <> 'OUT'
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
      WHERE cr.turma IN ${turmasIN(opts.turmas)} AND COALESCE(cr.tipoorigem, '') NOT IN ('MAT','OUT')
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
      WHERE cr.turma IN ${turmasIN(opts.turmas)} AND cr.datacancelamento IS NOT NULL AND COALESCE(cr.tipoorigem, '') <> 'OUT'
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
      WHERE cr.turma IN ${turmasIN(opts.turmas)} AND COALESCE(cr.tipoorigem, '') <> 'OUT'
      GROUP BY t.matricula
    ),
    trancamento_gap_base AS (
      SELECT cr.matriculaaluno AS matricula,
        LAG(cr.datavencimento::date) OVER (PARTITION BY cr.matriculaaluno ORDER BY cr.datavencimento::date, cr.codigo) AS data_trancamento,
        cr.datavencimento::date AS data_retorno_trancamento
      FROM cobranca.contareceber cr
      WHERE cr.turma IN ${turmasIN(opts.turmas)} AND cr.situacao IN ('AR','RE','CF')
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
      -- Restringe aos alunos da base_matricula (que ja respeita o filtro de turmas).
      -- Sem isso, recorrentes_por_semana contaria TODA a base de cartoes do banco,
      -- gerando percentuais > 100% quando o subset selecionado eh pequeno.
      SELECT cc.pessoa AS pessoa_id,
        cc.datacadastro::date AS datacadastro,
        cc.datainativacao::date AS datainativacao
      FROM cobranca.cartaocreditodebitorecorrenciapessoa cc
      WHERE cc.pessoa IN (SELECT pessoa_id FROM base_matricula)
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
//   - Whitelist de turmas (2,4,8,11,21,28,35) — cohort de medicina ativa (35 = TURMA 6 PRESENCIAL PADRAO)
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
      WHERE cr.turma IN ${turmasIN(opts.turmas)}
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
      WHERE cr.turma IN ${turmasIN(opts.turmas)} AND COALESCE(cr.tipoorigem, '') NOT IN ('MAT','OUT')
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
      WHERE cr.turma IN ${turmasIN(opts.turmas)} AND cr.datacancelamento IS NOT NULL AND COALESCE(cr.tipoorigem, '') <> 'OUT'
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
      WHERE cr.turma IN ${turmasIN(opts.turmas)} AND COALESCE(cr.tipoorigem, '') <> 'OUT'
      GROUP BY t.matricula
    ),
    trancamento_gap_base AS (
      SELECT cr.matriculaaluno AS matricula,
        LAG(cr.datavencimento::date) OVER (PARTITION BY cr.matriculaaluno ORDER BY cr.datavencimento::date, cr.codigo) AS data_trancamento,
        cr.datavencimento::date AS data_retorno_trancamento
      FROM cobranca.contareceber cr
      WHERE cr.turma IN ${turmasIN(opts.turmas)} AND cr.situacao IN ('AR','RE','CF')
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
    ),
    -- COORTE SEMANAL: dos alunos que matricularam NA semana X, quantos cadastraram
    -- recorrencia tambem DENTRO da mesma semana X (adesao imediata).
    -- Diferente de novos_alunos_recorrentes_semana, que conta cadastros DA semana de
    -- QUALQUER aluno da janela. Aqui exigimos que MATRICULA E CADASTRO_RECORRENCIA
    -- ambos ocorram dentro do mesmo bucket.
    -- Aplica os mesmos filtros do denominador (novos_alunos_semana) para consistencia visual.
    coorte_semana AS (
      SELECT s.semana, s.inicio, s.fim,
        COUNT(*) FILTER (
          WHERE bm.data_cadastro_recorrencia IS NOT NULL
            AND bm.data_cadastro_recorrencia >= s.inicio
            AND bm.data_cadastro_recorrencia <= s.fim
        ) AS rec_coorte
      FROM base_matricula bm CROSS JOIN semanas s
      WHERE bm.data_matricula >= s.inicio AND bm.data_matricula <= s.fim
        AND (bm.data_cancelamento IS NULL OR bm.data_cancelamento > s.fim)
        AND NOT (bm.data_trancamento IS NOT NULL AND bm.data_trancamento <= s.fim
          AND (bm.data_retorno_trancamento IS NULL OR bm.data_retorno_trancamento > s.fim))
      GROUP BY s.semana, s.inicio, s.fim
    )
    SELECT s.semana, s.inicio, s.fim,
      COALESCE(n.novos_alunos_semana, 0)::int AS novos_semana,
      SUM(COALESCE(n.novos_alunos_semana, 0)) OVER (ORDER BY s.semana ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::int AS novos_acumulado,
      COALESCE(r.novos_alunos_recorrentes_semana, 0)::int AS rec_semana,
      SUM(COALESCE(r.novos_alunos_recorrentes_semana, 0)) OVER (ORDER BY s.semana ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::int AS rec_acumulado,
      COALESCE(c.rec_coorte, 0)::int AS rec_coorte
    FROM semanas s
    LEFT JOIN novos_alunos_recorrentes_semana r ON r.semana = s.semana
    LEFT JOIN novos_alunos_semana n ON n.semana = s.semana
    LEFT JOIN coorte_semana c ON c.semana = s.semana
    ORDER BY s.semana
  `);

  const hojeMs = Date.now();
  return rows.map(r => {
    const acumulado = Number(r.novos_acumulado);
    const acumuladoRec = Number(r.rec_acumulado);
    const novos = Number(r.novos_semana);
    const recCoorte = Number(r.rec_coorte);
    // Maturacao: na visao de coorte estrita (cadastro dentro do mesmo bucket da matricula),
    // somente a semana ATUAL ainda pode receber cadastros — semanas passadas ja tem
    // o numero definitivo. gerarCteBuckets trunca o fim da ultima semana em hoje,
    // entao a "semana atual" eh aquela cujo fim eh hoje ou ate ~1 dia atras.
    const fimDate = new Date(r.fim);
    const diasAteHoje = Math.floor((hojeMs - fimDate.getTime()) / 86400000);
    const emMaturacao = diasAteHoje <= 1;
    return {
      semana: Number(r.semana),
      inicio: r.inicio,
      fim: r.fim,
      label: formatarLabelBucket(granularidade, r.inicio, r.fim),
      novos,
      acumulado,
      recorrentesSemana: Number(r.rec_semana),
      acumuladoRecorrentes: acumuladoRec,
      percentualRecorrentes: acumulado > 0 ? Number((acumuladoRec / acumulado * 100).toFixed(1)) : 0,
      // Visao de coorte: dos alunos que matricularam NESTA semana, quantos cadastraram recorrencia
      recCoorte,
      percentualCoorte: novos > 0 ? Number((recCoorte / novos * 100).toFixed(1)) : null,
      emMaturacao,
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
    const agenteIds = parseAgenteIds(req.query.agenteIds);

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

    // Cache 30s — funil eh agregado pesado e a mesma combinacao de datas
    // costuma ser pedida varias vezes em sequencia (re-renders, navegacao).
    // agenteIds entra na chave para nao misturar resultados entre filtros.
    const cacheKey = chaveDe('dashboard:funil', { inicio, fim, agenteIds: agenteIds ? agenteIds.join(',') : '' });
    const result = await getOrSet(cacheKey, 30, async () => {
    // Range de snapshots disponiveis
    const range = await prisma.$queryRawUnsafe(`
      SELECT MIN(data)::text AS min_data, MAX(data)::text AS max_data
      FROM cobranca.snapshot_inadimplencia_diario
    `);
    const minSnap = range[0]?.min_data;
    const maxSnap = range[0]?.max_data;

    if (!minSnap) {
      return {
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
      };
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

    // Funil OPERACIONAL (decisao do user 2026-05-08): nao ha mais restricao de
    // coorte nas etapas downstream. Cada coluna conta o que aconteceu no periodo
    // de forma independente. So a Base usa o snapshot.

    // Filtro de agente: aplicado em todas as etapas EXCETO Base (universo total).
    // Param $4 = array de User.id quando ha filtro.
    //
    // Ligacao: agenteId direto (3C Plus agent.id) OR campanhaId do user.
    // O OR cobre as ligacoes de massa do dialer preditivo (95% das ligacoes
    // tem agenteId NULL porque o dialer nao atribui agente individual — mas
    // pertencem a campanha do agente que subiu o mailing).
    //
    // Whatsapp: filtra por instanciaId via tabela N:N instancia_whatsapp_user.
    // Nao usar mensagem_whatsapp.agenteId — payload da 3C Plus quase nunca
    // popula msg.agent.id em mensagens recebidas (90% NULL). A relacao real
    // user-whatsapp e user-instancia.
    //
    // Acordo: criadoPor referencia User.id direto, sem traducao.
    const filtroAgenteLigacaoSql = agenteIds ? `
      AND (
        "agenteId" IN (
          SELECT "threecplusAgentId" FROM cobranca.users
          WHERE id = ANY($4::int[]) AND "threecplusAgentId" IS NOT NULL
        )
        OR "campanhaId" IN (
          SELECT "campanhaId" FROM cobranca.campanha_user
          WHERE "userId" = ANY($4::int[])
        )
      )` : '';
    const filtroAgenteWhatsappSql = agenteIds ? `
      AND "instanciaId" IN (
        SELECT "instanciaId" FROM cobranca.instancia_whatsapp_user
        WHERE "userId" = ANY($4::int[])
      )` : '';
    const filtroAgenteAcordoSql = agenteIds ? `AND "criadoPor" = ANY($4::int[])` : '';
    const paramsBase = [snapshotData];
    const paramsEtapa = agenteIds
      ? [snapshotData, inicioTs, fimTs, agenteIds]
      : [snapshotData, inicioTs, fimTs];

    const [base, tentativa, realizado, negociado, recuperado] = await Promise.all([
      // Base = snapshot do dia (SEMPRE — nao filtra por agente, eh universo total)
      prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int AS qtd, COALESCE(SUM("valorDevedor"), 0)::numeric AS valor
        FROM cobranca.snapshot_inadimplencia_diario WHERE data = $1::date
      `, ...paramsBase),
      // ---------------------------------------------------------------
      // Funil OPERACIONAL (decisao do user em 2026-05-08):
      //   - Base: snapshot do INICIO do periodo (foto inicial)
      //   - Tentativa/Realizado/Negociado/Recuperado: tudo que aconteceu
      //     no periodo, SEM restricao de coorte. Mede volume operacional.
      //   - Recuperado: mesma regra da Matriz Pago (cartao capturado conta,
      //     valor bruto).
      //
      // Antes era cohort tracking (restringe pela base inicial). Agora eh
      // visao operacional pura. As 5 colunas respondem perguntas
      // independentes sobre o periodo.
      // ---------------------------------------------------------------

      // Tentativa de Contato: qualquer interacao no periodo (inbound OU outbound).
      //   - Ligacao (qualquer registro_ligacao no periodo)
      //   - Mensagem WhatsApp em ambas direcoes (fromMe true OU false)
      // Valor = aluno_resumo.valorDevedor atual (best-effort) dos contactados.
      prisma.$queryRawUnsafe(`
        WITH contactados AS (
          SELECT DISTINCT "pessoaCodigo" AS pessoa
          FROM cobranca.registro_ligacao
          WHERE "pessoaCodigo" IS NOT NULL
            AND "dataHoraChamada" BETWEEN $2::timestamp AND $3::timestamp
            ${filtroAgenteLigacaoSql}
          UNION
          SELECT DISTINCT "pessoaCodigo" AS pessoa
          FROM cobranca.mensagem_whatsapp
          WHERE "pessoaCodigo" IS NOT NULL
            AND "timestamp" BETWEEN $2::timestamp AND $3::timestamp
            ${filtroAgenteWhatsappSql}
        )
        SELECT COUNT(DISTINCT c.pessoa)::int AS qtd,
          COALESCE(SUM(ar."valorDevedor"), 0)::numeric AS valor
        FROM contactados c
        LEFT JOIN cobranca.aluno_resumo ar ON ar.codigo = c.pessoa
      `, ...paramsEtapa),
      // Contato Realizado: interacao bilateral efetiva no periodo.
      //   - Ligacao com tempoFalando >= 4s (humano atendeu)
      //   - Aluno respondeu/iniciou WhatsApp (fromMe = false)
      prisma.$queryRawUnsafe(`
        WITH efetivos AS (
          SELECT DISTINCT "pessoaCodigo" AS pessoa
          FROM cobranca.registro_ligacao
          WHERE "pessoaCodigo" IS NOT NULL
            AND "dataHoraChamada" BETWEEN $2::timestamp AND $3::timestamp
            AND COALESCE("tempoFalando", 0) >= 4
            ${filtroAgenteLigacaoSql}
          UNION
          SELECT DISTINCT "pessoaCodigo" AS pessoa
          FROM cobranca.mensagem_whatsapp
          WHERE "pessoaCodigo" IS NOT NULL AND "fromMe" = false
            AND "timestamp" BETWEEN $2::timestamp AND $3::timestamp
            ${filtroAgenteWhatsappSql}
        )
        SELECT COUNT(DISTINCT e.pessoa)::int AS qtd,
          COALESCE(SUM(ar."valorDevedor"), 0)::numeric AS valor
        FROM efetivos e
        LEFT JOIN cobranca.aluno_resumo ar ON ar.codigo = e.pessoa
      `, ...paramsEtapa),
      // Negociado: acordos criados no periodo (acordo_financeiro + ficou_facil).
      // Sem restricao de coorte. Valor = soma de valorAcordo / valorInadimplenteMJ.
      prisma.$queryRawUnsafe(`
        WITH neg AS (
          SELECT "pessoaCodigo" AS pessoa, "valorAcordo"::numeric AS valor
          FROM cobranca.acordo_financeiro
          WHERE etapa != 'CANCELADO' AND "criadoEm" BETWEEN $2::timestamp AND $3::timestamp
            ${filtroAgenteAcordoSql}
          UNION ALL
          SELECT "pessoaCodigo" AS pessoa, "valorInadimplenteMJ"::numeric AS valor
          FROM cobranca.ficou_facil
          WHERE etapa != 'CANCELADO' AND "criadoEm" BETWEEN $2::timestamp AND $3::timestamp
            ${filtroAgenteAcordoSql}
        )
        SELECT COUNT(DISTINCT pessoa)::int AS qtd,
          COALESCE(SUM(valor), 0)::numeric AS valor
        FROM neg
      `, ...paramsEtapa),
      // Recuperado: MESMA regra da Matriz Pago bruto.
      //   - acordo_financeiro: pagamento_acordo com confirmadoEm OU
      //     creditCardCapturedAt no periodo, valor bruto (cartao capturado
      //     conta 100% mesmo se so 1 parcela confirmou)
      //   - ficou_facil: concluidoEm no periodo
      // Sem restricao de coorte. Sem exigencia de etapa=CONCLUIDO no acordo.
      prisma.$queryRawUnsafe(`
        WITH rec AS (
          SELECT DISTINCT af."pessoaCodigo" AS pessoa,
            CASE
              WHEN pa."formaPagamento" = 'CREDIT_CARD' AND pa.parcelas > 1 AND pa."creditCardCaptured" = true
                THEN pa.valor
              WHEN pa."confirmadoEm" IS NOT NULL
                THEN pa.valor
              ELSE 0
            END AS valor,
            pa.id AS pa_id
          FROM cobranca.acordo_financeiro af
          JOIN cobranca.pagamento_acordo pa ON pa."acordoId" = af.id
          WHERE af.etapa != 'CANCELADO'
            AND (
              pa."confirmadoEm" BETWEEN $2::timestamp AND $3::timestamp
              OR (pa."creditCardCaptured" = true
                  AND pa."creditCardCapturedAt" BETWEEN $2::timestamp AND $3::timestamp)
            )
            ${filtroAgenteAcordoSql.replace(/\$4/g, '$4')}
          UNION ALL
          SELECT "pessoaCodigo" AS pessoa, "valorInadimplenteMJ"::numeric AS valor, id AS pa_id
          FROM cobranca.ficou_facil
          WHERE etapa = 'CONCLUIDO' AND "concluidoEm" BETWEEN $2::timestamp AND $3::timestamp
            ${filtroAgenteAcordoSql}
        )
        SELECT COUNT(DISTINCT pessoa)::int AS qtd,
          COALESCE(SUM(valor), 0)::numeric AS valor
        FROM rec
      `, ...paramsEtapa),
    ]);

    return {
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
    };
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// Handlers HTTP dos graficos parametrizados — cache 60s
// -----------------------------------------------
export async function obterRecorrentesHistorico(req, res, next) {
  try {
    const opts = parsearOptsBucket(req);
    const cacheKey = chaveDe('dashboard:recorrentes', opts);
    const data = await getOrSet(cacheKey, 60, () => calcularRecorrentesHistorico(opts));
    res.json({ ...opts, data });
  } catch (error) {
    next(error);
  }
}

export async function obterAcumuladoAlunos(req, res, next) {
  try {
    const opts = parsearOptsBucket(req);
    const cacheKey = chaveDe('dashboard:acumulado', opts);
    const data = await getOrSet(cacheKey, 60, () => calcularAcumuladoAlunos(opts));
    res.json({ ...opts, data });
  } catch (error) {
    next(error);
  }
}

// Aging Atual e Aging Historico — endpoints proprios (sem filtro de agente).
// Sao numeros globais da carteira de cobranca; ficar fora do /dashboard
// evita re-renderizar quando o user muda o filtro de agente nos outros cards.
// Cache 5min.
export async function obterAging(req, res, next) {
  try {
    const data = await getOrSet('dashboard:aging-atual', 5 * 60, () => calcularAging());
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

export async function obterAgingHistorico(req, res, next) {
  try {
    const opts = parsearOptsBucket(req);
    // Limite de 24 meses pra evitar CROSS JOIN explodir (Cloud SQL timeout >5s)
    const diffDias = (new Date(opts.fim).getTime() - new Date(opts.inicio).getTime()) / (1000 * 60 * 60 * 24);
    if (diffDias < 0) return res.status(400).json({ error: 'fim deve ser >= inicio' });
    if (diffDias > 730) return res.status(400).json({ error: 'periodo maximo: 24 meses' });

    const cacheKey = chaveDe('dashboard:aging-historico:v4', opts);
    const data = await getOrSet(cacheKey, 60, () => calcularAgingHistorico(opts));
    res.json({ ...opts, data });
  } catch (error) {
    next(error);
  }
}

export async function obterPagoPorForma(req, res, next) {
  try {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    const inicio = re.test(String(req.query.inicio || '')) ? String(req.query.inicio) : null;
    const fim = re.test(String(req.query.fim || '')) ? String(req.query.fim) : null;
    if (!inicio || !fim) return res.status(400).json({ error: 'inicio e fim obrigatorios (YYYY-MM-DD)' });

    const diffDias = (new Date(fim).getTime() - new Date(inicio).getTime()) / (1000 * 60 * 60 * 24);
    if (diffDias < 0) return res.status(400).json({ error: 'fim deve ser >= inicio' });
    if (diffDias > 730) return res.status(400).json({ error: 'periodo maximo: 24 meses' });

    const agenteIds = req.query.agenteIds
      ? String(req.query.agenteIds).split(',').map(Number).filter(Boolean)
      : null;

    const cacheKey = chaveDe('dashboard:pago-por-forma:v1', {
      inicio, fim, agenteIds: agenteIds ? agenteIds.join(',') : ''
    });
    const data = await getOrSet(cacheKey, 60, () => calcularPagoPorForma({ inicio, fim, agenteIds }));
    res.json({ inicio, fim, ...data });
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// Pago por aging (faixa de inadimplencia)
// -----------------------------------------------
async function calcularPagoPorAging(agenteIds = null) {
  const filtroAgente = agenteIds ? `AND af."criadoPor" = ANY($1::int[])` : '';
  const params = agenteIds ? [agenteIds] : [];
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
          ${filtroAgente}
      ) sub
      GROUP BY 1, 5
    ) grouped
    ORDER BY ordem
  `, ...params);

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

async function calcularPagoPorForma({ inicio, fim, agenteIds = null } = {}) {
  const inicioTs = `${inicio} 00:00:00`;
  const fimTs = `${fim} 23:59:59`;
  const filtroAgenteAcordo = agenteIds ? `AND af."criadoPor" = ANY($3::int[])` : '';
  const filtroAgenteFf = agenteIds ? `AND "criadoPor" = ANY($3::int[])` : '';
  const params = agenteIds ? [inicioTs, fimTs, agenteIds] : [inicioTs, fimTs];

  // Competencia: cliente pagou — filtra por pa.confirmadoEm, soma pa.valor (bruto).
  // Cartao parcelado: pa.valor JA E o total do acordo (1 linha por acordo, nao N).
  const competencia = await prisma.$queryRawUnsafe(`
    SELECT ${caseFormaPagamento()} AS forma,
      COUNT(*)::int AS qtd,
      COALESCE(SUM(pa.valor), 0)::numeric AS valor
    FROM cobranca.pagamento_acordo pa
    JOIN cobranca.acordo_financeiro af ON af.id = pa."acordoId"
    WHERE af.etapa != 'CANCELADO'
      AND pa."confirmadoEm" BETWEEN $1::timestamp AND $2::timestamp
      ${filtroAgenteAcordo}
    GROUP BY forma
    ORDER BY valor DESC
  `, ...params);

  // Caixa: entrou na conta Asaas — filtra por pa.recebidoEm, soma valorLiquido.
  // Fallback no bruto quando valorLiquido nao foi gravado (raro).
  const caixa = await prisma.$queryRawUnsafe(`
    SELECT ${caseFormaPagamento()} AS forma,
      COUNT(*)::int AS qtd,
      COALESCE(SUM(COALESCE(NULLIF(pa."valorLiquido", 0), pa.valor)), 0)::numeric AS valor
    FROM cobranca.pagamento_acordo pa
    JOIN cobranca.acordo_financeiro af ON af.id = pa."acordoId"
    WHERE af.etapa != 'CANCELADO'
      AND pa."recebidoEm" BETWEEN $1::timestamp AND $2::timestamp
      ${filtroAgenteAcordo}
    GROUP BY forma
    ORDER BY valor DESC
  `, ...params);

  // Ficou Facil concluido no periodo — concluidoEm e a data unica
  // (caixa+competencia juntas, sem split). Liquido = bruto * 0.93 (taxa fixa 7%).
  const ff = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS qtd,
      COALESCE(SUM("valorInadimplenteMJ"), 0)::numeric AS valor_bruto,
      COALESCE(SUM("valorInadimplenteMJ" * 0.93), 0)::numeric AS valor_liquido
    FROM cobranca.ficou_facil
    WHERE etapa = 'CONCLUIDO'
      AND "concluidoEm" BETWEEN $1::timestamp AND $2::timestamp
      ${filtroAgenteFf}
  `, ...params);

  const adicionarFf = (rows, valorFf) => {
    const out = rows.map(r => ({ forma: r.forma, qtd: r.qtd, valor: Number(r.valor) }));
    if (ff[0]?.qtd > 0) out.push({ forma: 'Ficou Fácil', qtd: ff[0].qtd, valor: valorFf });
    return out;
  };

  return {
    competencia: adicionarFf(competencia, Number(ff[0].valor_bruto)),
    caixa: adicionarFf(caixa, Number(ff[0].valor_liquido)),
  };
}

// -----------------------------------------------
// Matriz Categoria de Aging x Metodo de Pagamento
//
// Substitui o card antigo "Pago por Faixa de Inadimplencia". Cruza:
//   - Linhas: Baixa (0-60d) | Media (61-150d) | Alta (150+d)
//     Aging calculado uma vez no momento da criacao do acordo, sobre a
//     parcela MAIS ANTIGA das parcela_original_acordo. Congela a categoria.
//   - Colunas: 7 metodos de pagamento (Cartao a vista, 2-6x, 7-12x, Ficou
//     Facil, Boleto, Pix, Outros).
//
// Cada celula traz:
//   - qtdAlunos: COUNT(DISTINCT pessoaCodigo)
//   - valorBruto: soma respeitando regra de cartao parcelado capturado
//     (creditCardCaptured=true -> conta valor de TODAS as parcelas, mesmo
//     nao confirmadas individualmente)
//   - valorLiquido: COALESCE(valorLiquido, valor) com a mesma regra
//
// Filtros:
//   - inicio/fim em acordo_financeiro.criadoEm (modo "negociado") ou
//     pagamento_acordo.confirmadoEm (modo "pago"). Default: negociado.
//   - agenteIds em acordo_financeiro.criadoPor.
//
// Decisoes do user (2026-05-07):
//   - 3 categorias (Baixa/Media/Alta) substituem 5 faixas anteriores.
//   - Bruto+Liquido conforme netValue do Asaas em pagamento_acordo.valorLiquido.
//   - Cartao parcelado capturado conta como pago em bruto (regra capturada
//     em creditCardCaptured + backfill via webhook + fetch installment).
// -----------------------------------------------
const FAIXAS_AGING_MATRIZ = `
  CASE
    WHEN dias <= 60 THEN 'Baixa'
    WHEN dias <= 150 THEN 'Média'
    ELSE 'Alta'
  END
`;

// Mapeamento explicito: pagamentos com formaPagamento fora desses 5 buckets
// (ex: NULL, TRANSFERENCIA, DINHEIRO) sao excluidos da matriz via NULL +
// filtro WHERE metodo IS NOT NULL na CTE pagamentos_relevantes.
const METODO_PAGAMENTO_MATRIZ = `
  CASE
    WHEN pa."formaPagamento" = 'CREDIT_CARD' AND pa.parcelas <= 1 THEN 'Cartão à vista'
    WHEN pa."formaPagamento" = 'CREDIT_CARD' AND pa.parcelas BETWEEN 2 AND 6 THEN 'Cartão 2-6x'
    WHEN pa."formaPagamento" = 'CREDIT_CARD' AND pa.parcelas BETWEEN 7 AND 12 THEN 'Cartão 7-12x'
    WHEN pa."formaPagamento" = 'BOLETO' THEN 'Boleto'
    WHEN pa."formaPagamento" = 'PIX' THEN 'Pix'
  END
`;

async function calcularMatrizRecuperacao({ inicio, fim, modoFiltro = 'negociado', agenteIds = null } = {}) {
  // Bordas de timestamp
  const inicioTs = `${inicio} 00:00:00`;
  const fimTs = `${fim} 23:59:59`;

  // Filtro temporal: negociado (acordo.criadoEm) ou pago (confirmadoEm OU
  // creditCardCapturedAt para cartao parcelado capturado mas com 1a parcela
  // ainda nao individualmente CONFIRMADA — caso edge que existe quando o
  // limite ja foi reservado no Asaas mas a primeira cobranca ainda nao
  // compensou).
  const filtroTempoSql = modoFiltro === 'pago'
    ? `AND (
         pa."confirmadoEm" BETWEEN $1::timestamp AND $2::timestamp
         OR (pa."creditCardCaptured" = true
             AND pa."creditCardCapturedAt" BETWEEN $1::timestamp AND $2::timestamp)
       )`
    : `AND af."criadoEm" BETWEEN $1::timestamp AND $2::timestamp`;

  const filtroTempoFf = modoFiltro === 'pago'
    ? `AND ff."concluidoEm" BETWEEN $1::timestamp AND $2::timestamp`
    : `AND ff."criadoEm" BETWEEN $1::timestamp AND $2::timestamp`;

  const filtroAgenteSql = agenteIds ? `AND af."criadoPor" = ANY($3::int[])` : '';
  const filtroAgenteFf = agenteIds ? `AND ff."criadoPor" = ANY($3::int[])` : '';
  const params = agenteIds ? [inicioTs, fimTs, agenteIds] : [inicioTs, fimTs];

  // Acordos financeiros: matriz por (categoria, metodo) com bruto/liquido
  const linhasAcordos = await prisma.$queryRawUnsafe(`
    WITH acordos_no_periodo AS (
      SELECT
        af.id AS "acordoId",
        af."pessoaCodigo",
        COALESCE(
          (SELECT MAX(af."criadoEm"::date - po."dataVencimento"::date)
           FROM cobranca.parcela_original_acordo po
           WHERE po."acordoId" = af.id),
          0
        ) AS dias
      FROM cobranca.acordo_financeiro af
      WHERE af.etapa != 'CANCELADO'
        ${modoFiltro === 'negociado' ? `AND af."criadoEm" BETWEEN $1::timestamp AND $2::timestamp` : ''}
        ${filtroAgenteSql}
    ),
    pagamentos_relevantes AS (
      SELECT
        a."pessoaCodigo",
        a.dias,
        ${METODO_PAGAMENTO_MATRIZ} AS metodo,
        -- Bruto: pa.valor JA E o valor total do acordo (cada cartao parcelado
        -- tem apenas 1 linha em pagamento_acordo, nao N linhas).
        --
        -- Modo Negociado: conta o valor cheio independente de pagamento (alinha
        -- com o funil etapa "Negociado", que soma acordo_financeiro.valorAcordo
        -- direto sem filtrar por confirmacao).
        --
        -- Modo Pago: filtra por cartao parcelado capturado OU pa.confirmadoEm.
        ${modoFiltro === 'negociado' ? `pa.valor AS bruto,` : `CASE
          WHEN pa."formaPagamento" = 'CREDIT_CARD' AND pa.parcelas > 1 AND pa."creditCardCaptured" = true
            THEN pa.valor
          WHEN pa."confirmadoEm" IS NOT NULL
            THEN pa.valor
          ELSE 0
        END AS bruto,`}
        -- Liquido cartao parcelado: pa.valorLiquido reflete o liquido de UMA
        -- parcela (Asaas envia webhook por parcela individual). Para o liquido
        -- total do acordo capturado, multiplicamos por pa.parcelas.
        -- Cartao a vista, boleto, pix: pa.valorLiquido ja eh do total.
        --
        -- Modo Negociado: usa valorLiquido se ja temos (acordo capturado ou
        -- pago), senao projeta liquido = bruto (sem desconto, projecao otimista
        -- ate o pagamento confirmar).
        ${modoFiltro === 'negociado' ? `CASE
          WHEN pa."formaPagamento" = 'CREDIT_CARD' AND pa.parcelas > 1 AND pa."creditCardCaptured" = true
            THEN COALESCE(NULLIF(pa."valorLiquido", 0) * pa.parcelas, pa.valor)
          WHEN pa."confirmadoEm" IS NOT NULL
            THEN COALESCE(NULLIF(pa."valorLiquido", 0), pa.valor)
          ELSE pa.valor
        END AS liquido` : `CASE
          WHEN pa."formaPagamento" = 'CREDIT_CARD' AND pa.parcelas > 1 AND pa."creditCardCaptured" = true
            THEN COALESCE(NULLIF(pa."valorLiquido", 0) * pa.parcelas, pa.valor)
          WHEN pa."confirmadoEm" IS NOT NULL
            THEN COALESCE(NULLIF(pa."valorLiquido", 0), pa.valor)
          ELSE 0
        END AS liquido`}
      FROM acordos_no_periodo a
      JOIN cobranca.pagamento_acordo pa ON pa."acordoId" = a."acordoId"
      JOIN cobranca.acordo_financeiro af ON af.id = a."acordoId"
      WHERE 1=1
        ${modoFiltro === 'pago' ? filtroTempoSql : ''}
    )
    SELECT
      ${FAIXAS_AGING_MATRIZ} AS categoria,
      metodo,
      COUNT(DISTINCT "pessoaCodigo")::int AS qtd_alunos,
      COALESCE(SUM(bruto), 0)::numeric AS valor_bruto,
      COALESCE(SUM(liquido), 0)::numeric AS valor_liquido
    FROM pagamentos_relevantes
    WHERE (bruto > 0 OR liquido > 0)
      AND metodo IS NOT NULL  -- exclui pagamentos sem forma mapeada (sem coluna "Outros")
    GROUP BY 1, metodo
  `, ...params);

  // Ficou Facil — tabela separada, sem parcela_original_acordo. Como geralmente
  // e refinanciamento estudantil para casos cronicos (debito alto, longo
  // tempo de atraso), categorizamos como "Alta" por padrao. Taxa fixa de 7%
  // (conforme tabela do print do user). Melhoria futura: olhar contareceber
  // do aluno para calcular aging real.
  const linhasFf = await prisma.$queryRawUnsafe(`
    SELECT
      'Alta' AS categoria,
      'Ficou Fácil' AS metodo,
      COUNT(DISTINCT "pessoaCodigo")::int AS qtd_alunos,
      COALESCE(SUM("valorInadimplenteMJ"), 0)::numeric AS valor_bruto,
      -- Ficou Facil tem taxa fixa de 7% (sem Asaas), liquido = bruto * 0.93
      COALESCE(SUM("valorInadimplenteMJ" * 0.93), 0)::numeric AS valor_liquido
    FROM cobranca.ficou_facil ff
    WHERE ff.etapa != 'CANCELADO'
      ${filtroTempoFf}
      ${filtroAgenteFf}
  `, ...params);

  // Estruturar matriz
  const categorias = ['Baixa', 'Média', 'Alta'];
  const metodos = ['Cartão à vista', 'Cartão 2-6x', 'Cartão 7-12x', 'Ficou Fácil', 'Outros', 'Boleto', 'Pix'];

  const matriz = categorias.map(cat => {
    const linhas = [...linhasAcordos, ...linhasFf].filter(r => r.categoria === cat);
    const cells = {};
    let totalBrutoCat = 0, totalLiquidoCat = 0, totalAlunosCat = 0;
    for (const m of metodos) {
      const row = linhas.find(r => r.metodo === m);
      const cell = {
        qtdAlunos: row ? Number(row.qtd_alunos) : 0,
        valorBruto: row ? Number(row.valor_bruto) : 0,
        valorLiquido: row ? Number(row.valor_liquido) : 0,
      };
      cells[m] = cell;
      totalBrutoCat += cell.valorBruto;
      totalLiquidoCat += cell.valorLiquido;
      totalAlunosCat += cell.qtdAlunos;
    }
    return {
      categoria: cat,
      metodos: cells,
      totalCategoria: { qtdAlunos: totalAlunosCat, valorBruto: totalBrutoCat, valorLiquido: totalLiquidoCat },
    };
  });

  // Total geral
  let totalBruto = 0, totalLiquido = 0;
  for (const r of [...linhasAcordos, ...linhasFf]) {
    totalBruto += Number(r.valor_bruto);
    totalLiquido += Number(r.valor_liquido);
  }
  // qtdAlunos total real precisa de SUM(DISTINCT) — re-contar via SQL
  const totaisAlunos = await prisma.$queryRawUnsafe(`
    WITH pessoas AS (
      SELECT DISTINCT af."pessoaCodigo"
      FROM cobranca.acordo_financeiro af
      WHERE af.etapa != 'CANCELADO'
        ${modoFiltro === 'negociado'
          ? `AND af."criadoEm" BETWEEN $1::timestamp AND $2::timestamp`
          : `AND EXISTS (
               SELECT 1 FROM cobranca.pagamento_acordo pa
               WHERE pa."acordoId" = af.id
                 AND (
                   pa."confirmadoEm" BETWEEN $1::timestamp AND $2::timestamp
                   OR (pa."creditCardCaptured" = true
                       AND pa."creditCardCapturedAt" BETWEEN $1::timestamp AND $2::timestamp)
                 )
             )`}
        ${filtroAgenteSql}
      UNION
      SELECT DISTINCT ff."pessoaCodigo"
      FROM cobranca.ficou_facil ff
      WHERE ff.etapa != 'CANCELADO'
        ${filtroTempoFf}
        ${filtroAgenteFf}
    )
    SELECT COUNT(*)::int AS total FROM pessoas;
  `, ...params);

  return {
    filtros: { inicio, fim, modoFiltro, agenteIds: agenteIds || null },
    matriz,
    totais: {
      qtdAlunos: Number(totaisAlunos[0]?.total || 0),
      valorBruto: totalBruto,
      valorLiquido: totalLiquido,
    },
  };
}

export async function obterMatrizRecuperacao(req, res, next) {
  try {
    const { inicio, fim } = req.query;
    const modoFiltro = req.query.modoFiltro === 'pago' ? 'pago' : 'negociado';
    const agenteIds = parseAgenteIds(req.query.agenteIds);

    if (!inicio || !fim) {
      return res.status(400).json({ error: 'inicio e fim sao obrigatorios (YYYY-MM-DD)' });
    }
    if (inicio > fim) {
      return res.status(400).json({ error: 'inicio nao pode ser depois de fim' });
    }

    const cacheKey = chaveDe('dashboard:matriz:v2', { inicio, fim, modoFiltro, agenteIds: agenteIds ? agenteIds.join(',') : '' });
    const result = await getOrSet(cacheKey, 60, () => calcularMatrizRecuperacao({ inicio, fim, modoFiltro, agenteIds }));
    res.json(result);
  } catch (error) {
    next(error);
  }
}
