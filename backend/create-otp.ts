import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const driver = await prisma.driver.findUnique({ where: { phone: '+996555123456' } });
  if (!driver) { console.log('Driver not found'); return; }
  
  await prisma.oTP.create({
    data: {
      phone: '+996555123456',
      code: '1234',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      driverId: driver.id,
    },
  });
  console.log('OTP created successfully!');
  console.log('Phone: +996555123456');
  console.log('Code: 1234');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
