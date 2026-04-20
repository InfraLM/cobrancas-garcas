/**
 * Controller de Ligações — proxy para 3C Plus
 *
 * O Click2Call requer o token do gestor, que fica no .env do backend.
 * O frontend envia { phone, extension } e o backend adiciona o token.
 *
 * getConfig() e hangup() usam dados do usuario logado (req.user).
 */

import { prisma } from '../config/database.js';

const CLICK2CALL_URL = 'https://3c.fluxoti.com/api/v1/click2call';
const SUBDOMAIN = 'liberdademedica';

export async function click2call(req, res, next) {
  try {
    const managerToken = process.env.THREECPLUS_MANAGER_TOKEN;

    if (!managerToken) {
      return res.status(500).json({
        error: 'Token do gestor 3C Plus não configurado. Adicione THREECPLUS_MANAGER_TOKEN no .env',
      });
    }

    const { phone, extension } = req.body;

    if (!phone || !extension) {
      return res.status(400).json({ error: 'phone e extension são obrigatórios' });
    }

    const now = Date.now();
    if (click2call._lastCall && now - click2call._lastCall < 5000) {
      return res.status(429).json({ error: 'Aguarde 5 segundos entre chamadas' });
    }
    click2call._lastCall = now;

    const response = await fetch(
      `${CLICK2CALL_URL}?api_token=${managerToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `extension=${extension}&phone=${phone}`,
      }
    );

    const data = await response.text();

    if (!response.ok) {
      console.error('[3C+] Click2Call falhou:', response.status, data);
      return res.status(response.status).json({ error: data });
    }

    const parsed = JSON.parse(data);
    console.log('[3C+] Click2Call OK:', parsed);
    res.json(parsed);
  } catch (error) {
    next(error);
  }
}

click2call._lastCall = 0;

/**
 * GET /api/ligacoes/config
 * Retorna configuração do agente logado para o frontend.
 * Busca token/extension/campanha do usuario no banco.
 * Fallback para .env se usuario nao tem dados configurados.
 */
export async function getConfig(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    // Se usuario e gestor (token = manager token), usar token e extension do agente do .env
    const isGestor = user?.threecplusAgentToken === process.env.THREECPLUS_MANAGER_TOKEN;
    const agentToken = isGestor ? process.env.THREECPLUS_AGENT_TOKEN : (user?.threecplusAgentToken || process.env.THREECPLUS_AGENT_TOKEN);
    const agentExtension = isGestor ? 228923 : (user?.threecplusExtension ? Number(user.threecplusExtension) : null);
    const campanhaId = user?.campanhaId || null;

    if (!agentToken) {
      return res.status(500).json({
        error: 'Token do agente não configurado. Vincule seu usuario à 3C Plus em Configurações > Usuários.',
      });
    }

    console.log(`[Ligacoes] Config para ${user?.nome}: ext=${agentExtension}, campanha=${campanhaId}`);

    res.json({
      agentToken,
      agentExtension: agentExtension || 0,
      campaignIdIndividual: campanhaId || 257943,
      campaignIdMassa: 257976,
      subdomain: SUBDOMAIN,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/ligacoes/hangup/:callId
 * Desliga a chamada ativa usando o token do usuario logado.
 */
export async function hangup(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    const isGestor = user?.threecplusAgentToken === process.env.THREECPLUS_MANAGER_TOKEN;
    const agentToken = isGestor ? process.env.THREECPLUS_AGENT_TOKEN : (user?.threecplusAgentToken || process.env.THREECPLUS_AGENT_TOKEN);
    if (!agentToken) {
      return res.status(500).json({ error: 'Token do agente não configurado' });
    }

    const { callId } = req.params;
    if (!callId) {
      return res.status(400).json({ error: 'callId obrigatório' });
    }

    const url = `https://${SUBDOMAIN}.3c.plus/api/v1/agent/call/${encodeURIComponent(callId)}/hangup?api_token=${agentToken}`;
    console.log(`[3C+] Hangup (${user?.nome}): ${url.replace(agentToken, '***')}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const text = await response.text();
    console.log('[3C+] Hangup resposta:', response.status, text);

    if (!response.ok) {
      return res.status(response.status).json({ error: text });
    }

    try {
      res.json(JSON.parse(text));
    } catch {
      res.json({ ok: true, raw: text });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/ligacoes/aluno-por-telefone?phone=62991088407
 * Busca pessoa SEI por telefone (celular/telefonerecado/telefoneres).
 * Retorna aluno com métricas financeiras, ou null se não encontrar.
 */
export async function alunoPorTelefone(req, res, next) {
  try {
    const phone = String(req.query.phone || '');
    if (!phone) {
      return res.status(400).json({ error: 'phone obrigatório na querystring' });
    }

    const somenteDigitos = phone.replace(/\D/g, '');
    const numero11 = somenteDigitos.length === 13 && somenteDigitos.startsWith('55')
      ? somenteDigitos.slice(2)
      : somenteDigitos;

    if (numero11.length < 10) {
      return res.json({ data: null });
    }

    const result = await prisma.$queryRawUnsafe(`
      SELECT
        p.codigo, p.nome, p.cpf, p.celular, p.email,
        matricula_ativa.matricula AS matricula
      FROM cobranca.pessoa p
      LEFT JOIN LATERAL (
        SELECT matricula
        FROM cobranca.matricula m
        WHERE m.aluno = p.codigo
        ORDER BY m.data DESC NULLS LAST
        LIMIT 1
      ) matricula_ativa ON true
      WHERE
        REGEXP_REPLACE(COALESCE(p.celular, ''), '[^0-9]', '', 'g') = $1
        OR REGEXP_REPLACE(COALESCE(p.telefonerecado, ''), '[^0-9]', '', 'g') = $1
        OR REGEXP_REPLACE(COALESCE(p.telefoneres, ''), '[^0-9]', '', 'g') = $1
      LIMIT 1
    `, numero11);

    if (!result || result.length === 0) {
      return res.json({ data: null });
    }

    const pessoa = result[0];

    const financeiro = await prisma.$queryRawUnsafe(`
      SELECT
        COALESCE(SUM(valor - COALESCE(valorrecebido, 0)), 0) AS valor_aberto,
        MIN(datavencimento) AS venc_mais_antigo,
        COUNT(*) FILTER (WHERE situacao = 'AR' AND datavencimento < CURRENT_DATE) AS parcelas_atraso
      FROM cobranca.contareceber
      WHERE pessoa = $1
        AND situacao = 'AR'
        AND datavencimento < CURRENT_DATE
        AND COALESCE(valorrecebido, 0) < valor
    `, pessoa.codigo);

    const valorInadimplente = Number(financeiro[0]?.valor_aberto || 0);
    const vencimentoMaisAntigo = financeiro[0]?.venc_mais_antigo;
    const diasAtraso = vencimentoMaisAntigo
      ? Math.max(0, Math.floor((Date.now() - new Date(vencimentoMaisAntigo).getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    const serasa = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS total
      FROM cobranca.serasa s
      JOIN cobranca.pessoa p ON p.codigo = $1
      WHERE s.cpf_cnpj_numerico = REGEXP_REPLACE(COALESCE(p.cpf, ''), '[^0-9]', '', 'g')
        AND (s.situacao = 'Ativa' OR s.baixado_em IS NULL)
    `, pessoa.codigo);

    const serasaAtivo = Number(serasa[0]?.total || 0) > 0;

    res.json({
      data: {
        codigo: pessoa.codigo,
        nome: pessoa.nome,
        cpf: pessoa.cpf,
        celular: pessoa.celular,
        email: pessoa.email,
        matricula: pessoa.matricula,
        valorInadimplente,
        diasAtraso,
        parcelasAtraso: Number(financeiro[0]?.parcelas_atraso || 0),
        serasaAtivo,
      },
    });
  } catch (error) {
    next(error);
  }
}
