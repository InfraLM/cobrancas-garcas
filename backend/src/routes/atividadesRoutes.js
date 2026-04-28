import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listar, criar, atualizar, concluir, cancelar, resumo } from '../controllers/atividadesController.js';

const router = Router();

router.get('/', requireAuth, listar);
router.get('/resumo', requireAuth, resumo);
router.post('/', requireAuth, criar);
router.patch('/:id', requireAuth, atualizar);
router.post('/:id/concluir', requireAuth, concluir);
router.delete('/:id', requireAuth, cancelar);

export default router;
