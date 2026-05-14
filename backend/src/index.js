import { createServer } from 'http';
import app from './app.js';
import { setupRealtime } from './realtime.js';
import { startSocketWorker } from './workers/socket3cplusWorker.js';
import { runDeltaSync } from './sync/deltaSync.js';
import { startReguaScheduler } from './services/reguaSchedulerService.js';
import { startReguaWorker } from './services/reguaWorkerService.js';
import { startReguaReconciliacaoWorker } from './services/reguaReconciliacaoService.js';
import { startSnapshotScheduler } from './services/snapshotService.js';
import { sincronizarStatus as sincronizarTemplatesMeta } from './services/metaTemplatesService.js';

const PORT = process.env.PORT || 3001;
const DELTA_SYNC_INTERVAL = 10 * 60 * 1000; // 10 minutos
const META_TEMPLATES_SYNC_INTERVAL = 30 * 60 * 1000; // 30 minutos

// HTTP server (necessario para anexar Socket.io)
const httpServer = createServer(app);

// Socket.io interno (backend → browsers) em /ws
setupRealtime(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);

  // Worker 24/7 conectado ao socket.3c.plus
  startSocketWorker().catch(err => console.error('[Worker] Erro no start:', err.message));

  // Delta Sync SEI — roda a cada 10 minutos (d-1 para seguranca)
  console.log(`[DeltaSync] Agendado a cada ${DELTA_SYNC_INTERVAL / 60000} minutos`);
  runDeltaSync(); // sync imediato ao iniciar
  setInterval(() => {
    runDeltaSync().catch(err => console.error('[DeltaSync] Erro:', err.message));
  }, DELTA_SYNC_INTERVAL);

  // Scheduler de reguas (1x/dia no horario configurado) + worker de disparo continuo
  startReguaScheduler();
  startReguaWorker();

  // Worker de reconciliacao de conversoes (boot + diario 00:30 BRT)
  // Popula DisparoMensagem.convertido / convertidoEm / diasAteConversao
  // baseado em contareceber.updated > disparadoEm AND situacao = 'RE'.
  startReguaReconciliacaoWorker();

  // Snapshot diario da inadimplencia (foto historica da base do funil)
  startSnapshotScheduler().catch(err => console.error('[Snapshot] Erro no start:', err.message));

  // Cron de fallback: sincroniza status dos templates Meta a cada 30min.
  // Cobre casos onde o webhook Meta nao chegou (rede, deploy, etc.).
  // Nao roda imediatamente — primeiro tick em 30min para nao competir com
  // o sync inicial que o user pode disparar manualmente apos deploy.
  //
  // Lock de reentrancia (metaSyncEmAndamento): se o tick anterior ainda
  // executa quando o intervalo dispara, pula. Padrao identico aos outros
  // daemons (reguaScheduler, snapshot, deltaSync).
  if (process.env.META_ACCESS_TOKEN && process.env.META_WABA_ID) {
    console.log(`[MetaTemplatesSync] Agendado a cada ${META_TEMPLATES_SYNC_INTERVAL / 60000} minutos`);
    let metaSyncEmAndamento = false;
    setInterval(async () => {
      if (metaSyncEmAndamento) {
        console.warn('[MetaTemplatesSync] Sync anterior ainda em andamento — pulando este ciclo');
        return;
      }
      metaSyncEmAndamento = true;
      try {
        const r = await sincronizarTemplatesMeta();
        console.log('[MetaTemplatesSync] OK:', r);
      } catch (err) {
        console.error('[MetaTemplatesSync] Erro:', err.message);
      } finally {
        metaSyncEmAndamento = false;
      }
    }, META_TEMPLATES_SYNC_INTERVAL);
  } else {
    console.log('[MetaTemplatesSync] Desativado (META_ACCESS_TOKEN ou META_WABA_ID nao configurados)');
  }
});
