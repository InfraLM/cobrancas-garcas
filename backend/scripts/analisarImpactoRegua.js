// Análise completa de impacto da régua de cobrança automática.
// Reconciliação de conversão ad-hoc via JOIN entre DisparoMensagem e contareceber.
//
// Definição de conversão (alinhada com BACKLOG):
//   = título referenciado mudou para situacao='RE' (recebido) APÓS o disparo bem-sucedido
import { prisma } from '../src/config/database.js';

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('ANÁLISE DE IMPACTO — RÉGUA DE COBRANÇA AUTOMÁTICA');
  console.log('='.repeat(70));

  // 1) Réguas existentes
  console.log('\n[1] RÉGUAS CONFIGURADAS\n');
  const reguas = await prisma.$queryRawUnsafe(`
    SELECT
      r.id, r.nome, r.ativo, r."horarioPadrao", r."intervaloDisparoSeg",
      r."criadoEm"::date AS criada_em, r."ultimaExecucao",
      COUNT(DISTINCT e.id)::int AS etapas
    FROM cobranca.regua_cobranca r
    LEFT JOIN cobranca.etapa_regua e ON e."reguaId" = r.id
    GROUP BY r.id, r.nome, r.ativo, r."horarioPadrao", r."intervaloDisparoSeg", r."criadoEm", r."ultimaExecucao"
    ORDER BY r."criadoEm" DESC
  `);
  console.table(reguas);

  // 2) Etapas
  console.log('\n[2] ETAPAS DAS RÉGUAS\n');
  const etapas = await prisma.$queryRawUnsafe(`
    SELECT
      e.id, e.nome, e."reguaId", e.ordem, e."diasRelativoVenc",
      e."filtroSituacao", e."filtroRecorrencia", e."tiposOrigem",
      tb.titulo AS template, e.ativo,
      e."ultimaExecucaoEm"::timestamp(0) AS ultima_exec
    FROM cobranca.etapa_regua e
    LEFT JOIN cobranca.template_blip tb ON tb.id = e."templateBlipId"
    ORDER BY e."reguaId", e.ordem
  `);
  console.table(etapas);

  // 3) Disparos: visão geral por status
  console.log('\n[3] DISPAROS POR STATUS (todos os tempos)\n');
  const status = await prisma.$queryRawUnsafe(`
    SELECT status, COUNT(*)::int AS qtd
    FROM cobranca.disparo_mensagem
    GROUP BY status ORDER BY qtd DESC
  `);
  console.table(status);

  // 4) Total agrupados
  console.log('\n[4] DISPAROS — RESUMO GERAL\n');
  const resumo = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'ENVIADO')::int AS enviados,
      COUNT(*) FILTER (WHERE status = 'FALHOU')::int AS falhados,
      COUNT(*) FILTER (WHERE status = 'CANCELADO')::int AS cancelados,
      COUNT(*) FILTER (WHERE status = 'PENDENTE')::int AS pendentes,
      COUNT(DISTINCT "pessoaCodigo")::int AS pessoas_distintas,
      COUNT(DISTINCT "contaReceberCodigo")::int AS titulos_distintos,
      MIN("criadoEm")::date AS primeiro,
      MAX("disparadoEm")::date AS ultimo_disparo
    FROM cobranca.disparo_mensagem
  `);
  console.table(resumo);

  // 5) Por template
  console.log('\n[5] POR TEMPLATE — ENVIOS\n');
  const porTemplate = await prisma.$queryRawUnsafe(`
    SELECT
      "templateNomeBlip" AS template,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'ENVIADO')::int AS enviados,
      COUNT(*) FILTER (WHERE status = 'FALHOU')::int AS falhados,
      COUNT(*) FILTER (WHERE status = 'CANCELADO')::int AS cancelados,
      COUNT(DISTINCT "pessoaCodigo")::int AS pessoas
    FROM cobranca.disparo_mensagem
    GROUP BY "templateNomeBlip"
    ORDER BY total DESC
  `);
  console.table(porTemplate);

  // 6) Análise de CONVERSÃO via cr.updated (timestamp do SEI quando título foi alterado)
  //    A cadeia contarecebernegociacaorecebimento só cobre acordos formais SEI (92% dos RE
  //    globais, mas 0% dos títulos da régua — que são mensalidades pagas diretamente).
  //    `cr.updated` vem do SEI e reflete a última alteração — para títulos que viraram
  //    RE, é uma boa aproximação da data do pagamento.
  console.log('\n[6] CONVERSÃO POR TEMPLATE (cr.updated > disparadoEm)\n');
  const conversao = await prisma.$queryRawUnsafe(`
    SELECT
      dm."templateNomeBlip" AS template,
      COUNT(*)::int AS enviados,
      -- Pagou apos o disparo: situacao=RE E updated > disparadoEm
      COUNT(*) FILTER (WHERE cr.situacao = 'RE' AND cr.updated > dm."disparadoEm")::int AS pagos_apos_disparo,
      -- Pagou ANTES do disparo (defesa do worker deveria evitar mas existe edge case)
      COUNT(*) FILTER (WHERE cr.situacao = 'RE' AND cr.updated <= dm."disparadoEm")::int AS pagos_antes,
      ROUND(COUNT(*) FILTER (WHERE cr.situacao = 'RE' AND cr.updated > dm."disparadoEm") * 100.0
            / NULLIF(COUNT(*), 0), 1) AS taxa_pct,
      ROUND(AVG(EXTRACT(EPOCH FROM (cr.updated - dm."disparadoEm")) / 86400.0)
            FILTER (WHERE cr.situacao = 'RE' AND cr.updated > dm."disparadoEm")::numeric, 1) AS dias_medio_ate_pagar
    FROM cobranca.disparo_mensagem dm
    JOIN cobranca.contareceber cr ON cr.codigo = dm."contaReceberCodigo"
    WHERE dm.status = 'ENVIADO' AND dm."disparadoEm" IS NOT NULL
    GROUP BY dm."templateNomeBlip"
    ORDER BY pagos_apos_disparo DESC
  `);
  console.table(conversao);

  // 6b) Conversão por ETAPA (mais granular)
  console.log('\n[6b] CONVERSÃO POR ETAPA (cr.updated > disparadoEm)\n');
  const conversaoEtapa = await prisma.$queryRawUnsafe(`
    SELECT
      e."diasRelativoVenc" AS dias_venc,
      e.nome AS etapa,
      COUNT(dm.id)::int AS enviados,
      COUNT(*) FILTER (WHERE cr.situacao = 'RE' AND cr.updated > dm."disparadoEm")::int AS pagos_apos,
      ROUND(COUNT(*) FILTER (WHERE cr.situacao = 'RE' AND cr.updated > dm."disparadoEm") * 100.0
            / NULLIF(COUNT(*), 0), 1) AS taxa_pct,
      ROUND(AVG(EXTRACT(EPOCH FROM (cr.updated - dm."disparadoEm")) / 86400.0)
            FILTER (WHERE cr.situacao = 'RE' AND cr.updated > dm."disparadoEm")::numeric, 1) AS dias_medio
    FROM cobranca.disparo_mensagem dm
    JOIN cobranca.etapa_regua e ON e.id = dm."etapaReguaId"
    JOIN cobranca.contareceber cr ON cr.codigo = dm."contaReceberCodigo"
    WHERE dm.status = 'ENVIADO' AND dm."disparadoEm" IS NOT NULL
    GROUP BY e.id, e.nome, e."diasRelativoVenc"
    ORDER BY e."diasRelativoVenc"
  `);
  console.table(conversaoEtapa);

  // 7) Engajamento WhatsApp (recebimento e resposta do aluno)
  console.log('\n[7] ENGAJAMENTO WHATSAPP (entregue/lido/respondido pelo aluno)\n');
  const engajamento = await prisma.$queryRawUnsafe(`
    WITH disparos AS (
      SELECT id, "pessoaCodigo", "templateNomeBlip", "disparadoEm"
      FROM cobranca.disparo_mensagem
      WHERE status = 'ENVIADO' AND "disparadoEm" IS NOT NULL
    ),
    -- Para cada disparo, busca a mensagem WhatsApp do template (fromMe=true) e respostas posteriores
    eng AS (
      SELECT
        d.id,
        d."templateNomeBlip" AS template,
        -- Mensagem fromMe=true correspondente (mesmo aluno, mesmo template, perto da disparadoEm)
        (SELECT mw.ack FROM cobranca.mensagem_whatsapp mw
          WHERE mw."pessoaCodigo" = d."pessoaCodigo"
            AND mw."fromMe" = true
            AND mw."templateMetaNome" IS NOT NULL
            AND mw.timestamp BETWEEN d."disparadoEm" - INTERVAL '2 minutes' AND d."disparadoEm" + INTERVAL '10 minutes'
          ORDER BY mw.timestamp LIMIT 1) AS ack,
        -- Resposta posterior do aluno (até 7d depois)
        EXISTS (
          SELECT 1 FROM cobranca.mensagem_whatsapp mw
          WHERE mw."pessoaCodigo" = d."pessoaCodigo"
            AND mw."fromMe" = false
            AND mw.timestamp BETWEEN d."disparadoEm" AND d."disparadoEm" + INTERVAL '7 days'
        ) AS respondeu
      FROM disparos d
    )
    SELECT
      template,
      COUNT(*)::int AS enviados,
      COUNT(*) FILTER (WHERE ack IS NOT NULL)::int AS entregues,
      COUNT(*) FILTER (WHERE ack = 'read')::int AS lidos,
      COUNT(*) FILTER (WHERE respondeu)::int AS responderam,
      ROUND(COUNT(*) FILTER (WHERE respondeu) * 100.0 / NULLIF(COUNT(*), 0), 1) AS taxa_resposta_pct
    FROM eng
    GROUP BY template
    ORDER BY enviados DESC
  `);
  console.table(engajamento);

  // 8) Funil completo
  console.log('\n[8] FUNIL COMPLETO\n');
  const funil = await prisma.$queryRawUnsafe(`
    WITH base AS (
      SELECT
        dm.id, dm."pessoaCodigo", dm."contaReceberCodigo", dm.status, dm."disparadoEm",
        (SELECT MIN(nr."data") FROM cobranca.contarecebernegociacaorecebimento crnr
          JOIN cobranca.negociacaorecebimento nr ON nr.codigo = crnr.negociacaorecebimento
          WHERE crnr.contareceber = dm."contaReceberCodigo") AS data_recebimento,
        EXISTS (
          SELECT 1 FROM cobranca.mensagem_whatsapp mw
          WHERE mw."pessoaCodigo" = dm."pessoaCodigo"
            AND mw."fromMe" = false
            AND mw.timestamp BETWEEN dm."disparadoEm" AND dm."disparadoEm" + INTERVAL '7 days'
        ) AS respondeu_7d
      FROM cobranca.disparo_mensagem dm
    )
    SELECT
      COUNT(*)::int AS criados,
      COUNT(*) FILTER (WHERE status = 'ENVIADO')::int AS enviados,
      COUNT(*) FILTER (WHERE status = 'ENVIADO' AND respondeu_7d)::int AS responderam,
      COUNT(*) FILTER (WHERE status = 'ENVIADO' AND data_recebimento IS NOT NULL AND data_recebimento > "disparadoEm")::int AS pagaram_apos
    FROM base
  `);
  console.table(funil);

  // 9) Por dia/etapa relativa ao vencimento
  console.log('\n[9] POR ETAPA (dias relativos ao vencimento)\n');
  const porEtapa = await prisma.$queryRawUnsafe(`
    SELECT
      e.nome AS etapa,
      e."diasRelativoVenc" AS dias_venc,
      COUNT(dm.id)::int AS disparos,
      COUNT(*) FILTER (WHERE dm.status = 'ENVIADO')::int AS enviados,
      COUNT(*) FILTER (WHERE dm.status = 'FALHOU')::int AS falhados,
      COUNT(*) FILTER (WHERE dm.status = 'CANCELADO')::int AS cancelados
    FROM cobranca.etapa_regua e
    LEFT JOIN cobranca.disparo_mensagem dm ON dm."etapaReguaId" = e.id
    GROUP BY e.id, e.nome, e."diasRelativoVenc", e.ordem
    ORDER BY e.ordem
  `);
  console.table(porEtapa);

  // 10) Falhas mais comuns
  console.log('\n[10] FALHAS / CANCELAMENTOS — top 10 mensagens de erro\n');
  const falhas = await prisma.$queryRawUnsafe(`
    SELECT
      "erroMensagem",
      status,
      COUNT(*)::int AS qtd
    FROM cobranca.disparo_mensagem
    WHERE status IN ('FALHOU', 'CANCELADO')
      AND "erroMensagem" IS NOT NULL
    GROUP BY "erroMensagem", status
    ORDER BY qtd DESC LIMIT 10
  `);
  console.table(falhas);

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
