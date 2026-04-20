import { prisma } from '../config/database.js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BATCH_SIZE = 200;

async function main() {
  // Caminho do JSON (na pasta SEI_database)
  const jsonPath = process.argv[2] || resolve(__dirname, '../../../SEI_database/pf_alunos.json');

  console.log(`Lendo JSON de: ${jsonPath}`);
  const raw = readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(raw);
  const records = data.pf_alunos;

  console.log(`${records.length} registros encontrados. Sanitizando...`);

  const sanitized = records.map(r => ({
    matricula: String(r.matricula).trim(),
    nome: r.nome?.trim() || null,
    telefone: r.telefone?.trim() || null,
    email: r.email?.trim() || null,
    parcelas_pagas: r.parcelas_pagas != null ? parseInt(r.parcelas_pagas, 10) : null,
    parcelas_atraso: r.parcelas_atraso != null ? parseInt(r.parcelas_atraso, 10) : null,
    parcelas_aberto: r.parcelas_aberto != null ? parseInt(r.parcelas_aberto, 10) : null,
    aulas_total_porcentagem: r.aulas_total_porcentagem != null ? parseFloat(r.aulas_total_porcentagem) : null,
    id: r.id != null ? BigInt(r.id) : null,
    turma: r.turma?.trim() || null,
    criado_em: r.criado_em?.trim() || null,
    dias_desde_primeira_aula: r.dias_desde_primeira_aula != null ? parseInt(r.dias_desde_primeira_aula, 10) : null,
    dias_desde_ultima_aula: r.dias_desde_ultima_aula != null ? parseInt(r.dias_desde_ultima_aula, 10) : null,
    aulas_assistidas: r.aulas_assistidas != null ? parseInt(r.aulas_assistidas, 10) : null,
    status_financeiro: r.status_financeiro?.trim() || null,
    cidade: r.cidade?.trim() || null,
    tag: r.tag?.trim() || null,
    cep: r.cep?.trim() || null,
  }));

  // Emails vazios -> null
  sanitized.forEach(r => { if (r.email === '') r.email = null; });

  console.log('Full refresh: deleteMany + createMany...');

  await prisma.$transaction(async (tx) => {
    await tx.pfalunos.deleteMany();
    for (let i = 0; i < sanitized.length; i += BATCH_SIZE) {
      const batch = sanitized.slice(i, i + BATCH_SIZE);
      await tx.pfalunos.createMany({ data: batch });
    }
  }, { timeout: 30_000 });

  console.log(`${sanitized.length} registros inseridos em pf_alunos.`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('ERRO:', err.message);
  prisma.$disconnect();
  process.exit(1);
});
