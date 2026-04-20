import { prisma } from '../config/database.js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BATCH_SIZE = 200;

async function main() {
  const jsonPath = process.argv[2] || resolve(__dirname, '../../../SEI_database/relatorio_serasa.json');

  console.log(`Lendo JSON de: ${jsonPath}`);
  const raw = readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(raw);

  // Aceita tanto array direto quanto { serasa: [...] }
  const records = Array.isArray(data) ? data : data.serasa;

  console.log(`${records.length} registros encontrados. Sanitizando...`);

  const sanitized = records.map(r => ({
    cpf_cnpj:          r.cpfCnpj?.trim() || '',
    cpf_cnpj_numerico: r.cpfCnpjNumerico?.trim() || '',
    nome:              r.nome?.trim() || null,
    contrato:          r.contrato?.trim() || null,
    valor:             r.valor?.trim() || null,
    valor_numerico:    r.valorNumerico != null ? Math.round(parseFloat(r.valorNumerico) * 100) / 100 : null,
    enviado_em:        r.enviadoEm?.trim() || null,
    baixado_em:        r.baixadoEm?.trim() || null,
    situacao:          r.situacao?.trim() || null,
  }));

  console.log('Full refresh: deleteMany + createMany...');

  await prisma.$transaction(async (tx) => {
    await tx.serasa.deleteMany();
    for (let i = 0; i < sanitized.length; i += BATCH_SIZE) {
      const batch = sanitized.slice(i, i + BATCH_SIZE);
      await tx.serasa.createMany({ data: batch });
    }
  }, { timeout: 30_000 });

  // Resumo
  const total = sanitized.length;
  const ativas = sanitized.filter(r => r.situacao === 'Ativa').length;
  const baixadas = sanitized.filter(r => r.situacao === 'Baixada').length;
  const cpfsDistintos = new Set(sanitized.map(r => r.cpf_cnpj_numerico)).size;

  console.log(`${total} registros inseridos em serasa.`);
  console.log(`  ${cpfsDistintos} CPFs distintos`);
  console.log(`  ${ativas} ativas, ${baixadas} baixadas`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('ERRO:', err.message);
  prisma.$disconnect();
  process.exit(1);
});
