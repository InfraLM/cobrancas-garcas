import { prisma } from '../config/database.js';
import { Prisma } from '@prisma/client';

const SEI_API_URL = process.env.SEI_API_URL;
const SEI_AUTH_KEY = process.env.SEI_AUTH_KEY;
const FETCH_TIMEOUT = 120_000; // 2 minutos por request

// -----------------------------------------------
// Mapeamento das 20 tabelas SEI
// -----------------------------------------------
const TABLE_CONFIG = [
  { model: 'formapagamento', serviceId: 'SEIformapagamento' },
  { model: 'planodesconto', serviceId: 'SEIplanodesconto' },
  { model: 'funcionario', serviceId: 'SEIfuncionario' },
  { model: 'curso', serviceId: 'SEIcurso' },
  { model: 'turma', serviceId: 'SEIturma' },
  { model: 'pessoa', serviceId: 'SEIpessoa' },
  { model: 'matricula', serviceId: 'SEImatricula' },
  { model: 'matriculaperiodo', serviceId: 'SEImatriculaperiodo' },
  { model: 'condicaopagamentoplanofinanceirocurso', serviceId: 'SEIcondicaopagamentoplanofinanceirocurso' },
  { model: 'contareceber', serviceId: 'SEIcontareceber' },
  { model: 'planodescontocontareceber', serviceId: 'SEIplanodescontocontareceber' },
  { model: 'negociacaocontareceber', serviceId: 'SEInegociacaocontareceber' },
  { model: 'contarecebernegociado', serviceId: 'SEIcontarecebernegociado' },
  { model: 'negociacaorecebimento', serviceId: 'SEInegociacaorecebimento' },
  { model: 'contarecebernegociacaorecebimento', serviceId: 'SEIcontarecebernegociacaorecebimento' },
  { model: 'contareceberrecebimento', serviceId: 'SEIcontareceberrecebimento' },
  { model: 'formapagamentonegociacaorecebimento', serviceId: 'SEIformapagamentonegociacaorecebimento' },
  { model: 'cartaocreditodebitorecorrenciapessoa', serviceId: 'SEIcartaocreditodebitorecorrenciapessoa' },
  { model: 'documentoassinado', serviceId: 'SEIdocumentoassinado' },
  { model: 'documentoassinadopessoa', serviceId: 'SEIdocumentoassinadopessoa' },
  { model: 'alunoResumo', serviceId: 'seiviewalunoresumo' },
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
    types[field.name] = field.type;
  }
  return types;
}

// -----------------------------------------------
// Sanitizadores por tipo
// -----------------------------------------------

// Datas: SEI envia "DD-MM-YYYY HH:mm:ss.SSS"
function parseDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  // Formato SEI: "DD-MM-YYYY HH:mm:ss.SSS"
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (match) {
    const [, day, month, year, hours, minutes, seconds, ms] = match;
    const iso = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${(ms || '0').padEnd(3, '0')}`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }
  // Fallback: parse direto
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// Decimais: arredondar 2 casas (Math.round * 100 / 100)
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
  return str === '' ? null : str; // string vazia -> null (evita violacao de unique constraints)
}

// -----------------------------------------------
// Sanitizacao de um registro completo
// -----------------------------------------------
function sanitizeRecord(record, fieldTypes) {
  const sanitized = {};
  for (const [key, value] of Object.entries(record)) {
    if (!(key in fieldTypes)) continue; // campo nao existe no model

    if (value === null || value === undefined) {
      sanitized[key] = null;
      continue;
    }

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
// Chamada a API do SEI
// -----------------------------------------------
async function fetchFromSEI(serviceId, bodyOverride) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(`${SEI_API_URL}/${serviceId}`, {
      method: 'POST',
      headers: {
        'Authorization': SEI_AUTH_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyOverride || {}),
      signal: controller.signal,
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
// Sync de uma tabela: delete all + createMany em batches
// -----------------------------------------------
async function syncTable({ model, serviceId }) {
  const startTime = Date.now();

  // 1. Fetch da API
  console.log(`  [${model}] Buscando ${serviceId}...`);
  // Webservice SEI passou a exigir data_ultima_sync no body de todos os endpoints —
  // enviar data antiga (2000-01-01) para forcar retorno completo.
  const records = await fetchFromSEI(serviceId, { data_ultima_sync: '2000-01-01 00:00:00' });

  if (!Array.isArray(records) || records.length === 0) {
    console.log(`  [${model}] Nenhum registro recebido`);
    return 0;
  }

  console.log(`  [${model}] ${records.length} registros recebidos. Sanitizando...`);

  // 2. Sanitizar (com mapeamento snake_case → camelCase para alunoResumo)
  const fieldTypes = getFieldTypes(model);
  const FIELD_MAP_FL = {
    alunoResumo: { mat_situacao: 'matSituacao', nao_enviar_msg: 'naoEnviarMsg', valor_devedor: 'valorDevedor', parcelas_atraso: 'parcelasAtraso', valor_pago: 'valorPago', situacao_financeira: 'situacaoFinanceira' },
  };
  const mapFn = FIELD_MAP_FL[model];
  const sanitized = records.map(r => {
    if (mapFn) {
      const mapped = {};
      for (const [k, v] of Object.entries(r)) mapped[mapFn[k] || k] = v;
      return sanitizeRecord(mapped, fieldTypes);
    }
    return sanitizeRecord(r, fieldTypes);
  });

  // 3. Full refresh: TRUNCATE + createMany dentro de transacao atomica.
  // Sem transacao, o worker em producao (Railway) pode rodar um delta entre o TRUNCATE
  // e o createMany — deixando o codigo do delta no banco e quebrando o createMany com
  // unique constraint na PK. A transacao bloqueia a tabela ate o final.
  // Resolver nome real da tabela via DMMF (model.dbName cobre @@map; senao usa o nome do model)
  const dmmfModel = Prisma.dmmf.datamodel.models.find(
    m => m.name.toLowerCase() === model.toLowerCase()
  );
  const tableName = dmmfModel?.dbName || model;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`TRUNCATE TABLE cobranca."${tableName}"`);
    await tx[model].createMany({ data: sanitized });
  }, { timeout: 600_000, maxWait: 60_000 });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`  [${model}] ${sanitized.length} registros sincronizados (${elapsed}s)`);
  return sanitized.length;
}

// -----------------------------------------------
// Main
// -----------------------------------------------
async function main() {
  if (!SEI_API_URL || !SEI_AUTH_KEY) {
    console.error('ERRO: SEI_API_URL e SEI_AUTH_KEY devem estar definidos no .env');
    process.exit(1);
  }

  console.log('========================================');
  console.log('  SEI Full Load - Inicio');
  console.log(`  ${new Date().toISOString()}`);
  console.log(`  Tabelas: ${TABLE_CONFIG.length}`);
  console.log('========================================\n');

  // Rodar TODAS as tabelas em paralelo (sem delay, sem batches)
  const results = await Promise.allSettled(
    TABLE_CONFIG.map(config => syncTable(config))
  );

  let totalRecords = 0;
  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      totalRecords += result.value;
      successCount++;
    } else {
      errorCount++;
      const msg = result.reason?.message || String(result.reason);
      errors.push({ table: TABLE_CONFIG[i].model, error: msg });
      console.error(`  [${TABLE_CONFIG[i].model}] ERRO: ${msg}\n`);
    }
  });

  console.log('\n========================================');
  console.log('  SEI Full Load - Resumo');
  console.log(`  ${new Date().toISOString()}`);
  console.log(`  Tabelas OK: ${successCount}/${TABLE_CONFIG.length}`);
  console.log(`  Tabelas com erro: ${errorCount}`);
  console.log(`  Total de registros: ${totalRecords}`);
  if (errors.length > 0) {
    console.log('\n  Erros:');
    for (const e of errors) {
      console.log(`    - ${e.table}: ${e.error}`);
    }
  }
  console.log('========================================');

  // aluno_resumo agora e sincronizado como tabela normal via WebService (seiviewalunoresumo)

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  prisma.$disconnect();
  process.exit(1);
});
