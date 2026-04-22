import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Security headers
app.use(helmet({ contentSecurityPolicy: false })); // CSP desabilitado pois frontend e separado

// CORS restritivo
const isDev = process.env.NODE_ENV === 'development';
const ALLOWED_ORIGINS = [
  ...(isDev ? ['http://localhost:5173', 'http://localhost:3000'] : []),
  'https://cobranca.lmedu.com.br',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sem origin (mobile apps, Postman, webhooks)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error('Bloqueado por CORS'));
  },
  credentials: true,
}));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 tentativas de login
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 200, // 200 requests por minuto
  message: { error: 'Limite de requisições excedido.' },
});

app.use(express.json({ limit: '10mb' }));

// Rate limits
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// Todas as rotas ficam sob /api
app.use('/api', routes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Qualquer acesso que nao seja /api/* redireciona para o frontend.
// Evita expor a API para quem tentar acessar o dominio do backend no browser.
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://cobranca.lmedu.com.br';
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.redirect(302, FRONTEND_URL);
});

// Error handler global (deve ser o ultimo middleware)
app.use(errorHandler);

export default app;
