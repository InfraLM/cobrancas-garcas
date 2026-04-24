import { Router } from 'express';
import { listar, obter, criar, atualizar, remover, promoverGlobal, executarAvulso, executarRegra, exportarRegra, subirCampanha, limparCampanha, listarTurmas } from '../controllers/segmentacaoController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, listar);
router.get('/turmas', requireAuth, listarTurmas);
router.get('/:id', requireAuth, obter);
router.post('/', requireAuth, criar);
router.put('/:id', requireAuth, atualizar);
router.delete('/:id', requireAuth, remover);
router.post('/executar', requireAuth, executarAvulso);
router.post('/limpar-campanha', requireAuth, limparCampanha);
router.post('/:id/executar', requireAuth, executarRegra);
router.post('/:id/subir-campanha', requireAuth, subirCampanha);
router.post('/:id/exportar', requireAuth, exportarRegra);
router.post('/:id/promover-global', requireAuth, promoverGlobal);

export default router;
