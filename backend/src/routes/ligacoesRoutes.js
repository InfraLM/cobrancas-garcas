import { Router } from 'express';
import { click2call, getConfig, hangup, alunoPorTelefone, qualificacoesCampanha } from '../controllers/ligacoesController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/config', requireAuth, getConfig);
router.post('/click2call', requireAuth, click2call);
router.post('/hangup/:callId', requireAuth, hangup);
router.get('/aluno-por-telefone', requireAuth, alunoPorTelefone);
router.get('/qualificacoes-campanha/:campaignId', requireAuth, qualificacoesCampanha);

export default router;
