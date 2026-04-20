import { createServer } from 'http';
import app from './app.js';
import { setupRealtime } from './realtime.js';
import { startSocketWorker } from './workers/socket3cplusWorker.js';
import { runDeltaSync } from './sync/deltaSync.js';

const PORT = process.env.PORT || 3001;
const DELTA_SYNC_INTERVAL = 10 * 60 * 1000; // 10 minutos

// HTTP server (necessario para anexar Socket.io)
const httpServer = createServer(app);

// Socket.io interno (backend → browsers) em /ws
setupRealtime(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);

  // Worker 24/7 conectado ao socket.3c.plus
  startSocketWorker();

  // Delta Sync SEI — roda a cada 10 minutos (d-1 para seguranca)
  console.log(`[DeltaSync] Agendado a cada ${DELTA_SYNC_INTERVAL / 60000} minutos`);
  runDeltaSync(); // sync imediato ao iniciar
  setInterval(() => {
    runDeltaSync().catch(err => console.error('[DeltaSync] Erro:', err.message));
  }, DELTA_SYNC_INTERVAL);
});
