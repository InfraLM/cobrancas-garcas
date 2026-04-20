import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listar,
  obter,
  criar,
  atualizarEtapa,
  vincularSei,
  cancelar,
  gerarPdf,
  enviarAssinatura,
  enviarLembrete,
  documentoAssinado,
  listarPorAluno,
  gerarCobrancas,
  enviarWhatsapp,
} from '../controllers/acordosController.js';

const router = Router();

router.get('/', requireAuth, listar);
router.get('/:id', requireAuth, obter);
router.post('/', requireAuth, criar);
router.patch('/:id/etapa', requireAuth, atualizarEtapa);
router.put('/:id/etapa', requireAuth, atualizarEtapa);
router.patch('/:id/vincular-sei', requireAuth, vincularSei);
router.put('/:id/vincular-sei', requireAuth, vincularSei);
router.delete('/:id', requireAuth, cancelar);
router.post('/:id/gerar-pdf', requireAuth, gerarPdf);
router.post('/:id/enviar-assinatura', requireAuth, enviarAssinatura);
router.post('/:id/enviar-lembrete', requireAuth, enviarLembrete);
router.get('/:id/documento-assinado', requireAuth, documentoAssinado);
router.get('/por-aluno/:codigo', requireAuth, listarPorAluno);
router.post('/:id/gerar-cobrancas', requireAuth, gerarCobrancas);
router.post('/:id/pagamentos/:pagamentoId/enviar-whatsapp', requireAuth, enviarWhatsapp);

export default router;
