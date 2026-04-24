import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  criar,
  remover,
  historicoPorAluno,
  removerEmMassa,
} from '../controllers/pausasLigacaoController.js';

const router = Router();

router.post('/', requireAuth, criar);
router.delete('/:id', requireAuth, remover);
router.get('/por-aluno/:codigo', requireAuth, historicoPorAluno);
router.post('/remover-em-massa', requireAuth, removerEmMassa);

export default router;
