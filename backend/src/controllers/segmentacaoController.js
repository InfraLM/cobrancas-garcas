import { prisma } from '../config/database.js';
import { buildSegmentacaoQuery, buildSegmentacaoCountQuery } from '../services/segmentacaoQueryBuilder.js';
import { subirSegmentacaoParaCampanha, limparListasCampanha } from '../services/mailingService.js';

const TURMAS_EXCLUIDAS_SQL = '1,10,14,19,22,27,29';

export async function listar(req, res, next) {
  try {
    const regras = await prisma.regraSegmentacao.findMany({
      orderBy: { criadoEm: 'desc' },
    });
    res.json({ data: regras });
  } catch (error) {
    next(error);
  }
}

export async function obter(req, res, next) {
  try {
    const regra = await prisma.regraSegmentacao.findUnique({
      where: { id: req.params.id },
    });
    if (!regra) return res.status(404).json({ error: 'Regra nao encontrada' });
    res.json({ data: regra });
  } catch (error) {
    next(error);
  }
}

export async function criar(req, res, next) {
  try {
    const { nome, descricao, condicoes } = req.body;
    if (!nome || !condicoes || !Array.isArray(condicoes) || condicoes.length === 0) {
      return res.status(400).json({ error: 'Nome e pelo menos uma condicao sao obrigatorios' });
    }

    const regra = await prisma.regraSegmentacao.create({
      data: {
        nome,
        descricao: descricao || null,
        condicoes,
        criadoPor: req.user?.id || 0,
        criadoPorNome: req.user?.nome || null,
      },
    });

    res.status(201).json({ data: regra });
  } catch (error) {
    next(error);
  }
}

export async function atualizar(req, res, next) {
  try {
    const { nome, descricao, condicoes, ativa } = req.body;
    const regra = await prisma.regraSegmentacao.update({
      where: { id: req.params.id },
      data: {
        ...(nome !== undefined && { nome }),
        ...(descricao !== undefined && { descricao }),
        ...(condicoes !== undefined && { condicoes }),
        ...(ativa !== undefined && { ativa }),
      },
    });
    res.json({ data: regra });
  } catch (error) {
    next(error);
  }
}

export async function remover(req, res, next) {
  try {
    await prisma.regraSegmentacao.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/segmentacoes/executar
 * Executa condicoes avulsas (preview, sem salvar)
 */
export async function executarAvulso(req, res, next) {
  try {
    const { condicoes, page = 1, limit = 20, search = '' } = req.body;
    if (!condicoes || !Array.isArray(condicoes) || condicoes.length === 0) {
      return res.status(400).json({ error: 'Condicoes obrigatorias' });
    }

    const sql = buildSegmentacaoQuery(condicoes, { page, limit, search });
    const rows = await prisma.$queryRawUnsafe(sql);
    const total = rows.length > 0 ? rows[0].total : 0;

    const data = rows.map(r => ({
      codigo: r.codigo,
      nome: r.nome,
      cpf: r.cpf,
      celular: r.celular,
      matricula: r.matricula,
      situacao: r.situacao_calculada,
      situacaoFinanceira: r.situacao_financeira,
      valorDevedor: Number(r.valor_devedor),
    }));

    res.json({ data, total, page, limit });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/segmentacoes/:id/executar
 * Executa regra salva e atualiza metricas
 */
export async function executarRegra(req, res, next) {
  try {
    const regra = await prisma.regraSegmentacao.findUnique({
      where: { id: req.params.id },
    });
    if (!regra) return res.status(404).json({ error: 'Regra nao encontrada' });

    const { page = 1, limit = 20, search = '' } = req.body || {};
    const condicoes = regra.condicoes;

    const sql = buildSegmentacaoQuery(condicoes, { page, limit, search });
    const rows = await prisma.$queryRawUnsafe(sql);
    const total = rows.length > 0 ? rows[0].total : 0;

    // Calcular metricas totais
    const countSql = buildSegmentacaoCountQuery(condicoes);
    const countResult = await prisma.$queryRawUnsafe(countSql);
    const totalGeral = countResult[0]?.total || 0;
    const valorTotal = Number(countResult[0]?.valor_total || 0);

    // Atualizar metricas na regra
    await prisma.regraSegmentacao.update({
      where: { id: req.params.id },
      data: {
        ultimaExecucao: new Date(),
        totalAlunos: totalGeral,
        valorInadimplente: valorTotal,
      },
    });

    const data = rows.map(r => ({
      codigo: r.codigo,
      nome: r.nome,
      cpf: r.cpf,
      celular: r.celular,
      matricula: r.matricula,
      situacao: r.situacao_calculada,
      situacaoFinanceira: r.situacao_financeira,
      valorDevedor: Number(r.valor_devedor),
    }));

    res.json({ data, total, totalGeral, valorTotal, page, limit });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/segmentacoes/turmas
 * Lista turmas disponiveis para filtro
 */
/**
 * POST /api/segmentacoes/:id/subir-campanha
 * Executa a regra, coleta alunos com telefone, sobe como mailing na campanha de massa.
 */
export async function subirCampanha(req, res, next) {
  try {
    const regra = await prisma.regraSegmentacao.findUnique({
      where: { id: req.params.id },
    });
    if (!regra) return res.status(404).json({ error: 'Regra nao encontrada' });

    // Executar regra sem limite para pegar TODOS os alunos
    const sql = buildSegmentacaoQuery(regra.condicoes, { page: 1, limit: 99999 });
    const rows = await prisma.$queryRawUnsafe(sql);

    const alunos = rows.map(r => ({
      codigo: r.codigo,
      nome: r.nome,
      celular: r.celular,
    }));

    const resultado = await subirSegmentacaoParaCampanha(alunos, regra.nome);

    console.log(`[Segmentacao] Regra "${regra.nome}" subida para campanha: ${resultado.totalSubidos} contatos`);

    res.json({ data: resultado });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/segmentacoes/limpar-campanha
 * Limpa todas as listas da campanha de massa.
 */
export async function limparCampanha(req, res, next) {
  try {
    await limparListasCampanha();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/segmentacoes/:id/exportar
 * Retorna dados expandidos para exportacao XLSX (sem paginacao)
 */
export async function exportarRegra(req, res, next) {
  try {
    const regra = await prisma.regraSegmentacao.findUnique({ where: { id: req.params.id } });
    if (!regra) return res.status(404).json({ error: 'Regra nao encontrada' });

    const { campos = [], agregacao = 'matricula' } = req.body;

    // 1. Buscar alunos base da segmentacao (sem paginacao)
    const sql = buildSegmentacaoQuery(regra.condicoes, { page: 1, limit: 99999 });
    const rows = await prisma.$queryRawUnsafe(sql);
    const codigos = rows.map(r => r.codigo);

    if (codigos.length === 0) return res.json({ data: [] });

    // Se agregacao por titulo, retornar 1 linha por contareceber
    if (agregacao === 'titulo') {
      const codigosStr = codigos.join(',');
      const titulos = await prisma.$queryRawUnsafe(`
        SELECT cr.codigo AS titulo_codigo, cr.parcela, cr.valor, cr.valorrecebido, cr.datavencimento,
               cr.situacao, cr.tipoorigem, cr.multa, cr.juro, cr.valordesconto,
               p.codigo AS pessoa_codigo, p.nome, p.cpf, p.celular, p.email,
               m.matricula,
               t.identificadorturma AS turma
        FROM cobranca.contareceber cr
        JOIN cobranca.pessoa p ON p.codigo = cr.pessoa
        LEFT JOIN LATERAL (SELECT matricula FROM cobranca.matricula WHERE aluno = p.codigo ORDER BY data DESC NULLS LAST LIMIT 1) m ON true
        LEFT JOIN cobranca.turma t ON t.codigo = cr.turma
        WHERE cr.pessoa IN (${codigosStr})
          AND (cr.turma IS NULL OR cr.turma NOT IN (${TURMAS_EXCLUIDAS_SQL}))
          AND cr.situacao IN ('AR', 'RE')
        ORDER BY p.nome, cr.datavencimento
      `);

      const data = titulos.map(r => ({
        nome: r.nome,
        cpf: r.cpf,
        celular: r.celular,
        email: r.email,
        matricula: r.matricula,
        turma: r.turma,
        tituloCodigo: r.titulo_codigo,
        parcela: r.parcela,
        tipoOrigem: r.tipoorigem,
        valor: Number(r.valor || 0),
        valorRecebido: Number(r.valorrecebido || 0),
        saldo: Number(r.valor || 0) - Number(r.valorrecebido || 0),
        dataVencimento: r.datavencimento ? new Date(r.datavencimento).toLocaleDateString('pt-BR') : '',
        situacao: r.situacao,
        multa: Number(r.multa || 0),
        juro: Number(r.juro || 0),
        desconto: Number(r.valordesconto || 0),
      }));

      return res.json({ data });
    }

    // 2. Buscar dados expandidos conforme campos solicitados
    const categorias = new Set(campos);
    const precisaDetalhes = categorias.has('pessoal') || categorias.has('academico');
    const precisaFinanceiro = categorias.has('financeiro');
    const precisaEngajamento = categorias.has('engajamento');
    const precisaPlantoes = categorias.has('plantoes');
    const precisaRecorrencia = categorias.has('recorrencia');
    const precisaFlags = categorias.has('flags');
    const precisaSuporte = categorias.has('suporte');

    // Mapa base dos alunos
    const alunosMap = {};
    for (const r of rows) {
      alunosMap[r.codigo] = {
        codigo: r.codigo,
        nome: r.nome,
        cpf: r.cpf,
        celular: r.celular,
        matricula: r.matricula,
        situacao: r.situacao_calculada,
        situacaoFinanceira: r.situacao_financeira,
        valorDevedor: Number(r.valor_devedor || 0),
      };
    }

    // 3. Dados pessoais expandidos
    if (precisaDetalhes) {
      const codigosStr = codigos.join(',');
      const pessoas = await prisma.$queryRawUnsafe(`
        SELECT p.codigo, p.email, p.telefonerecado, p.telefoneres, p.sexo, p.datanasc,
               p.estadocivil, p.endereco, p.numero, p.complemento, p.setor, p.cep, p.seraza,
               p.bloquearcontatocrm, p.created,
               c.nome AS curso_nome, t.identificadorturma AS turma_nome,
               m.data AS data_matricula, m.naoenviarmensagemcobranca
        FROM cobranca.pessoa p
        LEFT JOIN LATERAL (
          SELECT curso, data, naoenviarmensagemcobranca FROM cobranca.matricula WHERE aluno = p.codigo ORDER BY data DESC NULLS LAST LIMIT 1
        ) m ON true
        LEFT JOIN cobranca.curso c ON c.codigo = m.curso
        LEFT JOIN LATERAL (
          SELECT identificadorturma FROM cobranca.turma t2
          JOIN cobranca.contareceber cr ON cr.turma = t2.codigo
          WHERE cr.pessoa = p.codigo AND cr.turma NOT IN (1,10,14,19,22,27,29)
          LIMIT 1
        ) t ON true
        WHERE p.codigo IN (${codigosStr})
      `);
      for (const p of pessoas) {
        if (!alunosMap[p.codigo]) continue;
        Object.assign(alunosMap[p.codigo], {
          email: p.email,
          telefone: p.telefonerecado,
          sexo: p.sexo === 'M' ? 'Masculino' : p.sexo === 'F' ? 'Feminino' : p.sexo,
          dataNascimento: p.datanasc ? new Date(p.datanasc).toLocaleDateString('pt-BR') : '',
          estadoCivil: p.estadocivil,
          endereco: p.endereco ? `${p.endereco}, ${p.numero || 's/n'}` : '',
          complemento: p.complemento,
          bairro: p.setor,
          cep: p.cep,
          serasa: p.seraza ? 'SIM' : 'NAO',
          bloqueiocrm: p.bloquearcontatocrm ? 'SIM' : 'NAO',
          cursoNome: p.curso_nome,
          turmaNome: p.turma_nome,
          dataMatricula: p.data_matricula ? new Date(p.data_matricula).toLocaleDateString('pt-BR') : '',
          naoCobrar: p.naoenviarmensagemcobranca ? 'SIM' : 'NAO',
        });
      }
    }

    // 4. Financeiro expandido
    if (precisaFinanceiro) {
      const codigosStr = codigos.join(',');
      const fin = await prisma.$queryRawUnsafe(`
        SELECT cr.pessoa,
          COUNT(*) FILTER (WHERE cr.situacao = 'AR') AS total_ar,
          COUNT(*) FILTER (WHERE cr.situacao = 'AR' AND cr.datavencimento < CURRENT_DATE AND cr.valor > COALESCE(cr.valorrecebido,0)) AS parcelas_atraso,
          COUNT(*) FILTER (WHERE cr.situacao = 'AR' AND cr.datavencimento >= CURRENT_DATE) AS parcelas_a_vencer,
          COUNT(*) FILTER (WHERE cr.situacao = 'RE') AS parcelas_pagas,
          COALESCE(SUM(CASE WHEN cr.situacao = 'AR' THEN cr.valor - COALESCE(cr.valorrecebido,0) ELSE 0 END), 0) AS valor_aberto,
          COALESCE(SUM(CASE WHEN cr.situacao = 'RE' THEN COALESCE(cr.valorrecebido,0) ELSE 0 END), 0) AS valor_pago
        FROM cobranca.contareceber cr
        WHERE cr.pessoa IN (${codigosStr})
          AND (cr.turma IS NULL OR cr.turma NOT IN (1,10,14,19,22,27,29))
        GROUP BY cr.pessoa
      `);
      for (const f of fin) {
        if (!alunosMap[f.pessoa]) continue;
        Object.assign(alunosMap[f.pessoa], {
          parcelasAtraso: Number(f.parcelas_atraso),
          parcelasAVencer: Number(f.parcelas_a_vencer),
          parcelasPagas: Number(f.parcelas_pagas),
          valorEmAberto: Number(f.valor_aberto),
          valorPago: Number(f.valor_pago),
        });
      }
    }

    // 5. Engajamento
    if (precisaEngajamento) {
      const codigosStr = codigos.join(',');
      const eng = await prisma.$queryRawUnsafe(`
        SELECT pf.matricula AS mat_id, pf.aulas_assistidas, pf.aulas_total_porcentagem,
               pf.dias_desde_ultima_aula, pf.tag, m.aluno AS codigo
        FROM cobranca.pf_alunos pf
        JOIN cobranca.matricula m ON m.matricula = pf.matricula
        WHERE m.aluno IN (${codigosStr})
      `);
      for (const e of eng) {
        if (!alunosMap[e.codigo]) continue;
        Object.assign(alunosMap[e.codigo], {
          aulasAssistidas: e.aulas_assistidas,
          frequencia: e.aulas_total_porcentagem ? `${Number(e.aulas_total_porcentagem).toFixed(1)}%` : '',
          diasDesdeUltimaAula: e.dias_desde_ultima_aula,
          tag: e.tag,
        });
      }
    }

    // 6. Plantoes
    if (precisaPlantoes) {
      const codigosStr = codigos.join(',');
      const plt = await prisma.$queryRawUnsafe(`
        SELECT m.aluno AS codigo,
          COUNT(*) AS total_plantoes,
          COUNT(*) FILTER (WHERE pf.status = 'Realizado') AS realizados
        FROM cobranca.pf_plantoes pf
        JOIN cobranca.matricula m ON m.matricula = pf.matricula
        WHERE m.aluno IN (${codigosStr})
        GROUP BY m.aluno
      `);
      for (const p of plt) {
        if (!alunosMap[p.codigo]) continue;
        Object.assign(alunosMap[p.codigo], {
          totalPlantoes: Number(p.total_plantoes),
          plantoesRealizados: Number(p.realizados),
          jaFoiPlantao: Number(p.realizados) > 0 ? 'SIM' : 'NAO',
        });
      }
    }

    // 7. Recorrencia
    if (precisaRecorrencia) {
      const codigosStr = codigos.join(',');
      const rec = await prisma.$queryRawUnsafe(`
        SELECT pessoa AS codigo,
          COUNT(*) AS total_cadastros,
          BOOL_OR(datacadastro IS NOT NULL AND (datainativacao IS NULL OR datainativacao > CURRENT_TIMESTAMP)) AS ativa
        FROM cobranca.cartaocreditodebitorecorrenciapessoa
        WHERE pessoa IN (${codigosStr})
        GROUP BY pessoa
      `);
      for (const r of rec) {
        if (!alunosMap[r.codigo]) continue;
        Object.assign(alunosMap[r.codigo], {
          recorrenciaAtiva: r.ativa ? 'SIM' : 'NAO',
          totalCadastrosRecorrencia: Number(r.total_cadastros),
        });
      }
    }

    // 8. Suporte (Blip)
    if (precisaSuporte) {
      const codigosStr = codigos.join(',');
      const sup = await prisma.$queryRawUnsafe(`
        SELECT p.codigo,
          COUNT(bt.id) AS total_tickets,
          COUNT(bt.id) FILTER (WHERE bt.team ILIKE '%financeiro%') AS tickets_financeiro
        FROM cobranca.pessoa p
        LEFT JOIN cobranca.blip_contacts bc ON bc.cpf_sanitizado = p.cpf
        LEFT JOIN cobranca.blip_tickets bt ON bt."customerIdentity" = bc.identity
        WHERE p.codigo IN (${codigosStr})
        GROUP BY p.codigo
      `);
      for (const s of sup) {
        if (!alunosMap[s.codigo]) continue;
        Object.assign(alunosMap[s.codigo], {
          totalTicketsBlip: Number(s.total_tickets),
          ticketsFinanceiro: Number(s.tickets_financeiro),
        });
      }
    }

    res.json({ data: Object.values(alunosMap) });
  } catch (error) {
    next(error);
  }
}

export async function listarTurmas(req, res, next) {
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT t.identificadorturma AS nome
      FROM cobranca.turma t
      WHERE t.codigo NOT IN (1,10,14,19,22,27,29)
        AND t.identificadorturma IS NOT NULL
      ORDER BY t.identificadorturma
    `);
    res.json({ data: rows.map(r => r.nome) });
  } catch (error) {
    next(error);
  }
}
