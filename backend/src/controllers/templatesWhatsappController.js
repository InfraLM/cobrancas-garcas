import { prisma } from '../config/database.js';

const CATEGORIAS_VALIDAS = ['cobranca', 'saudacao', 'encerramento', 'follow_up', 'outros'];
const LIMITE_CONTEUDO = 4096;
const LIMITE_NOME = 100;

export async function listar(req, res, next) {
  try {
    const { categoria, incluirInativos } = req.query;
    const where = {};
    if (!incluirInativos) where.ativo = true;
    if (categoria) where.categoria = categoria;

    const templates = await prisma.templateWhatsapp.findMany({
      where,
      orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
    });
    res.json({ data: templates });
  } catch (error) {
    next(error);
  }
}

export async function obter(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID invalido' });

    const template = await prisma.templateWhatsapp.findUnique({ where: { id } });
    if (!template) return res.status(404).json({ error: 'Template nao encontrado' });
    res.json({ data: template });
  } catch (error) {
    next(error);
  }
}

export async function criar(req, res, next) {
  try {
    const { nome, categoria, conteudo, icone } = req.body;

    const erro = validar({ nome, categoria, conteudo });
    if (erro) return res.status(400).json({ error: erro });

    const template = await prisma.templateWhatsapp.create({
      data: {
        nome: nome.trim(),
        categoria,
        conteudo,
        icone: icone || null,
        criadoPor: req.user?.id || 0,
        criadoPorNome: req.user?.nome || null,
      },
    });
    res.status(201).json({ data: template });
  } catch (error) {
    next(error);
  }
}

export async function atualizar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID invalido' });

    const { nome, categoria, conteudo, icone, ativo } = req.body;

    if (nome !== undefined || categoria !== undefined || conteudo !== undefined) {
      const erro = validar({
        nome: nome !== undefined ? nome : 'placeholder',
        categoria: categoria !== undefined ? categoria : CATEGORIAS_VALIDAS[0],
        conteudo: conteudo !== undefined ? conteudo : 'placeholder',
      });
      if (erro && nome !== undefined && categoria !== undefined && conteudo !== undefined) {
        return res.status(400).json({ error: erro });
      }
    }

    const template = await prisma.templateWhatsapp.update({
      where: { id },
      data: {
        ...(nome !== undefined && { nome: nome.trim() }),
        ...(categoria !== undefined && { categoria }),
        ...(conteudo !== undefined && { conteudo }),
        ...(icone !== undefined && { icone: icone || null }),
        ...(ativo !== undefined && { ativo }),
      },
    });
    res.json({ data: template });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Template nao encontrado' });
    next(error);
  }
}

export async function remover(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID invalido' });

    // Soft delete: marca ativo=false
    await prisma.templateWhatsapp.update({
      where: { id },
      data: { ativo: false },
    });
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Template nao encontrado' });
    next(error);
  }
}

function validar({ nome, categoria, conteudo }) {
  if (!nome || typeof nome !== 'string' || !nome.trim()) return 'Nome obrigatorio';
  if (nome.length > LIMITE_NOME) return `Nome excede ${LIMITE_NOME} caracteres`;
  if (!categoria || !CATEGORIAS_VALIDAS.includes(categoria)) {
    return `Categoria invalida. Use: ${CATEGORIAS_VALIDAS.join(', ')}`;
  }
  if (!conteudo || typeof conteudo !== 'string' || !conteudo.trim()) return 'Conteudo obrigatorio';
  if (conteudo.length > LIMITE_CONTEUDO) return `Conteudo excede ${LIMITE_CONTEUDO} caracteres (limite WhatsApp)`;
  return null;
}
