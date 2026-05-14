import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  listar, obter, criar, atualizar, excluir,
  criarAgente, coletarToken, vincularAgente, buscarAgente,
  getInstanciasWhatsapp, getGruposCanais, getCampanhas,
  getCampanhasVinculadas, syncCampanhas,
  getEquipesVinculadas, syncEquipes,
  listarInstanciasUser, adicionarInstancia, editarInstancia, removerInstancia,
  refreshWhitelist,
} from '../controllers/usersController.js';

const router = Router();

// Endpoints de discovery 3C Plus (listagens read-only): qualquer usuario logado.
router.get('/instancias-whatsapp', requireAuth, getInstanciasWhatsapp);
router.get('/grupos-canais', requireAuth, getGruposCanais);
router.get('/campanhas', requireAuth, getCampanhas);
router.post('/whitelist/refresh', requireAuth, refreshWhitelist); // check inline de ADMIN no controller

// Gestao de usuarios: apenas ADMIN.
router.get('/', requireAuth, requireRole('ADMIN'), listar);
router.get('/buscar-agente-3cplus', requireAuth, requireRole('ADMIN'), buscarAgente);
router.get('/:id', requireAuth, requireRole('ADMIN'), obter);
router.post('/', requireAuth, requireRole('ADMIN'), criar);
router.put('/:id', requireAuth, requireRole('ADMIN'), atualizar);
router.delete('/:id', requireAuth, requireRole('ADMIN'), excluir);
router.get('/:id/campanhas', requireAuth, requireRole('ADMIN'), getCampanhasVinculadas);
router.post('/:id/campanhas/sync', requireAuth, requireRole('ADMIN'), syncCampanhas);
router.get('/:id/equipes', requireAuth, requireRole('ADMIN'), getEquipesVinculadas);
router.post('/:id/equipes/sync', requireAuth, requireRole('ADMIN'), syncEquipes);
router.post('/:id/criar-agente-3cplus', requireAuth, requireRole('ADMIN'), criarAgente);
router.post('/:id/coletar-token-3cplus', requireAuth, requireRole('ADMIN'), coletarToken);
router.post('/:id/vincular-agente-3cplus', requireAuth, requireRole('ADMIN'), vincularAgente);

// Instancias WhatsApp do user (N por user, pode compartilhar)
router.get('/:id/instancias', requireAuth, requireRole('ADMIN'), listarInstanciasUser);
router.post('/:id/instancias', requireAuth, requireRole('ADMIN'), adicionarInstancia);
router.put('/:id/instancias/:instanciaDbId', requireAuth, requireRole('ADMIN'), editarInstancia);
router.delete('/:id/instancias/:instanciaDbId', requireAuth, requireRole('ADMIN'), removerInstancia);

export default router;
