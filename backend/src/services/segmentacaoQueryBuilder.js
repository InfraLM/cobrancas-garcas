/**
 * Query builder dinamico para segmentacao.
 * Traduz condicoes JSON em SQL PostgreSQL.
 *
 * Dois modos:
 *   - tipo='ALUNO'  (default): 1 linha por aluno (comportamento historico)
 *   - tipo='TITULO' (novo):    1 linha por titulo (cobranca.contareceber)
 *
 * Cada campo em CAMPO_MAP declara em que escopos e valido via `escopos: ['ALUNO','TITULO']`.
 * Frontend oculta campos fora do escopo selecionado pelo agente. Backend tambem valida
 * (filtro inerte se campo incompativel for enviado).
 */

const CURSO_PERMITIDO = 1;
const TURMAS_EXCLUIDAS = '1,10,14,19,22,27,29';
const PESSOAS_EXCECAO = '589'; // Andre Garcia Ribeiro — testes (espelha titulosController)

// Mapeamento campo → { sql, join, escopos, tipo? }
const CAMPO_MAP = {
  // ===== Financeiro (agregado por aluno — so ALUNO) =====
  parcelas_atraso:     { sql: 'COALESCE(fin.parcelas_atraso, 0)', join: 'financeiro', escopos: ['ALUNO'] },
  valor_inadimplente:  { sql: 'COALESCE(fin.valor_inadimplente, 0)', join: 'financeiro', escopos: ['ALUNO'] },
  dias_atraso:         { sql: 'COALESCE(fin.dias_atraso, 0)', join: 'financeiro', escopos: ['ALUNO'] },
  parcelas_pagas:      { sql: 'COALESCE(fin.parcelas_pagas, 0)', join: 'financeiro', escopos: ['ALUNO'] },
  parcelas_a_vencer:   { sql: 'COALESCE(fin.parcelas_a_vencer, 0)', join: 'financeiro', escopos: ['ALUNO'] },
  valor_pago:          { sql: 'COALESCE(fin.valor_pago, 0)', join: 'financeiro', escopos: ['ALUNO'] },

  // ===== Situacao (tabela aluno_resumo — so ALUNO) =====
  situacao_aluno:      { sql: 'ar.situacao', join: 'aluno_resumo', escopos: ['ALUNO', 'TITULO'] },
  situacao_financeira: { sql: 'ar."situacaoFinanceira"', join: 'aluno_resumo', escopos: ['ALUNO'] },
  ja_trancou:          { sql: "(ar.situacao = 'TRANCADO')", join: 'aluno_resumo', escopos: ['ALUNO', 'TITULO'] },

  // ===== Academico (dados do aluno — ambos) =====
  turma:               { sql: 'turma_info.identificadorturma', join: 'turma', escopos: ['ALUNO', 'TITULO'] },
  frequencia:          { sql: 'COALESCE(eng.aulas_total_porcentagem, 0)', join: 'engajamento', escopos: ['ALUNO', 'TITULO'] },
  aulas_assistidas:    { sql: 'COALESCE(eng.aulas_assistidas, 0)', join: 'engajamento', escopos: ['ALUNO', 'TITULO'] },
  dias_ultima_aula:    { sql: 'COALESCE(eng.dias_desde_ultima_aula, 0)', join: 'engajamento', escopos: ['ALUNO', 'TITULO'] },
  status_financeiro_pf:{ sql: 'eng.status_financeiro', join: 'engajamento', escopos: ['ALUNO', 'TITULO'] },

  // ===== Recorrencia (aluno — ambos) =====
  recorrencia_ativa:         { sql: '(rec.recorrencia_ativa)', join: 'recorrencia', escopos: ['ALUNO', 'TITULO'] },
  qtd_cadastros_recorrencia: { sql: 'COALESCE(rec.qtd_cadastros, 0)', join: 'recorrencia', escopos: ['ALUNO', 'TITULO'] },

  // ===== Serasa =====
  negativado:          { sql: '(ser.serasa_ativo)', join: 'serasa', escopos: ['ALUNO', 'TITULO'] },

  // ===== Comunicacao =====
  tem_conversa_whatsapp: { sql: '(com.tem_conversa)', join: 'comunicacao', escopos: ['ALUNO', 'TITULO'] },
  tem_ligacao:           { sql: '(com.tem_ligacao)', join: 'comunicacao', escopos: ['ALUNO', 'TITULO'] },
  total_tickets_blip:    { sql: 'COALESCE(com.total_tickets, 0)', join: 'comunicacao', escopos: ['ALUNO', 'TITULO'] },
  tickets_financeiro:    { sql: 'COALESCE(com.tickets_financeiro, 0)', join: 'comunicacao', escopos: ['ALUNO', 'TITULO'] },

  // ===== Plantoes =====
  total_plantoes:      { sql: 'COALESCE(plt.total_plantoes, 0)', join: 'plantoes', escopos: ['ALUNO', 'TITULO'] },
  plantoes_realizados: { sql: 'COALESCE(plt.plantoes_realizados, 0)', join: 'plantoes', escopos: ['ALUNO', 'TITULO'] },

  // ===== Flags =====
  nao_enviar_cobranca: { sql: 'COALESCE(mr.naoenviarmensagemcobranca, false)', join: null, escopos: ['ALUNO', 'TITULO'] },
  bloquear_contato:    { sql: 'COALESCE(p.bloquearcontatocrm, false)', join: null, escopos: ['ALUNO', 'TITULO'] },

  // ===== Pausa de ligacoes (CRM) =====
  pausa_ligacao_ativa: {
    sql: `EXISTS (
      SELECT 1 FROM cobranca.pausa_ligacao pl
      WHERE pl."pessoaCodigo" = p.codigo
        AND pl."removidoEm" IS NULL
        AND (pl."pausaAte" IS NULL OR pl."pausaAte" > NOW())
    )`,
    join: null,
    escopos: ['ALUNO', 'TITULO'],
  },

  // ===== Identificacao (isolar aluno especifico) =====
  codigo_pessoa: { sql: 'p.codigo', join: null, escopos: ['ALUNO', 'TITULO'] },
  cpf_pessoa:    { sql: "REGEXP_REPLACE(COALESCE(p.cpf, ''), '[^0-9]', '', 'g')", join: null, escopos: ['ALUNO', 'TITULO'] },

  // ===== Datas de vencimento AGREGADAS (aluno — proxima/mais antiga) =====
  data_vencimento:              { sql: 'venc.proxima_vencimento', join: 'vencimento', tipo: 'data', escopos: ['ALUNO'] },
  data_vencimento_mais_antiga:  { sql: 'venc.vencimento_mais_antigo', join: 'vencimento', tipo: 'data', escopos: ['ALUNO'] },

  // ===== CAMPOS DE TITULO (so TITULO) =====
  titulo_situacao:             { sql: 'cr.situacao', join: null, escopos: ['TITULO'] },        // AR | RE | NE | CF
  titulo_tipo_origem:          { sql: 'cr.tipoorigem', join: null, escopos: ['TITULO'] },      // MEN | MAT | NCR | REQ | OUT
  titulo_valor:                { sql: 'cr.valor', join: null, escopos: ['TITULO'] },
  titulo_dias_ate_vencimento:  { sql: '(cr.datavencimento::date - CURRENT_DATE)', join: null, escopos: ['TITULO'] },
  titulo_dias_apos_vencimento: { sql: '(CURRENT_DATE - cr.datavencimento::date)', join: null, escopos: ['TITULO'] },
  titulo_data_vencimento:      { sql: 'cr.datavencimento::date', join: null, tipo: 'data', escopos: ['TITULO'] },
};

// CTEs disponiveis (adicionadas sob demanda)
const CTE_DEFS = {
  financeiro: `
    financeiro AS (
      SELECT cr.pessoa,
        COUNT(*) FILTER (WHERE cr.situacao='AR' AND cr.datavencimento < CURRENT_DATE AND cr.valor > COALESCE(cr.valorrecebido,0))::int AS parcelas_atraso,
        COALESCE(SUM(CASE WHEN cr.situacao='AR' AND cr.datavencimento < CURRENT_DATE AND cr.valor > COALESCE(cr.valorrecebido,0)
          THEN cr.valor - COALESCE(cr.valorrecebido,0) ELSE 0 END), 0) AS valor_inadimplente,
        CASE WHEN MIN(CASE WHEN cr.situacao='AR' AND cr.datavencimento < CURRENT_DATE THEN cr.datavencimento END) IS NOT NULL
          THEN (CURRENT_DATE - MIN(CASE WHEN cr.situacao='AR' AND cr.datavencimento < CURRENT_DATE THEN cr.datavencimento END)::date)
          ELSE 0 END AS dias_atraso,
        COUNT(*) FILTER (WHERE cr.situacao='RE')::int AS parcelas_pagas,
        COUNT(*) FILTER (WHERE cr.situacao='AR' AND cr.datavencimento >= CURRENT_DATE)::int AS parcelas_a_vencer,
        COALESCE(SUM(CASE WHEN cr.situacao='RE' THEN COALESCE(cr.valorrecebido,0) ELSE 0 END), 0) AS valor_pago
      FROM cobranca.contareceber cr
      WHERE (cr.turma IS NULL OR cr.turma NOT IN (${TURMAS_EXCLUIDAS}))
      GROUP BY cr.pessoa
    )`,

  engajamento: `
    engajamento AS (
      SELECT pf.matricula, pf.aulas_total_porcentagem, pf.aulas_assistidas,
             pf.dias_desde_ultima_aula, pf.status_financeiro
      FROM cobranca.pf_alunos pf
    )`,

  recorrencia: `
    recorrencia AS (
      SELECT c.pessoa,
        BOOL_OR(c.datacadastro <= CURRENT_DATE AND (c.datainativacao IS NULL OR c.datainativacao > CURRENT_DATE)) AS recorrencia_ativa,
        COUNT(*)::int AS qtd_cadastros
      FROM cobranca.cartaocreditodebitorecorrenciapessoa c
      GROUP BY c.pessoa
    )`,

  serasa: `
    serasa_check AS (
      SELECT REGEXP_REPLACE(COALESCE(p2.cpf, ''), '[^0-9]', '', 'g') AS cpf_num, p2.codigo AS pessoa,
        EXISTS(SELECT 1 FROM cobranca.serasa s WHERE s.cpf_cnpj_numerico = REGEXP_REPLACE(COALESCE(p2.cpf, ''), '[^0-9]', '', 'g') AND s.situacao = 'Ativa') AS serasa_ativo
      FROM cobranca.pessoa p2 WHERE p2.aluno = true
    )`,

  comunicacao: `
    comunicacao AS (
      SELECT p3.codigo AS pessoa,
        EXISTS(SELECT 1 FROM cobranca.conversa_cobranca cc WHERE cc."pessoaCodigo" = p3.codigo) AS tem_conversa,
        EXISTS(SELECT 1 FROM cobranca.registro_ligacao rl WHERE rl."pessoaCodigo" = p3.codigo) AS tem_ligacao,
        (SELECT COUNT(*)::int FROM cobranca.blip_tickets bt JOIN cobranca.blip_contacts bc ON bt."customerIdentity" = bc.identity WHERE bc.cpf_sanitizado = p3.cpf) AS total_tickets,
        (SELECT COUNT(*)::int FROM cobranca.blip_tickets bt JOIN cobranca.blip_contacts bc ON bt."customerIdentity" = bc.identity WHERE bc.cpf_sanitizado = p3.cpf AND bt.team ILIKE '%financeiro%') AS tickets_financeiro
      FROM cobranca.pessoa p3 WHERE p3.aluno = true
    )`,

  plantoes: `
    plantoes AS (
      SELECT mat.aluno AS pessoa,
        COUNT(*)::int AS total_plantoes,
        COUNT(*) FILTER (WHERE pf.status = 'Realizado')::int AS plantoes_realizados
      FROM cobranca.pf_plantoes pf
      INNER JOIN cobranca.matricula mat ON mat.matricula = pf.matricula AND mat.curso = ${CURSO_PERMITIDO}
      GROUP BY mat.aluno
    )`,
  vencimento: `
    vencimento AS (
      SELECT cr.pessoa,
        MIN(cr.datavencimento)::date AS proxima_vencimento,
        MIN(CASE WHEN cr.datavencimento < CURRENT_DATE THEN cr.datavencimento END)::date AS vencimento_mais_antigo
      FROM cobranca.contareceber cr
      WHERE cr.situacao = 'AR'
        AND cr.valor > COALESCE(cr.valorrecebido, 0)
        AND (cr.turma IS NULL OR cr.turma NOT IN (${TURMAS_EXCLUIDAS}))
        AND COALESCE(cr.tipoorigem, '') NOT IN ('OUT')
      GROUP BY cr.pessoa
    )`,
};

// JOINs para cada CTE ou tabela (os JOINs usam 'p' ou 'mr', presentes em ambos os builders)
const JOIN_DEFS = {
  financeiro: 'LEFT JOIN financeiro fin ON fin.pessoa = p.codigo',
  engajamento: 'LEFT JOIN engajamento eng ON eng.matricula = mr.matricula',
  recorrencia: 'LEFT JOIN recorrencia rec ON rec.pessoa = p.codigo',
  serasa: 'LEFT JOIN serasa_check ser ON ser.pessoa = p.codigo',
  comunicacao: 'LEFT JOIN comunicacao com ON com.pessoa = p.codigo',
  plantoes: 'LEFT JOIN plantoes plt ON plt.pessoa = p.codigo',
  turma: `LEFT JOIN LATERAL (
      SELECT DISTINCT t.identificadorturma FROM cobranca.contareceber cr2
      JOIN cobranca.turma t ON t.codigo = cr2.turma
      WHERE cr2.matriculaaluno = mr.matricula AND cr2.turma NOT IN (${TURMAS_EXCLUIDAS})
      LIMIT 1
    ) turma_info ON true`,
  aluno_resumo: 'LEFT JOIN cobranca.aluno_resumo ar ON ar.codigo = p.codigo',
  vencimento: 'LEFT JOIN vencimento venc ON venc.pessoa = p.codigo',
};

function buildOperatorClause(sqlExpr, operador, valor, valor2) {
  if (operador === 'sim') return `${sqlExpr} = true`;
  if (operador === 'nao') return `${sqlExpr} = false`;

  if (valor === '' || valor === null || valor === undefined) {
    console.warn(`[segmentacaoQueryBuilder] Operador "${operador}" com valor vazio — filtro ignorado. Expr: ${String(sqlExpr).slice(0, 80)}`);
    return 'true';
  }

  switch (operador) {
    case 'igual': return `${sqlExpr} = ${escape(valor)}`;
    case 'maior': return `${sqlExpr} > ${escape(valor)}`;
    case 'menor': return `${sqlExpr} < ${escape(valor)}`;
    case 'entre': return `${sqlExpr} BETWEEN ${escape(valor)} AND ${escape(valor2)}`;
    case 'em': {
      const vals = Array.isArray(valor) ? valor : [valor];
      return `${sqlExpr} IN (${vals.map(v => escape(v)).join(',')})`;
    }
    case 'nao_em': {
      const vals = Array.isArray(valor) ? valor : [valor];
      return `${sqlExpr} NOT IN (${vals.map(v => escape(v)).join(',')})`;
    }
    default: return 'true';
  }
}

function escape(val) {
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return `'${String(val).replace(/'/g, "''")}'`;
}

// CTEs base compartilhadas pelos dois builders
function baseCtes() {
  return [
    `matricula_recente AS (
      SELECT DISTINCT ON (m.aluno) m.aluno, m.matricula, m.curso, m.data, m.naoenviarmensagemcobranca
      FROM cobranca.matricula m WHERE m.curso = ${CURSO_PERMITIDO}
      ORDER BY m.aluno, m.data DESC NULLS LAST
    )`,
    `cancelamento AS (
      SELECT cr.matriculaaluno AS matricula, MIN(cr.datacancelamento::date) AS data_cancelamento
      FROM cobranca.contareceber cr
      INNER JOIN cobranca.matricula m ON m.matricula = cr.matriculaaluno AND m.situacao IN ('IN', 'CA')
      WHERE cr.datacancelamento IS NOT NULL AND COALESCE(cr.tipoorigem, '') <> 'OUT'
        AND (cr.turma IS NULL OR cr.turma NOT IN (${TURMAS_EXCLUIDAS}))
      GROUP BY cr.matriculaaluno
    )`,
    `trancamento AS (
      SELECT DISTINCT ON (nc.matriculaaluno) nc.matriculaaluno AS matricula,
             nc.codigo AS codigo_trancamento, nc.data::date AS data_trancamento
      FROM cobranca.negociacaocontareceber nc WHERE nc.justificativa ILIKE '%TRANCAMENTO%'
      ORDER BY nc.matriculaaluno, nc.data DESC NULLS LAST, nc.codigo DESC
    )`,
    `retorno_trancamento AS (
      SELECT t.matricula, MIN(cr.datavencimento::date) AS data_retorno
      FROM trancamento t JOIN cobranca.contareceber cr ON cr.matriculaaluno = t.matricula
        AND cr.tipoorigem = 'NCR' AND TRIM(cr.codorigem) = t.codigo_trancamento::text
      GROUP BY t.matricula
    )`,
    `devedor AS (
      SELECT cr.pessoa,
        COALESCE(SUM(CASE WHEN cr.situacao='AR' AND cr.datavencimento < CURRENT_DATE AND cr.valor > COALESCE(cr.valorrecebido,0)
          THEN cr.valor - COALESCE(cr.valorrecebido,0) ELSE 0 END), 0) AS valor_devedor
      FROM cobranca.contareceber cr WHERE (cr.turma IS NULL OR cr.turma NOT IN (${TURMAS_EXCLUIDAS}))
      GROUP BY cr.pessoa
    )`,
  ];
}

/**
 * Resolve CTEs e JOINs necessarios baseado nos campos das condicoes (respeita escopo).
 */
function resolverDependencias(condicoes, tipo) {
  const needsCtes = new Set();
  const needsJoins = new Set();
  const camposIgnorados = [];

  for (const cond of condicoes) {
    const mapping = CAMPO_MAP[cond.campo];
    if (!mapping) {
      camposIgnorados.push(cond.campo || '(vazio)');
      continue;
    }
    if (mapping.escopos && !mapping.escopos.includes(tipo)) {
      console.warn(`[segmentacaoQueryBuilder] Campo "${cond.campo}" nao vale para tipo ${tipo} — filtro ignorado`);
      continue;
    }
    if (mapping.join) {
      needsCtes.add(mapping.join);
      needsJoins.add(mapping.join);
    }
  }

  if (camposIgnorados.length > 0) {
    console.warn('[segmentacaoQueryBuilder] Campos desconhecidos:', camposIgnorados);
  }

  return { needsCtes, needsJoins };
}

function buildWheres(condicoes, tipo) {
  const wheres = [];
  for (const cond of condicoes) {
    const mapping = CAMPO_MAP[cond.campo];
    if (!mapping) continue;
    if (mapping.escopos && !mapping.escopos.includes(tipo)) continue;
    wheres.push(buildOperatorClause(mapping.sql, cond.operador, cond.valor, cond.valor2));
  }
  return wheres;
}

/**
 * Builder por ALUNO (comportamento historico).
 */
function buildAlunoQuery(condicoes, opts) {
  const { page = 1, limit = 20, search = '' } = opts;
  const offset = (page - 1) * limit;

  const { needsCtes, needsJoins } = resolverDependencias(condicoes, 'ALUNO');
  const ctes = baseCtes();
  for (const need of needsCtes) if (CTE_DEFS[need]) ctes.push(CTE_DEFS[need]);
  const extraJoins = [];
  for (const need of needsJoins) if (JOIN_DEFS[need]) extraJoins.push(JOIN_DEFS[need]);

  const wheres = buildWheres(condicoes, 'ALUNO');

  const searchSafe = search ? search.replace(/[^a-zA-Z0-9À-ÿ\s.]/g, '') : '';
  const searchDigits = search ? search.replace(/\D/g, '') : '';
  const searchClause = searchSafe
    ? `AND (p.nome ILIKE '%${searchSafe}%' OR REGEXP_REPLACE(COALESCE(p.cpf,''), '[^0-9]', '', 'g') LIKE '%${searchDigits}%')`
    : '';

  return `
    WITH ${ctes.join(',\n')}
    SELECT p.codigo, p.nome, p.cpf, p.celular, mr.matricula,
      CASE
        WHEN canc.data_cancelamento IS NOT NULL AND canc.data_cancelamento <= CURRENT_DATE THEN 'CANCELADO'
        WHEN tranc.data_trancamento IS NOT NULL AND tranc.data_trancamento <= CURRENT_DATE
          AND (ret.data_retorno IS NULL OR ret.data_retorno > CURRENT_DATE) THEN 'TRANCADO'
        ELSE 'ATIVO'
      END AS situacao_calculada,
      CASE WHEN COALESCE(dev.valor_devedor, 0) > 0 THEN 'INADIMPLENTE' ELSE 'ADIMPLENTE' END AS situacao_financeira,
      COALESCE(dev.valor_devedor, 0) AS valor_devedor,
      COUNT(*) OVER()::int AS total
    FROM cobranca.pessoa p
    INNER JOIN matricula_recente mr ON mr.aluno = p.codigo
    LEFT JOIN cancelamento canc ON canc.matricula = mr.matricula
    LEFT JOIN trancamento tranc ON tranc.matricula = mr.matricula
    LEFT JOIN retorno_trancamento ret ON ret.matricula = mr.matricula
    LEFT JOIN devedor dev ON dev.pessoa = p.codigo
    ${extraJoins.join('\n    ')}
    WHERE p.aluno = true
      AND (COALESCE(p.funcionario, false) = false OR p.codigo IN (${PESSOAS_EXCECAO}))
      ${searchClause}
      ${wheres.length > 0 ? 'AND ' + wheres.join(' AND ') : ''}
    ORDER BY p.nome
    LIMIT ${limit} OFFSET ${offset}
  `;
}

/**
 * Builder por TITULO — 1 linha por titulo (contareceber).
 * Cada linha traz dados do titulo + dados do aluno associado.
 * O mesmo aluno pode aparecer N vezes (1 por titulo elegivel).
 */
function buildTituloQuery(condicoes, opts) {
  const { page = 1, limit = 20, search = '' } = opts;
  const offset = (page - 1) * limit;

  const { needsCtes, needsJoins } = resolverDependencias(condicoes, 'TITULO');
  const ctes = baseCtes();
  for (const need of needsCtes) if (CTE_DEFS[need]) ctes.push(CTE_DEFS[need]);
  const extraJoins = [];
  for (const need of needsJoins) if (JOIN_DEFS[need]) extraJoins.push(JOIN_DEFS[need]);

  const wheres = buildWheres(condicoes, 'TITULO');

  const searchSafe = search ? search.replace(/[^a-zA-Z0-9À-ÿ\s.]/g, '') : '';
  const searchDigits = search ? search.replace(/\D/g, '') : '';
  const searchClause = searchSafe
    ? `AND (p.nome ILIKE '%${searchSafe}%' OR REGEXP_REPLACE(COALESCE(p.cpf,''), '[^0-9]', '', 'g') LIKE '%${searchDigits}%')`
    : '';

  return `
    WITH ${ctes.join(',\n')}
    SELECT
      cr.codigo         AS titulo_codigo,
      cr.valor          AS titulo_valor,
      cr.valorrecebido  AS titulo_valor_recebido,
      cr.datavencimento AS titulo_data_vencimento,
      cr.token          AS titulo_token,
      cr.situacao       AS titulo_situacao,
      cr.tipoorigem     AS titulo_tipo_origem,
      (cr.datavencimento::date - CURRENT_DATE) AS titulo_dias_ate_venc,
      (CURRENT_DATE - cr.datavencimento::date) AS titulo_dias_apos_venc,
      p.codigo, p.nome, p.cpf, p.celular,
      mr.matricula,
      turma_info_all.identificadorturma AS titulo_turma,
      COUNT(*) OVER()::int AS total,
      SUM(cr.valor) OVER()::numeric AS valor_total_sum
    FROM cobranca.contareceber cr
    INNER JOIN cobranca.pessoa p ON p.codigo = cr.pessoa
    INNER JOIN matricula_recente mr ON mr.aluno = p.codigo
    LEFT JOIN LATERAL (
      SELECT t.identificadorturma FROM cobranca.turma t WHERE t.codigo = cr.turma LIMIT 1
    ) turma_info_all ON true
    ${extraJoins.join('\n    ')}
    WHERE p.aluno = true
      AND (COALESCE(p.funcionario, false) = false OR p.codigo IN (${PESSOAS_EXCECAO}))
      AND (cr.turma IS NULL OR cr.turma NOT IN (${TURMAS_EXCLUIDAS}))
      AND cr.token IS NOT NULL
      ${searchClause}
      ${wheres.length > 0 ? 'AND ' + wheres.join(' AND ') : ''}
    ORDER BY cr.datavencimento ASC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

/**
 * Dispatcher — aceita `tipo` como 3o argumento (default ALUNO).
 */
export function buildSegmentacaoQuery(condicoes, opts = {}, tipo = 'ALUNO') {
  if (tipo === 'TITULO') return buildTituloQuery(condicoes, opts);
  return buildAlunoQuery(condicoes, opts);
}

/**
 * Conta totais (sem paginacao). Para ALUNO retorna total+valor_inadimplente.
 * Para TITULO retorna total+valor_total+alunos_unicos.
 */
export function buildSegmentacaoCountQuery(condicoes, tipo = 'ALUNO') {
  const fullSql = buildSegmentacaoQuery(condicoes, { page: 1, limit: 999999 }, tipo);
  if (tipo === 'TITULO') {
    return `SELECT
      COUNT(*)::int AS total,
      COUNT(DISTINCT codigo)::int AS alunos_unicos,
      COALESCE(SUM(titulo_valor), 0) AS valor_total
    FROM (${fullSql}) sub`;
  }
  return `SELECT COUNT(*)::int AS total, COALESCE(SUM(valor_devedor), 0) AS valor_total FROM (${fullSql}) sub`;
}

/**
 * Expoe CAMPO_MAP para o frontend/controllers validarem escopos de campos.
 */
export function listarCamposDisponiveis() {
  return Object.entries(CAMPO_MAP).map(([id, cfg]) => ({
    id,
    escopos: cfg.escopos,
    tipo: cfg.tipo || null,
  }));
}
