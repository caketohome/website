const { Client } = require('pg');
require('dotenv').config({ path: './.env' });

async function main() {
  const authRes = await fetch('http://localhost:9000/auth/user/emailpass', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@email.com', password: 'supersecret' }),
  });
  const { token } = await authRes.json();
  const adminH = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };

  // 1. Create Delivery
  const delRes = await fetch('http://localhost:9000/admin/delivery', {
    method: 'POST',
    headers: adminH,
    body: JSON.stringify({
      recipient_name: 'Fleet Persistence Test',
      recipient_phone: '+919988112233',
      recipient_address: '789 MG Road, Bengaluru',
      recipient_pincode: '560001',
    }),
  });
  const delData = await delRes.json();
  const delId = delData.delivery?.[0]?.id || delData.delivery?.id;
  console.log('1. Created Delivery API:', delId);

  // 2. Create Driver Partner
  const partRes = await fetch('http://localhost:9000/admin/delivery/partners', {
    method: 'POST',
    headers: adminH,
    body: JSON.stringify({
      first_name: 'PersistRider',
      last_name: 'One',
      phone: '+919911223344',
      email: `persist_rider_${Date.now()}@cakes2home.com`,
    }),
  });
  const partData = await partRes.json();
  const partnerId = partData.partner?.[0]?.id || partData.partner?.id;
  console.log('2. Created Driver Partner API:', partnerId);

  // 3. Assign Driver
  const assignRes = await fetch('http://localhost:9000/admin/delivery/assign', {
    method: 'POST',
    headers: adminH,
    body: JSON.stringify({ delivery_id: delId, partner_id: partnerId }),
  });
  console.log('3. Assign Partner Status:', assignRes.status);

  // 4. Query List Deliveries API
  const listRes = await fetch('http://localhost:9000/admin/delivery', {
    method: 'GET',
    headers: adminH,
  });
  const listData = await listRes.json();
  const foundInApi = listData.deliveries?.find(d => d.id === delId);
  console.log('4. Queried via GET /admin/delivery API:', {
    id: foundInApi?.id,
    delivery_partner_id: foundInApi?.delivery_partner_id,
    status: foundInApi?.delivery_status,
  });

  // 5. Query Supabase PostgreSQL directly
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const delDb = await client.query(`SELECT id, delivery_partner_id, delivery_status, recipient_name FROM "delivery" WHERE id = $1;`, [delId]);
  console.log('5. PostgreSQL delivery row:', delDb.rows[0]);

  const juncDb = await client.query(`SELECT id, delivery_id, delivery_partner_id FROM "delivery_delivery_partner" WHERE delivery_id = $1;`, [delId]);
  console.log('6. PostgreSQL delivery_delivery_partner junction row:', juncDb.rows[0]);

  await client.end();
}

main().catch(console.error);
