import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import {
  getConfig,
  listarChatsFila,
  obterChat,
  listarMensagens,
  enviarTexto,
  enviarTemplate,
  enviarInterno,
  enviarImagem,
  enviarAudio,
  enviarDocumento,
  aceitarChat,
  finalizarChat,
  transferirChat,
  listarAgentes,
  listarEquipes,
  persistirMensagem,
  buscarMensagensLocal,
  buscarChatsLocal,
  abrirChat,
} from '../controllers/conversasController.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });

// Config (token for Socket.io)
router.get('/config', requireAuth, getConfig);

// Chats (Chat API — Bearer)
router.get('/chats/queue', requireAuth, listarChatsFila);
router.get('/chats/:chatId', requireAuth, obterChat);

// Messages (Chat API — Bearer, fallback search)
router.get('/chats/:chatId/messages', requireAuth, listarMensagens);

// Send (Chat API — Bearer)
router.post('/enviar/texto', requireAuth, enviarTexto);
router.post('/enviar/template', requireAuth, enviarTemplate);
router.post('/enviar/interno', requireAuth, enviarInterno);
router.post('/enviar/imagem', requireAuth, upload.single('image'), enviarImagem);
router.post('/enviar/audio', requireAuth, upload.single('audio'), enviarAudio);
router.post('/enviar/documento', requireAuth, upload.single('file'), enviarDocumento);

// Abrir chat novo
router.post('/abrir-chat', requireAuth, abrirChat);

// Actions (Chat API — Bearer)
router.post('/chats/:chatId/aceitar', requireAuth, aceitarChat);
router.post('/chats/:chatId/finalizar', requireAuth, finalizarChat);
router.post('/chats/:chatId/transferir', requireAuth, transferirChat);

// Config endpoints (Omni API legada)
router.get('/agentes', requireAuth, listarAgentes);
router.get('/equipes', requireAuth, listarEquipes);

// Banco local
router.post('/mensagens/persistir', requireAuth, persistirMensagem);
router.get('/mensagens/local/:chatId', requireAuth, buscarMensagensLocal);
router.get('/mensagens/chats-local', requireAuth, buscarChatsLocal);

export default router;
