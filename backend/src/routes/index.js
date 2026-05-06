import { Router } from 'express';
import exampleRoutes from './exampleRoutes.js';
import blipWebhookRoutes from './blipWebhookRoutes.js';
import ligacoesRoutes from './ligacoesRoutes.js';
import conversasRoutes from './conversasRoutes.js';
import conversaCobrancaRoutes from './conversaCobrancaRoutes.js';
import usersRoutes from './usersRoutes.js';
import authRoutes from './authRoutes.js';
import alunosRoutes from './alunosRoutes.js';
import segmentacaoRoutes from './segmentacaoRoutes.js';
import acordosRoutes from './acordosRoutes.js';
import cadastroRecorrenciaRoutes from './cadastroRecorrenciaRoutes.js';
import ocorrenciasRoutes from './ocorrenciasRoutes.js';
import ficouFacilRoutes from './ficouFacilRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import titulosRoutes from './titulosRoutes.js';
import webhooksRoutes from './webhooksRoutes.js';
import templatesWhatsappRoutes from './templatesWhatsappRoutes.js';
import pausasLigacaoRoutes from './pausasLigacaoRoutes.js';
import templatesBlipRoutes from './templatesBlipRoutes.js';
import disparosRoutes from './disparosRoutes.js';
import reguasCobrancaRoutes from './reguasCobrancaRoutes.js';
import atividadesRoutes from './atividadesRoutes.js';
import tagsRoutes from './tagsRoutes.js';
import templatesMetaRoutes from './templatesMetaRoutes.js';

const router = Router();

// Rotas publicas (sem auth)
router.use('/auth', authRoutes);

// Registre novas rotas aqui:
router.use('/examples', exampleRoutes);
router.use('/webhooks/blip', blipWebhookRoutes);
router.use('/ligacoes', ligacoesRoutes);
router.use('/conversas', conversasRoutes);
router.use('/conversas-cobranca', conversaCobrancaRoutes);
router.use('/users', usersRoutes);
router.use('/alunos', alunosRoutes);
router.use('/segmentacoes', segmentacaoRoutes);
router.use('/acordos', acordosRoutes);
router.use('/recorrencias', cadastroRecorrenciaRoutes);
router.use('/ocorrencias', ocorrenciasRoutes);
router.use('/titulos', titulosRoutes);
router.use('/ficou-facil', ficouFacilRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/webhooks', webhooksRoutes);
router.use('/templates-whatsapp', templatesWhatsappRoutes);
router.use('/pausas-ligacao', pausasLigacaoRoutes);
router.use('/templates-blip', templatesBlipRoutes);
router.use('/disparos', disparosRoutes);
router.use('/reguas-cobranca', reguasCobrancaRoutes);
router.use('/atividades', atividadesRoutes);
router.use('/tags', tagsRoutes);
router.use('/templates-meta', templatesMetaRoutes);

export default router;
