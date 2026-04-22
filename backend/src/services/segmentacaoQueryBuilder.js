/**
 * Query builder dinamico para segmentacao.
 * Traduz condicoes JSON em SQL PostgreSQL.
 *
 * Cada condicao: { campo, operador, valor, valor2? }
 * Operadores: igual, maior, menor, entre, sim, nao, em, nao_em
 */

const CURSO_PERMITIDO = 1;
const TURMAS_EXCLUIDAS = '1,10,14,19,22,27,29';

// Mapeamento campo → expressao SQL + JOINs necessarios
const CAMPO_MAP = {
  // Financeiro
  parcelas_atraso: { sql: 'COALESCE(fin.parcelas_atraso, 0)', join: 'financeiro' },
  valor_inadimplente: { sql: 'COALESCE(fin.valor_inadimplente, 0)', join: 'financeiro' },
  dias_atraso: { sql: 'COALESCE(fin.dias_atraso, 0)', join: 'financeiro' },
  parcelas_pagas: { sql: 'COALESCE(fin.parcelas_pagas, 0)', join: 'financeiro' },
  parcelas_a_vencer: { sql: 'COALESCE(fin.parcelas_a_vencer, 0)', join: 'financeiro' },
  valor_pago: { sql: 'COALESCE(fin.valor_pago, 0)', join: 'financeiro' },

  // Situacao (da tabela aluno_resumo)
  situacao_aluno: { sql: 'ar.situacao', join: 'aluno_resumo' },
  situacao_financeira: { sql: 'ar."situacaoFinanceira"', join: 'aluno_resumo' },
  ja_trancou: { sql: '(ar.situacao = \'TRANCADO\')', join: 'aluno_resumo' },

  // Academico
  turma: { sql: 'turma_info.identificadorturma', join: 'turma' },
  frequencia: { sql: 'COALESCE(eng.aulas_total_porcentagem, 0)', join: 'engajamento' },
  aulas_assistidas: { sql: 'COALESCE(eng.aulas_assistidas, 0)', join: 'engajamento' },
  dias_ultima_aula: { sql: 'COALESCE(eng.dias_desde_ultima_aula, 0)', join: 'engajamento' },
  status_financeiro_pf: { sql: 'eng.status_financeiro', join: 'engajamento' },

  // Recorrencia
  recorrencia_ativa: { sql: '(rec.recorrencia_ativa)', join: 'recorrencia' },
  qtd_cadastros_recorrencia: { sql: 'COALESCE(rec.qtd_cadastros, 0)', join: 'recorrencia' },

  // Serasa
  negativado: { sql: '(ser.serasa_ativo)', join: 'serasa' },

  // Comunicacao
  tem_conversa_whatsapp: { sql: '(com.tem_conversa)', join: 'comunicacao' },
  tem_ligacao: { sql: '(com.tem_ligacao)', join: 'comunicacao' },
  total_tickets_blip: { sql: 'COALESCE(com.total_tickets, 0)', join: 'comunicacao' },
  tickets_financeiro: { sql: 'COALESCE(com.tickets_financeiro, 0)', join: 'comunicacao' },

  // Plantoes
  total_plantoes: { sql: 'COALESCE(plt.total_plantoes, 0)', join: 'plantoes' },
  plantoes_realizados: { sql: 'COALESCE(plt.plantoes_realizados, 0)', join: 'plantoes' },

  // Flags
  nao_enviar_cobranca: { sql: 'COALESCE(mr.naoenviarmensagemcobranca, false)', join: null },
  bloquear_contato: { sql: 'COALESCE(p.bloquearcontatocrm, false)', join: null },

  // Datas de vencimento
  data_vencimento: { sql: 'venc.proxima_vencimento', join: 'vencimento', tipo: 'data' },
  data_vencimento_mais_antiga: { sql: 'venc.vencimento_mais_antigo', join: 'vencimento', tipo: 'data' },
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

// JOINs para cada CTE ou tabela
const JOIN_DEFS = {
  financeiro: 'LEFT JOIN financeiro fin ON fin.pessoa = p.codigo',
  engajamento: 'LEFT JOIN engajamento eng ON eng.matricula = mr.matricula',
  recorrencia: 'LEFT JOIN recorrencia rec ON rec.pessoa = p.codigo',
  serasa: 'LEFT JOIN serasa_check ser ON ser.pessoa = p.codigo',
  comunicacao: 'LEFT JOIN comunicacao com ON com.pessoa = p.codigo',
  plantoes: 'LEFT JOIN plantoes plt ON plt.pessoa = p.codigo',
  turma: `LEFT JOIN LATERAL (
      SELECT DISTINCT t.identificadorturma FROM cobranca.contareceber cr
      JOIN cobranca.turma t ON t.codigo = cr.turma
      WHERE cr.matriculaaluno = mr.matricula AND cr.turma NOT IN (${TURMAS_EXCLUIDAS})
      LIMIT 1
    ) turma_info ON true`,
  aluno_resumo: 'LEFT JOIN cobranca.aluno_resumo ar ON ar.codigo = p.codigo',
  vencimento: 'LEFT JOIN vencimento venc ON venc.pessoa = p.codigo',
};

function buildOperatorClause(sqlExpr, operador, valor, valor2) {
  // Booleanos: 'sim' e 'nao' nao precisam de valor
  if (operador === 'sim') return `${sqlExpr} = true`;
  if (operador === 'nao') return `${sqlExpr} = false`;

  // Para outros operadores, ignorar se valor esta vazio
  if (valor === '' || valor === null || valor === undefined) return 'true';

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

/**
 * Traduz condicoes JSON para SQL completo.
 * @param {Array} condicoes - [{campo, operador, valor, valor2?}]
 * @param {Object} opts - {page, limit, search}
 * @returns {string} SQL query completo
 */
export function buildSegmentacaoQuery(condicoes, opts = {}) {
  const { page = 1, limit = 20, search = '' } = opts;
  const offset = (page - 1) * limit;

  // Determinar quais CTEs e JOINs sao necessarios
  const needsCtes = new Set();
  const needsJoins = new Set();

  // aluno_resumo nao e CTE, e JOIN direto — nao adicionar como CTE

  const camposIgnorados = [];
  for (const cond of condicoes) {
    const mapping = CAMPO_MAP[cond.campo];
    if (!mapping) {
      camposIgnorados.push(cond.campo || '(vazio)');
      continue;
    }
    if (mapping.join) {
      needsCtes.add(mapping.join);
      needsJoins.add(mapping.join);
    }
  }
  if (camposIgnorados.length > 0) {
    console.warn('[segmentacaoQueryBuilder] Campos ignorados (nao existem em CAMPO_MAP):', camposIgnorados);
  }

  // Montar CTEs
  const ctes = [];

  // Base CTEs (sempre presentes)
  ctes.push(`matricula_recente AS (
    SELECT DISTINCT ON (m.aluno) m.aluno, m.matricula, m.curso, m.data, m.naoenviarmensagemcobranca
    FROM cobranca.matricula m WHERE m.curso = ${CURSO_PERMITIDO}
    ORDER BY m.aluno, m.data DESC NULLS LAST
  )`);

  ctes.push(`cancelamento AS (
    SELECT cr.matriculaaluno AS matricula, MIN(cr.datacancelamento::date) AS data_cancelamento
    FROM cobranca.contareceber cr
    INNER JOIN cobranca.matricula m ON m.matricula = cr.matriculaaluno AND m.situacao IN ('IN', 'CA')
    WHERE cr.datacancelamento IS NOT NULL AND COALESCE(cr.tipoorigem, '') <> 'OUT'
      AND (cr.turma IS NULL OR cr.turma NOT IN (${TURMAS_EXCLUIDAS}))
    GROUP BY cr.matriculaaluno
  )`);

  ctes.push(`trancamento AS (
    SELECT DISTINCT ON (nc.matriculaaluno) nc.matriculaaluno AS matricula,
           nc.codigo AS codigo_trancamento, nc.data::date AS data_trancamento
    FROM cobranca.negociacaocontareceber nc WHERE nc.justificativa ILIKE '%TRANCAMENTO%'
    ORDER BY nc.matriculaaluno, nc.data DESC NULLS LAST, nc.codigo DESC
  )`);

  ctes.push(`retorno_trancamento AS (
    SELECT t.matricula, MIN(cr.datavencimento::date) AS data_retorno
    FROM trancamento t JOIN cobranca.contareceber cr ON cr.matriculaaluno = t.matricula
      AND cr.tipoorigem = 'NCR' AND TRIM(cr.codorigem) = t.codigo_trancamento::text
    GROUP BY t.matricula
  )`);

  ctes.push(`devedor AS (
    SELECT cr.pessoa,
      COALESCE(SUM(CASE WHEN cr.situacao='AR' AND cr.datavencimento < CURRENT_DATE AND cr.valor > COALESCE(cr.valorrecebido,0)
        THEN cr.valor - COALESCE(cr.valorrecebido,0) ELSE 0 END), 0) AS valor_devedor
    FROM cobranca.contareceber cr WHERE (cr.turma IS NULL OR cr.turma NOT IN (${TURMAS_EXCLUIDAS}))
    GROUP BY cr.pessoa
  )`);

  // Adicionar CTEs sob demanda
  for (const need of needsCtes) {
    if (CTE_DEFS[need]) ctes.push(CTE_DEFS[need]);
  }

  // Montar JOINs extras
  const extraJoins = [];
  for (const need of needsJoins) {
    if (JOIN_DEFS[need]) extraJoins.push(JOIN_DEFS[need]);
  }

  // Montar WHERE das condicoes
  const wheres = [];
  for (const cond of condicoes) {
    const mapping = CAMPO_MAP[cond.campo];
    if (!mapping) continue;
    wheres.push(buildOperatorClause(mapping.sql, cond.operador, cond.valor, cond.valor2));
  }

  // Sanitizar search: remover tudo exceto letras, numeros, espacos e pontos
  const searchSafe = search ? search.replace(/[^a-zA-Z0-9À-ÿ\s.]/g, '') : '';
  const searchDigits = search ? search.replace(/\D/g, '') : '';
  const searchClause = searchSafe
    ? `AND (p.nome ILIKE '%${searchSafe}%' OR REGEXP_REPLACE(COALESCE(p.cpf,''), '[^0-9]', '', 'g') LIKE '%${searchDigits}%')`
    : '';

  const sql = `
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
    WHERE p.aluno = true AND COALESCE(p.funcionario, false) = false
      ${searchClause}
      ${wheres.length > 0 ? 'AND ' + wheres.join(' AND ') : ''}
    ORDER BY p.nome
    LIMIT ${limit} OFFSET ${offset}
  `;

  return sql;
}

/**
 * Conta total e valor inadimplente para uma segmentacao (sem paginacao).
 */
export function buildSegmentacaoCountQuery(condicoes) {
  const fullSql = buildSegmentacaoQuery(condicoes, { page: 1, limit: 999999 });
  return `SELECT COUNT(*)::int AS total, COALESCE(SUM(valor_devedor), 0) AS valor_total FROM (${fullSql}) sub`;
}
