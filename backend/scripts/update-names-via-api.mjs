/**
 * Update client names in production via API
 * Run: node scripts/update-names-via-api.mjs
 */

const BASE_URL = 'https://ekidos-taxi-production-587e.up.railway.app';

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
  // 1. Login as admin
  console.log('Logging in as admin...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@ekidos.kg', password: 'EKIDOS@2025' }),
  });

  if (!loginRes.ok) {
    console.error('Login failed:', await loginRes.text());
    return;
  }

  const { token } = await loginRes.json();
  console.log('Logged in successfully!');

  // 2. Get all orders
  console.log('Fetching orders...');
  const ordersRes = await fetch(`${BASE_URL}/api/orders?limit=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!ordersRes.ok) {
    console.error('Failed to get orders:', await ordersRes.text());
    return;
  }

  const ordersData = await ordersRes.json();
  const orders = ordersData.orders || ordersData;
  console.log(`Found ${orders.length} orders total`);

  // 3. Update each order's clientName
  let updated = 0;
  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    const newName = randomNames[i % randomNames.length];
    
    // Use PATCH to update clientName
    const updateRes = await fetch(`${BASE_URL}/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ clientName: newName }),
    });

    if (updateRes.ok) {
      updated++;
      console.log(`  [${i + 1}/${orders.length}] "${order.clientName}" → "${newName}"`);
    } else {
      console.log(`  [${i + 1}] FAILED for order ${order.id}: ${updateRes.status}`);
    }
  }

  console.log(`\nDone! Updated ${updated}/${orders.length} orders.`);
}

main().catch(console.error);
