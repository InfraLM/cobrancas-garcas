import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'andre.ribeiro@liberdademedicaedu.com.br' },
    update: {
      nome: 'André Garcia Ribeiro',
      role: 'ADMIN',
      ativo: true,
    },
    create: {
      email: 'andre.ribeiro@liberdademedicaedu.com.br',
      nome: 'André Garcia Ribeiro',
      role: 'ADMIN',
      ativo: true,
    },
  });

  console.log('Seed concluido:');
  console.log(`  Admin: ${admin.nome} (${admin.email}) — ID: ${admin.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
