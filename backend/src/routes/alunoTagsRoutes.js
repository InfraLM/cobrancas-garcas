import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listarPorAluno, aplicar, remover } from '../controllers/alunoTagsController.js';

// mergeParams permite acessar :codigo da rota pai (alunos/:codigo/tags)
const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', listarPorAluno);
router.post('/', aplicar);
router.delete('/:atribId', remover);

export default router;
