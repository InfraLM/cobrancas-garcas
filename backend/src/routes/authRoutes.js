import { Router } from 'express';
import { loginGoogle, devLogin, me } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/google', loginGoogle);
router.post('/dev-login', devLogin);
router.get('/me', requireAuth, me);

export default router;
