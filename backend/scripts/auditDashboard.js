/**
 * Auditoria do dashboard - investiga discrepancias e integridade dos dados.
 *
 * Reproduz queries do dashboardController.obterFunil para o periodo
 * default (ultimos 30 dias) e compara com counter-queries.
 */
import { prisma } from '../src/config/database.js';

async function main() {
  console.log('=== AUDIT DASHBOARD ===\n');

  // ---- 1. Snapshot inadimplencia: range, gaps, integridade ----
  console.log('### 1. Snapshot inadimplencia ###');
  const snapRange = await prisma.$queryRawUnsafe(`
    SELECT
      MIN(data)::text AS min_data,
      MAX(data)::text AS max_data,
      COUNT(DISTINCT data)::int AS dias_distintos,
      COUNT(*)::int AS total_linhas
    FROM cobranca.snapshot_inadimplencia_diario
  `);
  console.log('Range:', snapRange[0]);

  const minD = snapRange[0]?.min_data;
  const maxD = snapRange[0]?.max_data;
  if (minD && maxD) {
    const diasEsperados = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS total
      FROM generate_series($1::date, $2::date, INTERVAL '1 day') gs
    `, minD, maxD);
    console.log(`Dias esperados no range ${minD} -> ${maxD}: ${diasEsperados[0].total}`);
    console.log(`Dias com snapshot: ${snapRange[0].dias_distintos}`);
    console.log(`GAPS: ${diasEsperados[0].total - snapRange[0].dias_distintos} dias sem snapshot`);

    const gaps = await prisma.$queryRawUnsafe(`
      WITH dias AS (
        SELECT generate_series($1::date, $2::date, INTERVAL '1 day')::date AS dia
      )
      SELECT d.dia::text AS dia
      FROM dias d
      LEFT JOIN cobranca.snapshot_inadimplencia_diario s ON s.data = d.dia
      WHERE s.data IS NULL
      ORDER BY d.dia
    `, minD, maxD);
    if (gaps.length > 0) {
      console.log('Datas sem snapshot:', gaps.map(g => g.dia).join(', '));
    }
  }

  // Snapshot de uma data exemplo: tamanho da base e valor total
  if (maxD) {
    const snapHoje = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS qtd, COALESCE(SUM("valorDevedor"),0)::numeric AS valor
      FROM cobranca.snapshot_inadimplencia_diario
      WHERE data = $1::date
    `, maxD);
    console.log(`Snapshot ${maxD}: ${snapHoje[0].qtd} alunos, R$ ${Number(snapHoje[0].valor).toFixed(2)}`);
  }

  // ---- 2. Aluno_resumo: estado atual ----
  console.log('\n### 2. Aluno_resumo (atual) ###');
  const ar = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE "situacaoFinanceira" = 'INADIMPLENTE')::int AS inadimplentes,
      COUNT(*) FILTER (WHERE "situacaoFinanceira" = 'ADIMPLENTE')::int AS adimplentes,
      COUNT(*) FILTER (WHERE situacao = 'ATIVO')::int AS ativos,
      COUNT(*) FILTER (WHERE situacao = 'TRANCADO')::int AS trancados,
      COUNT(*) FILTER (WHERE situacao = 'CANCELADO')::int AS cancelados,
      COALESCE(SUM("valorDevedor"),0)::numeric AS valor_devedor,
      COALESCE(SUM("valorPago"),0)::numeric AS valor_pago,
      MIN("atualizadoEm") AS atualizado_em_min,
      MAX("atualizadoEm") AS atualizado_em_max
    FROM cobranca.aluno_resumo
  `);
  console.log(ar[0]);

  // Inadimplentes no aluno_resumo vs base no snapshot mais recente
  if (maxD) {
    console.log('\n### 3. Comparacao snapshot vs aluno_resumo ATUAL ###');
    const cmp = await prisma.$queryRawUnsafe(`
      WITH snap_max AS (
        SELECT "pessoaCodigo", "valorDevedor"
        FROM cobranca.snapshot_inadimplencia_diario
        WHERE data = $1::date
      ),
      ar_inad AS (
        SELECT codigo, "valorDevedor"
        FROM cobranca.aluno_resumo
        WHERE "situacaoFinanceira" = 'INADIMPLENTE'
      )
      SELECT
        (SELECT COUNT(*) FROM snap_max)::int AS snap_qtd,
        (SELECT SUM("valorDevedor") FROM snap_max)::numeric AS snap_valor,
        (SELECT COUNT(*) FROM ar_inad)::int AS ar_qtd,
        (SELECT SUM("valorDevedor") FROM ar_inad)::numeric AS ar_valor,
        (SELECT COUNT(*) FROM ar_inad WHERE codigo NOT IN (SELECT "pessoaCodigo" FROM snap_max))::int AS ar_nao_no_snap,
        (SELECT COUNT(*) FROM snap_max WHERE "pessoaCodigo" NOT IN (SELECT codigo FROM ar_inad))::int AS snap_nao_no_ar
    `, maxD);
    console.log(cmp[0]);
  }

  // ---- 4. FUNIL: reproduz query do controller para periodo defaultpasados 30 dias ----
  console.log('\n### 4. Funil (ultimos 30 dias) - reproducao da query ###');
  const inicio = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const fim = new Date().toISOString().slice(0, 10);
  const inicioTs = `${inicio} 00:00:00`;
  const fimTs = `${fim} 23:59:59`;
  console.log(`Periodo: ${inicio} -> ${fim}`);

  // Resolver snapshotData (logica do controller)
  let snapshotData = inicio;
  let aviso = null;
  if (minD && inicio < minD) {
    snapshotData = minD;
    aviso = `Snapshot disponivel apenas a partir de ${minD}`;
  } else if (maxD && inicio > maxD) {
    snapshotData = maxD;
    aviso = `Snapshot mais recente eh de ${maxD}`;
  }
  console.log(`snapshotData efetivo: ${snapshotData} | aviso: ${aviso || '(nenhum)'}`);
  const restringirBase = aviso === null;
  console.log(`restringirBase: ${restringirBase}`);

  const filtroBaseSql = restringirBase
    ? `AND "pessoaCodigo" IN (SELECT "pessoaCodigo" FROM cobranca.snapshot_inadimplencia_diario WHERE data = $1::date)`
    : '';

  // Etapa 1 - Base
  const base = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS qtd, COALESCE(SUM("valorDevedor"),0)::numeric AS valor
    FROM cobranca.snapshot_inadimplencia_diario WHERE data = $1::date
  `, snapshotData);

  // Etapa 2 - Tentativa
  const tentativa = await prisma.$queryRawUnsafe(`
    WITH contactados AS (
      SELECT DISTINCT "pessoaCodigo" AS pessoa
      FROM cobranca.registro_ligacao
      WHERE "pessoaCodigo" IS NOT NULL
        AND "dataHoraChamada" BETWEEN $2::timestamp AND $3::timestamp
        ${filtroBaseSql}
      UNION
      SELECT DISTINCT "pessoaCodigo" AS pessoa
      FROM cobranca.mensagem_whatsapp
      WHERE "pessoaCodigo" IS NOT NULL AND "fromMe" = true
        AND "timestamp" BETWEEN $2::timestamp AND $3::timestamp
        ${filtroBaseSql}
    )
    SELECT COUNT(DISTINCT c.pessoa)::int AS qtd,
      COALESCE(SUM(COALESCE(snap."valorDevedor", ar."valorDevedor")),0)::numeric AS valor
    FROM contactados c
    LEFT JOIN cobranca.snapshot_inadimplencia_diario snap ON snap.data = $1::date AND snap."pessoaCodigo" = c.pessoa
    LEFT JOIN cobranca.aluno_resumo ar ON ar.codigo = c.pessoa
  `, snapshotData, inicioTs, fimTs);

  // Etapa 3 - Realizado
  const realizado = await prisma.$queryRawUnsafe(`
    WITH efetivos AS (
      SELECT DISTINCT "pessoaCodigo" AS pessoa
      FROM cobranca.registro_ligacao
      WHERE "pessoaCodigo" IS NOT NULL
        AND "dataHoraChamada" BETWEEN $2::timestamp AND $3::timestamp
        AND COALESCE("tempoFalando", 0) >= 4
        ${filtroBaseSql}
      UNION
      SELECT DISTINCT "pessoaCodigo" AS pessoa
      FROM cobranca.mensagem_whatsapp
      WHERE "pessoaCodigo" IS NOT NULL AND "fromMe" = false
        AND "timestamp" BETWEEN $2::timestamp AND $3::timestamp
        ${filtroBaseSql}
    )
    SELECT COUNT(DISTINCT e.pessoa)::int AS qtd,
      COALESCE(SUM(COALESCE(snap."valorDevedor", ar."valorDevedor")),0)::numeric AS valor
    FROM efetivos e
    LEFT JOIN cobranca.snapshot_inadimplencia_diario snap ON snap.data = $1::date AND snap."pessoaCodigo" = e.pessoa
    LEFT JOIN cobranca.aluno_resumo ar ON ar.codigo = e.pessoa
  `, snapshotData, inicioTs, fimTs);

  // Etapa 4 - Negociado
  const negociado = await prisma.$queryRawUnsafe(`
    WITH neg AS (
      SELECT "pessoaCodigo" AS pessoa, "valorAcordo"::numeric AS valor
      FROM cobranca.acordo_financeiro
      WHERE etapa != 'CANCELADO' AND "criadoEm" BETWEEN $2::timestamp AND $3::timestamp
        ${filtroBaseSql}
      UNION ALL
      SELECT "pessoaCodigo" AS pessoa, "valorInadimplenteMJ"::numeric AS valor
      FROM cobranca.ficou_facil
      WHERE etapa != 'CANCELADO' AND "criadoEm" BETWEEN $2::timestamp AND $3::timestamp
        ${filtroBaseSql}
    )
    SELECT COUNT(DISTINCT pessoa)::int AS qtd,
      COALESCE(SUM(valor),0)::numeric AS valor
    FROM neg
  `, snapshotData, inicioTs, fimTs);

  // Etapa 5 - Recuperado
  const recuperado = await prisma.$queryRawUnsafe(`
    WITH rec AS (
      SELECT "pessoaCodigo" AS pessoa, "valorAcordo"::numeric AS valor
      FROM cobranca.acordo_financeiro
      WHERE etapa = 'CONCLUIDO' AND "concluidoEm" BETWEEN $2::timestamp AND $3::timestamp
        ${filtroBaseSql}
      UNION ALL
      SELECT "pessoaCodigo" AS pessoa, "valorInadimplenteMJ"::numeric AS valor
      FROM cobranca.ficou_facil
      WHERE etapa = 'CONCLUIDO' AND "concluidoEm" BETWEEN $2::timestamp AND $3::timestamp
        ${filtroBaseSql}
    )
    SELECT COUNT(DISTINCT pessoa)::int AS qtd,
      COALESCE(SUM(valor),0)::numeric AS valor
    FROM rec
  `, snapshotData, inicioTs, fimTs);

  console.log('\nFunil:');
  console.log(`  Base Inadimplente:    ${base[0].qtd} alunos | R$ ${Number(base[0].valor).toFixed(2)}`);
  console.log(`  Tentativa Contato:    ${tentativa[0].qtd} alunos | R$ ${Number(tentativa[0].valor).toFixed(2)}`);
  console.log(`  Contato Realizado:    ${realizado[0].qtd} alunos | R$ ${Number(realizado[0].valor).toFixed(2)}`);
  console.log(`  Negociado:            ${negociado[0].qtd} alunos | R$ ${Number(negociado[0].valor).toFixed(2)}`);
  console.log(`  Recuperado:           ${recuperado[0].qtd} alunos | R$ ${Number(recuperado[0].valor).toFixed(2)}`);

  // ---- 5. INVESTIGACAO: Por que Realizado > Tentativa em valor? ----
  console.log('\n### 5. Investigacao: Realizado vs Tentativa ###');

  // Pessoas em Tentativa (set A)
  const aSet = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT "pessoaCodigo" AS pessoa
    FROM cobranca.registro_ligacao
    WHERE "pessoaCodigo" IS NOT NULL
      AND "dataHoraChamada" BETWEEN $2::timestamp AND $3::timestamp
      ${filtroBaseSql}
    UNION
    SELECT DISTINCT "pessoaCodigo" AS pessoa
    FROM cobranca.mensagem_whatsapp
    WHERE "pessoaCodigo" IS NOT NULL AND "fromMe" = true
      AND "timestamp" BETWEEN $2::timestamp AND $3::timestamp
      ${filtroBaseSql}
  `, snapshotData, inicioTs, fimTs);

  const bSet = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT "pessoaCodigo" AS pessoa
    FROM cobranca.registro_ligacao
    WHERE "pessoaCodigo" IS NOT NULL
      AND "dataHoraChamada" BETWEEN $2::timestamp AND $3::timestamp
      AND COALESCE("tempoFalando", 0) >= 4
      ${filtroBaseSql}
    UNION
    SELECT DISTINCT "pessoaCodigo" AS pessoa
    FROM cobranca.mensagem_whatsapp
    WHERE "pessoaCodigo" IS NOT NULL AND "fromMe" = false
      AND "timestamp" BETWEEN $2::timestamp AND $3::timestamp
      ${filtroBaseSql}
  `, snapshotData, inicioTs, fimTs);

  const aIds = new Set(aSet.map(r => r.pessoa));
  const bIds = new Set(bSet.map(r => r.pessoa));
  const apenasB = [...bIds].filter(x => !aIds.has(x));
  const intersec = [...bIds].filter(x => aIds.has(x));
  console.log(`|Tentativa| = ${aIds.size}`);
  console.log(`|Realizado| = ${bIds.size}`);
  console.log(`|Tentativa ∩ Realizado| = ${intersec.length}`);
  console.log(`|Realizado SEM estar em Tentativa| = ${apenasB.length}`);
  console.log('  (esses sao alunos que receberam wpp inbound mas o agente nao fez nem ligacao nem msg outbound NESSE periodo)');

  if (apenasB.length > 0) {
    console.log('\nExemplo de pessoas: ', apenasB.slice(0, 5));
    const exDet = await prisma.$queryRawUnsafe(`
      SELECT m."pessoaCodigo" AS pessoa,
        COUNT(*) FILTER (WHERE "fromMe"=false) AS msgs_inbound,
        COUNT(*) FILTER (WHERE "fromMe"=true) AS msgs_outbound,
        MIN(timestamp) AS primeira,
        MAX(timestamp) AS ultima
      FROM cobranca.mensagem_whatsapp m
      WHERE m."pessoaCodigo" = ANY($1::int[])
        AND m."timestamp" BETWEEN $2::timestamp AND $3::timestamp
      GROUP BY m."pessoaCodigo"
      LIMIT 5
    `, apenasB.slice(0, 5), inicioTs, fimTs);
    console.log('Detalhes (mensagens no periodo):');
    console.log(exDet);
  }

  // ---- 6. KPIs (sem filtro de agente) ----
  console.log('\n### 6. KPIs ###');
  const kpis = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS total_alunos,
      COUNT(*) FILTER (WHERE "situacaoFinanceira" = 'INADIMPLENTE')::int AS inadimplentes,
      COALESCE(SUM("valorDevedor"),0)::numeric AS valor_inadimplente,
      COALESCE(SUM("valorPago"),0)::numeric AS valor_pago
    FROM cobranca.aluno_resumo
  `);
  console.log(kpis[0]);

  const acordos = await prisma.$queryRawUnsafe(`
    SELECT etapa, COUNT(*)::int AS qtd, COALESCE(SUM("valorAcordo"),0)::numeric AS valor
    FROM cobranca.acordo_financeiro
    GROUP BY etapa ORDER BY qtd DESC
  `);
  console.log('Acordos por etapa:', acordos);

  const ff = await prisma.$queryRawUnsafe(`
    SELECT etapa, COUNT(*)::int AS qtd, COALESCE(SUM("valorInadimplenteMJ"),0)::numeric AS valor
    FROM cobranca.ficou_facil
    GROUP BY etapa ORDER BY qtd DESC
  `);
  console.log('Ficou Facil por etapa:', ff);

  // ---- 7. Pessoas inadimplentes que nao estao em aluno_resumo (orfaos) ----
  console.log('\n### 7. Integridade: pessoas com contas AR vencidas mas sem aluno_resumo ###');
  const orfaos = await prisma.$queryRawUnsafe(`
    SELECT COUNT(DISTINCT cr.pessoa)::int AS qtd
    FROM cobranca.contareceber cr
    JOIN cobranca.pessoa p ON p.codigo = cr.pessoa
    LEFT JOIN cobranca.aluno_resumo ar ON ar.codigo = cr.pessoa
    WHERE cr.situacao = 'AR'
      AND cr.datavencimento < CURRENT_DATE
      AND cr.valor > COALESCE(cr.valorrecebido, 0)
      AND p.aluno = true
      AND COALESCE(p.funcionario, false) = false
      AND (cr.turma IS NULL OR cr.turma NOT IN (1,10,14,19,22,27,29))
      AND COALESCE(cr.tipoorigem, '') NOT IN ('MAT', 'OUT')
      AND ar.codigo IS NULL
  `);
  console.log(`Pessoas inadimplentes sem aluno_resumo: ${orfaos[0].qtd}`);

  // ---- 8. mensagem_whatsapp pessoaCodigo NULL ----
  console.log('\n### 8. Vinculacao mensagem_whatsapp ###');
  const msgVinc = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE "pessoaCodigo" IS NULL)::int AS sem_pessoa,
      COUNT(*) FILTER (WHERE "fromMe" = true)::int AS outbound,
      COUNT(*) FILTER (WHERE "fromMe" = false)::int AS inbound
    FROM cobranca.mensagem_whatsapp
    WHERE timestamp BETWEEN $1::timestamp AND $2::timestamp
  `, inicioTs, fimTs);
  console.log(msgVinc[0]);

  const ligVinc = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE "pessoaCodigo" IS NULL)::int AS sem_pessoa,
      COUNT(*) FILTER (WHERE COALESCE("tempoFalando", 0) >= 4)::int AS com_fala_4s
    FROM cobranca.registro_ligacao
    WHERE "dataHoraChamada" BETWEEN $1::timestamp AND $2::timestamp
  `, inicioTs, fimTs);
  console.log(`registro_ligacao no periodo:`, ligVinc[0]);

  // ---- 9. Acordos: distribuicao de pessoaCodigo ----
  console.log('\n### 9. Acordos x snapshot ###');
  const acoSnap = await prisma.$queryRawUnsafe(`
    WITH a AS (
      SELECT DISTINCT "pessoaCodigo"
      FROM cobranca.acordo_financeiro
      WHERE etapa != 'CANCELADO' AND "criadoEm" BETWEEN $2::timestamp AND $3::timestamp
    ), snap AS (
      SELECT "pessoaCodigo" FROM cobranca.snapshot_inadimplencia_diario WHERE data = $1::date
    )
    SELECT
      (SELECT COUNT(*) FROM a)::int AS acordos_pessoas,
      (SELECT COUNT(*) FROM a WHERE "pessoaCodigo" IN (SELECT "pessoaCodigo" FROM snap))::int AS acordos_pessoas_no_snap,
      (SELECT COUNT(*) FROM a WHERE "pessoaCodigo" NOT IN (SELECT "pessoaCodigo" FROM snap))::int AS acordos_pessoas_NAO_no_snap
  `, snapshotData, inicioTs, fimTs);
  console.log(acoSnap[0]);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
