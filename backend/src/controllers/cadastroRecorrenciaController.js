import { prisma } from '../config/database.js';

// -----------------------------------------------
// GET /api/recorrencias — Listar cadastros
// -----------------------------------------------
export async function listar(req, res, next) {
  try {
    const { etapa, search, origem } = req.query;
    const where = {};

    if (etapa) where.etapa = etapa;
    if (origem) where.origem = origem;
    if (search) {
      where.OR = [
        { pessoaNome: { contains: search, mode: 'insensitive' } },
        { pessoaCpf: { contains: search.replace(/\D/g, '') } },
      ];
    }

    const cadastros = await prisma.cadastroRecorrencia.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
    });

    res.json(cadastros);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// GET /api/recorrencias/:id — Obter cadastro
// -----------------------------------------------
export async function obter(req, res, next) {
  try {
    const cadastro = await prisma.cadastroRecorrencia.findUnique({
      where: { id: req.params.id },
    });
    if (!cadastro) return res.status(404).json({ error: 'Cadastro nao encontrado' });
    res.json(cadastro);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// POST /api/recorrencias — Criar cadastro
// -----------------------------------------------
export async function criar(req, res, next) {
  try {
    const { pessoaCodigo, pessoaNome, pessoaCpf, matricula, celularAluno, origem, observacao, acordoId, dataLimite } = req.body;

    // Buscar nome do agente
    const usuario = await prisma.user.findUnique({ where: { id: req.user.id }, select: { nome: true } });

    const cadastro = await prisma.cadastroRecorrencia.create({
      data: {
        pessoaCodigo,
        pessoaNome,
        pessoaCpf,
        matricula,
        celularAluno,
        origem: origem || 'MANUAL',
        acordoId,
        dataLimite: dataLimite ? new Date(dataLimite) : null,
        observacao,
        criadoPor: req.user.id,
        criadoPorNome: usuario?.nome || req.user.email || 'Agente',
      },
    });

    res.status(201).json(cadastro);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// PUT /api/recorrencias/:id/metodo — Definir metodo
// -----------------------------------------------
export async function definirMetodo(req, res, next) {
  try {
    const { metodo, contaReceberCodigo, dataLimite } = req.body;

    const cadastro = await prisma.cadastroRecorrencia.update({
      where: { id: req.params.id },
      data: {
        metodo,
        contaReceberCodigo: contaReceberCodigo ? Number(contaReceberCodigo) : null,
        dataLimite: dataLimite ? new Date(dataLimite) : undefined,
        etapa: 'MONITORANDO',
      },
    });

    res.json(cadastro);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// PUT /api/recorrencias/:id/etapa — Atualizar etapa
// -----------------------------------------------
export async function atualizarEtapa(req, res, next) {
  try {
    const { etapa } = req.body;
    const data = { etapa };

    if (etapa === 'CONCLUIDO') data.concluidoEm = new Date();
    if (etapa === 'CANCELADO') data.canceladoEm = new Date();

    const cadastro = await prisma.cadastroRecorrencia.update({
      where: { id: req.params.id },
      data,
    });

    res.json(cadastro);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// DELETE /api/recorrencias/:id — Cancelar
// -----------------------------------------------
export async function cancelar(req, res, next) {
  try {
    const cadastro = await prisma.cadastroRecorrencia.update({
      where: { id: req.params.id },
      data: {
        etapa: 'CANCELADO',
        canceladoEm: new Date(),
      },
    });

    res.json(cadastro);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------
// Verificacao automatica (chamada pelo delta sync)
// -----------------------------------------------
export async function verificarRecorrencias() {
  try {
    // Buscar cadastros em MONITORANDO
    const monitorando = await prisma.cadastroRecorrencia.findMany({
      where: { etapa: 'MONITORANDO' },
    });

    if (monitorando.length === 0) return;

    console.log(`[Recorrencia] Verificando ${monitorando.length} cadastros em monitoramento`);

    for (const cadastro of monitorando) {
      let ativada = false;

      // 1. Verificar se recorrencia foi ativada (registro mais recente ativo)
      const recorrenciaAtual = await prisma.$queryRawUnsafe(`
        SELECT codigo, situacao, datacadastro, datainativacao
        FROM cobranca.cartaocreditodebitorecorrenciapessoa
        WHERE pessoa = $1
        ORDER BY datacadastro DESC NULLS LAST
        LIMIT 1
      `, cadastro.pessoaCodigo);

      if (recorrenciaAtual.length > 0) {
        const reg = recorrenciaAtual[0];
        // Ativa se situacao indica ativo e nao tem datainativacao recente
        if (reg.situacao && reg.situacao.toLowerCase().includes('ativ') && !reg.datainativacao) {
          ativada = true;
          // Salvar codigo do cartao detectado
          await prisma.cadastroRecorrencia.update({
            where: { id: cadastro.id },
            data: { cartaoDetectadoCodigo: reg.codigo },
          });
        }
      }

      // 2. Se metodo = parcela simbolica, verificar se foi paga
      if (!ativada && cadastro.metodo === 'PARCELA_SIMBOLICA' && cadastro.contaReceberCodigo) {
        const conta = await prisma.$queryRawUnsafe(`
          SELECT situacao FROM cobranca.contareceber WHERE codigo = $1
        `, cadastro.contaReceberCodigo);

        if (conta.length > 0 && conta[0].situacao === 'RE') {
          await prisma.cadastroRecorrencia.update({
            where: { id: cadastro.id },
            data: { parcelaPaga: true },
          });
          // Parcela paga, mas ainda precisa verificar se recorrencia foi ativada
        }
      }

      // 3. Se ativada → mover para CONCLUIDO
      if (ativada) {
        await prisma.cadastroRecorrencia.update({
          where: { id: cadastro.id },
          data: {
            etapa: 'CONCLUIDO',
            recorrenciaAtivada: true,
            concluidoEm: new Date(),
          },
        });

        // Criar ocorrencia de conversao
        await prisma.ocorrencia.create({
          data: {
            tipo: 'CONVERSAO_RECORRENCIA',
            descricao: `Recorrência ativada para ${cadastro.pessoaNome}`,
            origem: 'SISTEMA',
            pessoaCodigo: cadastro.pessoaCodigo,
            pessoaNome: cadastro.pessoaNome,
            agenteCodigo: String(cadastro.criadoPor),
            agenteNome: cadastro.criadoPorNome,
          },
        });

        console.log(`[Recorrencia] Ativada para ${cadastro.pessoaNome} (${cadastro.pessoaCodigo})`);
      }
    }
  } catch (error) {
    console.error('[Recorrencia] Erro na verificacao:', error.message);
  }
}

// -----------------------------------------------
// Deteccao de desativacoes (chamada pelo delta sync)
// -----------------------------------------------
export async function detectarDesativacoes() {
  try {
    // Buscar alunos que tinham recorrencia ativa mas agora nao tem
    // Compara: registro mais recente por pessoa com datainativacao preenchida recentemente
    const desativados = await prisma.$queryRawUnsafe(`
      WITH ultima_recorrencia AS (
        SELECT DISTINCT ON (pessoa) pessoa, codigo, situacao, datacadastro, datainativacao, motivoinativacao
        FROM cobranca.cartaocreditodebitorecorrenciapessoa
        WHERE pessoa IS NOT NULL
        ORDER BY pessoa, datacadastro DESC NULLS LAST
      )
      SELECT ur.pessoa, ur.codigo, ur.datainativacao, ur.motivoinativacao, p.nome, p.cpf, p.celular,
             m.matricula
      FROM ultima_recorrencia ur
      JOIN cobranca.pessoa p ON p.codigo = ur.pessoa
      LEFT JOIN LATERAL (
        SELECT matricula FROM cobranca.matricula WHERE aluno = ur.pessoa ORDER BY data DESC NULLS LAST LIMIT 1
      ) m ON true
      WHERE ur.datainativacao IS NOT NULL
        AND ur.datainativacao > CURRENT_TIMESTAMP - INTERVAL '1 day'
        AND p.aluno = true
        AND NOT EXISTS (
          SELECT 1 FROM cobranca.cadastro_recorrencia cr
          WHERE cr."pessoaCodigo" = ur.pessoa
            AND cr.etapa IN ('PENDENTE', 'MONITORANDO')
            AND cr.origem = 'RECONVERSAO'
        )
    `);

    if (desativados.length === 0) return;

    console.log(`[Recorrencia] ${desativados.length} desativacao(oes) detectada(s)`);

    for (const d of desativados) {
      await prisma.cadastroRecorrencia.create({
        data: {
          pessoaCodigo: d.pessoa,
          pessoaNome: d.nome,
          pessoaCpf: d.cpf || '',
          matricula: d.matricula,
          celularAluno: d.celular,
          origem: 'RECONVERSAO',
          observacao: d.motivoinativacao ? `Motivo da desativação: ${d.motivoinativacao}` : null,
          criadoPor: 0,
          criadoPorNome: 'Sistema',
        },
      });

      // Criar ocorrencia de desativacao
      await prisma.ocorrencia.create({
        data: {
          tipo: 'RECORRENCIA_DESATIVADA',
          descricao: `Recorrência desativada${d.motivoinativacao ? ` — ${d.motivoinativacao}` : ''}`,
          origem: 'SYNC_SEI',
          pessoaCodigo: d.pessoa,
          pessoaNome: d.nome,
        },
      });

      console.log(`[Recorrencia] Card RECONVERSAO criado para ${d.nome} (${d.pessoa})`);
    }
  } catch (error) {
    console.error('[Recorrencia] Erro na deteccao de desativacoes:', error.message);
  }
}

// -----------------------------------------------
// Detectar ativacoes organicas (aluno ativou sem card)
// -----------------------------------------------
export async function detectarAtivacoes() {
  try {
    const ativados = await prisma.$queryRawUnsafe(`
      WITH ultima_recorrencia AS (
        SELECT DISTINCT ON (pessoa) pessoa, codigo, situacao, datacadastro, datainativacao
        FROM cobranca.cartaocreditodebitorecorrenciapessoa
        WHERE pessoa IS NOT NULL
        ORDER BY pessoa, datacadastro DESC NULLS LAST
      )
      SELECT ur.pessoa, ur.codigo, ur.datacadastro, p.nome
      FROM ultima_recorrencia ur
      JOIN cobranca.pessoa p ON p.codigo = ur.pessoa
      WHERE ur.datainativacao IS NULL
        AND ur.datacadastro > CURRENT_TIMESTAMP - INTERVAL '1 day'
        AND p.aluno = true
        AND NOT EXISTS (
          SELECT 1 FROM cobranca.ocorrencia o
          WHERE o."pessoaCodigo" = ur.pessoa
            AND o.tipo = 'RECORRENCIA_ATIVADA'
            AND o."criadoEm" > CURRENT_TIMESTAMP - INTERVAL '1 day'
        )
    `);

    if (ativados.length === 0) return;

    console.log(`[Recorrencia] ${ativados.length} ativacao(oes) organica(s) detectada(s)`);

    for (const a of ativados) {
      await prisma.ocorrencia.create({
        data: {
          tipo: 'RECORRENCIA_ATIVADA',
          descricao: `Recorrência ativada pelo aluno`,
          origem: 'SYNC_SEI',
          pessoaCodigo: a.pessoa,
          pessoaNome: a.nome,
        },
      });
    }
  } catch (error) {
    console.error('[Recorrencia] Erro na deteccao de ativacoes:', error.message);
  }
}
