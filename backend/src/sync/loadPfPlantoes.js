import { prisma } from '../config/database.js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BATCH_SIZE = 200;

async function main() {
  const jsonPath = process.argv[2] || resolve(__dirname, '../../../SEI_database/pf_plantoes.json');

  console.log(`Lendo JSON de: ${jsonPath}`);
  const raw = readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(raw);
  const records = data.pf_plantoes;

  console.log(`${records.length} registros encontrados. Sanitizando...`);

  const sanitized = records.map(r => ({
    data_plantao: r.data_plantao?.trim() || null,
    data_marcado: r.data_marcado?.trim() || null,
    matricula: String(r.matricula).trim(),
    nome: r.nome?.trim() || null,
    telefone: r.telefone?.trim() || null,
    status: r.status?.trim() || null,
    moscow: r.moscow?.trim() || null,
  }));

  console.log('Full refresh: deleteMany + createMany...');

  await prisma.$transaction(async (tx) => {
    await tx.pfplantoes.deleteMany();
    for (let i = 0; i < sanitized.length; i += BATCH_SIZE) {
      const batch = sanitized.slice(i, i + BATCH_SIZE);
      await tx.pfplantoes.createMany({ data: batch });
    }
  }, { timeout: 30_000 });

  console.log(`${sanitized.length} registros inseridos em pf_plantoes.`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('ERRO:', err.message);
  prisma.$disconnect();
  process.exit(1);
});
