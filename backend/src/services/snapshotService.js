/**
 * Snapshot diario da inadimplencia.
 *
 * Captura uma "foto" da tabela aluno_resumo (codigo, valorDevedor) para
 * cada aluno INADIMPLENTE, gravando em snapshot_inadimplencia_diario com
 * a data BRT. Permite que o funil de cobranca reconstrua a base de
 * inadimplentes em qualquer dia passado a partir da implementacao.
 *
 * Job: tick de 1 min. Quando >= 00:05 BRT e ainda nao ha snapshot do dia
 * atual, captura. ON CONFLICT DO NOTHING garante idempotencia.
 *
 * No boot, captura imediato se nao houver snapshot do dia atual.
 */

import { prisma } from '../config/database.js';

const TICK_MS = 60_000;
const HORA_INICIO_MIN = 5; // 00:05 BRT — depois da virada do dia

let trabalhandoTick = false;

function chaveBRTDia(d = new Date()) {
  const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return brt.toISOString().slice(0, 10);
}

function minutosBRTAgora() {
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return brt.getUTCHours() * 60 + brt.getUTCMinutes();
}

/**
 * Captura snapshot da data informada (formato YYYY-MM-DD) a partir de aluno_resumo.
 * Idempotente via ON CONFLICT (PK = data, pessoaCodigo).
 */
export async function capturarSnapshotDoDia(dataIso = chaveBRTDia()) {
  const inserido = await prisma.$queryRawUnsafe(`
    INSERT INTO cobranca.snapshot_inadimplencia_diario
      (data, "pessoaCodigo", "valorDevedor", "capturadoEm")
    SELECT $1::date, codigo, "valorDevedor", NOW()
    FROM cobranca.aluno_resumo
    WHERE "situacaoFinanceira" = 'INADIMPLENTE'
      AND COALESCE("valorDevedor", 0) > 0
    ON CONFLICT (data, "pessoaCodigo") DO NOTHING
    RETURNING 1
  `, dataIso);

  const qtd = inserido.length;
  console.log(`[Snapshot] Capturado ${qtd} inadimplente(s) em ${dataIso}`);
  return qtd;
}

async function jaTemSnapshotHoje() {
  const hoje = chaveBRTDia();
  const r = await prisma.$queryRawUnsafe(`
    SELECT 1 FROM cobranca.snapshot_inadimplencia_diario
    WHERE data = $1::date LIMIT 1
  `, hoje);
  return r.length > 0;
}

async function tick() {
  if (trabalhandoTick) return;
  if (minutosBRTAgora() < HORA_INICIO_MIN) return;
  if (await jaTemSnapshotHoje()) return;

  trabalhandoTick = true;
  try {
    await capturarSnapshotDoDia();
  } catch (err) {
    console.error('[Snapshot] Erro no tick:', err.message);
  } finally {
    trabalhandoTick = false;
  }
}

export async function startSnapshotScheduler() {
  // Captura imediata no boot se ainda nao houver snapshot do dia
  try {
    if (!(await jaTemSnapshotHoje())) {
      await capturarSnapshotDoDia();
    }
  } catch (err) {
    console.error('[Snapshot] Erro na captura inicial:', err.message);
  }

  setInterval(() => {
    tick().catch(err => console.error('[Snapshot] Erro:', err.message));
  }, TICK_MS);

  console.log('[Snapshot] Scheduler iniciado (tick 1min, captura >= 00:05 BRT)');
}
