import { prisma } from '../config/database.js';
import { getRealtimeIo } from '../realtime.js';
import { sincronizarPausaPorEtapa } from '../services/pausaLigacaoService.js';

// -----------------------------------------------
// POST /api/webhooks/clicksign
// -----------------------------------------------
export async function clicksignWebhook(req, res, next) {
  try {
    // Retornar 200 imediatamente (ClickSign bloqueia apos falhas consecutivas)
    res.status(200).json({ received: true });

    const { event, document } = req.body;
    const eventName = event?.name;
    const documentKey = document?.key;

    if (!eventName || !documentKey) {
      console.warn('[Webhook ClickSign] Payload incompleto:', JSON.stringify(req.body).slice(0, 200));
      return;
    }

    console.log(`[Webhook ClickSign] Evento: ${eventName} | Document: ${documentKey}`);

    // Salvar evento (idempotente)
    const eventoId = `${documentKey}_${eventName}_${Date.now()}`;
    try {
      await prisma.webhookEvent.create({
        data: {
          origem: 'CLICKSIGN',
          eventoTipo: eventName,
          eventoId,
          payload: req.body,
        },
      });
    } catch (e) {
      if (e.code === 'P2002') return; // duplicado
      console.error('[Webhook ClickSign] Erro ao salvar evento:', e.message);
    }

    // Buscar acordo vinculado pelo documentId
    const acordo = await prisma.acordoFinanceiro.findFirst({
      where: {
        OR: [
          { clicksignDocumentId: documentKey },
          { clicksignEnvelopeId: documentKey },
        ],
      },
    });

    if (!acordo) {
      console.warn(`[Webhook ClickSign] Nenhum acordo para document ${documentKey}`);
      return;
    }

    // Processar evento
    switch (eventName) {
      case 'sign': {
        console.log(`[Webhook ClickSign] Assinatura recebida para acordo ${acordo.id}`);
        // Broadcast para frontend
        try {
          getRealtimeIo().emit('acordo:atualizado', {
            acordoId: acordo.id,
            evento: 'sign',
          });
        } catch {}
        break;
      }

      case 'auto_close':
      case 'close':
      case 'document_closed': {
        // Documento finalizado — termo assinado
        const urlAssinado = document?.downloads?.signed_file_url || null;

        // Baixar PDF assinado da URL temporaria do S3
        let pdfAssinado = null;
        if (urlAssinado) {
          try {
            const pdfRes = await fetch(urlAssinado);
            if (pdfRes.ok) {
              const arrayBuffer = await pdfRes.arrayBuffer();
              pdfAssinado = Buffer.from(arrayBuffer);
              console.log(`[Webhook ClickSign] PDF assinado baixado (${pdfAssinado.length} bytes)`);
            }
          } catch (e) {
            console.warn('[Webhook ClickSign] Erro ao baixar PDF:', e.message);
          }
        }

        // Atualizar acordo: marcar assinado + avancar etapa
        await prisma.acordoFinanceiro.update({
          where: { id: acordo.id },
          data: {
            termoAssinadoEm: new Date(),
            etapa: 'ACORDO_GERADO',
            acordoGeradoEm: new Date(),
          },
        });

        await sincronizarPausaPorEtapa({
          acordoId: acordo.id,
          etapa: 'ACORDO_GERADO',
          pessoaCodigo: acordo.pessoaCodigo,
          pessoaNome: acordo.pessoaNome,
        });

        // Atualizar documento com PDF
        await prisma.documento.updateMany({
          where: { acordoId: acordo.id },
          data: {
            situacao: 'ASSINADO',
            assinadoEm: new Date(),
            urlAssinado,
            ...(pdfAssinado && { pdfAssinado }),
          },
        });

        console.log(`[Webhook ClickSign] Termo ASSINADO + etapa ACORDO_GERADO para acordo ${acordo.id}`);

        // Registrar ocorrencia
        try {
          await prisma.ocorrencia.create({
            data: {
              tipo: 'NEGOCIACAO_TERMO_ASSINADO',
              descricao: 'Termo de negociação assinado pelo aluno',
              origem: 'WEBHOOK_CLICKSIGN',
              pessoaCodigo: acordo.pessoaCodigo,
              pessoaNome: acordo.pessoaNome,
              acordoId: acordo.id,
            },
          });
        } catch {}

        // Broadcast para frontend
        try {
          getRealtimeIo().emit('acordo:atualizado', {
            acordoId: acordo.id,
            evento: 'document_closed',
            etapa: 'ACORDO_GERADO',
          });
        } catch {}
        break;
      }

      case 'refusal': {
        await prisma.documento.updateMany({
          where: { acordoId: acordo.id },
          data: { situacao: 'RECUSADO' },
        });
        console.log(`[Webhook ClickSign] Termo RECUSADO para acordo ${acordo.id}`);

        try {
          getRealtimeIo().emit('acordo:atualizado', {
            acordoId: acordo.id,
            evento: 'refusal',
          });
        } catch {}
        break;
      }

      case 'deadline': {
        await prisma.documento.updateMany({
          where: { acordoId: acordo.id },
          data: { situacao: 'EXPIRADO' },
        });
        console.log(`[Webhook ClickSign] Prazo EXPIRADO para acordo ${acordo.id}`);

        try {
          getRealtimeIo().emit('acordo:atualizado', {
            acordoId: acordo.id,
            evento: 'deadline',
          });
        } catch {}
        break;
      }

      default:
        console.log(`[Webhook ClickSign] Evento nao tratado: ${eventName}`);
    }
  } catch (error) {
    console.error('[Webhook ClickSign] Erro:', error.message);
  }
}

// -----------------------------------------------
// POST /api/webhooks/asaas
// -----------------------------------------------
export async function asaasWebhook(req, res, next) {
  try {
    // Retornar 200 imediatamente
    res.status(200).json({ received: true });

    // Validar token
    const token = req.headers['asaas-access-token'];
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
    if (expectedToken && token !== expectedToken) {
      console.warn('[Webhook Asaas] Token invalido, ignorando');
      return;
    }

    const { event, payment } = req.body;

    if (!event || !payment) {
      console.warn('[Webhook Asaas] Payload incompleto');
      return;
    }

    console.log(`[Webhook Asaas] Evento: ${event} | Payment: ${payment.id}`);

    // Filtrar: so processar pagamentos do nosso sistema (tem externalReference = acordoId)
    if (!payment.externalReference) {
      console.log(`[Webhook Asaas] Pagamento ${payment.id} sem externalReference, ignorando`);
      return;
    }

    // Salvar evento (idempotente)
    const eventoId = `${payment.id}_${event}`;
    try {
      await prisma.webhookEvent.create({
        data: {
          origem: 'ASAAS',
          eventoTipo: event,
          eventoId,
          acordoId: payment.externalReference,
          payload: req.body,
        },
      });
    } catch (e) {
      if (e.code === 'P2002') {
        console.log(`[Webhook Asaas] Evento duplicado ${eventoId}, ignorando`);
        return;
      }
    }

    // Buscar pagamento no banco pelo asaasPaymentId
    const pagamento = await prisma.pagamentoAcordo.findFirst({
      where: { asaasPaymentId: payment.id },
    });

    if (!pagamento) {
      console.warn(`[Webhook Asaas] Nenhum pagamento encontrado para ${payment.id}`);
      return;
    }

    const acordoId = pagamento.acordoId;

    switch (event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED': {
        // Marcar pagamento como confirmado
        await prisma.pagamentoAcordo.update({
          where: { id: pagamento.id },
          data: {
            situacao: 'CONFIRMADO',
            dataPagamento: payment.paymentDate ? new Date(payment.paymentDate) : new Date(),
            valorPago: payment.value ? Number(payment.value) : Number(pagamento.valor),
            valorLiquido: payment.netValue ? Number(payment.netValue) : null,
            taxaAsaas: payment.value && payment.netValue ? Number(payment.value) - Number(payment.netValue) : null,
          },
        });

        console.log(`[Webhook Asaas] Pagamento ${payment.id} CONFIRMADO`);

        // Registrar ocorrencia de pagamento
        try {
          const valor = payment.value ? Number(payment.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';
          await prisma.ocorrencia.create({
            data: {
              tipo: 'NEGOCIACAO_PAGAMENTO_CONFIRMADO',
              descricao: `Pagamento confirmado ${valor}`,
              origem: 'WEBHOOK_ASAAS',
              pessoaCodigo: (await prisma.acordoFinanceiro.findUnique({ where: { id: acordoId }, select: { pessoaCodigo: true, pessoaNome: true } }))?.pessoaCodigo || 0,
              pessoaNome: (await prisma.acordoFinanceiro.findUnique({ where: { id: acordoId }, select: { pessoaNome: true } }))?.pessoaNome,
              acordoId,
              webhookEventId: eventoId,
            },
          });
        } catch {}

        // Verificar se TODOS os pagamentos do acordo estao confirmados
        const todosOsPagamentos = await prisma.pagamentoAcordo.findMany({
          where: { acordoId },
        });
        const todosConfirmados = todosOsPagamentos.every(p => p.situacao === 'CONFIRMADO');

        if (todosConfirmados) {
          // Defesa: se o acordo foi CANCELADO pelo agente entre o pagamento
          // e este webhook, NAO ressuscita o acordo. Registra ocorrencia para
          // o time financeiro decidir manualmente o que fazer com o valor.
          const estadoAtual = await prisma.acordoFinanceiro.findUnique({
            where: { id: acordoId },
            select: { etapa: true, pessoaCodigo: true, pessoaNome: true },
          });
          if (estadoAtual?.etapa === 'CANCELADO') {
            console.warn(`[Webhook Asaas] Pagamento confirmado em acordo ${acordoId} CANCELADO — ignorado, sem ressuscitar`);
            try {
              await prisma.ocorrencia.create({
                data: {
                  tipo: 'WEBHOOK_PAGAMENTO_RESIDUAL',
                  descricao: 'Pagamento confirmado em acordo cancelado — verifique manualmente',
                  origem: 'WEBHOOK_ASAAS',
                  pessoaCodigo: estadoAtual.pessoaCodigo,
                  pessoaNome: estadoAtual.pessoaNome,
                  acordoId,
                  webhookEventId: eventoId,
                },
              });
            } catch {}
            return;
          }

          // Mover acordo para CONCLUIDO. concluidoEm registra o instante real
          // da conclusao — usado no funil historico do dashboard.
          const acordoConcluido = await prisma.acordoFinanceiro.update({
            where: { id: acordoId },
            data: { etapa: 'CONCLUIDO', concluidoEm: new Date() },
          });
          console.log(`[Webhook Asaas] Todos os pagamentos confirmados — acordo ${acordoId} CONCLUIDO`);

          await sincronizarPausaPorEtapa({
            acordoId,
            etapa: 'CONCLUIDO',
            pessoaCodigo: acordoConcluido.pessoaCodigo,
            pessoaNome: acordoConcluido.pessoaNome,
          });

          // Ocorrencia de conclusao
          try {
            await prisma.ocorrencia.create({
              data: {
                tipo: 'NEGOCIACAO_CONCLUIDA',
                descricao: 'Negociação concluída — todos os pagamentos confirmados',
                origem: 'WEBHOOK_ASAAS',
                pessoaCodigo: acordoConcluido.pessoaCodigo,
                pessoaNome: acordoConcluido.pessoaNome,
                acordoId,
              },
            });
          } catch {}

          // Se acordo tinha vincularRecorrencia, criar card de recorrencia
          if (acordoConcluido.vincularRecorrencia) {
            const jaExiste = await prisma.cadastroRecorrencia.findFirst({
              where: { acordoId, etapa: { in: ['PENDENTE', 'MONITORANDO'] } },
            });
            if (!jaExiste) {
              await prisma.cadastroRecorrencia.create({
                data: {
                  pessoaCodigo: acordoConcluido.pessoaCodigo,
                  pessoaNome: acordoConcluido.pessoaNome,
                  pessoaCpf: acordoConcluido.pessoaCpf,
                  matricula: acordoConcluido.matricula,
                  celularAluno: acordoConcluido.celularAluno,
                  origem: 'NEGOCIACAO',
                  acordoId,
                  criadoPor: acordoConcluido.criadoPor,
                  criadoPorNome: acordoConcluido.criadoPorNome,
                  observacao: 'Criado automaticamente — negociação condicionada à recorrência',
                },
              });
              console.log(`[Webhook Asaas] Card de recorrencia criado para ${acordoConcluido.pessoaNome}`);
            }
          }
        } else {
          // Atualizar para CHECANDO_PAGAMENTO se ainda nao esta
          const acordo = await prisma.acordoFinanceiro.findUnique({ where: { id: acordoId } });
          if (acordo && !['CHECANDO_PAGAMENTO', 'CONCLUIDO'].includes(acordo.etapa)) {
            await prisma.acordoFinanceiro.update({
              where: { id: acordoId },
              data: { etapa: 'CHECANDO_PAGAMENTO' },
            });
            await sincronizarPausaPorEtapa({
              acordoId,
              etapa: 'CHECANDO_PAGAMENTO',
              pessoaCodigo: acordo.pessoaCodigo,
              pessoaNome: acordo.pessoaNome,
            });
          }
        }

        // Broadcast realtime
        try {
          getRealtimeIo().emit('acordo:atualizado', { acordoId, evento: event });
        } catch {}
        break;
      }

      case 'PAYMENT_OVERDUE': {
        await prisma.pagamentoAcordo.update({
          where: { id: pagamento.id },
          data: { situacao: 'VENCIDO' },
        });
        console.log(`[Webhook Asaas] Pagamento ${payment.id} VENCIDO`);

        try {
          getRealtimeIo().emit('acordo:atualizado', { acordoId, evento: event });
        } catch {}
        break;
      }

      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_DELETED': {
        await prisma.pagamentoAcordo.update({
          where: { id: pagamento.id },
          data: { situacao: 'CANCELADO' },
        });
        console.log(`[Webhook Asaas] Pagamento ${payment.id} CANCELADO/ESTORNADO`);

        try {
          getRealtimeIo().emit('acordo:atualizado', { acordoId, evento: event });
        } catch {}
        break;
      }

      default:
        console.log(`[Webhook Asaas] Evento nao tratado: ${event}`);
    }
  } catch (error) {
    console.error('[Webhook Asaas] Erro:', error.message);
  }
}
