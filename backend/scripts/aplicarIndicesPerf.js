// Aplica indices de performance em tabelas SEI (F-07).
// CREATE INDEX CONCURRENTLY nao pode rodar dentro de transacao,
// entao executa um statement por vez.
// Idempotente: IF NOT EXISTS — pode rodar 2x.
import { prisma } from '../src/config/database.js';

const INDICES = [
  // contareceber
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS contareceber_situacao_datavencimento_idx ON cobranca.contareceber (situacao, datavencimento)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS contareceber_pessoa_idx ON cobranca.contareceber (pessoa)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS contareceber_matriculaaluno_idx ON cobranca.contareceber (matriculaaluno)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS contareceber_tipoorigem_idx ON cobranca.contareceber (tipoorigem)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS contareceber_turma_idx ON cobranca.contareceber (turma)`,
  // pessoa
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS pessoa_aluno_idx ON cobranca.pessoa (aluno)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS pessoa_funcionario_idx ON cobranca.pessoa (funcionario)`,
  // matricula
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS matricula_aluno_idx ON cobranca.matricula (aluno)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS matricula_curso_idx ON cobranca.matricula (curso)`,
  // negociacaocontareceber
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS negociacaocontareceber_matriculaaluno_idx ON cobranca.negociacaocontareceber (matriculaaluno)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS negociacaocontareceber_data_idx ON cobranca.negociacaocontareceber ("data")`,
  // contarecebernegociado
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS contarecebernegociado_negociacaocontareceber_idx ON cobranca.contarecebernegociado (negociacaocontareceber)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS contarecebernegociado_contareceber_idx ON cobranca.contarecebernegociado (contareceber)`,
  // cartaocreditodebitorecorrenciapessoa
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS cartaorec_pessoa_idx ON cobranca.cartaocreditodebitorecorrenciapessoa (pessoa)`,
];

console.log(`Aplicando ${INDICES.length} indices...\n`);

let ok = 0;
let falhou = 0;

for (const sql of INDICES) {
  const nome = sql.match(/IF NOT EXISTS (\w+)/)?.[1] || '?';
  const tabela = sql.match(/ON cobranca\.(\w+)/)?.[1] || '?';
  process.stdout.write(`  [${tabela}] ${nome}... `);
  const t0 = Date.now();
  try {
    await prisma.$executeRawUnsafe(sql);
    const ms = Date.now() - t0;
    console.log(`OK (${ms}ms)`);
    ok++;
  } catch (err) {
    console.log(`FALHOU: ${err.message?.slice(0, 120)}`);
    falhou++;
  }
}

console.log(`\nResultado: ${ok} ok / ${falhou} falhou`);
await prisma.$disconnect();

if (falhou > 0) process.exit(1);
