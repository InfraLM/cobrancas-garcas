/**
 * Auditoria 2: investiga em detalhe o bug da inversao do funil.
 *
 * Caso 1: periodo onde inicio >= minSnap (com restringirBase=true)
 * Caso 2: periodo onde inicio < minSnap (com restringirBase=false) — CASO ATUAL
 * Compara valor das etapas em ambos cenarios.
 */
import { prisma } from '../src/config/database.js';

async function executarFunil(snapshotData, inicio, fim, restringirBase, label) {
  const inicioTs = `${inicio} 00:00:00`;
  const fimTs = `${fim} 23:59:59`;
  const filtroBaseSql = restringirBase
    ? `AND "pessoaCodigo" IN (SELECT "pessoaCodigo" FROM cobranca.snapshot_inadimplencia_diario WHERE data = $1::date)`
    : '';

  const base = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS qtd, COALESCE(SUM("valorDevedor"),0)::numeric AS valor
    FROM cobranca.snapshot_inadimplencia_diario WHERE data = $1::date
  `, snapshotData);

  const tentativa = await prisma.$queryRawUnsafe(`
    WITH contactados AS (
      SELECT DISTINCT "pessoaCodigo" AS pessoa FROM cobranca.registro_ligacao
      WHERE "pessoaCodigo" IS NOT NULL AND "dataHoraChamada" BETWEEN $2::timestamp AND $3::timestamp ${filtroBaseSql}
      UNION
      SELECT DISTINCT "pessoaCodigo" AS pessoa FROM cobranca.mensagem_whatsapp
      WHERE "pessoaCodigo" IS NOT NULL AND "fromMe" = true AND "timestamp" BETWEEN $2::timestamp AND $3::timestamp ${filtroBaseSql}
    )
    SELECT COUNT(DISTINCT c.pessoa)::int AS qtd,
      COALESCE(SUM(COALESCE(snap."valorDevedor", ar."valorDevedor")),0)::numeric AS valor
    FROM contactados c
    LEFT JOIN cobranca.snapshot_inadimplencia_diario snap ON snap.data = $1::date AND snap."pessoaCodigo" = c.pessoa
    LEFT JOIN cobranca.aluno_resumo ar ON ar.codigo = c.pessoa
  `, snapshotData, inicioTs, fimTs);

  const realizado = await prisma.$queryRawUnsafe(`
    WITH efetivos AS (
      SELECT DISTINCT "pessoaCodigo" AS pessoa FROM cobranca.registro_ligacao
      WHERE "pessoaCodigo" IS NOT NULL AND "dataHoraChamada" BETWEEN $2::timestamp AND $3::timestamp
        AND COALESCE("tempoFalando", 0) >= 4 ${filtroBaseSql}
      UNION
      SELECT DISTINCT "pessoaCodigo" AS pessoa FROM cobranca.mensagem_whatsapp
      WHERE "pessoaCodigo" IS NOT NULL AND "fromMe" = false AND "timestamp" BETWEEN $2::timestamp AND $3::timestamp ${filtroBaseSql}
    )
    SELECT COUNT(DISTINCT e.pessoa)::int AS qtd,
      COALESCE(SUM(COALESCE(snap."valorDevedor", ar."valorDevedor")),0)::numeric AS valor
    FROM efetivos e
    LEFT JOIN cobranca.snapshot_inadimplencia_diario snap ON snap.data = $1::date AND snap."pessoaCodigo" = e.pessoa
    LEFT JOIN cobranca.aluno_resumo ar ON ar.codigo = e.pessoa
  `, snapshotData, inicioTs, fimTs);

  const negociado = await prisma.$queryRawUnsafe(`
    WITH neg AS (
      SELECT "pessoaCodigo" AS pessoa, "valorAcordo"::numeric AS valor FROM cobranca.acordo_financeiro
      WHERE etapa != 'CANCELADO' AND "criadoEm" BETWEEN $2::timestamp AND $3::timestamp ${filtroBaseSql}
      UNION ALL
      SELECT "pessoaCodigo" AS pessoa, "valorInadimplenteMJ"::numeric AS valor FROM cobranca.ficou_facil
      WHERE etapa != 'CANCELADO' AND "criadoEm" BETWEEN $2::timestamp AND $3::timestamp ${filtroBaseSql}
    )
    SELECT COUNT(DISTINCT pessoa)::int AS qtd, COALESCE(SUM(valor),0)::numeric AS valor FROM neg
  `, snapshotData, inicioTs, fimTs);

  const recuperado = await prisma.$queryRawUnsafe(`
    WITH rec AS (
      SELECT "pessoaCodigo" AS pessoa, "valorAcordo"::numeric AS valor FROM cobranca.acordo_financeiro
      WHERE etapa = 'CONCLUIDO' AND "concluidoEm" BETWEEN $2::timestamp AND $3::timestamp ${filtroBaseSql}
      UNION ALL
      SELECT "pessoaCodigo" AS pessoa, "valorInadimplenteMJ"::numeric AS valor FROM cobranca.ficou_facil
      WHERE etapa = 'CONCLUIDO' AND "concluidoEm" BETWEEN $2::timestamp AND $3::timestamp ${filtroBaseSql}
    )
    SELECT COUNT(DISTINCT pessoa)::int AS qtd, COALESCE(SUM(valor),0)::numeric AS valor FROM rec
  `, snapshotData, inicioTs, fimTs);

  console.log(`\n=== ${label} ===`);
  console.log(`snapshot=${snapshotData}, inicio=${inicio}, fim=${fim}, restringirBase=${restringirBase}`);
  const linhas = [
    ['Base Inadimplente', base[0].qtd, base[0].valor],
    ['Tentativa Contato', tentativa[0].qtd, tentativa[0].valor],
    ['Contato Realizado', realizado[0].qtd, realizado[0].valor],
    ['Negociado', negociado[0].qtd, negociado[0].valor],
    ['Recuperado', recuperado[0].qtd, recuperado[0].valor],
  ];
  for (const l of linhas) {
    console.log(`  ${l[0].padEnd(20)} | ${String(l[1]).padStart(5)} alunos | R$ ${Number(l[2]).toFixed(2).padStart(12)}`);
  }
  return linhas;
}

async function main() {
  // CASO 1: ULTIMOS 30 DIAS — bug real (inicio < minSnap)
  await executarFunil(
    '2026-04-28', // snapshot fallback
    '2026-04-07', // inicio
    '2026-05-07', // fim
    false, // restringirBase=false (BUG)
    'CASO 1: Ultimos 30 dias COMO ESTA HOJE (restringir=false, bug confirmado)'
  );

  // CASO 2: mesmo periodo MAS restringindo a base
  await executarFunil(
    '2026-04-28',
    '2026-04-07',
    '2026-05-07',
    true,
    'CASO 2: Mesmo periodo MAS com restringirBase=TRUE (correcao proposta)'
  );

  // CASO 3: periodo que esta dentro da janela do snapshot
  await executarFunil(
    '2026-04-28',
    '2026-04-28',
    '2026-05-07',
    true,
    'CASO 3: Periodo dentro da janela snapshot (sem aviso) - 28/04 a 07/05'
  );

  // ---- Diagnostico do "Realizado SEM estar em Tentativa" no caso 1 ----
  console.log('\n=== DIAGNOSTICO: Por que tantos inbounds sem outbound previo? ===');
  const inicioTs = '2026-04-07 00:00:00';
  const fimTs = '2026-05-07 23:59:59';

  // Quantos inbound vem de pessoas que estao ATIVAS no nosso CRM
  const breakdown = await prisma.$queryRawUnsafe(`
    WITH inbound_pessoas AS (
      SELECT DISTINCT "pessoaCodigo" AS pessoa
      FROM cobranca.mensagem_whatsapp
      WHERE "pessoaCodigo" IS NOT NULL AND "fromMe" = false
        AND "timestamp" BETWEEN $1::timestamp AND $2::timestamp
    ),
    outbound_pessoas AS (
      SELECT DISTINCT "pessoaCodigo" AS pessoa
      FROM cobranca.mensagem_whatsapp
      WHERE "pessoaCodigo" IS NOT NULL AND "fromMe" = true
        AND "timestamp" BETWEEN $1::timestamp AND $2::timestamp
      UNION
      SELECT DISTINCT "pessoaCodigo" AS pessoa FROM cobranca.registro_ligacao
      WHERE "pessoaCodigo" IS NOT NULL AND "dataHoraChamada" BETWEEN $1::timestamp AND $2::timestamp
    )
    SELECT
      (SELECT COUNT(*) FROM inbound_pessoas)::int AS inbound_pessoas,
      (SELECT COUNT(*) FROM inbound_pessoas WHERE pessoa NOT IN (SELECT pessoa FROM outbound_pessoas))::int AS inbound_sem_outbound,
      (SELECT COUNT(*) FROM inbound_pessoas WHERE pessoa IN (SELECT pessoa FROM outbound_pessoas))::int AS inbound_com_outbound
  `, inicioTs, fimTs);
  console.log('Inbound de WhatsApp:', breakdown[0]);

  // Esses 51 "Realizado sem Tentativa": poderia ser um aluno que nos liga primeiro
  // ou que respondeu a uma mensagem ANTES do periodo (ainda na janela 24h).

  console.log('\n=== Pessoas com contato espontaneo (inbound sem outbound no periodo) ===');
  const espontaneos = await prisma.$queryRawUnsafe(`
    WITH inbound_only AS (
      SELECT m."pessoaCodigo" AS pessoa, MIN(m.timestamp) AS primeira_inbound
      FROM cobranca.mensagem_whatsapp m
      WHERE m."pessoaCodigo" IS NOT NULL AND m."fromMe" = false
        AND m."timestamp" BETWEEN $1::timestamp AND $2::timestamp
      GROUP BY m."pessoaCodigo"
    ),
    outbound_periodo AS (
      SELECT DISTINCT "pessoaCodigo" AS pessoa
      FROM cobranca.mensagem_whatsapp
      WHERE "pessoaCodigo" IS NOT NULL AND "fromMe" = true
        AND "timestamp" BETWEEN $1::timestamp AND $2::timestamp
      UNION
      SELECT DISTINCT "pessoaCodigo" AS pessoa FROM cobranca.registro_ligacao
      WHERE "pessoaCodigo" IS NOT NULL AND "dataHoraChamada" BETWEEN $1::timestamp AND $2::timestamp
    ),
    -- Para os "espontaneos", verificar se houve outbound ANTES do periodo
    -- (pode ser resposta de cobranca antiga)
    outbound_ate_periodo AS (
      SELECT m."pessoaCodigo" AS pessoa, MAX(m.timestamp) AS ultima_outbound_anterior
      FROM cobranca.mensagem_whatsapp m
      WHERE m."pessoaCodigo" IS NOT NULL AND m."fromMe" = true
        AND m."timestamp" < $1::timestamp
      GROUP BY m."pessoaCodigo"
    )
    SELECT
      (SELECT COUNT(*) FROM inbound_only WHERE pessoa NOT IN (SELECT pessoa FROM outbound_periodo))::int AS sem_outbound_periodo,
      (SELECT COUNT(*) FROM inbound_only io
        WHERE io.pessoa NOT IN (SELECT pessoa FROM outbound_periodo)
        AND io.pessoa IN (SELECT pessoa FROM outbound_ate_periodo))::int AS tem_outbound_anterior,
      (SELECT COUNT(*) FROM inbound_only io
        WHERE io.pessoa NOT IN (SELECT pessoa FROM outbound_periodo)
        AND io.pessoa NOT IN (SELECT pessoa FROM outbound_ate_periodo))::int AS espontaneo_real
  `, inicioTs, fimTs);
  console.log(espontaneos[0]);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
