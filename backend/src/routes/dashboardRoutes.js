import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { obterDashboard } from '../controllers/dashboardController.js';

const router = Router();

router.get('/', requireAuth, obterDashboard);

export default router;
