import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { obterDashboard, obterFunil, obterRecorrentesHistorico, obterAcumuladoAlunos, obterMatrizRecuperacao, obterAging, obterAgingHistorico, obterPagoPorForma } from '../controllers/dashboardController.js';

const router = Router();

router.get('/', requireAuth, obterDashboard);
router.get('/funil', requireAuth, obterFunil);
router.get('/recorrentes-historico', requireAuth, obterRecorrentesHistorico);
router.get('/acumulado-alunos', requireAuth, obterAcumuladoAlunos);
router.get('/matriz-recuperacao', requireAuth, obterMatrizRecuperacao);
router.get('/aging', requireAuth, obterAging);
router.get('/aging-historico', requireAuth, obterAgingHistorico);
router.get('/pago-por-forma', requireAuth, obterPagoPorForma);

export default router;
