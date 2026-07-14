import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default admin
  const hashedPassword = await bcrypt.hash('2108767676', 12);
  
  await prisma.admin.upsert({
    where: { email: 'adminn0101js@gmail.com' },
    update: { password: hashedPassword },
    create: {
      email: 'adminn0101js@gmail.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'EKIDOS',
      role: 'ADMIN',
      isActive: true,
    },
  });

  // Create default settings
  await prisma.settings.create({
    data: {
      companyName: 'EKIDOS TAXI',
      theme: 'dark',
      language: 'ru',
      currency: 'KGS',
    },
  }).catch(() => {});

  console.log('✅ Seed completed!');
  console.log('📧 Admin email: adminn0101js@gmail.com');
  console.log('🔑 Admin password: 2108767676');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
