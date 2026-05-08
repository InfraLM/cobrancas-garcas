import { prisma } from '../src/config/database.js';

const NOMES = [
  'lm_cobranca_90dias',
  'lm_cobranca_alerta',
  'lm_cobranca_media',
  'lm_cobranca_leve',
  'lm_confirmacao_rapida',
  'lm_abertura_simples',
  'lm_teste_lembrete_v2',
  'teste_modelo',
  'mensagem_universal_eloi',
];

async function main() {
  const antes = await prisma.templateMeta.findMany({
    where: { name: { in: NOMES } },
    select: { id: true, name: true, status: true, metaTemplateId: true, ativo: true },
  });

  console.log('=== ANTES ===');
  console.table(antes);

  const semMetaId = antes.filter(t => !t.metaTemplateId);
  if (semMetaId.length) {
    console.warn('AVISO: Templates sem metaTemplateId (envio vai falhar mesmo aprovado):');
    console.table(semMetaId);
  }

  const naoEncontrados = NOMES.filter(n => !antes.find(t => t.name === n));
  if (naoEncontrados.length) {
    console.warn('AVISO: Nomes nao encontrados no banco:', naoEncontrados);
  }

  const r = await prisma.templateMeta.updateMany({
    where: { name: { in: NOMES } },
    data: {
      status: 'APPROVED',
      aprovadoEm: new Date(),
      ativo: true,
      qualityRating: 'UNKNOWN',
      rejectReason: null,
    },
  });

  console.log(`\nOK: ${r.count} templates atualizados.\n`);

  const depois = await prisma.templateMeta.findMany({
    where: { name: { in: NOMES } },
    select: { name: true, status: true, qualityRating: true, aprovadoEm: true },
  });
  console.log('=== DEPOIS ===');
  console.table(depois);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
