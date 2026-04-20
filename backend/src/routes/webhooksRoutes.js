import { Router } from 'express';
import { clicksignWebhook, asaasWebhook } from '../controllers/webhooksController.js';

const router = Router();

// Webhooks nao tem auth (validacao via token/HMAC no controller)
router.post('/clicksign', clicksignWebhook);
router.post('/asaas', asaasWebhook);

export default router;
