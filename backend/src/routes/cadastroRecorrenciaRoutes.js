import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listar,
  obter,
  criar,
  definirMetodo,
  atualizarEtapa,
  cancelar,
} from '../controllers/cadastroRecorrenciaController.js';

const router = Router();

router.get('/', requireAuth, listar);
router.get('/:id', requireAuth, obter);
router.post('/', requireAuth, criar);
router.put('/:id/metodo', requireAuth, definirMetodo);
router.put('/:id/etapa', requireAuth, atualizarEtapa);
router.delete('/:id', requireAuth, cancelar);

export default router;
