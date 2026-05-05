import { prisma } from '../config/database.js';

// Catalogo de tags qualitativas. Todos os usuarios autenticados podem editar
// hoje — quando entrar governanca, trocar para requireRole('ADMIN').
//
// Campo `codigo` eh IMUTAVEL apos criacao (identificador estavel para queries
// externas e analises). Demais campos podem ser editados livremente.

const CATEGORIAS_PADRAO = ['FINANCEIRO', 'MATRICULA_INTENCAO', 'QUALIDADE_CONTATO', 'JURIDICO'];
const CORES_VALIDAS = ['amber', 'blue', 'gray', 'red', 'green', 'purple', 'pink', 'teal'];

function validarCodigoFormat(codigo) {
  // SCREAMING_SNAKE_CASE: letras maiusculas, numeros e underscore
  return /^[A-Z][A-Z0-9_]*$/.test(codigo);
}

export async function listar(req, res, next) {
  try {
    const incluirInativos = req.query.incluirInativos === 'true';
    const { categoria } = req.query;

    const where = {};
    if (!incluirInativos) where.ativo = true;
    if (categoria) where.categoria = String(categoria);

    const tags = await prisma.tag.findMany({
      where,
      orderBy: [{ categoria: 'asc' }, { ordem: 'asc' }, { label: 'asc' }],
    });
    res.json({ data: tags });
  } catch (error) {
    next(error);
  }
}

export async function obter(req, res, next) {
  try {
    const tag = await prisma.tag.findUnique({ where: { id: req.params.id } });
    if (!tag) return res.status(404).json({ error: 'Tag nao encontrada' });
    res.json({ data: tag });
  } catch (error) {
    next(error);
  }
}

export async function criar(req, res, next) {
  try {
    const { categoria, codigo, label, descricao, cor, ordem } = req.body;

    if (!categoria || !codigo || !label) {
      return res.status(400).json({ error: 'categoria, codigo e label sao obrigatorios' });
    }
    if (!validarCodigoFormat(codigo)) {
      return res.status(400).json({ error: 'codigo deve estar em SCREAMING_SNAKE_CASE (ex: BUSCOU_CANCELAMENTO)' });
    }
    if (cor && !CORES_VALIDAS.includes(cor)) {
      return res.status(400).json({ error: `cor invalida. Valores aceitos: ${CORES_VALIDAS.join(', ')}` });
    }

    const ja = await prisma.tag.findUnique({
      where: { categoria_codigo: { categoria, codigo } },
    });
    if (ja) return res.status(409).json({ error: `Ja existe tag com (categoria=${categoria}, codigo=${codigo})` });

    const tag = await prisma.tag.create({
      data: {
        categoria: String(categoria).toUpperCase(),
        codigo: String(codigo).toUpperCase(),
        label,
        descricao: descricao || null,
        cor: cor || null,
        ordem: Number.isFinite(Number(ordem)) ? Number(ordem) : 0,
      },
    });
    res.status(201).json({ data: tag });
  } catch (error) {
    next(error);
  }
}

export async function atualizar(req, res, next) {
  try {
    const tag = await prisma.tag.findUnique({ where: { id: req.params.id } });
    if (!tag) return res.status(404).json({ error: 'Tag nao encontrada' });

    const { categoria, codigo, label, descricao, cor, ordem, ativo } = req.body;

    // codigo eh IMUTAVEL — se cliente tentar mudar com valor diferente, rejeita
    if (codigo !== undefined && codigo !== tag.codigo) {
      return res.status(400).json({
        error: 'O campo "codigo" eh imutavel apos a criacao. Para reorganizar, crie nova tag e desative a antiga.',
      });
    }

    if (cor !== undefined && cor !== null && !CORES_VALIDAS.includes(cor)) {
      return res.status(400).json({ error: `cor invalida. Valores aceitos: ${CORES_VALIDAS.join(', ')}` });
    }

    const data = {};
    if (label !== undefined) data.label = label;
    if (descricao !== undefined) data.descricao = descricao;
    if (cor !== undefined) data.cor = cor;
    if (ordem !== undefined) data.ordem = Number(ordem) || 0;
    if (ativo !== undefined) data.ativo = Boolean(ativo);
    if (categoria !== undefined && categoria !== tag.categoria) {
      // Mover de categoria — checa que (novaCategoria, codigo) ainda eh unica
      const conflito = await prisma.tag.findUnique({
        where: { categoria_codigo: { categoria: String(categoria).toUpperCase(), codigo: tag.codigo } },
      });
      if (conflito) {
        return res.status(409).json({ error: `Ja existe tag com (categoria=${categoria}, codigo=${tag.codigo})` });
      }
      data.categoria = String(categoria).toUpperCase();
    }

    const atualizada = await prisma.tag.update({ where: { id: tag.id }, data });
    res.json({ data: atualizada });
  } catch (error) {
    next(error);
  }
}

export async function remover(req, res, next) {
  // Soft-delete: marca ativo=false. Nunca hard-delete (FK em aluno_tag e
  // perderia historico).
  try {
    const tag = await prisma.tag.findUnique({ where: { id: req.params.id } });
    if (!tag) return res.status(404).json({ error: 'Tag nao encontrada' });

    const atualizada = await prisma.tag.update({
      where: { id: tag.id },
      data: { ativo: false },
    });
    res.json({ data: atualizada });
  } catch (error) {
    next(error);
  }
}

export async function listarCategorias(_req, res, next) {
  // Retorna categorias distintas que ja existem + categorias padrao
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT categoria FROM cobranca.tag ORDER BY categoria
    `);
    const existentes = rows.map(r => r.categoria);
    const todas = Array.from(new Set([...CATEGORIAS_PADRAO, ...existentes]));
    res.json({ data: todas });
  } catch (error) {
    next(error);
  }
}
