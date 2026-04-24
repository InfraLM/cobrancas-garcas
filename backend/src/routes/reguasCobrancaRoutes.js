import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listar,
  obter,
  criar,
  atualizar,
  remover,
  duplicar,
  executarAgora,
  criarEtapa,
  atualizarEtapa,
  removerEtapa,
  simularEtapa,
  metricasRegua,
  criarDoModelo,
  previewMensagemEtapa,
} from '../controllers/reguasCobrancaController.js';

const router = Router();
router.use(requireAuth);

// Regua
router.get('/', listar);
router.post('/', criar);
router.post('/modelo-padrao', criarDoModelo);
router.get('/:id', obter);
router.put('/:id', atualizar);
router.delete('/:id', remover);
router.post('/:id/duplicar', duplicar);
router.post('/:id/executar-agora', executarAgora);
router.get('/:id/metricas', metricasRegua);

// Etapas (nested)
router.post('/:id/etapas', criarEtapa);
router.put('/:id/etapas/:etapaId', atualizarEtapa);
router.delete('/:id/etapas/:etapaId', removerEtapa);
router.post('/:id/etapas/:etapaId/simular', simularEtapa);
router.get('/:id/etapas/:etapaId/preview', previewMensagemEtapa);

export default router;
