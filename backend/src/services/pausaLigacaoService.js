import { prisma } from '../config/database.js';

const MOTIVOS_VALIDOS = ['EM_NEGOCIACAO', 'CLIENTE_SOLICITOU', 'AGENTE_DECISAO', 'OUTRO'];
const ORIGENS_VALIDAS = ['SISTEMA', 'AGENTE'];

function pausaAtivaWhere() {
  return {
    removidoEm: null,
    OR: [{ pausaAte: null }, { pausaAte: { gt: new Date() } }],
  };
}

async function criarOcorrenciaPausa({ pausa, tipo, origem, agenteNome }) {
  try {
    await prisma.ocorrencia.create({
      data: {
        tipo,
        descricao: tipo === 'PAUSA_LIGACAO_CRIADA'
          ? `Ligações pausadas · ${pausa.motivo}${pausa.pausaAte ? ` (até ${pausa.pausaAte.toISOString().slice(0, 10)})` : ''}`
          : `Pausa de ligações removida${pausa.motivoRemocao ? ` · ${pausa.motivoRemocao}` : ''}`,
        origem,
        pessoaCodigo: pausa.pessoaCodigo,
        pessoaNome: pausa.pessoaNome || null,
        agenteNome: agenteNome || pausa.pausadoPorNome || null,
        acordoId: pausa.acordoId || null,
        metadados: {
          pausaId: pausa.id,
          motivo: pausa.motivo,
          pausaAte: pausa.pausaAte || null,
          motivoRemocao: pausa.motivoRemocao || null,
        },
      },
    });
  } catch (e) {
    console.warn('[PausaLigacao] Falha ao registrar ocorrencia:', e?.message);
  }
}

/**
 * Cria uma pausa. Idempotente para origem=SISTEMA + acordoId:
 * se ja existe pausa ativa para esse acordo, retorna a existente.
 */
export async function criarPausa({
  pessoaCodigo,
  pessoaNome,
  motivo,
  observacao,
  origem,
  acordoId,
  pausadoPor,
  pausadoPorNome,
  pausaAte,
}) {
  if (!pessoaCodigo) throw new Error('pessoaCodigo obrigatorio');
  if (!MOTIVOS_VALIDOS.includes(motivo)) throw new Error(`Motivo invalido: ${motivo}`);
  if (!ORIGENS_VALIDAS.includes(origem)) throw new Error(`Origem invalida: ${origem}`);

  // Idempotencia: se origem=SISTEMA + acordoId, nao duplica
  if (origem === 'SISTEMA' && acordoId) {
    const existente = await prisma.pausaLigacao.findFirst({
      where: {
        acordoId,
        origem: 'SISTEMA',
        ...pausaAtivaWhere(),
      },
    });
    if (existente) return existente;
  }

  // Nao cria outra pausa ativa manual se ja existe qualquer pausa ativa para essa pessoa
  // (permite substituir uma pausa SISTEMA por uma manual desautoriza — tratamos como upsert leve)
  const pausaVigente = await prisma.pausaLigacao.findFirst({
    where: {
      pessoaCodigo,
      ...pausaAtivaWhere(),
    },
  });
  if (pausaVigente) {
    // Ja existe pausa ativa — retorna a existente em vez de criar duplicata
    return pausaVigente;
  }

  const nova = await prisma.pausaLigacao.create({
    data: {
      pessoaCodigo,
      pessoaNome: pessoaNome || null,
      motivo,
      observacao: observacao || null,
      origem,
      acordoId: acordoId || null,
      pausadoPor: Number(pausadoPor) || 0,
      pausadoPorNome: pausadoPorNome || null,
      pausaAte: pausaAte ? new Date(pausaAte) : null,
    },
  });

  await criarOcorrenciaPausa({
    pausa: nova,
    tipo: 'PAUSA_LIGACAO_CRIADA',
    origem,
    agenteNome: pausadoPorNome,
  });

  return nova;
}

/**
 * Remove (soft-delete) uma pausa pelo id.
 */
export async function removerPausa({ pausaId, removidoPor, removidoPorNome, motivoRemocao }) {
  const existente = await prisma.pausaLigacao.findUnique({ where: { id: pausaId } });
  if (!existente) throw new Error('Pausa nao encontrada');
  if (existente.removidoEm) return existente; // idempotente

  const atualizada = await prisma.pausaLigacao.update({
    where: { id: pausaId },
    data: {
      removidoEm: new Date(),
      removidoPor: removidoPor ? Number(removidoPor) : null,
      removidoPorNome: removidoPorNome || null,
      motivoRemocao: motivoRemocao || null,
    },
  });

  await criarOcorrenciaPausa({
    pausa: atualizada,
    tipo: 'PAUSA_LIGACAO_REMOVIDA',
    origem: removidoPor ? 'AGENTE' : 'SISTEMA',
    agenteNome: removidoPorNome,
  });

  return atualizada;
}

/**
 * Remove todas as pausas ativas vinculadas a um acordo.
 * Usado quando acordo muda para CANCELADO/CONCLUIDO/INADIMPLENTE.
 */
export async function removerPausasAtivasPorAcordo(acordoId, motivoRemocao) {
  if (!acordoId) return 0;
  const ativas = await prisma.pausaLigacao.findMany({
    where: { acordoId, ...pausaAtivaWhere() },
  });
  for (const p of ativas) {
    await removerPausa({
      pausaId: p.id,
      removidoPor: null,
      removidoPorNome: 'Sistema',
      motivoRemocao: motivoRemocao || 'Acordo finalizado',
    });
  }
  return ativas.length;
}

/**
 * Retorna Map<pessoaCodigo, pausaAtiva> para uma lista de codigos.
 * Usado para enriquecer preview de segmentacao + filtrar mailing antes de subir.
 */
export async function listarPausasAtivasPorCodigos(codigos) {
  if (!Array.isArray(codigos) || codigos.length === 0) return new Map();
  const ativas = await prisma.pausaLigacao.findMany({
    where: {
      pessoaCodigo: { in: codigos.map(Number) },
      ...pausaAtivaWhere(),
    },
  });
  const map = new Map();
  for (const p of ativas) {
    // Primeira ativa por pessoa ja e suficiente (nao deveria haver 2)
    if (!map.has(p.pessoaCodigo)) map.set(p.pessoaCodigo, p);
  }
  return map;
}

/**
 * Historico completo de pausas de uma pessoa (ativas + removidas).
 */
export async function listarHistoricoPorPessoa(pessoaCodigo) {
  return prisma.pausaLigacao.findMany({
    where: { pessoaCodigo: Number(pessoaCodigo) },
    orderBy: { pausadoEm: 'desc' },
  });
}

/**
 * Retorna a pausa ativa corrente de uma pessoa (ou null).
 */
export async function obterPausaAtivaPorPessoa(pessoaCodigo) {
  return prisma.pausaLigacao.findFirst({
    where: {
      pessoaCodigo: Number(pessoaCodigo),
      ...pausaAtivaWhere(),
    },
    orderBy: { pausadoEm: 'desc' },
  });
}

/**
 * Remove em massa as pausas ativas de uma lista de codigos.
 * Retorna total removido.
 */
export async function removerEmMassaPorCodigos({ codigos, removidoPor, removidoPorNome, motivoRemocao }) {
  if (!Array.isArray(codigos) || codigos.length === 0) return 0;
  const ativas = await prisma.pausaLigacao.findMany({
    where: {
      pessoaCodigo: { in: codigos.map(Number) },
      ...pausaAtivaWhere(),
    },
  });
  for (const p of ativas) {
    await removerPausa({
      pausaId: p.id,
      removidoPor,
      removidoPorNome,
      motivoRemocao: motivoRemocao || 'Remocao em massa',
    });
  }
  return ativas.length;
}

// Etapas em que o aluno esta em negociacao ativa — auto-pausa enquanto nessas etapas
const ETAPAS_AUTO_PAUSA = new Set(['TERMO_ENVIADO', 'ACORDO_GERADO', 'SEI_VINCULADO', 'CHECANDO_PAGAMENTO']);
// Etapas finais — auto-remove pausas do acordo
const ETAPAS_FINAIS = new Set(['CANCELADO', 'CONCLUIDO', 'INADIMPLENTE']);

/**
 * Sincroniza o estado de pausa com a etapa atual do acordo.
 * - Se etapa ativa: cria pausa SISTEMA (idempotente)
 * - Se etapa final: remove pausas SISTEMA deste acordo
 * - Se SELECAO ou nova etapa fora das listas: no-op
 *
 * Seguro para chamar em qualquer controller que mude etapa — eh idempotente.
 */
export async function sincronizarPausaPorEtapa({ acordoId, etapa, pessoaCodigo, pessoaNome }) {
  try {
    if (!acordoId || !etapa) return;

    if (ETAPAS_AUTO_PAUSA.has(etapa)) {
      await criarPausa({
        pessoaCodigo,
        pessoaNome,
        motivo: 'EM_NEGOCIACAO',
        origem: 'SISTEMA',
        acordoId,
        pausadoPor: 0,
        pausadoPorNome: 'Sistema',
      });
      return;
    }

    if (ETAPAS_FINAIS.has(etapa)) {
      await removerPausasAtivasPorAcordo(acordoId, `Acordo ${etapa.toLowerCase()}`);
    }
  } catch (e) {
    console.warn('[PausaLigacao] sincronizarPausaPorEtapa falhou:', e?.message);
  }
}

export { MOTIVOS_VALIDOS, ORIGENS_VALIDAS, ETAPAS_AUTO_PAUSA, ETAPAS_FINAIS };
