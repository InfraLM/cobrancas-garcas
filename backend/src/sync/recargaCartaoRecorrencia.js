/**
 * Script ad-hoc: full reload da tabela `cartaocreditodebitorecorrenciapessoa`.
 *
 * Por que existe:
 *   O delta sync padrao (deltaSync.js) nao traz registros novos dessa tabela
 *   porque os campos `created`/`updated` sao NULL para todos os registros no
 *   SEI, e o WebService incremental do lado deles filtra por esses campos.
 *   Resultado: a tabela fica congelada — qualquer cartao cadastrado apos o
 *   ultimo full load some do nosso clone.
 *
 * O que faz:
 *   1. Busca TODOS os registros via POST {SEI_API_URL}/SEIcartaocreditodebitorecorrenciapessoa
 *      (sem `data_ultima_sync` = full load).
 *   2. TRUNCATE + createMany no clone.
 *   3. Dispara verificarRecorrencias / detectarAtivacoes / detectarDesativacoes
 *      para reprocessar cadastros em MONITORANDO contra os cartoes novos.
 *
 * Como rodar (manual):
 *   node backend/src/sync/recargaCartaoRecorrencia.js
 *
 * Tamanho da tabela: ~400 registros. Roda em segundos.
 */

import { prisma } from '../config/database.js';
import { Prisma } from '@prisma/client';
import {
  verificarRecorrencias,
  detectarDesativacoes,
  detectarAtivacoes,
} from '../controllers/cadastroRecorrenciaController.js';

const SEI_API_URL = process.env.SEI_API_URL;
const SEI_AUTH_KEY = process.env.SEI_AUTH_KEY;
const FETCH_TIMEOUT = 60_000;
const MODEL = 'cartaocreditodebitorecorrenciapessoa';
const SERVICE_ID = 'SEIcartaocreditodebitorecorrenciapessoa';

// ----- Sanitizadores (replica do fullLoad.js / deltaSync.js) -----

function parseDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  const m = value.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (m) {
    const [, day, month, year, hh, mm, ss, ms] = m;
    const iso = `${year}-${month}-${day}T${hh}:${mm}:${ss}.${(ms || '0').padEnd(3, '0')}`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

const parseDecimal = (v) => v === null || v === undefined || v === '' ? null : (isNaN(parseFloat(v)) ? null : Math.round(parseFloat(v) * 100) / 100);
const parseFloat_ = (v) => v === null || v === undefined || v === '' ? null : (isNaN(parseFloat(v)) ? null : parseFloat(v));
const parseInt_ = (v) => v === null || v === undefined || v === '' ? null : (isNaN(parseInt(v, 10)) ? null : parseInt(v, 10));
const parseBigInt_ = (v) => { if (v === null || v === undefined || v === '') return null; try { return BigInt(v); } catch { return null; } };
const parseBoolean_ = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.toLowerCase() === 'true';
  return null;
};
const parseString_ = (v) => v === null || v === undefined ? null : (String(v).trim() === '' ? null : String(v).trim());

function getFieldTypes(modelName) {
  const dmmfName = modelName.charAt(0).toUpperCase() + modelName.slice(1);
  const model = Prisma.dmmf.datamodel.models.find(m => m.name === dmmfName);
  if (!model) throw new Error(`Model "${dmmfName}" nao encontrado no DMMF`);
  const types = {};
  for (const f of model.fields) if (f.kind === 'scalar') types[f.name] = f.type;
  return types;
}

function sanitizeRecord(record, fieldTypes) {
  const out = {};
  for (const [k, v] of Object.entries(record)) {
    if (!(k in fieldTypes)) continue;
    if (v === null || v === undefined) { out[k] = null; continue; }
    switch (fieldTypes[k]) {
      case 'DateTime': out[k] = parseDate(v); break;
      case 'Decimal':  out[k] = parseDecimal(v); break;
      case 'Float':    out[k] = parseFloat_(v); break;
      case 'Int':      out[k] = parseInt_(v); break;
      case 'BigInt':   out[k] = parseBigInt_(v); break;
      case 'Boolean':  out[k] = parseBoolean_(v); break;
      case 'String':   out[k] = parseString_(v); break;
      default:         out[k] = v;
    }
  }
  return out;
}

async function fetchFromSEI() {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(`${SEI_API_URL}/${SERVICE_ID}`, {
      method: 'POST',
      headers: { 'Authorization': SEI_AUTH_KEY, 'Content-Type': 'application/json' },
      // SEI exige data_ultima_sync no body. Data antiga (2000-01-01) atua como "full"
      // — mesmo padrao usado pelo fullLoad.js para seiviewalunoresumo.
      body: JSON.stringify({ data_ultima_sync: '2000-01-01 00:00:00' }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// ----- Main -----

async function main() {
  if (!SEI_API_URL || !SEI_AUTH_KEY) {
    console.error('ERRO: SEI_API_URL e SEI_AUTH_KEY devem estar definidos no .env');
    process.exit(1);
  }

  console.log('========================================');
  console.log('  Recarga: cartaocreditodebitorecorrenciapessoa');
  console.log(`  ${new Date().toISOString()}`);
  console.log('========================================\n');

  // 1. Snapshot do estado antes (pra log de diff)
  const antes = await prisma.cartaocreditodebitorecorrenciapessoa.count();
  console.log(`Antes: ${antes} registros no clone`);

  // 2. Fetch full
  console.log(`Buscando ${SERVICE_ID}...`);
  const records = await fetchFromSEI();
  if (!Array.isArray(records)) {
    throw new Error(`Resposta nao e array: ${JSON.stringify(records).slice(0, 200)}`);
  }
  console.log(`Recebidos: ${records.length} registros`);

  // 3. Sanitizar
  const fieldTypes = getFieldTypes(MODEL);
  const sanitized = records.map(r => sanitizeRecord(r, fieldTypes));

  // 4. Truncate + createMany (mesmo padrao do fullLoad)
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE cobranca."${MODEL}"`);
  await prisma.cartaocreditodebitorecorrenciapessoa.createMany({ data: sanitized });

  const depois = await prisma.cartaocreditodebitorecorrenciapessoa.count();
  console.log(`Depois: ${depois} registros (delta: ${depois - antes >= 0 ? '+' : ''}${depois - antes})`);

  // 5. Disparar verificacao de recorrencias (atualiza cadastro_recorrencia
  //    em MONITORANDO baseado nos cartoes recem chegados)
  console.log('\nDisparando verificarRecorrencias / detectarAtivacoes / detectarDesativacoes...');
  try {
    await verificarRecorrencias();
    await detectarAtivacoes();
    await detectarDesativacoes();
    console.log('Verificacoes concluidas.');
  } catch (err) {
    console.warn('Aviso na verificacao:', err.message?.slice(0, 200));
  }

  console.log('\n✅ Recarga concluida.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  prisma.$disconnect();
  process.exit(1);
});
