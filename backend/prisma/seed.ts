import { PrismaClient } from '@prisma/client';
import { seedDemoData } from '../src/services/seed.service';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  const result = await seedDemoData(prisma);
  console.log('Seed complete.');
  console.log(`${result.workflows.length} workflows seeded: ${result.workflows.join(', ')}`);
  console.log(`Demo credentials (all use password: ${result.password})`);
  for (const u of result.users) console.log(` ${u.role.padEnd(8)} ${u.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
