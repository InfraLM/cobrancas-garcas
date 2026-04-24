import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listar,
  obter,
  criar,
  atualizar,
  remover,
  fontes,
  gerarPreview,
} from '../controllers/templatesBlipController.js';

const router = Router();

router.use(requireAuth);

// ordem importa: /fontes tem que vir antes do /:id
router.get('/fontes', fontes);
router.get('/', listar);
router.get('/:id', obter);
router.post('/', criar);
router.put('/:id', atualizar);
router.delete('/:id', remover);
router.post('/:id/preview', gerarPreview);

export default router;
