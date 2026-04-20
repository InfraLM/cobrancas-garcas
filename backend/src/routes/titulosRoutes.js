import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listar, metricas } from '../controllers/titulosController.js';

const router = Router();

router.get('/', requireAuth, listar);
router.get('/metricas', requireAuth, metricas);

export default router;
