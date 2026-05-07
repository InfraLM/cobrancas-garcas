/**
 * Controller de Conversas — proxy para 3C Plus Omnichannel API
 *
 * Duas APIs (mesmo token, domínios diferentes):
 * - Omni API (legada): app.3c.fluxoti.com — auth via ?api_token= — apenas /agents, /teams
 * - Chat API (nova):   app.3c.plus        — auth via Bearer     — chats, mensagens, envio, ações
 *
 * O token do manager fica no .env, NUNCA vai pro frontend (exceto para Socket.io).
 */

import { prisma } from '../config/database.js';
import { upsertConversa } from '../services/conversaCobrancaService.js';
import { getRealtimeIo } from '../realtime.js';

const OMNI_API = 'https://app.3c.fluxoti.com/omni-api/v1/whatsapp';
const CHAT_API = 'https://app.3c.plus/omni-chat-api/v1/whatsapp';

function getToken() {
  return process.env.THREECPLUS_MANAGER_TOKEN;
}

// Omni API legada — apenas agents/teams
function omniUrl(path) {
  return `${OMNI_API}${path}?api_token=${getToken()}`;
}

// Chat API nova — chats, mensagens, envio
function chatUrl(path) {
  return `${CHAT_API}${path}`;
}

function bearerHeaders(contentType = 'application/json') {
  const h = { 'Authorization': `Bearer ${getToken()}` };
  if (contentType) h['Content-Type'] = contentType;
  return h;
}

// ─── Config ───────────────────────────────────────────────
export async function getConfig(req, res) {
  const token = getToken();
  if (!token) {
    return res.status(500).json({ error: 'THREECPLUS_MANAGER_TOKEN não configurado' });
  }
  res.json({ socketToken: token });
}

// ─── Chats (Chat API — Bearer) ───────────────────────────
export async function listarChatsFila(req, res, next) {
  try {
    const instanceId = req.query.instance_id || '';
    const query = instanceId ? `?instance_id=${instanceId}` : '';
    const response = await fetch(chatUrl(`/chats/queue${query}`), { headers: bearerHeaders() });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function obterChat(req, res, next) {
  try {
    const { chatId } = req.params;
    const response = await fetch(chatUrl(`/chats/${chatId}`), { headers: bearerHeaders() });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    next(error);
  }
}

// ─── Messages (Chat API — Bearer) ────────────────────────
export async function listarMensagens(req, res, next) {
  try {
    const { chatId } = req.params;
    const page = req.query.page || 1;
    const perPage = req.query.per_page || 50;

    // Strategy: try /message/{chatId}/history first, if empty try /message/search
    const histRes = await fetch(
      chatUrl(`/message/${chatId}/history?page=${page}&per_page=${perPage}`),
      { headers: bearerHeaders() }
    );
    const histData = await histRes.json();

    if (histData.data && histData.data.length > 0) {
      return res.json(histData);
    }

    // Fallback: use search with common vowels to get messages
    // This is a workaround because /history returns empty for active chats
    const chatRes = await fetch(chatUrl(`/chats/${chatId}`), { headers: bearerHeaders() });
    const chatData = await chatRes.json();
    const instanceId = chatData.data?.instance_id || chatData.data?.instance?.id || '';

    if (!instanceId) return res.json(histData); // return empty

    // Search with multiple common chars and merge (dedup by id)
    const allMessages = new Map();
    for (const term of ['a', 'e', 'o']) {
      try {
        const searchRes = await fetch(chatUrl('/message/search'), {
          method: 'POST',
          headers: bearerHeaders(),
          body: JSON.stringify({ chat_id: String(chatId), search: term, per_page: 100, instance_id: instanceId }),
        });
        const searchData = await searchRes.json();
        if (searchData.data && Array.isArray(searchData.data)) {
          for (const msg of searchData.data) {
            allMessages.set(msg.id, msg);
          }
        }
      } catch { /* skip */ }
    }

    const merged = Array.from(allMessages.values()).sort((a, b) => (a.time || 0) - (b.time || 0));
    console.log(`[3C+ Omni] Messages for chat ${chatId}: history=0, search=${merged.length}`);
    res.json({ ...histData, data: merged });
  } catch (error) {
    next(error);
  }
}

// ─── Helper: persistir mensagem enviada no banco ─────────
// Chamado depois que a 3C Plus confirma o envio (REST 200).
// Garante que mensagens enviadas sobrevivem ao F5 mesmo se o socket nao ecoar.
async function persistirMensagemEnviada(apiResponse, chatIdFallback, tipoOverride, extras = {}) {
  try {
    const sent = apiResponse?.data || apiResponse;
    if (!sent?.id) return;

    const mensagemExternaId = String(sent.id);
    const chatId = Number(sent.chat_id || chatIdFallback) || 0;
    const timestamp = sent.time || sent.time_whatsapp || Math.floor(Date.now() / 1000);

    // Canal whatsapp-3c NAO emite eco/ack via socket para mensagens enviadas.
    // Tratamos HTTP 200 do REST como confirmacao de entrega (ack = "device" = 2 tracos).
    // Nao temos "read" nesse canal — aceito pelo usuario.
    const ackInicial = sent.ack && sent.ack !== '' ? sent.ack : 'device';

    // Tracking de template: se a mensagem foi enviada a partir de um template
    // (mesmo que editada parcialmente), guardamos a referencia para futuras
    // analises de efetividade.
    const templateWhatsappId = Number.isFinite(Number(extras?.templateWhatsappId))
      ? Number(extras.templateWhatsappId)
      : null;
    const templateMetaId = extras?.templateMetaId || null;

    // Override defensivo de instanciaTipo: send_template e sempre WABA por
    // definicao (template Meta), mas a 3C Plus pode retornar instance.type=
    // whatsapp-3c quando o chat primario e 3C+. O caller pode forcar via extras.
    const instanciaTipoFinal = extras?.instanciaTipoOverride
      || sent.instance?.type
      || null;

    const mensagem = await prisma.mensagemWhatsapp.upsert({
      where: { mensagemExternaId },
      create: {
        mensagemExternaId,
        chatId,
        contatoNumero: sent.number || sent.to || '',
        contatoNome: null,
        contatoImagem: null,
        instanciaId: sent.instance?.id || sent.instance_id || '',
        instanciaNome: sent.instance?.name || null,
        instanciaTipo: instanciaTipoFinal,
        pessoaCodigo: null,
        tipo: tipoOverride || sent.type || 'chat',
        corpo: sent.body || null,
        mediaUrl: sent.media || null,
        mediaNome: sent.media_name || sent.media_original_name || null,
        transcricaoAudio: null,
        fromMe: true,
        de: sent.from || '',
        para: sent.to || sent.number || '',
        agenteId: sent.agent?.id || null,
        agenteNome: sent.agent?.name || sent.author || null,
        mensagemCitadaId: null,
        mensagemCitadaCorpo: null,
        ack: ackInicial,
        timestamp: new Date(timestamp * 1000),
        templateWhatsappId,
        templateMetaId,
      },
      update: ackInicial ? { ack: ackInicial } : {},
    });

    // Atualiza ConversaCobranca (preview + ultimaMensagemAgente)
    const chatData = {
      id: chatId,
      instance: sent.instance || { id: sent.instance_id },
      number: sent.number || sent.to || '',
      contact: { number: sent.number || sent.to || '' },
    };
    const msgData = {
      id: sent.id,
      body: sent.body,
      type: sent.type,
      fromMe: true,
      time: timestamp,
      instance_id: sent.instance_id,
      from: sent.from,
      to: sent.to,
    };
    const conversa = await upsertConversa({ chatData, messageData: msgData });

    // Broadcast pro frontend para atualizar UI imediatamente
    const io = getRealtimeIo();
    if (io) {
      io.emit('mensagem:nova', { mensagem, conversa });
      io.emit('conversa:atualizada', conversa);
    }

    console.log(`[Send] Mensagem ${mensagemExternaId.slice(0, 8)} enviada e persistida`);
  } catch (err) {
    console.warn('[Send] Falha ao persistir mensagem enviada:', err.message);
  }
}

// ─── Send Messages (Chat API — Bearer) ───────────────────
export async function enviarTexto(req, res, next) {
  try {
    const { chat_id, body, instance_id, templateWhatsappId } = req.body;
    if (!chat_id || !body) {
      return res.status(400).json({ error: 'chat_id e body são obrigatórios' });
    }

    const response = await fetch(chatUrl('/message/send_chat'), {
      method: 'POST',
      headers: bearerHeaders(),
      body: JSON.stringify({ chat_id, body, instance_id }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('[3C+ Chat API] send_chat falhou:', response.status, data);
      return res.status(response.status).json(data);
    }
    await persistirMensagemEnviada(data, chat_id, 'chat', { templateWhatsappId });
    res.json(data);
  } catch (error) {
    next(error);
  }
}

// Envio de template Meta WABA (fora da janela 24h ou primeira mensagem ao aluno).
// Diferente de enviarTexto: passa pelo endpoint /message/send_template da 3C Plus,
// que roteia para Meta Cloud API. Body precisa estar com variáveis ja resolvidas
// (substituidas com valores reais das variáveis).
export async function enviarTemplate(req, res, next) {
  try {
    const { chat_id, instance_id, template_meta_id, parametros } = req.body;
    if (!chat_id || !instance_id || !template_meta_id) {
      return res.status(400).json({
        error: 'chat_id, instance_id e template_meta_id sao obrigatorios',
      });
    }

    // Lookup do template local
    const tpl = await prisma.templateMeta.findUnique({ where: { id: template_meta_id } });
    if (!tpl) return res.status(404).json({ error: 'Template nao encontrado' });
    if (tpl.status !== 'APPROVED') {
      return res.status(400).json({
        error: `Template esta com status ${tpl.status}. Apenas APPROVED pode ser enviado.`,
      });
    }
    if (!tpl.metaTemplateId) {
      return res.status(400).json({ error: 'Template nao tem metaTemplateId — precisa ser sincronizado com Meta' });
    }

    // Resolve body com parametros: substitui {{1}}, {{2}}, ... pelos valores
    const bodyComp = (tpl.components || []).find(c => c.type === 'BODY' || c.type === 'body');
    if (!bodyComp || !bodyComp.text) {
      return res.status(400).json({ error: 'Template sem componente BODY' });
    }
    let bodyResolvido = bodyComp.text;
    for (const [k, v] of Object.entries(parametros || {})) {
      const re = new RegExp('\\{\\{\\s*' + k + '\\s*\\}\\}', 'g');
      bodyResolvido = bodyResolvido.replace(re, String(v));
    }

    // Sanity check: nenhuma variavel restante
    const variaveisRestantes = bodyResolvido.match(/\{\{\d+\}\}/g);
    if (variaveisRestantes && variaveisRestantes.length > 0) {
      return res.status(400).json({
        error: 'Variaveis nao preenchidas: ' + variaveisRestantes.join(', '),
      });
    }

    // Chama 3C Plus
    const response = await fetch(chatUrl('/message/send_template'), {
      method: 'POST',
      headers: bearerHeaders(),
      body: JSON.stringify({
        chat_id,
        instance_id,
        template_id: tpl.metaTemplateId,
        template_name: tpl.name,
        template_language: tpl.language,
        body: bodyResolvido,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('[3C+ Chat API] send_template falhou:', response.status, data);
      // Se 3C/Meta retornar 401, mapear pra 502 pra nao deslogar (mesmo padrao
      // do templatesMetaController).
      const isAuthErr = response.status === 401 || response.status === 403;
      const statusResp = isAuthErr ? 502 : response.status;
      return res.status(statusResp).json({
        error: data?.error?.error_user_msg || data?.error?.message || data?.detail || 'Erro ao enviar template',
        meta: data,
      });
    }

    await persistirMensagemEnviada(data, chat_id, 'chat', {
      templateMetaId: tpl.id,
      instanciaTipoOverride: 'waba',
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function enviarInterno(req, res, next) {
  try {
    const { chat_id, body } = req.body;
    if (!chat_id || !body) {
      return res.status(400).json({ error: 'chat_id e body são obrigatórios' });
    }

    const response = await fetch(chatUrl('/message/send_internal_chat'), {
      method: 'POST',
      headers: bearerHeaders(),
      body: JSON.stringify({ chat_id, body }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('[3C+ Chat API] send_internal falhou:', response.status, data);
      return res.status(response.status).json(data);
    }
    await persistirMensagemEnviada(data, chat_id, 'internal-message');
    res.json(data);
  } catch (error) {
    next(error);
  }
}

// Media uploads — Chat API com Bearer
// Node.js File() funciona com fetch nativo (Node 20+)
function sanitizarFilename(nome) {
  if (!nome) return 'arquivo';
  // Remove caracteres problematicos: espacos, parenteses, acentos, etc.
  // Mantem letras, numeros, underscores, hifens e o ponto da extensao.
  const ext = nome.lastIndexOf('.') !== -1 ? nome.slice(nome.lastIndexOf('.')) : '';
  const base = nome.slice(0, nome.length - ext.length);
  const cleanBase = base
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9_-]/g, '_')                   // substitui o resto por _
    .replace(/_+/g, '_')                                 // colapsa underscores
    .slice(0, 100);
  return (cleanBase || 'arquivo') + ext.toLowerCase();
}

function bufferToFile(buffer, filename, mimetype) {
  return new File([buffer], sanitizarFilename(filename), { type: mimetype });
}

export async function enviarImagem(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada' });

    const formData = new FormData();
    formData.append('image', bufferToFile(req.file.buffer, req.file.originalname, req.file.mimetype));
    formData.append('chat_id', req.body.chat_id);
    if (req.body.instance_id) formData.append('instance_id', req.body.instance_id);
    if (req.body.caption) formData.append('caption', req.body.caption);

    console.log('[3C+ Upload] Enviando imagem:', req.file.originalname, req.file.mimetype, req.file.size, 'bytes');

    const response = await fetch(chatUrl('/message/send_image'), {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: formData,
    });
    const text = await response.text();
    console.log('[3C+ Upload] Resposta send_image:', response.status, text);

    try {
      const data = JSON.parse(text);
      if (!response.ok) return res.status(response.status).json(data);
      await persistirMensagemEnviada(data, req.body.chat_id, 'image');
      res.json(data);
    } catch {
      if (!response.ok) return res.status(response.status).json({ error: text });
      res.json({ raw: text });
    }
  } catch (error) {
    next(error);
  }
}

export async function enviarAudio(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum áudio enviado' });

    const formData = new FormData();
    // 3C Plus espera .ogg para voice
    const filename = req.file.originalname.endsWith('.ogg') ? req.file.originalname : 'audio.ogg';
    formData.append('audio', bufferToFile(req.file.buffer, filename, 'audio/ogg'));
    formData.append('chat_id', req.body.chat_id);
    if (req.body.instance_id) formData.append('instance_id', req.body.instance_id);

    console.log('[3C+ Upload] Enviando áudio:', filename, req.file.size, 'bytes');

    const response = await fetch(chatUrl('/message/send_voice'), {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: formData,
    });
    const text = await response.text();
    console.log('[3C+ Upload] Resposta send_voice:', response.status, text);

    try {
      const data = JSON.parse(text);
      if (!response.ok) return res.status(response.status).json(data);
      await persistirMensagemEnviada(data, req.body.chat_id, 'voice');
      res.json(data);
    } catch {
      if (!response.ok) return res.status(response.status).json({ error: text });
      res.json({ raw: text });
    }
  } catch (error) {
    next(error);
  }
}

export async function enviarDocumento(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum documento enviado' });

    const formData = new FormData();
    formData.append('file', bufferToFile(req.file.buffer, req.file.originalname, req.file.mimetype));
    formData.append('chat_id', req.body.chat_id);
    if (req.body.instance_id) formData.append('instance_id', req.body.instance_id);
    if (req.body.caption) formData.append('caption', req.body.caption);

    console.log('[3C+ Upload] Enviando documento:', req.file.originalname, req.file.mimetype, req.file.size, 'bytes');

    const response = await fetch(chatUrl('/message/send_document'), {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: formData,
    });
    const text = await response.text();
    console.log('[3C+ Upload] Resposta send_document:', response.status, text);

    try {
      const data = JSON.parse(text);
      if (!response.ok) return res.status(response.status).json(data);
      await persistirMensagemEnviada(data, req.body.chat_id, 'document');
      res.json(data);
    } catch {
      if (!response.ok) return res.status(response.status).json({ error: text });
      res.json({ raw: text });
    }
  } catch (error) {
    next(error);
  }
}

// ─── Chat Actions (Chat API — Bearer) ────────────────────
export async function aceitarChat(req, res, next) {
  try {
    const { chatId } = req.params;
    const response = await fetch(chatUrl(`/chats/accept_queue/${chatId}`), {
      method: 'POST',
      headers: bearerHeaders(),
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function finalizarChat(req, res, next) {
  try {
    const { chatId } = req.params;
    const response = await fetch(chatUrl(`/chats/${chatId}/finish`), {
      method: 'POST',
      headers: bearerHeaders(),
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function transferirChat(req, res, next) {
  try {
    const { chatId } = req.params;
    const response = await fetch(chatUrl(`/chats/${chatId}/transfer`), {
      method: 'POST',
      headers: bearerHeaders(),
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

// ─── Config endpoints (Omni API legada — ?api_token=) ────
export async function listarAgentes(req, res, next) {
  try {
    const response = await fetch(omniUrl('/agents'), { method: 'GET' });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function listarEquipes(req, res, next) {
  try {
    const response = await fetch(omniUrl('/teams'), { method: 'GET' });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    next(error);
  }
}

// ─── Banco local: persistir e buscar mensagens ──────────
export async function persistirMensagem(req, res, next) {
  try {
    const msg = req.body;
    if (!msg.mensagemExternaId) {
      return res.status(400).json({ error: 'mensagemExternaId obrigatório' });
    }

    const result = await prisma.mensagemWhatsapp.upsert({
      where: { mensagemExternaId: msg.mensagemExternaId },
      create: {
        mensagemExternaId: msg.mensagemExternaId,
        chatId: Number(msg.chatId) || 0,
        contatoNumero: msg.contatoNumero || '',
        contatoNome: msg.contatoNome || null,
        contatoImagem: msg.contatoImagem || null,
        instanciaId: msg.instanciaId || '',
        instanciaNome: msg.instanciaNome || null,
        pessoaCodigo: msg.pessoaCodigo || null,
        tipo: msg.tipo || 'chat',
        corpo: msg.corpo || null,
        mediaUrl: msg.mediaUrl || null,
        mediaNome: msg.mediaNome || null,
        transcricaoAudio: null,
        fromMe: msg.fromMe ?? false,
        de: msg.de || '',
        para: msg.para || '',
        agenteId: msg.agenteId || null,
        agenteNome: msg.agenteNome || null,
        mensagemCitadaId: msg.mensagemCitadaId || null,
        mensagemCitadaCorpo: msg.mensagemCitadaCorpo || null,
        timestamp: new Date(msg.timestamp * 1000),
      },
      update: {}, // Don't update if exists (dedup)
    });
    res.json(result);
  } catch (error) {
    // Ignore unique constraint (already persisted)
    if (error.code === 'P2002') return res.json({ dedup: true });
    next(error);
  }
}

export async function buscarMensagensLocal(req, res, next) {
  try {
    const { chatId } = req.params;
    const mensagens = await prisma.mensagemWhatsapp.findMany({
      where: { chatId: Number(chatId) },
      orderBy: { timestamp: 'asc' },
      take: 200,
    });
    res.json({ data: mensagens });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/conversas/abrir-chat
 * Abre um novo chat WhatsApp com um numero.
 * Chama 3C Plus: POST /chats/open_new_chat { number, instance_id }
 */
export async function abrirChat(req, res, next) {
  try {
    const { number, instanceId } = req.body;

    if (!number) {
      return res.status(400).json({ error: 'number obrigatorio' });
    }

    // Formatar numero: garantir 55 + DDD + numero
    let telefone = number.replace(/\D/g, '');
    if (telefone.length === 11) telefone = '55' + telefone;
    if (telefone.length === 10) telefone = '55' + telefone;

    // Usar instanceId do request, ou descobrir automaticamente dos chats existentes
    let instancia = instanceId;

    if (!instancia) {
      try {
        const queueRes = await fetch(chatUrl('/chats/queue'), { headers: bearerHeaders() });
        if (queueRes.ok) {
          const queueData = await queueRes.json();
          const chats = queueData.data || [];
          if (chats.length > 0 && chats[0].instance_id) {
            instancia = chats[0].instance_id;
            console.log(`[Conversas] Instance auto-detectada: ${instancia}`);
          }
        }
      } catch { /* ignora */ }
    }

    if (!instancia) {
      return res.status(400).json({ error: 'Nao foi possivel determinar a instancia WhatsApp. Nenhum chat ativo encontrado.' });
    }

    const response = await fetch(chatUrl('/chats/open_new_chat'), {
      method: 'POST',
      headers: bearerHeaders(),
      body: JSON.stringify({ number: telefone, instance_id: instancia }),
    });

    const text = await response.text();

    if (!response.ok) {
      console.error('[Conversas] Erro ao abrir chat:', response.status, text);
      return res.status(response.status).json({ error: text });
    }

    const data = JSON.parse(text);
    console.log(`[Conversas] Chat aberto com ${telefone}:`, data.data?.id || data.id || 'sem id');

    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function buscarChatsLocal(req, res, next) {
  try {
    const instanceId = req.query.instance_id || '';
    const where = instanceId ? { instanciaId: instanceId } : {};

    // Buscar chats únicos com última mensagem
    const chats = instanceId
      ? await prisma.$queryRawUnsafe(`
          SELECT DISTINCT ON ("chatId")
            "chatId", "contatoNumero", "contatoNome", "contatoImagem",
            "instanciaId", "instanciaNome", "agenteId", "agenteNome",
            "tipo" as "ultimaMensagemTipo", "corpo" as "ultimaMensagem",
            EXTRACT(EPOCH FROM "timestamp")::integer as "ultimaMensagemData",
            "fromMe"
          FROM cobranca.mensagem_whatsapp
          WHERE "instanciaId" = $1
          ORDER BY "chatId", "timestamp" DESC
        `, instanceId)
      : await prisma.$queryRawUnsafe(`
          SELECT DISTINCT ON ("chatId")
            "chatId", "contatoNumero", "contatoNome", "contatoImagem",
            "instanciaId", "instanciaNome", "agenteId", "agenteNome",
            "tipo" as "ultimaMensagemTipo", "corpo" as "ultimaMensagem",
            EXTRACT(EPOCH FROM "timestamp")::integer as "ultimaMensagemData",
            "fromMe"
          FROM cobranca.mensagem_whatsapp
          ORDER BY "chatId", "timestamp" DESC
        `);
    res.json({ data: chats });
  } catch (error) {
    next(error);
  }
}
