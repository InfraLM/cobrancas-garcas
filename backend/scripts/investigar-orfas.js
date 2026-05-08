import { prisma } from '../src/config/database.js';

async function main() {
  console.log('\n=== (a) Instâncias órfãs (instanciaId em mensagens/conversas mas NÃO em instancia_whatsapp_user) ===\n');
  const orfas = await prisma.$queryRawUnsafe(`
    WITH ti AS (
      SELECT DISTINCT "instanciaId" FROM cobranca.mensagem_whatsapp WHERE "instanciaId" IS NOT NULL
      UNION
      SELECT DISTINCT "instanciaId" FROM cobranca.conversa_cobranca WHERE "instanciaId" IS NOT NULL
    )
    SELECT
      ti."instanciaId",
      (SELECT COUNT(*)::int FROM cobranca.mensagem_whatsapp m WHERE m."instanciaId" = ti."instanciaId") AS qtd_msgs,
      (SELECT COUNT(*)::int FROM cobranca.mensagem_whatsapp m WHERE m."instanciaId" = ti."instanciaId" AND m."fromMe" = true) AS qtd_outbound,
      (SELECT COUNT(*)::int FROM cobranca.mensagem_whatsapp m WHERE m."instanciaId" = ti."instanciaId" AND m."fromMe" = false) AS qtd_inbound,
      (SELECT COUNT(*)::int FROM cobranca.conversa_cobranca c WHERE c."instanciaId" = ti."instanciaId") AS qtd_convs,
      (SELECT MIN(timestamp) FROM cobranca.mensagem_whatsapp m WHERE m."instanciaId" = ti."instanciaId") AS msg_inicio,
      (SELECT MAX(timestamp) FROM cobranca.mensagem_whatsapp m WHERE m."instanciaId" = ti."instanciaId") AS msg_fim
    FROM ti
    WHERE NOT EXISTS (SELECT 1 FROM cobranca.instancia_whatsapp_user iwu WHERE iwu."instanciaId" = ti."instanciaId")
    ORDER BY qtd_msgs DESC;
  `);
  console.table(orfas);

  console.log('\n=== (b) Alunos com inbound mas sem outbound entre 2026-04-07 e 2026-05-07 ===\n');
  const espontaneos = await prisma.$queryRawUnsafe(`
    WITH inbound AS (
      SELECT DISTINCT "pessoaCodigo" FROM cobranca.mensagem_whatsapp
      WHERE "pessoaCodigo" IS NOT NULL AND "fromMe" = false
        AND "timestamp" BETWEEN '2026-04-07' AND '2026-05-07 23:59:59'
    ),
    outbound AS (
      SELECT DISTINCT "pessoaCodigo" FROM cobranca.mensagem_whatsapp
      WHERE "pessoaCodigo" IS NOT NULL AND "fromMe" = true
        AND "timestamp" BETWEEN '2026-04-07' AND '2026-05-07 23:59:59'
      UNION
      SELECT DISTINCT "pessoaCodigo" FROM cobranca.registro_ligacao
      WHERE "pessoaCodigo" IS NOT NULL AND COALESCE("tempoFalando",0) >= 4
        AND "dataHoraChamada" BETWEEN '2026-04-07' AND '2026-05-07 23:59:59'
    )
    SELECT i."pessoaCodigo", ar.nome, ar."valorDevedor"
    FROM inbound i
    LEFT JOIN cobranca.aluno_resumo ar ON ar.codigo = i."pessoaCodigo"
    WHERE i."pessoaCodigo" NOT IN (SELECT "pessoaCodigo" FROM outbound)
    ORDER BY ar."valorDevedor" DESC NULLS LAST;
  `);
  console.log(`Encontrados ${espontaneos.length} alunos espontâneos. Top 20:`);
  console.table(espontaneos.slice(0, 20));

  console.log('\n=== (c) Outbound histórico (qualquer período) dos espontâneos — em que instância? ===\n');
  const codigos = espontaneos.map(e => e.pessoaCodigo);
  if (codigos.length) {
    const historico = await prisma.$queryRawUnsafe(`
      SELECT
        m."pessoaCodigo",
        m."instanciaId",
        m."instanciaTipo",
        COUNT(*)::int AS qtd_outbound,
        MIN(m.timestamp) AS primeiro,
        MAX(m.timestamp) AS ultimo,
        CASE WHEN EXISTS (SELECT 1 FROM cobranca.instancia_whatsapp_user iwu WHERE iwu."instanciaId" = m."instanciaId")
             THEN 'EXISTE' ELSE 'ÓRFÃ' END AS status
      FROM cobranca.mensagem_whatsapp m
      WHERE m."pessoaCodigo" = ANY($1::int[]) AND m."fromMe" = true
      GROUP BY m."pessoaCodigo", m."instanciaId", m."instanciaTipo"
      ORDER BY m."pessoaCodigo", qtd_outbound DESC;
    `, codigos);
    console.log(`${historico.length} linhas de histórico. Mostrando primeiras 50:`);
    console.table(historico.slice(0, 50));

    const orfaCount = historico.filter(h => h.status === 'ÓRFÃ').length;
    const existeCount = historico.filter(h => h.status === 'EXISTE').length;
    console.log(`\nResumo: ${orfaCount} registros em instâncias ÓRFÃS, ${existeCount} em instâncias existentes.`);

    const alunosComOrfa = new Set(historico.filter(h => h.status === 'ÓRFÃ').map(h => h.pessoaCodigo));
    console.log(`Dos ${codigos.length} alunos espontâneos, ${alunosComOrfa.size} têm outbound histórico em instância órfã.`);
  } else {
    console.log('Nenhum aluno espontâneo identificado — query (b) retornou vazio.');
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
