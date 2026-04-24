import { prisma } from '../config/database.js';
import { obterPausaAtivaPorPessoa } from '../services/pausaLigacaoService.js';
import { buildBuscaClauses } from '../utils/buscaNomeHelper.js';

const CURSO_PERMITIDO = 1;
const TURMAS_EXCLUIDAS = [1, 10, 14, 19, 22, 27, 29];
const TURMAS_EXCLUIDAS_SQL = TURMAS_EXCLUIDAS.join(',');
const PESSOAS_EXCECAO = [589]; // Andre Garcia Ribeiro — funcionario mas usado para testes

/**
 * GET /api/alunos?search=&situacao=&financeiro=&page=1&limit=20
 * situacao: ATIVO, TRANCADO, CANCELADO (calculada via proxy)
 * financeiro: ADIMPLENTE, INADIMPLENTE
 */
export async function listar(req, res, next) {
  try {
    const search = String(req.query.search || '').trim();
    const situacao = String(req.query.situacao || '');
    const financeiro = String(req.query.financeiro || '');
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    // Monta busca (nome + cpf + matricula) com ranking de relevancia via pg_trgm.
    const busca = buildBuscaClauses({
      colunaNome: 'nome',
      termo: search,
      extras: { colunaCpf: 'cpf', colunaMatricula: 'matricula' },
      paramStartIndex: 1,
      fallbackOrderBy: 'nome',
    });

    // Concatena filtros de situacao/financeiro com os params da busca.
    const filtroExtras = [];
    const params = [...busca.params];
    let idx = busca.nextIndex;
    if (situacao) { filtroExtras.push(`situacao = $${idx++}`); params.push(situacao); }
    if (financeiro) { filtroExtras.push(`"situacaoFinanceira" = $${idx++}`); params.push(financeiro); }

    const whereParts = [];
    if (busca.filterClause) whereParts.push(busca.filterClause);
    if (filtroExtras.length) whereParts.push(...filtroExtras);

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    params.push(limit, offset);
    const limitIdx = idx++;
    const offsetIdx = idx++;

    const rows = await prisma.$queryRawUnsafe(`
      SELECT codigo, nome, cpf, celular, matricula, turma,
        situacao AS situacao_calculada,
        "situacaoFinanceira" AS situacao_financeira,
        "valorDevedor" AS valor_devedor,
        "parcelasAtraso" AS parcelas_atraso,
        COUNT(*) OVER()::int AS total
      FROM cobranca.aluno_resumo
      ${whereClause}
      ORDER BY ${busca.orderClause}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `, ...params);

    const total = rows.length > 0 ? rows[0].total : 0;

    const data = rows.map(r => ({
      codigo: r.codigo,
      nome: r.nome,
      cpf: r.cpf,
      celular: r.celular,
      matricula: r.matricula,
      turma: r.turma,
      situacao: r.situacao_calculada,
      situacaoFinanceira: r.situacao_financeira,
      valorDevedor: Number(r.valor_devedor || 0),
    }));

    res.json({ data, total, page, limit });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/alunos/:codigo
 */
export async function obter(req, res, next) {
  try {
    const codigo = Number(req.params.codigo);

    const pessoaRows = await prisma.$queryRawUnsafe(`
      SELECT
        p.codigo, p.nome, p.cpf, p.email, p.celular, p.telefonerecado, p.telefoneres,
        p.sexo, p.datanasc, p.estadocivil, p.rg, p.created AS data_criacao,
        p.endereco, p.numero, p.complemento, p.setor AS bairro, p.cep,
        COALESCE(p.seraza, false) AS serasa,
        COALESCE(p.bloquearcontatocrm, false) AS bloquear_contato_crm,
        m.matricula, m.situacao AS situacao_matricula, m.data AS data_matricula,
        COALESCE(m.naoenviarmensagemcobranca, false) AS nao_enviar_msg,
        c.nome AS curso_nome,
        turma_info.identificadorturma AS turma_identificador
      FROM cobranca.pessoa p
      LEFT JOIN LATERAL (
        SELECT matricula, situacao, data, curso, naoenviarmensagemcobranca
        FROM cobranca.matricula
        WHERE aluno = p.codigo AND curso = ${CURSO_PERMITIDO}
        ORDER BY data DESC NULLS LAST LIMIT 1
      ) m ON true
      LEFT JOIN cobranca.curso c ON c.codigo = m.curso
      LEFT JOIN LATERAL (
        SELECT DISTINCT t.identificadorturma
        FROM cobranca.contareceber cr
        JOIN cobranca.turma t ON t.codigo = cr.turma
        WHERE cr.matriculaaluno = m.matricula
          AND cr.turma NOT IN (${TURMAS_EXCLUIDAS_SQL})
        LIMIT 1
      ) turma_info ON true
      WHERE p.codigo = $1
    `, codigo);

    if (!pessoaRows || pessoaRows.length === 0) {
      return res.status(404).json({ error: 'Aluno nao encontrado' });
    }

    const p = pessoaRows[0];

    // Queries em paralelo
    const [finRows, serasaRows, pausaAtiva] = await Promise.all([
      prisma.$queryRawUnsafe(`
        SELECT
          COUNT(*)::int AS total_parcelas,
          COUNT(*) FILTER (WHERE cr.situacao='AR' AND cr.datavencimento < CURRENT_DATE AND cr.valor > COALESCE(cr.valorrecebido,0))::int AS parcelas_em_atraso,
          COUNT(*) FILTER (WHERE cr.situacao='AR' AND cr.datavencimento >= CURRENT_DATE)::int AS parcelas_a_vencer,
          COUNT(*) FILTER (WHERE cr.situacao='RE')::int AS parcelas_pagas,
          COUNT(*) FILTER (WHERE cr.situacao='NE')::int AS parcelas_negociadas,
          COUNT(*) FILTER (WHERE cr.situacao='CF')::int AS parcelas_canceladas,
          COALESCE(SUM(CASE WHEN cr.situacao='AR' THEN cr.valor - COALESCE(cr.valorrecebido,0) ELSE 0 END), 0) AS valor_em_aberto,
          COALESCE(SUM(CASE WHEN cr.situacao='AR' AND cr.datavencimento < CURRENT_DATE AND cr.valor > COALESCE(cr.valorrecebido,0)
            THEN cr.valor - COALESCE(cr.valorrecebido,0) ELSE 0 END), 0) AS valor_inadimplente,
          COALESCE(SUM(CASE WHEN cr.situacao='RE' THEN COALESCE(cr.valorrecebido,0) ELSE 0 END), 0) AS valor_pago,
          MIN(CASE WHEN cr.situacao='AR' AND cr.datavencimento < CURRENT_DATE AND cr.valor > COALESCE(cr.valorrecebido,0) THEN cr.datavencimento END) AS vencimento_mais_antigo
        FROM cobranca.contareceber cr
        WHERE cr.pessoa = $1
          AND (cr.turma IS NULL OR cr.turma NOT IN (${TURMAS_EXCLUIDAS_SQL}))
      `, codigo),
      prisma.$queryRawUnsafe(`
        SELECT id, contrato, valor, valor_numerico, situacao, enviado_em, baixado_em
        FROM cobranca.serasa
        WHERE cpf_cnpj_numerico = REGEXP_REPLACE(COALESCE($1, ''), '[^0-9]', '', 'g')
        ORDER BY enviado_em DESC
      `, p.cpf),
      obterPausaAtivaPorPessoa(codigo),
    ]);

    const fin = finRows[0] || {};

    res.json({
      data: {
        codigo: p.codigo,
        nome: p.nome,
        cpf: p.cpf,
        email: p.email,
        celular: p.celular,
        telefone1: p.telefonerecado,
        sexo: p.sexo,
        dataNascimento: p.datanasc,
        estadoCivil: p.estadocivil,
        rg: p.rg,
        dataCriacao: p.data_criacao,
        endereco: p.endereco,
        numero: p.numero,
        complemento: p.complemento,
        bairro: p.bairro,
        cep: p.cep,
        serasa: p.serasa,
        bloquearContatoCrm: p.bloquear_contato_crm,
        matricula: p.matricula,
        situacaoMatricula: p.situacao_matricula,
        dataMatricula: p.data_matricula,
        naoEnviarMensagemCobranca: p.nao_enviar_msg,
        cursoNome: p.curso_nome,
        turmaIdentificador: p.turma_identificador,
        resumoFinanceiro: {
          totalParcelas: fin.total_parcelas || 0,
          parcelasEmAtraso: fin.parcelas_em_atraso || 0,
          parcelasAVencer: fin.parcelas_a_vencer || 0,
          parcelasPagas: fin.parcelas_pagas || 0,
          parcelasNegociadas: fin.parcelas_negociadas || 0,
          parcelasCanceladas: fin.parcelas_canceladas || 0,
          valorEmAberto: Number(fin.valor_em_aberto || 0),
          valorInadimplente: Number(fin.valor_inadimplente || 0),
          valorPago: Number(fin.valor_pago || 0),
          vencimentoMaisAntigo: fin.vencimento_mais_antigo || null,
        },
        serasaRegistros: serasaRows.map(s => ({
          id: s.id,
          contrato: s.contrato,
          valor: s.valor,
          valorNumerico: s.valor_numerico,
          situacao: s.situacao,
          enviadoEm: s.enviado_em,
          baixadoEm: s.baixado_em,
        })),
        pausaAtiva: pausaAtiva ? {
          id: pausaAtiva.id,
          motivo: pausaAtiva.motivo,
          observacao: pausaAtiva.observacao,
          origem: pausaAtiva.origem,
          acordoId: pausaAtiva.acordoId,
          pausaAte: pausaAtiva.pausaAte,
          pausadoEm: pausaAtiva.pausadoEm,
          pausadoPorNome: pausaAtiva.pausadoPorNome,
        } : null,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/alunos/:codigo/parcelas?situacao=
 */
export async function parcelas(req, res, next) {
  try {
    const codigo = Number(req.params.codigo);
    const situacao = String(req.query.situacao || '');

    const rows = await prisma.$queryRawUnsafe(`
      SELECT cr.codigo, cr.valor, cr.valorrecebido, cr.datavencimento, cr.situacao, cr.tipoorigem,
             cr.multa, cr.juro, cr.valordesconto
      FROM cobranca.contareceber cr
      WHERE cr.pessoa = $1
        AND (cr.turma IS NULL OR cr.turma NOT IN (${TURMAS_EXCLUIDAS_SQL}))
        AND cr.situacao IN ('AR', 'RE')
        AND ($2 = '' OR cr.situacao = $2)
      ORDER BY cr.datavencimento DESC
    `, codigo, situacao);

    res.json({
      data: rows.map(r => ({
        codigo: r.codigo,
        valor: Number(r.valor || 0),
        valorRecebido: Number(r.valorrecebido || 0),
        dataVencimento: r.datavencimento,
        situacao: r.situacao,
        tipoOrigem: r.tipoorigem,
        multa: Number(r.multa || 0),
        juro: Number(r.juro || 0),
        desconto: Number(r.valordesconto || 0),
      })),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/alunos/:codigo/engajamento
 */
export async function engajamento(req, res, next) {
  try {
    const codigo = Number(req.params.codigo);

    const rows = await prisma.$queryRawUnsafe(`
      SELECT pf.*
      FROM cobranca.pf_alunos pf
      INNER JOIN cobranca.matricula mat ON mat.matricula = pf.matricula
      WHERE mat.aluno = $1 AND mat.curso = ${CURSO_PERMITIDO}
      ORDER BY mat.data DESC NULLS LAST
      LIMIT 1
    `, codigo);

    if (!rows || rows.length === 0) {
      return res.json({ data: null });
    }

    const r = rows[0];
    res.json({
      data: {
        matricula: r.matricula,
        turma: r.turma,
        statusFinanceiro: r.status_financeiro,
        aulasAssistidas: r.aulas_assistidas,
        aulasTotalPorcentagem: r.aulas_total_porcentagem,
        diasDesdePrimeiraAula: r.dias_desde_primeira_aula,
        diasDesdeUltimaAula: r.dias_desde_ultima_aula,
        criadoEm: r.criado_em,
        cidade: r.cidade,
        tag: r.tag,
        parcelasPagas: r.parcelas_pagas,
        parcelasAtraso: r.parcelas_atraso,
        parcelasAberto: r.parcelas_aberto,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/alunos/:codigo/plantoes
 */
export async function plantoes(req, res, next) {
  try {
    const codigo = Number(req.params.codigo);

    const rows = await prisma.$queryRawUnsafe(`
      SELECT pf.id, pf.data_plantao, pf.data_marcado, pf.status, pf.moscow
      FROM cobranca.pf_plantoes pf
      INNER JOIN cobranca.matricula mat ON mat.matricula = pf.matricula
      WHERE mat.aluno = $1 AND mat.curso = ${CURSO_PERMITIDO}
      ORDER BY pf.data_plantao DESC
    `, codigo);

    res.json({
      data: rows.map(r => ({
        id: r.id,
        dataPlantao: r.data_plantao,
        dataMarcado: r.data_marcado,
        status: r.status,
        moscow: r.moscow,
      })),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/alunos/:codigo/suporte
 */
export async function suporte(req, res, next) {
  try {
    const codigo = Number(req.params.codigo);

    const pessoaRows = await prisma.$queryRawUnsafe(
      `SELECT cpf FROM cobranca.pessoa WHERE codigo = $1`, codigo
    );

    if (!pessoaRows || pessoaRows.length === 0) {
      return res.json({ data: null });
    }

    const cpf = pessoaRows[0].cpf;
    if (!cpf) return res.json({ data: null });

    const ticketRows = await prisma.$queryRawUnsafe(`
      SELECT bt.id, bt.team, bt.status, bt."storageDate" AS data, bt.closed
      FROM cobranca.blip_tickets bt
      JOIN cobranca.blip_contacts bc ON bt."customerIdentity" = bc.identity
      WHERE bc.cpf_sanitizado = $1
      ORDER BY bt."storageDate" DESC
    `, cpf);

    const tickets = ticketRows || [];
    const totalTickets = tickets.length;
    const ticketsFinanceiro = tickets.filter(t => t.team?.toLowerCase().includes('financeiro')).length;
    const ultimoTicket = tickets.length > 0 ? tickets[0].data : null;
    const primeiroTicket = tickets.length > 0 ? tickets[tickets.length - 1].data : null;

    res.json({
      data: {
        totalTickets,
        ticketsFinanceiro,
        ultimoTicket,
        primeiroTicket,
        tickets: tickets.map(t => ({
          id: t.id,
          equipe: t.team,
          status: t.closed ? 'Fechado' : (t.status || 'Aberto'),
          data: t.data,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/alunos/:codigo/ocorrencias
 * Timeline unificada: WhatsApp, ligacoes, tickets Blip, plantoes, serasa, negociacoes
 */
export async function ocorrencias(req, res, next) {
  try {
    const codigo = Number(req.params.codigo);

    // Buscar CPF primeiro (necessario para blip e serasa)
    const pessoaCpf = await prisma.$queryRawUnsafe(
      `SELECT cpf FROM cobranca.pessoa WHERE codigo = $1`, codigo
    ).catch(() => []);
    const cpf = pessoaCpf[0]?.cpf || null;

    // Rodar TODAS as queries em paralelo
    const [mensagens, ligacoes, tickets, plantoesRows, serasaRows, conversas] = await Promise.all([
      prisma.$queryRawUnsafe(`
        SELECT id, tipo, corpo, "fromMe", "criadoEm", "agenteNome"
        FROM cobranca.mensagem_whatsapp WHERE "pessoaCodigo" = $1
        ORDER BY "criadoEm" DESC LIMIT 50
      `, codigo).catch(() => []),

      prisma.$queryRawUnsafe(`
        SELECT id, telefone, "agenteNome", "dataHoraChamada", "tempoFalando", "qualificacaoNome"
        FROM cobranca.registro_ligacao WHERE "pessoaCodigo" = $1
        ORDER BY "dataHoraChamada" DESC LIMIT 50
      `, codigo).catch(() => []),

      cpf ? prisma.$queryRawUnsafe(`
        SELECT bt.id, bt.team, bt.status, bt."storageDate", bt.closed
        FROM cobranca.blip_tickets bt JOIN cobranca.blip_contacts bc ON bt."customerIdentity" = bc.identity
        WHERE bc.cpf_sanitizado = $1 ORDER BY bt."storageDate" DESC LIMIT 30
      `, cpf).catch(() => []) : [],

      prisma.$queryRawUnsafe(`
        SELECT pf.id, pf.data_plantao, pf.status FROM cobranca.pf_plantoes pf
        INNER JOIN cobranca.matricula mat ON mat.matricula = pf.matricula
        WHERE mat.aluno = $1 AND mat.curso = ${CURSO_PERMITIDO}
      `, codigo).catch(() => []),

      cpf ? prisma.$queryRawUnsafe(`
        SELECT id, contrato, valor, situacao, enviado_em, baixado_em FROM cobranca.serasa
        WHERE cpf_cnpj_numerico = REGEXP_REPLACE(COALESCE($1, ''), '[^0-9]', '', 'g')
      `, cpf).catch(() => []) : [],

      prisma.$queryRawUnsafe(`
        SELECT id, status, "agenteNome", "motivoEncerramento", "criadoEm", "encerradoEm"
        FROM cobranca.conversa_cobranca WHERE "pessoaCodigo" = $1
        ORDER BY "criadoEm" DESC LIMIT 20
      `, codigo).catch(() => []),
    ]);

    const timeline = [];

    for (const c of conversas) {
      timeline.push({
        id: `conv-${c.id}`,
        tipo: 'CONVERSA_CRIADA',
        descricao: `Conversa de cobranca · ${c.status}`,
        agente: c.agenteNome || null,
        data: c.criadoEm,
      });
      if (c.encerradoEm) {
        timeline.push({
          id: `conv-${c.id}-enc`,
          tipo: 'CONVERSA_ENCERRADA',
          descricao: `Encerrada: ${c.motivoEncerramento || 'sem motivo'}`,
          agente: c.agenteNome || null,
          data: c.encerradoEm,
        });
      }
    }

    // Ordenar por data DESC
    timeline.sort((a, b) => {
      const da = a.data ? new Date(a.data).getTime() : 0;
      const db = b.data ? new Date(b.data).getTime() : 0;
      return db - da;
    });

    res.json({ data: timeline });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/alunos/:codigo/recorrencia
 */
export async function recorrencia(req, res, next) {
  try {
    const codigo = Number(req.params.codigo);

    const rows = await prisma.$queryRawUnsafe(`
      SELECT c.codigo, c.numerocartaomascarado, c.nomecartao, c.mesvalidade, c.anovalidade,
             c.situacao, c.datacadastro, c.datainativacao, c.motivoinativacao,
             c.diapagamentopadrao, c.inativadoviarecorrencia, c.celularcartao, c.emailcartao,
             c.matricula
      FROM cobranca.cartaocreditodebitorecorrenciapessoa c
      WHERE c.pessoa = $1
      ORDER BY c.datacadastro DESC
    `, codigo);

    const agora = new Date();
    const ativaAgora = rows.some(r =>
      r.datacadastro && new Date(r.datacadastro) <= agora &&
      (!r.datainativacao || new Date(r.datainativacao) > agora)
    );

    res.json({
      data: {
        recorrenciaAtiva: ativaAgora,
        totalCadastros: rows.length,
        cartoes: rows.map(r => ({
          codigo: r.codigo,
          numeroMascarado: r.numerocartaomascarado,
          nome: r.nomecartao,
          mesValidade: r.mesvalidade,
          anoValidade: r.anovalidade,
          situacao: r.situacao,
          dataCadastro: r.datacadastro,
          dataInativacao: r.datainativacao,
          motivoInativacao: r.motivoinativacao,
          diaPagamento: r.diapagamentopadrao,
          inativadoViaRecorrencia: r.inativadoviarecorrencia,
          celular: r.celularcartao,
          email: r.emailcartao,
          matricula: r.matricula,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/alunos/:codigo/serasa
 */
export async function serasaRegistros(req, res, next) {
  try {
    const codigo = Number(req.params.codigo);

    const rows = await prisma.$queryRawUnsafe(`
      SELECT s.id, s.contrato, s.valor, s.valor_numerico, s.situacao, s.enviado_em, s.baixado_em
      FROM cobranca.serasa s
      JOIN cobranca.pessoa p ON p.codigo = $1
      WHERE s.cpf_cnpj_numerico = REGEXP_REPLACE(COALESCE(p.cpf, ''), '[^0-9]', '', 'g')
      ORDER BY s.enviado_em DESC
    `, codigo);

    res.json({
      data: rows.map(r => ({
        id: r.id,
        contrato: r.contrato,
        valor: r.valor,
        valorNumerico: r.valor_numerico,
        situacao: r.situacao,
        enviadoEm: r.enviado_em,
        baixadoEm: r.baixado_em,
      })),
    });
  } catch (error) {
    next(error);
  }
}
