import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.oTP.deleteMany();
  await prisma.order.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.driver.deleteMany();
  console.log('All drivers and vehicles deleted');
}
main().then(() => process.exit(0));
