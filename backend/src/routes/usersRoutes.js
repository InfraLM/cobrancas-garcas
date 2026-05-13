import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
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

router.get('/', requireAuth, listar);
router.post('/whitelist/refresh', requireAuth, refreshWhitelist);
router.get('/instancias-whatsapp', requireAuth, getInstanciasWhatsapp);
router.get('/grupos-canais', requireAuth, getGruposCanais);
router.get('/campanhas', requireAuth, getCampanhas);
router.get('/buscar-agente-3cplus', requireAuth, buscarAgente);
router.get('/:id', requireAuth, obter);
router.post('/', requireAuth, criar);
router.put('/:id', requireAuth, atualizar);
router.delete('/:id', requireAuth, excluir);
router.get('/:id/campanhas', requireAuth, getCampanhasVinculadas);
router.post('/:id/campanhas/sync', requireAuth, syncCampanhas);
router.get('/:id/equipes', requireAuth, getEquipesVinculadas);
router.post('/:id/equipes/sync', requireAuth, syncEquipes);
router.post('/:id/criar-agente-3cplus', requireAuth, criarAgente);
router.post('/:id/coletar-token-3cplus', requireAuth, coletarToken);
router.post('/:id/vincular-agente-3cplus', requireAuth, vincularAgente);

// Instancias WhatsApp do user (N por user, pode compartilhar)
router.get('/:id/instancias', requireAuth, listarInstanciasUser);
router.post('/:id/instancias', requireAuth, adicionarInstancia);
router.put('/:id/instancias/:instanciaDbId', requireAuth, editarInstancia);
router.delete('/:id/instancias/:instanciaDbId', requireAuth, removerInstancia);

export default router;
