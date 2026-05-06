import { Router } from 'express';
import { verificar, receber } from '../controllers/metaWebhookController.js';

// Rotas SEM auth — Meta valida via hub.verify_token query param.
// Endpoints publicos:
//   GET  /api/webhooks/meta — handshake (Meta envia hub.challenge)
//   POST /api/webhooks/meta — eventos (status_update, category_update, etc)
const router = Router();

router.get('/', verificar);
router.post('/', receber);

export default router;
