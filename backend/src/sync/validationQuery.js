import { prisma } from '../config/database.js';

const sql = `
WITH
base_matriculas AS (
  SELECT DISTINCT
    cr.matriculaaluno AS matricula,
    cr.turma          AS turma_codigo
  FROM contareceber cr
  WHERE cr.turma IN (2,4,8,11,21,28,35)
    AND COALESCE(cr.tipoorigem, '') <> 'OUT'
),

cadastro AS (
  SELECT
    bm.matricula,
    bm.turma_codigo,
    tr.identificadorturma AS turma,
    date(mt."data")       AS data_matricula,
    p.cpf,
    p.nome                AS nome_aluno,
    p.codigo              AS pessoa_id
  FROM base_matriculas bm
  JOIN matricula mt ON mt.matricula = bm.matricula
  JOIN pessoa   p  ON p.codigo      = mt.aluno
  JOIN turma    tr ON tr.codigo     = bm.turma_codigo
  WHERE COALESCE(p.funcionario, 0) = 0
),

mp_ultimo AS (
  SELECT matricula, date(databasegeracaoparcelas) AS data_base_parcelas
  FROM (
    SELECT
      mp.matricula,
      mp.databasegeracaoparcelas,
      ROW_NUMBER() OVER (
        PARTITION BY mp.matricula
        ORDER BY mp.databasegeracaoparcelas DESC
      ) AS rn
    FROM matriculaperiodo mp
    WHERE mp.databasegeracaoparcelas IS NOT NULL
  )
  WHERE rn = 1
),

primeiro_venc_nao_mat AS (
  SELECT
    cr.matriculaaluno AS matricula,
    MIN(date(cr.datavencimento)) AS data_base_fallback
  FROM contareceber cr
  WHERE cr.turma IN (2,4,8,11,21,28,35)
    AND COALESCE(cr.tipoorigem, '') NOT IN ('MAT','OUT')
  GROUP BY cr.matriculaaluno
),

data_base AS (
  SELECT
    c.matricula,
    COALESCE(mu.data_base_parcelas, pv.data_base_fallback) AS data_base_parcelas
  FROM cadastro c
  LEFT JOIN mp_ultimo mu ON mu.matricula = c.matricula
  LEFT JOIN primeiro_venc_nao_mat pv ON pv.matricula = c.matricula
),

rec AS (
  SELECT
    crx.codigo       AS contareceber_id,
    date(nr."data")  AS data_recebimento,
    fp.nome          AS forma_pagamento
  FROM contareceber crx
  LEFT JOIN contarecebernegociacaorecebimento crnr
         ON crnr.contareceber = crx.codigo
  LEFT JOIN negociacaorecebimento nr
         ON nr.codigo = crnr.negociacaorecebimento
  LEFT JOIN contareceberrecebimento crr
         ON crr.contareceber = crx.codigo
        AND crr.negociacaorecebimento = nr.codigo
  LEFT JOIN formapagamentonegociacaorecebimento fpnr
         ON crr.formapagamentonegociacaorecebimento = fpnr.codigo
  LEFT JOIN formapagamento fp
         ON fp.codigo = fpnr.formapagamento
),

recorrencia AS (
  SELECT
    cc.pessoa AS pessoa_id,
    MAX(cc.datacadastro) AS data_cadastro
  FROM cartaocreditodebitorecorrenciapessoa cc
  GROUP BY cc.pessoa
),

trancamento AS (
  SELECT matricula, codigo_trancamento, data_trancamento
  FROM (
    SELECT
      nc.matriculaaluno AS matricula,
      nc.codigo         AS codigo_trancamento,
      date(nc."data")   AS data_trancamento,
      ROW_NUMBER() OVER (
        PARTITION BY nc.matriculaaluno
        ORDER BY nc."data" DESC, nc.codigo DESC
      ) AS rn
    FROM negociacaocontareceber nc
    WHERE nc.justificativa LIKE '%TRANCAMENTO%'
       OR nc.justificativa LIKE '%trancamento%'
       OR nc.justificativa LIKE '%Trancamento%'
  )
  WHERE rn = 1
),

retorno_trancamento AS (
  SELECT
    t.matricula,
    MIN(date(cr.datavencimento)) AS data_retorno_trancamento
  FROM trancamento t
  JOIN contareceber cr
    ON cr.matriculaaluno = t.matricula
   AND cr.tipoorigem = 'NCR'
   AND TRIM(cr.codorigem) = CAST(t.codigo_trancamento AS TEXT)
  WHERE cr.turma IN (2,4,8,11,21,28,35)
    AND COALESCE(cr.tipoorigem, '') <> 'OUT'
  GROUP BY t.matricula
),

trancamento_gap_base AS (
  SELECT
    cr.matriculaaluno AS matricula,
    LAG(date(cr.datavencimento)) OVER (
      PARTITION BY cr.matriculaaluno
      ORDER BY date(cr.datavencimento), cr.codigo
    ) AS data_trancamento,
    date(cr.datavencimento) AS data_retorno_trancamento
  FROM contareceber cr
  WHERE cr.turma IN (2,4,8,11,21,28,35)
    AND cr.situacao IN ('AR','RE','CF')
    AND COALESCE(cr.tipoorigem, '') NOT IN ('MAT','OUT')
),

trancamento_gap AS (
  SELECT matricula, data_trancamento, data_retorno_trancamento
  FROM (
    SELECT
      tgb.matricula,
      tgb.data_trancamento,
      tgb.data_retorno_trancamento,
      ROW_NUMBER() OVER (
        PARTITION BY tgb.matricula
        ORDER BY tgb.data_retorno_trancamento DESC, tgb.data_trancamento DESC
      ) AS rn
    FROM trancamento_gap_base tgb
    WHERE tgb.data_trancamento IS NOT NULL
      AND tgb.data_retorno_trancamento >= date(tgb.data_trancamento, '+5 months')
  )
  WHERE rn = 1
)

SELECT
  c.nome_aluno AS nome,
  c.cpf,
  c.matricula,
  c.turma,

  strftime('%d/%m/%Y', c.data_matricula) AS data_matricula,
  strftime('%d/%m/%Y', db.data_base_parcelas) AS data_base_parcelas,

  CASE
    WHEN t.matricula IS NOT NULL THEN 1
    WHEN tg.matricula IS NOT NULL THEN 1
    ELSE 0
  END AS realizou_trancamento,

  strftime('%d/%m/%Y',
    COALESCE(t.data_trancamento, tg.data_trancamento)
  ) AS data_trancamento,

  strftime('%d/%m/%Y',
    COALESCE(rt.data_retorno_trancamento, tg.data_retorno_trancamento)
  ) AS data_retorno_trancamento,

  cr.nossonumero,
  cr.tipoorigem,
  cr.codorigem,
  cr.parcela,
  cr.situacao,

  ROUND(cr.valordescontocalculadoprimeirafaixadescontos, 2) AS valor_nominal,

  strftime('%d/%m/%Y', date(cr.datavencimento)) AS data_vencimento,

  CAST(julianday(date('now')) - julianday(date(cr.datavencimento)) AS INTEGER) AS dias_vencimento,

  ROUND(cr.valorrecebido, 2) AS valor_recebido,

  strftime('%d/%m/%Y', r.data_recebimento) AS data_recebimento,

  CASE
    WHEN r.data_recebimento IS NOT NULL
    THEN CAST(julianday(r.data_recebimento) - julianday(date(cr.datavencimento)) AS INTEGER)
    ELSE NULL
  END AS dias_atraso_pagamento,

  COALESCE(
    r.forma_pagamento,
    /* ult_pag: ultimo metodo pago anterior ou na data da parcela */
    (SELECT fp.nome
     FROM contareceber cr2
     LEFT JOIN contarecebernegociacaorecebimento crnr2 ON crnr2.contareceber = cr2.codigo
     LEFT JOIN negociacaorecebimento nr2 ON nr2.codigo = crnr2.negociacaorecebimento
     LEFT JOIN contareceberrecebimento crr2 ON crr2.contareceber = cr2.codigo AND crr2.negociacaorecebimento = nr2.codigo
     LEFT JOIN formapagamentonegociacaorecebimento fpnr2 ON crr2.formapagamentonegociacaorecebimento = fpnr2.codigo
     LEFT JOIN formapagamento fp ON fp.codigo = fpnr2.formapagamento
     WHERE cr2.matriculaaluno = cr.matriculaaluno
       AND cr2.situacao = 'RE'
       AND COALESCE(cr2.tipoorigem, '') NOT IN ('MAT','OUT')
       AND nr2."data" IS NOT NULL
       AND fp.nome <> 'Abono Multa Biblioteca'
       AND nr2."data" <= COALESCE(r.data_recebimento, cr.datavencimento)
     ORDER BY nr2."data" DESC, cr2.codigo DESC
     LIMIT 1),
    /* prox_pag: primeiro metodo pago futuro */
    (SELECT fp.nome
     FROM contareceber cr3
     LEFT JOIN contarecebernegociacaorecebimento crnr3 ON crnr3.contareceber = cr3.codigo
     LEFT JOIN negociacaorecebimento nr3 ON nr3.codigo = crnr3.negociacaorecebimento
     LEFT JOIN contareceberrecebimento crr3 ON crr3.contareceber = cr3.codigo AND crr3.negociacaorecebimento = nr3.codigo
     LEFT JOIN formapagamentonegociacaorecebimento fpnr3 ON crr3.formapagamentonegociacaorecebimento = fpnr3.codigo
     LEFT JOIN formapagamento fp ON fp.codigo = fpnr3.formapagamento
     WHERE cr3.matriculaaluno = cr.matriculaaluno
       AND cr3.situacao = 'RE'
       AND COALESCE(cr3.tipoorigem, '') NOT IN ('MAT','OUT')
       AND nr3."data" IS NOT NULL
       AND fp.nome <> 'Abono Multa Biblioteca'
       AND nr3."data" > COALESCE(r.data_recebimento, cr.datavencimento)
     ORDER BY nr3."data" ASC, cr3.codigo ASC
     LIMIT 1),
    'NUNCA PAGOU'
  ) AS metodo_pagamento,

  CASE
    WHEN rec.data_cadastro IS NULL THEN 'Inativa'
    WHEN COALESCE(r.data_recebimento, date(cr.datavencimento)) < date(rec.data_cadastro) THEN 'Inativa'
    ELSE 'Ativa'
  END AS recorrencia_cartao,

  strftime('%d/%m/%Y', rec.data_cadastro) AS data_cadastro_recorrencia

FROM contareceber cr

JOIN cadastro c
  ON c.matricula = cr.matriculaaluno
 AND c.turma_codigo = cr.turma

LEFT JOIN data_base db
  ON db.matricula = c.matricula

LEFT JOIN rec r
  ON r.contareceber_id = cr.codigo

LEFT JOIN recorrencia rec
  ON rec.pessoa_id = c.pessoa_id

LEFT JOIN trancamento t
  ON t.matricula = c.matricula

LEFT JOIN retorno_trancamento rt
  ON rt.matricula = c.matricula

LEFT JOIN trancamento_gap tg
  ON tg.matricula = c.matricula

WHERE cr.turma IN (2,4,8,11,21,28,35)
  AND cr.situacao IN ('AR','RE','CF')
  AND COALESCE(cr.tipoorigem, '') NOT IN ('MAT','OUT')

ORDER BY
  c.turma,
  c.matricula,
  cr.datavencimento,
  cr.codigo
`;

async function main() {
  console.log('Executando query de validacao...\n');
  const startTime = Date.now();

  const rows = await prisma.$queryRawUnsafe(sql);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`${rows.length} linhas retornadas (${elapsed}s)\n`);

  if (rows.length === 0) {
    console.log('Nenhum resultado.');
    await prisma.$disconnect();
    return;
  }

  // Mostra as primeiras 20 linhas como tabela
  const sample = rows.slice(0, 20);
  const cols = Object.keys(sample[0]);

  // Header
  console.log(cols.join(' | '));
  console.log(cols.map(c => '-'.repeat(c.length)).join('-+-'));

  // Rows
  for (const row of sample) {
    console.log(cols.map(c => {
      const v = row[c];
      if (v === null || v === undefined) return '';
      if (typeof v === 'bigint') return v.toString();
      return String(v);
    }).join(' | '));
  }

  if (rows.length > 20) {
    console.log(`\n... e mais ${rows.length - 20} linhas`);
  }

  // Resumo por turma
  const byTurma = {};
  for (const row of rows) {
    byTurma[row.turma] = (byTurma[row.turma] || 0) + 1;
  }
  console.log('\nResumo por turma:');
  for (const [turma, count] of Object.entries(byTurma).sort()) {
    console.log(`  ${turma}: ${count} parcelas`);
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('ERRO:', err.message);
  prisma.$disconnect();
  process.exit(1);
});
