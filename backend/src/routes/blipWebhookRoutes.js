import { Router } from 'express';
import { handleBlipWebhook } from '../controllers/blipWebhookController.js';

const router = Router();

router.post('/', handleBlipWebhook);

export default router;
