import { prisma } from '../config/database.js';
import { Prisma } from '@prisma/client';
import { verificarRecorrencias, detectarDesativacoes, detectarAtivacoes } from '../controllers/cadastroRecorrenciaController.js';
// alunoResumo agora e sincronizado diretamente via WebService SEI (seiviewalunoresumo)

const SEI_API_URL = process.env.SEI_API_URL;
const SEI_AUTH_KEY = process.env.SEI_AUTH_KEY;
const FETCH_TIMEOUT = 120_000;

// -----------------------------------------------
// Tabelas SEI com suporte a delta sync
// Adicionar aqui conforme cada WebService for atualizado
// -----------------------------------------------
const DELTA_TABLES = [
  { model: 'formapagamento', serviceId: 'SEIformapagamento', pk: 'codigo' },
  { model: 'planodesconto', serviceId: 'SEIplanodesconto', pk: 'codigo' },
  { model: 'funcionario', serviceId: 'SEIfuncionario', pk: 'codigo' },
  { model: 'curso', serviceId: 'SEIcurso', pk: 'codigo' },
  { model: 'turma', serviceId: 'SEIturma', pk: 'codigo' },
  { model: 'pessoa', serviceId: 'SEIpessoa', pk: 'codigo' },
  { model: 'matricula', serviceId: 'SEImatricula', pk: 'matricula' },
  { model: 'matriculaperiodo', serviceId: 'SEImatriculaperiodo', pk: 'codigo' },
  { model: 'condicaopagamentoplanofinanceirocurso', serviceId: 'SEIcondicaopagamentoplanofinanceirocurso', pk: 'codigo' },
  { model: 'contareceber', serviceId: 'SEIcontareceber', pk: 'codigo' },
  { model: 'planodescontocontareceber', serviceId: 'SEIplanodescontocontareceber', pk: 'codigo' },
  { model: 'negociacaocontareceber', serviceId: 'SEInegociacaocontareceber', pk: 'codigo' },
  { model: 'contarecebernegociado', serviceId: 'SEIcontarecebernegociado', pk: 'codigo' },
  { model: 'negociacaorecebimento', serviceId: 'SEInegociacaorecebimento', pk: 'codigo' },
  { model: 'contarecebernegociacaorecebimento', serviceId: 'SEIcontarecebernegociacaorecebimento', pk: 'codigo' },
  { model: 'contareceberrecebimento', serviceId: 'SEIcontareceberrecebimento', pk: 'codigo' },
  { model: 'formapagamentonegociacaorecebimento', serviceId: 'SEIformapagamentonegociacaorecebimento', pk: 'codigo' },
  { model: 'cartaocreditodebitorecorrenciapessoa', serviceId: 'SEIcartaocreditodebitorecorrenciapessoa', pk: 'codigo' },
  { model: 'documentoassinado', serviceId: 'SEIdocumentoassinado', pk: 'codigo' },
  { model: 'documentoassinadopessoa', serviceId: 'SEIdocumentoassinadopessoa', pk: 'codigo' },
  { model: 'alunoResumo', serviceId: 'seiviewalunoresumo', pk: 'codigo' },
];

// -----------------------------------------------
// Deteccao automatica de tipos via Prisma DMMF
// -----------------------------------------------
function getFieldTypes(modelName) {
  const dmmfName = modelName.charAt(0).toUpperCase() + modelName.slice(1);
  const model = Prisma.dmmf.datamodel.models.find(m => m.name === dmmfName);
  if (!model) throw new Error(`Model "${dmmfName}" nao encontrado no DMMF`);
  const types = {};
  for (const field of model.fields) {
    if (field.kind === 'scalar') types[field.name] = field.type;
  }
  return types;
}

// -----------------------------------------------
// Sanitizadores (mesmos do fullLoad.js)
// -----------------------------------------------
function parseDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (match) {
    const [, day, month, year, hours, minutes, seconds, ms] = match;
    const iso = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${(ms || '0').padEnd(3, '0')}`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function parseDecimal(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  return Math.round(num * 100) / 100;
}

function parseFloat_(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

function parseInt_(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
}

function parseBigInt_(value) {
  if (value === null || value === undefined || value === '') return null;
  try { return BigInt(value); } catch { return null; }
}

function parseBoolean_(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return null;
}

function parseString_(value) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

function sanitizeRecord(record, fieldTypes) {
  const sanitized = {};
  for (const [key, value] of Object.entries(record)) {
    if (!(key in fieldTypes)) continue;
    if (value === null || value === undefined) { sanitized[key] = null; continue; }
    switch (fieldTypes[key]) {
      case 'DateTime': sanitized[key] = parseDate(value); break;
      case 'Decimal':  sanitized[key] = parseDecimal(value); break;
      case 'Float':    sanitized[key] = parseFloat_(value); break;
      case 'Int':      sanitized[key] = parseInt_(value); break;
      case 'BigInt':   sanitized[key] = parseBigInt_(value); break;
      case 'Boolean':  sanitized[key] = parseBoolean_(value); break;
      case 'String':   sanitized[key] = parseString_(value); break;
      default:         sanitized[key] = value;
    }
  }
  return sanitized;
}

// -----------------------------------------------
// Mapeamento snake_case → camelCase para tabelas com nomes diferentes
// -----------------------------------------------
const FIELD_MAP = {
  alunoResumo: {
    mat_situacao: 'matSituacao',
    nao_enviar_msg: 'naoEnviarMsg',
    valor_devedor: 'valorDevedor',
    parcelas_atraso: 'parcelasAtraso',
    valor_pago: 'valorPago',
    situacao_financeira: 'situacaoFinanceira',
  },
};

function mapearCampos(record, model) {
  const map = FIELD_MAP[model];
  if (!map) return record;
  const mapped = {};
  for (const [key, value] of Object.entries(record)) {
    mapped[map[key] || key] = value;
  }
  return mapped;
}

// -----------------------------------------------
// Chamada a API do SEI com parametro data_ultima_sync
// -----------------------------------------------
async function fetchDelta(serviceId, dataUltimaSync) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(`${SEI_API_URL}/${serviceId}`, {
      method: 'POST',
      headers: {
        'Authorization': SEI_AUTH_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data_ultima_sync: dataUltimaSync }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

// -----------------------------------------------
// Delta sync: fetch + upsert
// -----------------------------------------------
async function syncTableDelta({ model, serviceId, pk }, dataUltimaSync) {
  const startTime = Date.now();

  console.log(`  [${model}] Buscando delta desde ${dataUltimaSync}...`);
  const records = await fetchDelta(serviceId, dataUltimaSync);

  if (!Array.isArray(records) || records.length === 0) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  [${model}] Nenhum registro alterado (${elapsed}s)`);
    return { model, count: 0, elapsed };
  }

  console.log(`  [${model}] ${records.length} registros alterados. Sincronizando...`);

  const fieldTypes = getFieldTypes(model);
  const sanitized = records.map(r => sanitizeRecord(mapearCampos(r, model), fieldTypes));

  // Bulk upsert: deletar existentes + inserir tudo de uma vez
  const pks = sanitized.map(r => r[pk]).filter(v => v !== null && v !== undefined);

  if (pks.length > 30000) {
    // Volume muito grande: processar em batches de 5000 para evitar limite de bind variables
    for (let i = 0; i < pks.length; i += 5000) {
      const batchPks = pks.slice(i, i + 5000);
      const batchData = sanitized.slice(i, i + 5000);
      await prisma[model].deleteMany({ where: { [pk]: { in: batchPks } } });
      await prisma[model].createMany({ data: batchData });
    }
  } else {
    await prisma[model].deleteMany({ where: { [pk]: { in: pks } } });
    await prisma[model].createMany({ data: sanitized });
  }
  const upserted = sanitized.length;

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`  [${model}] ${upserted} registros upserted (${elapsed}s)`);
  return { model, count: upserted, elapsed };
}

// -----------------------------------------------
// Calcular data d-1 (ontem meia-noite)
// -----------------------------------------------
function calcularDataDMenos1() {
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  ontem.setHours(0, 0, 0, 0);
  const yyyy = ontem.getFullYear();
  const mm = String(ontem.getMonth() + 1).padStart(2, '0');
  const dd = String(ontem.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} 00:00:00`;
}

// -----------------------------------------------
// Funcao principal exportavel (usada pelo worker)
// -----------------------------------------------
export async function runDeltaSync(dataOverride) {
  if (!SEI_API_URL || !SEI_AUTH_KEY) {
    console.error('[DeltaSync] SEI_API_URL e SEI_AUTH_KEY nao definidos, pulando sync');
    return;
  }

  const dataUltimaSync = dataOverride || calcularDataDMenos1();

  console.log(`[DeltaSync] Inicio — delta desde ${dataUltimaSync} (${DELTA_TABLES.length} tabelas)`);

  const results = await Promise.allSettled(
    DELTA_TABLES.map(config => syncTableDelta(config, dataUltimaSync))
  );

  let totalRecords = 0;
  const errors = [];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      totalRecords += result.value.count;
    } else {
      const msg = result.reason?.message || String(result.reason);
      errors.push({ table: DELTA_TABLES[i].model, error: msg });
      console.error(`  [${DELTA_TABLES[i].model}] ERRO: ${msg}\n`);
    }
  });

  console.log(`[DeltaSync] Concluido — ${totalRecords} registros upserted, ${errors.length} erros`);

  // aluno_resumo agora e sincronizado diretamente do WebService SEI (seiviewalunoresumo)
  // Nao precisa mais de refresh local — o delta sync ja trata via DELTA_TABLES

  // Verificar recorrencias apos sync
  try {
    await verificarRecorrencias();
    await detectarDesativacoes();
    await detectarAtivacoes();
  } catch (err) {
    console.warn('[DeltaSync] Erro verificacao recorrencias:', err.message?.slice(0, 100));
  }

  return { totalRecords, errors };
}

// -----------------------------------------------
// Execucao direta via CLI: node deltaSync.js [data]
// -----------------------------------------------
const isDirectRun = process.argv[1]?.includes('deltaSync');
if (isDirectRun) {
  const dataUltimaSync = process.argv[2] || calcularDataDMenos1();

  console.log('========================================');
  console.log('  SEI Delta Sync');
  console.log(`  ${new Date().toISOString()}`);
  console.log(`  Delta desde: ${dataUltimaSync}`);
  console.log(`  Tabelas: ${DELTA_TABLES.length}`);
  console.log('========================================\n');

  runDeltaSync(dataUltimaSync)
    .then(({ totalRecords, errors }) => {
      console.log('\n========================================');
      console.log(`  Tabelas OK: ${DELTA_TABLES.length - errors.length}/${DELTA_TABLES.length}`);
      console.log(`  Total registros upserted: ${totalRecords}`);
      if (errors.length > 0) {
        console.log('\n  Erros:');
        for (const e of errors) console.log(`    - ${e.table}: ${e.error}`);
      }
      console.log('========================================');
      prisma.$disconnect();
    })
    .catch((err) => {
      console.error('Erro fatal:', err);
      prisma.$disconnect();
      process.exit(1);
    });
}
