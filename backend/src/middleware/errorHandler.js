import { prisma } from '../config/database.js';

export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Erro interno do servidor';

  const logEntry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    status,
    error: message,
    stack: err.stack?.split('\n').slice(0, 5).join('\n'),
    userId: req.user?.id || null,
  };

  console.error(`[ERROR] ${req.method} ${req.originalUrl} → ${status}: ${message}`);

  // Salvar no banco (async, nao bloqueia a resposta)
  prisma.errorLog.create({ data: {
    metodo: req.method,
    url: req.originalUrl,
    status,
    mensagem: message,
    stack: err.stack?.slice(0, 2000) || null,
    userId: req.user?.id || null,
  }}).catch(() => {});

  const isDev = process.env.NODE_ENV === 'development';
  res.status(status).json({
    error: isDev ? message : 'Erro interno do servidor',
  });
}
