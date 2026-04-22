import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listar,
  obter,
  criar,
  atualizar,
  remover,
} from '../controllers/templatesWhatsappController.js';

const router = Router();

router.use(requireAuth);

router.get('/', listar);
router.get('/:id', obter);
router.post('/', criar);
router.put('/:id', atualizar);
router.delete('/:id', remover);

export default router;
