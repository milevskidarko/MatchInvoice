import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check if demo-user already exists
  const existing = await prisma.user.findUnique({ where: { id: 'demo-user' } });
  if (!existing) {
    await prisma.user.create({
      data: {
        id: 'demo-user',
        email: 'demo@demo.com',
        password: 'demo',
      },
    });
    console.log('Seeded demo-user');
  } else {
    console.log('demo-user already exists');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
