import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listar, obter, assumir, encerrar, transferir, snooze, reativar,
} from '../controllers/conversaCobrancaController.js';

const router = Router();

router.get('/', requireAuth, listar);
router.get('/:id', requireAuth, obter);
router.post('/:id/assumir', requireAuth, assumir);
router.post('/:id/encerrar', requireAuth, encerrar);
router.post('/:id/transferir', requireAuth, transferir);
router.post('/:id/snooze', requireAuth, snooze);
router.post('/:id/reativar', requireAuth, reativar);

export default router;
