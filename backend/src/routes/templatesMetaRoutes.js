import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listar,
  obter,
  criar,
  atualizar,
  submeter,
  deletar,
  sincronizar,
} from '../controllers/templatesMetaController.js';

const router = Router();

router.use(requireAuth);

router.get('/', listar);
router.post('/sync', sincronizar);            // POST /api/templates-meta/sync — puxa estado da Meta
router.get('/:id', obter);
router.post('/', criar);
router.put('/:id', atualizar);
router.post('/:id/submeter', submeter);       // POST /api/templates-meta/:id/submeter — envia para Meta
router.delete('/:id', deletar);

export default router;
