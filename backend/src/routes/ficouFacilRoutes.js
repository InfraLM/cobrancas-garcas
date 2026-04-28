import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listar, obter, criar, atualizarEtapa, atualizarCheckboxes, atualizarCredito,
  atualizarValores, uploadDocumento, uploadMiddleware, listarDocumentos, baixarDocumento,
  cancelar, calcularValores, listarPorAluno,
} from '../controllers/ficouFacilController.js';

const router = Router();

router.get('/', requireAuth, listar);
router.get('/calcular/:pessoaCodigo', requireAuth, calcularValores);
router.get('/documentos/:docId', requireAuth, baixarDocumento);
router.get('/por-aluno/:codigo', requireAuth, listarPorAluno);
router.get('/:id', requireAuth, obter);
router.post('/', requireAuth, criar);
router.put('/:id/etapa', requireAuth, atualizarEtapa);
router.put('/:id/checkboxes', requireAuth, atualizarCheckboxes);
router.put('/:id/credito', requireAuth, atualizarCredito);
router.put('/:id/valores', requireAuth, atualizarValores);
router.post('/:id/documentos', requireAuth, uploadMiddleware, uploadDocumento);
router.get('/:id/documentos', requireAuth, listarDocumentos);
router.delete('/:id', requireAuth, cancelar);

export default router;
