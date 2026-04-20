import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listarGlobal, listarTipos, metricas } from '../controllers/ocorrenciasController.js';

const router = Router();

router.get('/', requireAuth, listarGlobal);
router.get('/tipos', requireAuth, listarTipos);
router.get('/metricas', requireAuth, metricas);

export default router;
