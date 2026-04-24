import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { obterDashboard, obterFunil } from '../controllers/dashboardController.js';

const router = Router();

router.get('/', requireAuth, obterDashboard);
router.get('/funil', requireAuth, obterFunil);

export default router;
