/**
 * Handler de eventos WhatsApp vindos do Socket 3C Plus.
 *
 * Fluxo:
 * 1. Recebe payload bruto do evento new-message-whatsapp
 * 2. Persiste em mensagem_whatsapp (dedup por mensagemExternaId)
 * 3. Upsert da ConversaCobranca (enriquecimento + estado)
 * 4. Emite via Socket.io interno para browsers conectados
 */

import { prisma } from '../../config/database.js';
import { upsertConversa } from '../../services/conversaCobrancaService.js';
import { getRealtimeIo } from '../../realtime.js';
import {
  isInstanciaNossa,
  registrarRecebido,
  registrarProcessado,
  registrarFiltrado,
} from '../../services/threecplusWhitelist.js';

export async function onNovaMensagemWhatsapp(payload) {
  try {
    registrarRecebido();
    const chatData = payload?.chat || {};
    const msgData = payload?.message || {};

    // Extrai identidade da instancia — usado tanto pro log "instancia vista"
    // (ANTES do filtro, ajuda admin a descobrir ids reais) quanto pro filtro.
    const instanciaId =
      chatData?.instance?.id ||
      msgData?.instance_id ||
      chatData?.instance_id ||
      null;
    const instanciaNome = chatData?.instance?.name || null;
    const instanciaTelefone = chatData?.instance?.phone || null;

    if (instanciaId) {
      console.log(
        `[Whatsapp] 📬 Instancia vista: id=${instanciaId} nome="${instanciaNome || '-'}" telefone=${instanciaTelefone || '-'}`
      );
    }

    // Filtra por instancia — so processa mensagens das instancias WhatsApp
    // vinculadas a users do nosso time. 3C Plus usa token de gestor, o que
    // deixa o backend ouvir TODAS as instancias da empresa.
    if (!instanciaId || !isInstanciaNossa(instanciaId)) {
      registrarFiltrado();
      return;
    }
    registrarProcessado();

    const mensagemExternaId = String(msgData.id || msgData.internal_id || '');

    // Evento de abertura de chat (new-agent-chat-whatsapp) — sem message, so chat
    if (!mensagemExternaId && chatData.id) {
      console.log(`[Worker/WhatsApp] Chat aberto sem mensagem — chatId=${chatData.id}, criando ConversaCobranca`);
      const conversa = await upsertConversa({
        chatData: {
          id: chatData.id,
          contact: chatData.contact,
          instance_id: chatData.instance_id || chatData.instance?.id,
          number: chatData.number,
        },
        messageData: null,
      });
      if (conversa) {
        const io = getRealtimeIo();
        if (io) io.emit('conversa:atualizada', conversa);
      }
      return;
    }

    if (!mensagemExternaId) {
      return;
    }

    const ackNovo = msgData.ack || null;

    // Diagnostico: verificar se mensagem ja existia (ack update) antes do upsert
    const anterior = await prisma.mensagemWhatsapp.findUnique({
      where: { mensagemExternaId },
      select: { ack: true },
    });

    const ackAnterior = anterior?.ack ?? null;
    const jaExistia = anterior !== null;
    const fromMe = Boolean(msgData.fromMe ?? msgData.from_me ?? false);

    if (jaExistia) {
      console.log(`[ACK] msg ${mensagemExternaId.slice(0, 8)} — ja existia | ack: ${JSON.stringify(ackAnterior)} → ${JSON.stringify(ackNovo)} | fromMe=${fromMe}`);
    } else {
      console.log(`[ACK] msg ${mensagemExternaId.slice(0, 8)} — NOVA | ack: ${JSON.stringify(ackNovo)} | fromMe=${fromMe}`);
    }

    // 1. Persistir mensagem (dedup + atualizar ack)
    const mensagem = await prisma.mensagemWhatsapp.upsert({
      where: { mensagemExternaId },
      create: {
        mensagemExternaId,
        chatId: Number(chatData.id) || 0,
        contatoNumero: chatData.contact?.number || chatData.number || '',
        contatoNome: chatData.contact?.name || null,
        contatoImagem: chatData.contact?.image || null,
        instanciaId: chatData.instance?.id || msgData.instance_id || '',
        instanciaNome: chatData.instance?.name || null,
        pessoaCodigo: null,
        tipo: msgData.type || 'chat',
        corpo: msgData.body || null,
        mediaUrl: msgData.media || null,
        mediaNome: msgData.media_name || msgData.media_original_name || null,
        transcricaoAudio: msgData.audio_transcription || null,
        fromMe,
        de: msgData.from || '',
        para: msgData.to || '',
        agenteId: msgData.agent?.id || msgData.agent_id || null,
        agenteNome: msgData.agent?.name || msgData.author || null,
        mensagemCitadaId: msgData.quoted_msg?.id || null,
        mensagemCitadaCorpo: msgData.quoted_msg?.body || null,
        ack: ackNovo,
        timestamp: new Date((msgData.time || msgData.time_whatsapp || Date.now() / 1000) * 1000),
      },
      // Update: so atualiza ack (progride: null → device → read)
      update: ackNovo ? { ack: ackNovo } : {},
    });

    // 2. Upsert ConversaCobranca
    const conversa = await upsertConversa({ chatData, messageData: msgData });

    // 3. Broadcast para browsers via Socket.io interno
    const io = getRealtimeIo();
    if (io) {
      io.emit('mensagem:nova', { mensagem, conversa });
      io.emit('conversa:atualizada', conversa);
    }

    // 4. Registrar ocorrencia (apenas mensagens recebidas, para nao poluir)
    if (msgData.direcao === 'received' && conversa.pessoaCodigo) {
      try {
        await prisma.ocorrencia.create({
          data: {
            tipo: 'WHATSAPP_RECEBIDO',
            descricao: msgData.tipo === 'text' ? `Mensagem recebida: "${(msgData.body || '').slice(0, 60)}"` : `Mídia recebida (${msgData.tipo})`,
            origem: 'SOCKET_3CPLUS',
            pessoaCodigo: conversa.pessoaCodigo,
            pessoaNome: conversa.contatoNome,
            mensagemWhatsappId: mensagem.id,
          },
        });
      } catch {}
    }

    console.log(`[Worker/WhatsApp] Mensagem ${mensagem.id.slice(0, 8)} persistida | Conversa ${conversa.id.slice(0, 8)} status=${conversa.status}`);
  } catch (error) {
    console.error('[Worker/WhatsApp] Erro ao processar mensagem:', error);
  }
}
