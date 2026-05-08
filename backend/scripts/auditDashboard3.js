/**
 * Auditoria 3: investiga PRECISAMENTE por que valor(Realizado) > valor(Tentativa)
 * MESMO COM restringirBase=true.
 *
 * Hipotese: alunos que fizeram inbound (em Realizado) tem maior valorDevedor do
 * que alunos que recebem msg/ligacao outbound (Tentativa). Esse diff vem de
 * campanhas/disparos automaticos privilegiarem alunos com pouca divida vs
 * alunos com muita divida que entram em contato espontaneo.
 *
 * Ou pior: sao conjuntos QUASE disjuntos.
 */
import { prisma } from '../src/config/database.js';

async function main() {
  const inicioTs = '2026-04-07 00:00:00';
  const fimTs = '2026-05-07 23:59:59';
  const snapshotData = '2026-04-28';

  // Universos restritos a base
  const tent = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT "pessoaCodigo" AS pessoa
    FROM cobranca.registro_ligacao
    WHERE "pessoaCodigo" IS NOT NULL AND "dataHoraChamada" BETWEEN $1::timestamp AND $2::timestamp
      AND "pessoaCodigo" IN (SELECT "pessoaCodigo" FROM cobranca.snapshot_inadimplencia_diario WHERE data = $3::date)
    UNION
    SELECT DISTINCT "pessoaCodigo" AS pessoa
    FROM cobranca.mensagem_whatsapp
    WHERE "pessoaCodigo" IS NOT NULL AND "fromMe" = true AND "timestamp" BETWEEN $1::timestamp AND $2::timestamp
      AND "pessoaCodigo" IN (SELECT "pessoaCodigo" FROM cobranca.snapshot_inadimplencia_diario WHERE data = $3::date)
  `, inicioTs, fimTs, snapshotData);

  const real = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT "pessoaCodigo" AS pessoa
    FROM cobranca.registro_ligacao
    WHERE "pessoaCodigo" IS NOT NULL AND "dataHoraChamada" BETWEEN $1::timestamp AND $2::timestamp
      AND COALESCE("tempoFalando", 0) >= 4
      AND "pessoaCodigo" IN (SELECT "pessoaCodigo" FROM cobranca.snapshot_inadimplencia_diario WHERE data = $3::date)
    UNION
    SELECT DISTINCT "pessoaCodigo" AS pessoa
    FROM cobranca.mensagem_whatsapp
    WHERE "pessoaCodigo" IS NOT NULL AND "fromMe" = false AND "timestamp" BETWEEN $1::timestamp AND $2::timestamp
      AND "pessoaCodigo" IN (SELECT "pessoaCodigo" FROM cobranca.snapshot_inadimplencia_diario WHERE data = $3::date)
  `, inicioTs, fimTs, snapshotData);

  const tentSet = new Set(tent.map(r => r.pessoa));
  const realSet = new Set(real.map(r => r.pessoa));
  const apenasTent = [...tentSet].filter(x => !realSet.has(x));
  const apenasReal = [...realSet].filter(x => !tentSet.has(x));
  const intersec = [...realSet].filter(x => tentSet.has(x));

  console.log(`Tentativa universe size: ${tentSet.size}`);
  console.log(`Realizado universe size: ${realSet.size}`);
  console.log(`Intersecao Tentativa∩Realizado: ${intersec.length}`);
  console.log(`SO em Tentativa (nao realizou): ${apenasTent.length}`);
  console.log(`SO em Realizado (sem outbound previo): ${apenasReal.length}`);

  // Valor de cada subconjunto via snapshot
  async function valorSet(arr, label) {
    if (arr.length === 0) {
      console.log(`${label}: vazio`);
      return;
    }
    const r = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS qtd, COALESCE(SUM("valorDevedor"),0)::numeric AS valor,
             AVG("valorDevedor")::numeric AS avg, MAX("valorDevedor")::numeric AS max
      FROM cobranca.snapshot_inadimplencia_diario
      WHERE data = $1::date AND "pessoaCodigo" = ANY($2::int[])
    `, snapshotData, arr);
    console.log(`${label}: qtd=${r[0].qtd} | total=R$${Number(r[0].valor).toFixed(2)} | avg=R$${Number(r[0].avg).toFixed(2)} | max=R$${Number(r[0].max).toFixed(2)}`);
  }

  await valorSet([...tentSet], 'Tentativa (todos)');
  await valorSet([...realSet], 'Realizado (todos)');
  await valorSet(apenasTent, 'Apenas Tentativa');
  await valorSet(apenasReal, 'Apenas Realizado (inbound sem outbound)');
  await valorSet(intersec, 'Intersecao');

  // Top alunos no "apenas Realizado" — sao os de maior dvida
  console.log('\n### Top 10 alunos do conjunto "Apenas Realizado" (inbound sem outbound) ###');
  const top = await prisma.$queryRawUnsafe(`
    SELECT s."pessoaCodigo", ar.nome, s."valorDevedor", ar.situacao, ar."situacaoFinanceira", ar.turma
    FROM cobranca.snapshot_inadimplencia_diario s
    LEFT JOIN cobranca.aluno_resumo ar ON ar.codigo = s."pessoaCodigo"
    WHERE s.data = $1::date AND s."pessoaCodigo" = ANY($2::int[])
    ORDER BY s."valorDevedor" DESC
    LIMIT 10
  `, snapshotData, apenasReal);
  console.log(top);

  // Comparacao por turma — talvez disparos so atingem certas turmas
  console.log('\n### Distribuicao de valor por turma — apenas Realizado vs apenas Tentativa ###');
  const turmasReal = await prisma.$queryRawUnsafe(`
    SELECT ar.turma, COUNT(*)::int AS qtd, COALESCE(SUM(s."valorDevedor"),0)::numeric AS valor
    FROM cobranca.snapshot_inadimplencia_diario s
    LEFT JOIN cobranca.aluno_resumo ar ON ar.codigo = s."pessoaCodigo"
    WHERE s.data = $1::date AND s."pessoaCodigo" = ANY($2::int[])
    GROUP BY ar.turma ORDER BY valor DESC
  `, snapshotData, apenasReal);
  console.log('Turmas em "Apenas Realizado":', turmasReal);

  const turmasTent = await prisma.$queryRawUnsafe(`
    SELECT ar.turma, COUNT(*)::int AS qtd, COALESCE(SUM(s."valorDevedor"),0)::numeric AS valor
    FROM cobranca.snapshot_inadimplencia_diario s
    LEFT JOIN cobranca.aluno_resumo ar ON ar.codigo = s."pessoaCodigo"
    WHERE s.data = $1::date AND s."pessoaCodigo" = ANY($2::int[])
    GROUP BY ar.turma ORDER BY valor DESC
  `, snapshotData, apenasTent);
  console.log('Turmas em "Apenas Tentativa":', turmasTent);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
