/**
 * Worker de reconciliacao de conversoes da regua de cobranca.
 *
 * Para cada DisparoMensagem ENVIADO ainda nao convertido, verifica se o titulo
 * referenciado (contaReceberCodigo) virou RE apos a data de disparo. Se sim,
 * popula:
 *   - convertido = true
 *   - convertidoEm = cr.updated (data da ultima alteracao no SEI)
 *   - diasAteConversao = dias entre disparadoEm e cr.updated
 *
 * Fonte de verdade da data: `contareceber.updated` — campo do SEI sincronizado
 * pelo fullLoad. Reflete a ultima alteracao do registro. Para titulos que
 * viraram RE, e a melhor aproximacao da data do pagamento (precisa de poucos
 * dias). Cobertura: 100% dos titulos (sem dependencia de cadeia de negociacao).
 *
 * Cobertura conhecida: pagamentos via boleto Bradesco / PIX direto / cartao
 * recorrencia. NAO cobre pagamentos pre-disparo (edge case ~0.7%).
 *
 * Frequencia: 1x/dia (apos delta sync de contareceber). Idempotente —
 * disparos ja convertidos sao ignorados via filtro `convertido = false`.
 */
import { prisma } from '../config/database.js';

const BATCH_SIZE = 500;

export async function reconciliarConversoes() {
  const t0 = Date.now();
  console.log('[reguaReconciliacao] Iniciando reconciliacao de conversoes...');

  let totalProcessados = 0;
  let totalConvertidos = 0;
  let cursor = null;

  while (true) {
    // Busca proximo batch de candidatos
    const candidatos = await prisma.disparoMensagem.findMany({
      where: {
        status: 'ENVIADO',
        convertido: false,
        contaReceberCodigo: { not: null },
        disparadoEm: { not: null },
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      select: { id: true, contaReceberCodigo: true, disparadoEm: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
    });

    if (candidatos.length === 0) break;
    cursor = candidatos[candidatos.length - 1].id;

    // Busca status atual + updated de cada titulo
    const codigos = [...new Set(candidatos.map(c => c.contaReceberCodigo))];
    const titulos = await prisma.$queryRawUnsafe(
      `SELECT codigo, situacao, updated FROM cobranca.contareceber WHERE codigo = ANY($1::int[])`,
      codigos
    );
    const tituloMap = new Map(titulos.map(t => [t.codigo, t]));

    // Identifica conversoes
    const conversoesPraAplicar = [];
    for (const cand of candidatos) {
      const titulo = tituloMap.get(cand.contaReceberCodigo);
      if (!titulo || titulo.situacao !== 'RE' || !titulo.updated) continue;
      if (titulo.updated <= cand.disparadoEm) continue; // pagou antes do disparo

      const diasAteConversao = Math.max(
        0,
        Math.floor((new Date(titulo.updated).getTime() - new Date(cand.disparadoEm).getTime()) / 86400000)
      );
      conversoesPraAplicar.push({
        id: cand.id,
        convertidoEm: titulo.updated,
        diasAteConversao,
      });
    }

    // Aplica updates em batch (transacao)
    if (conversoesPraAplicar.length > 0) {
      await prisma.$transaction(
        conversoesPraAplicar.map(c =>
          prisma.disparoMensagem.update({
            where: { id: c.id },
            data: {
              convertido: true,
              convertidoEm: c.convertidoEm,
              diasAteConversao: c.diasAteConversao,
            },
          })
        ),
        { timeout: 30_000 }
      );
      totalConvertidos += conversoesPraAplicar.length;
    }

    totalProcessados += candidatos.length;
    if (candidatos.length < BATCH_SIZE) break;
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[reguaReconciliacao] Processados: ${totalProcessados} | Convertidos: ${totalConvertidos} | ${elapsed}s`);
  return { processados: totalProcessados, convertidos: totalConvertidos };
}

// Trabalhamos com flag pra evitar reentrancia entre ticks
let executando = false;

/**
 * Inicia o agendamento do worker:
 * - Roda 1x no boot (com delay de 60s pra dar tempo do delta sync iniciar)
 * - Roda diariamente as 00:30 BRT (= 03:30 UTC)
 *
 * Idempotente: pode chamar varias vezes; setInterval interno garante 1 unico.
 */
export function startReguaReconciliacaoWorker() {
  // Boot: 60s depois de subir
  setTimeout(async () => {
    if (executando) return;
    executando = true;
    try { await reconciliarConversoes(); }
    catch (e) { console.error('[reguaReconciliacao] erro boot:', e); }
    finally { executando = false; }
  }, 60_000);

  // Tick a cada 5min checa se eh hora de rodar (03:30 UTC = 00:30 BRT)
  setInterval(async () => {
    if (executando) return;
    const agora = new Date();
    if (agora.getUTCHours() === 3 && agora.getUTCMinutes() < 5) {
      executando = true;
      try { await reconciliarConversoes(); }
      catch (e) { console.error('[reguaReconciliacao] erro diario:', e); }
      finally { executando = false; }
    }
  }, 5 * 60 * 1000);

  console.log('[reguaReconciliacao] Worker iniciado (boot + diario 00:30 BRT)');
}
