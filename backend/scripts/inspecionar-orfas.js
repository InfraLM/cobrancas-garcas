import { prisma } from '../src/config/database.js';

const codigos = [515, 451, 513, 715, 535, 648, 730, 789, 784, 679];

(async () => {
  console.log('=== Detalhes das mensagens inbound dos top 10 espontâneos ===\n');
  const detalhes = await prisma.$queryRawUnsafe(`
    SELECT
      m."pessoaCodigo",
      ar.nome AS aluno_vinculado,
      m."contatoNumero" AS num_remetente,
      m."contatoNome" AS nome_remetente_whatsapp,
      m."instanciaId",
      m."instanciaTipo",
      LEFT(m.corpo, 100) AS preview,
      m.timestamp,
      p.celular AS celular_aluno_sei,
      p.telefonerecado AS telefonerecado_sei
    FROM cobranca.mensagem_whatsapp m
    LEFT JOIN cobranca.aluno_resumo ar ON ar.codigo = m."pessoaCodigo"
    LEFT JOIN cobranca.pessoa p ON p.codigo = m."pessoaCodigo"
    WHERE m."pessoaCodigo" = ANY($1::int[])
      AND m."fromMe" = false
      AND m.timestamp BETWEEN '2026-04-07' AND '2026-05-07 23:59:59'
    ORDER BY m."pessoaCodigo", m.timestamp
    LIMIT 50;
  `, codigos);
  console.table(detalhes);

  console.log('\n=== Verificando se contatoNumero bate com celular do aluno SEI ===\n');
  const conferencia = await prisma.$queryRawUnsafe(`
    SELECT
      m."pessoaCodigo",
      ar.nome,
      m."contatoNumero",
      p.celular,
      CASE
        WHEN regexp_replace(m."contatoNumero", '\\D', '', 'g') = regexp_replace(COALESCE(p.celular,''), '\\D', '', 'g') THEN 'BATE celular'
        WHEN regexp_replace(m."contatoNumero", '\\D', '', 'g') LIKE '%' || regexp_replace(COALESCE(p.celular,''), '\\D', '', 'g') || '%'
             AND length(regexp_replace(COALESCE(p.celular,''), '\\D', '', 'g')) >= 8 THEN 'CONTAINS celular'
        WHEN regexp_replace(COALESCE(p.celular,''), '\\D', '', 'g') LIKE '%' || regexp_replace(m."contatoNumero", '\\D', '', 'g') || '%'
             AND length(regexp_replace(m."contatoNumero", '\\D', '', 'g')) >= 8 THEN 'celular CONTAINS num'
        ELSE 'NAO BATE'
      END AS match,
      COUNT(*)::int AS qtd_msgs
    FROM cobranca.mensagem_whatsapp m
    LEFT JOIN cobranca.aluno_resumo ar ON ar.codigo = m."pessoaCodigo"
    LEFT JOIN cobranca.pessoa p ON p.codigo = m."pessoaCodigo"
    WHERE m."pessoaCodigo" = ANY($1::int[])
      AND m."fromMe" = false
      AND m.timestamp BETWEEN '2026-04-07' AND '2026-05-07 23:59:59'
    GROUP BY m."pessoaCodigo", ar.nome, m."contatoNumero", p.celular
    ORDER BY m."pessoaCodigo";
  `, codigos);
  console.table(conferencia);

  await prisma.$disconnect();
})();
