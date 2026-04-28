import { prisma } from '../config/database.js';
import multer from 'multer';
import { buildBuscaClauses } from '../utils/buscaNomeHelper.js';

const TURMAS_EXCLUIDAS = '1,10,14,19,22,27,29';

// Multer config: armazena em memoria (Buffer)
const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de arquivo nao permitido. Use PDF, JPG ou PNG.'));
  },
});
export const uploadMiddleware = upload.single('arquivo');

// -----------------------------------------------
// GET /api/ficou-facil/calcular/:pessoaCodigo
// -----------------------------------------------
export async function calcularValores(req, res, next) {
  try {
    const codigo = Number(req.params.pessoaCodigo);

    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        COALESCE(SUM(cr.valor), 0) AS valor_pos,
        COALESCE(SUM(CASE WHEN cr.situacao = 'RE' THEN COALESCE(cr.valorrecebido, 0) ELSE 0 END), 0) AS valor_recebido,
        COALESCE(SUM(CASE WHEN cr.situacao = 'AR' AND cr.datavencimento < CURRENT_DATE AND cr.valor > COALESCE(cr.valorrecebido, 0)
          THEN cr.valor - COALESCE(cr.valorrecebido, 0) ELSE 0 END), 0) AS valor_inadimplente,
        COALESCE(SUM(CASE WHEN cr.situacao = 'AR' AND cr.datavencimento < CURRENT_DATE AND cr.valor > COALESCE(cr.valorrecebido, 0)
          THEN cr.valor - COALESCE(cr.valorrecebido, 0) + COALESCE(cr.multa, 0) + COALESCE(cr.juro, 0) ELSE 0 END), 0) AS valor_inadimplente_mj
      FROM cobranca.contareceber cr
      WHERE cr.pessoa = $1
        AND cr.tipoorigem IN ('MAT', 'MEN')
        AND (cr.turma IS NULL OR cr.turma NOT IN (${TURMAS_EXCLUIDAS}))
    `, codigo);

    const r = rows[0] || {};
    res.json({
      valorPos: Number(r.valor_pos),
      valorRecebido: Number(r.valor_recebido),
      valorInadimplente: Number(r.valor_inadimplente),
      valorInadimplenteMJ: Number(r.valor_inadimplente_mj),
    });
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// GET /api/ficou-facil
// -----------------------------------------------
export async function listar(req, res, next) {
  try {
    const { etapa, search } = req.query;
    const termo = String(search || '').trim();

    // Sem busca: Prisma puro
    if (!termo) {
      const where = {};
      if (etapa) where.etapa = etapa;
      const registros = await prisma.ficouFacil.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        include: { documentos: { select: { id: true, tipo: true, nomeArquivo: true, criadoEm: true } } },
      });
      return res.json(registros);
    }

    // Com busca: raw IDs ordenados por relevancia + findMany
    const busca = buildBuscaClauses({
      colunaNome: '"pessoaNome"',
      termo,
      extras: { colunaCpf: '"pessoaCpf"' },
      paramStartIndex: 1,
    });

    const filtros = [busca.filterClause].filter(Boolean);
    const params = [...busca.params];
    let idx = busca.nextIndex;
    if (etapa) { filtros.push(`etapa = $${idx++}`); params.push(etapa); }

    const idsResult = await prisma.$queryRawUnsafe(`
      SELECT id FROM cobranca.ficou_facil
      WHERE ${filtros.join(' AND ')}
      ORDER BY ${busca.orderClause}
    `, ...params);

    const ids = idsResult.map(r => r.id);
    if (ids.length === 0) return res.json([]);

    const registrosData = await prisma.ficouFacil.findMany({
      where: { id: { in: ids } },
      include: { documentos: { select: { id: true, tipo: true, nomeArquivo: true, criadoEm: true } } },
    });
    const byId = new Map(registrosData.map(r => [r.id, r]));
    res.json(ids.map(id => byId.get(id)).filter(Boolean));
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// GET /api/ficou-facil/:id
// -----------------------------------------------
export async function obter(req, res, next) {
  try {
    const registro = await prisma.ficouFacil.findUnique({
      where: { id: req.params.id },
      include: { documentos: { select: { id: true, tipo: true, nomeArquivo: true, mimeType: true, tamanho: true, criadoEm: true } } },
    });
    if (!registro) return res.status(404).json({ error: 'Registro nao encontrado' });
    res.json(registro);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// POST /api/ficou-facil
// -----------------------------------------------
export async function criar(req, res, next) {
  try {
    const usuario = await prisma.user.findUnique({ where: { id: req.user.id }, select: { nome: true } });
    const nomeAgente = usuario?.nome || req.user.email || 'Agente';

    const { pessoaCodigo, pessoaNome, pessoaCpf, matricula, turma, celularAluno,
            valorPos, valorRecebido, valorInadimplente, valorInadimplenteMJ,
            contaSantander, observacao } = req.body;

    const registro = await prisma.ficouFacil.create({
      data: {
        pessoaCodigo,
        pessoaNome,
        pessoaCpf,
        matricula,
        turma,
        celularAluno,
        valorPos,
        valorRecebido,
        valorInadimplente,
        valorInadimplenteMJ,
        contaSantander: contaSantander || false,
        observacao,
        criadoPor: req.user.id,
        criadoPorNome: nomeAgente,
      },
    });

    // Ocorrencia
    try {
      await prisma.ocorrencia.create({
        data: {
          tipo: 'FICOU_FACIL_CRIADO',
          descricao: `Financiamento Ficou Fácil criado — Total: R$ ${Number(valorPos - valorRecebido).toFixed(2)}`,
          origem: 'AGENTE',
          pessoaCodigo,
          pessoaNome,
          agenteNome: nomeAgente,
        },
      });
    } catch {}

    res.status(201).json(registro);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// PUT /api/ficou-facil/:id/etapa
// -----------------------------------------------
export async function atualizarEtapa(req, res, next) {
  try {
    const { etapa } = req.body;
    const data = { etapa };

    if (etapa === 'CONCLUIDO') {
      data.concluidoEm = new Date();

      // Criar ocorrencia de conclusao
      const reg = await prisma.ficouFacil.findUnique({ where: { id: req.params.id } });
      if (reg) {
        try {
          const valorFinanciado = Number(reg.valorPos) - Number(reg.valorRecebido);
          await prisma.ocorrencia.create({
            data: {
              tipo: 'FICOU_FACIL_CONCLUIDO',
              descricao: `Financiamento Ficou Fácil concluído — Recuperado: R$ ${Number(reg.valorInadimplenteMJ).toFixed(2)}`,
              origem: 'AGENTE',
              pessoaCodigo: reg.pessoaCodigo,
              pessoaNome: reg.pessoaNome,
              agenteNome: reg.criadoPorNome,
            },
          });
        } catch {}
      }
    }

    if (etapa === 'CANCELADO') data.canceladoEm = new Date();

    const registro = await prisma.ficouFacil.update({
      where: { id: req.params.id },
      data,
      include: { documentos: { select: { id: true, tipo: true, nomeArquivo: true, criadoEm: true } } },
    });

    res.json(registro);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// PUT /api/ficou-facil/:id/valores
// Permite editar os valores financeiros em qualquer etapa (inclusive
// CONCLUIDO e CANCELADO). Util quando o agente precisa corrigir valor
// pos-financiamento depois que o aluno fechou o contrato com a Caixa.
// -----------------------------------------------
export async function atualizarValores(req, res, next) {
  try {
    const { valorPos, valorRecebido, valorInadimplente, valorInadimplenteMJ, contaSantander } = req.body;
    const data = {};
    if (valorPos !== undefined && valorPos !== null) data.valorPos = Number(valorPos);
    if (valorRecebido !== undefined && valorRecebido !== null) data.valorRecebido = Number(valorRecebido);
    if (valorInadimplente !== undefined && valorInadimplente !== null) data.valorInadimplente = Number(valorInadimplente);
    if (valorInadimplenteMJ !== undefined && valorInadimplenteMJ !== null) data.valorInadimplenteMJ = Number(valorInadimplenteMJ);
    if (contaSantander !== undefined && contaSantander !== null) data.contaSantander = Boolean(contaSantander);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Nenhum valor enviado para atualizacao' });
    }

    const registro = await prisma.ficouFacil.update({
      where: { id: req.params.id },
      data,
      include: { documentos: { select: { id: true, tipo: true, nomeArquivo: true, criadoEm: true } } },
    });
    res.json(registro);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// PUT /api/ficou-facil/:id/checkboxes
// -----------------------------------------------
export async function atualizarCheckboxes(req, res, next) {
  try {
    const { checkboxes } = req.body;
    const registro = await prisma.ficouFacil.update({
      where: { id: req.params.id },
      data: { checkboxes },
    });
    res.json(registro);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// PUT /api/ficou-facil/:id/credito
// -----------------------------------------------
export async function atualizarCredito(req, res, next) {
  try {
    const { creditoAprovado, creditoObservacao } = req.body;
    const registro = await prisma.ficouFacil.update({
      where: { id: req.params.id },
      data: { creditoAprovado, creditoObservacao },
    });
    res.json(registro);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// POST /api/ficou-facil/:id/documentos
// -----------------------------------------------
export async function uploadDocumento(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    const { tipo } = req.body; // DOCUMENTO_ALUNO ou DOCUMENTO_AVALISTA

    const doc = await prisma.documentoFicouFacil.create({
      data: {
        ficouFacilId: req.params.id,
        tipo: tipo || 'DOCUMENTO_ALUNO',
        nomeArquivo: req.file.originalname,
        mimeType: req.file.mimetype,
        tamanho: req.file.size,
        arquivo: req.file.buffer,
      },
    });

    res.status(201).json({ id: doc.id, tipo: doc.tipo, nomeArquivo: doc.nomeArquivo, tamanho: doc.tamanho, criadoEm: doc.criadoEm });
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// GET /api/ficou-facil/:id/documentos
// -----------------------------------------------
export async function listarDocumentos(req, res, next) {
  try {
    const docs = await prisma.documentoFicouFacil.findMany({
      where: { ficouFacilId: req.params.id },
      select: { id: true, tipo: true, nomeArquivo: true, mimeType: true, tamanho: true, criadoEm: true },
      orderBy: { criadoEm: 'desc' },
    });
    res.json(docs);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// GET /api/ficou-facil/documentos/:docId
// -----------------------------------------------
export async function baixarDocumento(req, res, next) {
  try {
    const doc = await prisma.documentoFicouFacil.findUnique({
      where: { id: req.params.docId },
    });
    if (!doc) return res.status(404).json({ error: 'Documento nao encontrado' });

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.nomeArquivo}"`);
    res.send(Buffer.from(doc.arquivo));
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// DELETE /api/ficou-facil/:id
// -----------------------------------------------
export async function cancelar(req, res, next) {
  try {
    const registro = await prisma.ficouFacil.update({
      where: { id: req.params.id },
      data: { etapa: 'CANCELADO', canceladoEm: new Date() },
    });
    res.json(registro);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// GET /api/ficou-facil/por-aluno/:codigo
// -----------------------------------------------
export async function listarPorAluno(req, res, next) {
  try {
    const registros = await prisma.ficouFacil.findMany({
      where: { pessoaCodigo: Number(req.params.codigo) },
      include: { documentos: { select: { id: true, tipo: true, nomeArquivo: true, criadoEm: true } } },
      orderBy: { criadoEm: 'desc' },
    });
    res.json(registros);
  } catch (error) {
    next(error);
  }
}
