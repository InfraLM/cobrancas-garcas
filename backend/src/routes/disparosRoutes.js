import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  historico,
  prever,
  dispararAgora,
  status,
  resumoBatch,
} from '../controllers/disparosController.js';

const router = Router();

router.use(requireAuth);

router.get('/historico', historico);
router.post('/prever', prever);
router.post('/disparar-agora', dispararAgora);
router.get('/resumo', resumoBatch);
router.get('/status/:disparoId', status);

export default router;
