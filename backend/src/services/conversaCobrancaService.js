/**
 * Service de ConversaCobranca.
 *
 * Responsavel por:
 * - Vincular conversa WhatsApp a um aluno (Pessoa SEI) via telefone
 * - Enriquecer com metricas financeiras (inadimplencia, atraso, Serasa, acordo)
 * - Criar/atualizar ConversaCobranca a cada mensagem recebida/enviada
 *
 * Priorizacao automatica (score/faixa) fica adiada — campos default.
 */

import { prisma } from '../config/database.js';

// ─── 1. Vinculacao de contato com aluno ────────────────────

/**
 * Normaliza numero de telefone WhatsApp (5562991088407) para buscar
 * em pessoa.celular (formato SEI: "(62)99108-8407").
 *
 * Estrategia: remove tudo que nao eh digito e compara os ultimos 11 digitos.
 */
export async function vincularPessoa(contatoNumero) {
  if (!contatoNumero) return null;

  // Normaliza para so digitos, remove +55 se houver (13 digitos → 11)
  const somenteDigitos = String(contatoNumero).replace(/\D/g, '');
  const numero11 = somenteDigitos.length === 13 && somenteDigitos.startsWith('55')
    ? somenteDigitos.slice(2)
    : somenteDigitos;

  if (numero11.length < 10) return null;

  // Busca por celular, telefonerecado, telefoneres usando regex de digitos apenas
  // Usando SQL puro porque Prisma nao suporta REGEXP_REPLACE em where
  const result = await prisma.$queryRawUnsafe(`
    SELECT codigo, nome, celular, matricula_ativa.matricula AS matricula
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

  if (!result || result.length === 0) return null;

  return {
    codigo: result[0].codigo,
    nome: result[0].nome,
    matricula: result[0].matricula || null,
  };
}

// ─── 2. Enriquecimento financeiro ───────────────────────────

/**
 * Calcula metricas de cobranca a partir da tabela contareceber e serasa.
 * Retorna sempre valores seguros mesmo se nao houver registros.
 */
export async function calcularMetricasCobranca(pessoaCodigo) {
  if (!pessoaCodigo) {
    return {
      valorInadimplente: 0,
      diasAtraso: null,
      serasaAtivo: false,
      temAcordoAtivo: false,
      acordoId: null,
    };
  }

  // Valor inadimplente + dias do vencimento mais antigo em aberto
  const financeiro = await prisma.$queryRawUnsafe(`
    SELECT
      COALESCE(SUM(valor - COALESCE(valorrecebido, 0)), 0) AS valor_aberto,
      MIN(datavencimento) AS venc_mais_antigo
    FROM cobranca.contareceber
    WHERE pessoa = $1
      AND situacao = 'AR'
      AND datavencimento < CURRENT_DATE
      AND COALESCE(valorrecebido, 0) < valor
  `, pessoaCodigo);

  const valorInadimplente = Number(financeiro[0]?.valor_aberto || 0);
  const vencimentoMaisAntigo = financeiro[0]?.venc_mais_antigo;
  const diasAtraso = vencimentoMaisAntigo
    ? Math.max(0, Math.floor((Date.now() - new Date(vencimentoMaisAntigo).getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  // Serasa ativo (join por CPF numerico)
  const serasa = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS total
    FROM cobranca.serasa s
    JOIN cobranca.pessoa p ON p.codigo = $1
    WHERE s.cpf_cnpj_numerico = REGEXP_REPLACE(COALESCE(p.cpf, ''), '[^0-9]', '', 'g')
      AND (s.situacao = 'Ativa' OR s.baixado_em IS NULL)
  `, pessoaCodigo);

  const serasaAtivo = Number(serasa[0]?.total || 0) > 0;

  // Acordo ativo: model AcordoFinanceiro ainda nao existe no schema Prisma.
  // Retornamos false por enquanto. Quando o workflow de negociacao
  // for migrado para Prisma, habilitamos aqui.
  const temAcordoAtivo = false;
  const acordoId = null;

  return {
    valorInadimplente,
    diasAtraso,
    serasaAtivo,
    temAcordoAtivo,
    acordoId,
  };
}

// ─── 3. Upsert da ConversaCobranca ──────────────────────────

/**
 * Cria ou atualiza uma ConversaCobranca a partir de um evento de mensagem.
 *
 * @param {object} params
 * @param {object} params.chatData - objeto chat do payload 3C Plus (chat.id, chat.contact, chat.instance, etc.)
 * @param {object} params.messageData - objeto message do payload 3C Plus (message.id, message.body, message.fromMe, message.time)
 * @returns {Promise<ConversaCobranca>}
 */
export async function upsertConversa({ chatData, messageData }) {
  const chatId = String(chatData?.id || messageData?.chat_id || '');
  if (!chatId) throw new Error('chatId ausente no payload');

  const contatoNumero = chatData?.contact?.number || chatData?.number || messageData?.number || '';
  const contatoNome = chatData?.contact?.name || null;
  const contatoImagem = chatData?.contact?.image || null;
  const instanciaId = chatData?.instance?.id || chatData?.instance_id || messageData?.instance_id || '';
  // Tipo do canal — extraido do payload da 3C Plus (instance.type = 'whatsapp-3c' | 'waba')
  // Usado pelo frontend para detectar janela 24h e modo de envio (livre vs template).
  const instanciaTipo = chatData?.instance?.type || messageData?.instance?.type || null;

  // Detecta @lid do WhatsApp: ID interno (14+ digitos sem prefixo 55).
  // Quando isso chega, vincularPessoa nao casa com nenhum celular do SEI e
  // a conversa fica "fantasma". Quando o telefone real volta, a 3C Plus
  // entrega outro chatId, criando duplicata. So loga; nao temos como evitar.
  const ehLid = /^\d{14,}$/.test(contatoNumero) && !contatoNumero.startsWith('55');
  if (ehLid) {
    console.warn(`[ConversaCobranca] @lid detectado em chatId=${chatId} numero=${contatoNumero} — pessoa nao sera vinculada`);
  }
  const fromMe = Boolean(messageData?.fromMe ?? messageData?.from_me ?? false);
  const timestamp = messageData?.time || messageData?.time_whatsapp || Math.floor(Date.now() / 1000);
  const quandoMensagem = new Date(timestamp * 1000);
  const tipoMsg = messageData?.type || 'chat';
  const textoMsg = messageData?.body || null;

  // Tenta buscar existente
  let existente = await prisma.conversaCobranca.findUnique({ where: { chatId } });

  // Se nao existe, enriquecer e criar
  if (!existente) {
    const pessoa = await vincularPessoa(contatoNumero);
    const metricas = await calcularMetricasCobranca(pessoa?.codigo);

    try {
      return await prisma.conversaCobranca.create({
        data: {
          chatId,
          instanciaId,
          instanciaTipo,
          contatoNumero,
          contatoNome: contatoNome || pessoa?.nome || null,
          contatoImagem,
          pessoaCodigo: pessoa?.codigo || null,
          matricula: pessoa?.matricula || null,
          status: 'AGUARDANDO',
          valorInadimplente: metricas.valorInadimplente,
          diasAtraso: metricas.diasAtraso,
          serasaAtivo: metricas.serasaAtivo,
          temAcordoAtivo: metricas.temAcordoAtivo,
          acordoId: metricas.acordoId,
          ultimaMensagemCliente: fromMe ? null : quandoMensagem,
          ultimaMensagemAgente: fromMe ? quandoMensagem : null,
          ultimaAtividadeEm: quandoMensagem,
          aguardandoRespostaDesde: fromMe ? null : quandoMensagem,
          ultimaMensagemTexto: textoMsg,
          ultimaMensagemTipo: tipoMsg,
          ultimaMensagemFromMe: fromMe,
          naoLidos: fromMe ? 0 : 1,
        },
      });
    } catch (err) {
      // Race condition: outro evento do mesmo chatId criou primeiro entre o
      // findUnique e o create. Recupera e cai no path de update abaixo —
      // garante que a mensagem atual seja contabilizada (preview, naoLidos,
      // ultimaAtividadeEm). Sem isso, a mensagem era perdida com erro P2002.
      const isP2002ChatId =
        err?.code === 'P2002' &&
        (Array.isArray(err?.meta?.target) ? err.meta.target.includes('chatId') : err?.meta?.target === 'chatId');
      if (!isP2002ChatId) throw err;

      console.warn(`[ConversaCobranca] Race no chatId=${chatId} — recuperando registro concorrente e atualizando`);
      existente = await prisma.conversaCobranca.findUnique({ where: { chatId } });
      if (!existente) throw err; // nao recuperou (improvavel) — propaga erro original
      // continua para o path de update abaixo
    }
  }

  // Se nao tem nome no contato nem na conversa, buscar do SEI
  let nomeFinal = contatoNome || existente.contatoNome;
  if (!nomeFinal && existente.pessoaCodigo) {
    const pessoaSei = await prisma.$queryRawUnsafe(
      `SELECT nome FROM cobranca.pessoa WHERE codigo = $1`, existente.pessoaCodigo
    ).catch(() => []);
    if (pessoaSei.length > 0) nomeFinal = pessoaSei[0].nome;
  }

  // Existe: atualizar
  const patch = {
    contatoNome: nomeFinal,
    contatoImagem: contatoImagem || existente.contatoImagem,
    // Sempre atualiza preview da ultima mensagem
    ultimaMensagemTexto: textoMsg,
    ultimaMensagemTipo: tipoMsg,
    ultimaMensagemFromMe: fromMe,
    // Bumpa atividade tanto no envio quanto no recebimento (ordering)
    ultimaAtividadeEm: quandoMensagem,
  };
  // Atualiza instanciaTipo se o payload trouxe (corrige conversas antigas que tinham
  // `whatsapp-3c` por backfill quando recebem msg via WABA depois)
  if (instanciaTipo && existente.instanciaTipo !== instanciaTipo) {
    patch.instanciaTipo = instanciaTipo;
  }

  if (fromMe) {
    patch.ultimaMensagemAgente = quandoMensagem;
  } else {
    patch.ultimaMensagemCliente = quandoMensagem;
    patch.aguardandoRespostaDesde = quandoMensagem;
    patch.naoLidos = { increment: 1 };

    // Se estava encerrada e cliente voltou, reabre como AGUARDANDO
    if (existente.status === 'ENCERRADA') {
      patch.status = 'AGUARDANDO';
      patch.motivoEncerramento = null;
      patch.observacaoEncerramento = null;
      patch.encerradoEm = null;
    }
    // Se estava em SNOOZE, reativa
    if (existente.status === 'SNOOZE') {
      patch.status = 'AGUARDANDO';
      patch.reativarEm = null;
    }
  }

  // Reenriquece metricas de tempos em tempos (se ultima atualizacao > 1h atras)
  const tempoDesdeAtualizacao = Date.now() - new Date(existente.atualizadoEm).getTime();
  if (tempoDesdeAtualizacao > 60 * 60 * 1000) {
    const metricas = await calcularMetricasCobranca(existente.pessoaCodigo);
    patch.valorInadimplente = metricas.valorInadimplente;
    patch.diasAtraso = metricas.diasAtraso;
    patch.serasaAtivo = metricas.serasaAtivo;
    patch.temAcordoAtivo = metricas.temAcordoAtivo;
    patch.acordoId = metricas.acordoId;
  }

  return prisma.conversaCobranca.update({
    where: { chatId },
    data: patch,
  });
}
