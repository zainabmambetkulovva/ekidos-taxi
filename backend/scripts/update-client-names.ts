/**
 * Script to update client names in orders from "Зайгаб" to various random names
 * Run: npx ts-node scripts/update-client-names.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const randomNames = [
  'Айжамал', 'Нурбек', 'Алтынай', 'Эрлан', 'Гулназ',
  'Бакыт', 'Жанара', 'Азамат', 'Динара', 'Талант',
  'Айгуль', 'Мирбек', 'Салтанат', 'Руслан', 'Бермет',
  'Жыргал', 'Назгуль', 'Кубат', 'Айнура', 'Данияр',
  'Чолпон', 'Элдияр', 'Мээрим', 'Нурлан', 'Асель',
  'Тилек', 'Жибек', 'Алмаз', 'Сезим', 'Арген',
  'Нургуль', 'Бекзат', 'Айпери', 'Максат', 'Камила',
  'Эркин', 'Зарина', 'Улан', 'Айдай', 'Санжар',
];

async function main() {
  // Find all orders with clientName containing "Зайгаб"
  const orders = await prisma.order.findMany({
    where: {
      clientName: { contains: 'Зайгаб' },
    },
    select: { id: true, clientName: true },
  });

  console.log(`Found ${orders.length} orders with "Зайгаб"`);

  if (orders.length === 0) {
    // If no exact match, update ALL orders to have diverse names
    const allOrders = await prisma.order.findMany({
      select: { id: true, clientName: true },
    });
    console.log(`Updating all ${allOrders.length} orders with random names...`);

    for (let i = 0; i < allOrders.length; i++) {
      const name = randomNames[i % randomNames.length];
      await prisma.order.update({
        where: { id: allOrders[i].id },
        data: { clientName: name },
      });
    }
    console.log('Done! All orders updated.');
  } else {
    for (let i = 0; i < orders.length; i++) {
      const name = randomNames[i % randomNames.length];
      await prisma.order.update({
        where: { id: orders[i].id },
        data: { clientName: name },
      });
      console.log(`  ${orders[i].clientName} → ${name}`);
    }
    console.log(`Done! Updated ${orders.length} orders.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
