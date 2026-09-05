import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Admin credentials are set via environment variables or Railway dashboard
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@ekidos.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'change_me_in_production';

  const hashedPassword = await bcrypt.hash(adminPassword, 12);
  
  await prisma.admin.upsert({
    where: { email: adminEmail },
    update: { password: hashedPassword },
    create: {
      email: adminEmail,
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
