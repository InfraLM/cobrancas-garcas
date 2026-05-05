import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listar, obter, parcelas, engajamento, plantoes, suporte, recorrencia, serasaRegistros, ocorrencias } from '../controllers/alunosController.js';
import alunoTagsRoutes from './alunoTagsRoutes.js';

const router = Router();

// Sub-rota: /api/alunos/:codigo/tags
router.use('/:codigo/tags', alunoTagsRoutes);

router.get('/', requireAuth, listar);
router.post('/refresh', requireAuth, async (req, res, next) => {
  try {
    const { refreshAlunoResumo } = await import('../services/alunoResumoService.js');
    const count = await refreshAlunoResumo();
    res.json({ ok: true, message: `${count} alunos atualizados` });
  } catch (error) {
    next(error);
  }
});
router.get('/:codigo', requireAuth, obter);
router.get('/:codigo/parcelas', requireAuth, parcelas);
router.get('/:codigo/engajamento', requireAuth, engajamento);
router.get('/:codigo/plantoes', requireAuth, plantoes);
router.get('/:codigo/suporte', requireAuth, suporte);
router.get('/:codigo/recorrencia', requireAuth, recorrencia);
router.get('/:codigo/ocorrencias', requireAuth, ocorrencias);
router.get('/:codigo/serasa', requireAuth, serasaRegistros);

export default router;
