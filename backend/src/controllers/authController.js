import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../config/database.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET nao configurado — defina no .env');
const JWT_EXPIRES_IN = '24h';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

function gerarToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function sanitizarUser(user) {
  const { threecplusAgentToken, ...safe } = user;
  return {
    ...safe,
    threecplusAgentToken: threecplusAgentToken ? '***' : null,
  };
}

/**
 * POST /api/auth/google
 * Recebe o credential (ID token) do Google Sign-In, verifica, e retorna JWT + user
 */
export async function loginGoogle(req, res, next) {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Token do Google não fornecido' });
    }

    // Verificar token do Google
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ error: 'Token do Google inválido' });
    }

    const { email, name, picture, sub: googleId } = payload;

    // Buscar usuario no banco por email
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(403).json({
        error: 'Usuário não cadastrado no sistema. Solicite ao administrador.',
      });
    }

    if (!user.ativo) {
      return res.status(403).json({ error: 'Usuário inativo. Contate o administrador.' });
    }

    // Atualizar googleId e avatar se necessario
    if (!user.googleId || !user.avatarUrl) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: user.googleId || googleId,
          avatarUrl: user.avatarUrl || picture,
          nome: user.nome || name,
        },
      });
    }

    const token = gerarToken(user);

    console.log(`[Auth] Login: ${user.nome} (${user.role})`);

    res.json({
      token,
      user: sanitizarUser(user),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/dev-login
 * Login de desenvolvimento sem Google (apenas em NODE_ENV=development)
 * Aceita email do usuario cadastrado
 */
export async function devLogin(req, res, next) {
  try {
    if (process.env.NODE_ENV !== 'development' || !process.env.NODE_ENV) {
      return res.status(404).json({ error: 'Rota não disponível' });
    }

    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'E-mail obrigatório' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(403).json({ error: 'Usuário não cadastrado' });
    if (!user.ativo) return res.status(403).json({ error: 'Usuário inativo' });

    const token = gerarToken(user);

    console.log(`[Auth] Dev login: ${user.nome} (${user.role})`);

    res.json({
      token,
      user: sanitizarUser(user),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/auth/me
 * Retorna dados do usuario logado (requer JWT)
 */
export async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (!user.ativo) return res.status(403).json({ error: 'Usuário inativo' });

    res.json(sanitizarUser(user));
  } catch (error) {
    next(error);
  }
}
