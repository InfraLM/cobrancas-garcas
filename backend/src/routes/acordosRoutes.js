import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listar,
  obter,
  detalhado,
  resumo,
  listarAgentes,
  criar,
  atualizarEtapa,
  vincularSei,
  cancelar,
  previewCancelamento,
  gerarPdf,
  enviarAssinatura,
  enviarLembrete,
  documentoAssinado,
  listarPorAluno,
  gerarCobrancas,
  enviarWhatsapp,
  cancelarPagamento,
} from '../controllers/acordosController.js';

const router = Router();

// Rotas estaticas vem antes das parametricas pra nao colidir com /:id
router.get('/', requireAuth, listar);
router.get('/resumo', requireAuth, resumo);
router.get('/agentes', requireAuth, listarAgentes);
router.get('/por-aluno/:codigo', requireAuth, listarPorAluno);
router.get('/:id/detalhado', requireAuth, detalhado);
router.get('/:id/preview-cancelamento', requireAuth, previewCancelamento);
router.get('/:id/documento-assinado', requireAuth, documentoAssinado);
router.get('/:id', requireAuth, obter);

router.post('/', requireAuth, criar);
router.post('/:id/gerar-pdf', requireAuth, gerarPdf);
router.post('/:id/enviar-assinatura', requireAuth, enviarAssinatura);
router.post('/:id/enviar-lembrete', requireAuth, enviarLembrete);
router.post('/:id/gerar-cobrancas', requireAuth, gerarCobrancas);
router.post('/:id/pagamentos/:pagamentoId/enviar-whatsapp', requireAuth, enviarWhatsapp);
router.post('/:id/pagamentos/:pagamentoId/cancelar', requireAuth, cancelarPagamento);

router.patch('/:id/etapa', requireAuth, atualizarEtapa);
router.put('/:id/etapa', requireAuth, atualizarEtapa);
router.patch('/:id/vincular-sei', requireAuth, vincularSei);
router.put('/:id/vincular-sei', requireAuth, vincularSei);

router.delete('/:id', requireAuth, cancelar);

export default router;
