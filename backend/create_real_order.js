const { Client } = require('pg');
require('dotenv').config({ path: './.env' });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const cols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'order';");
  console.log("Order table columns:", cols.rows.map(r => r.column_name));

  const existing = await client.query('SELECT id, status FROM "order" LIMIT 5;');
  console.log("Existing Orders in DB:", existing.rows);

  const orderId = `order_e2e_real_${Date.now()}`;
  await client.query(`
    INSERT INTO "order" (id, status, currency_code, display_id, email, customer_id, created_at, updated_at)
    VALUES ($1, 'pending', 'inr', 9999, 'kds_customer@test.com', 'cus_01KYWJADM819171B7VST0JKQWR', NOW(), NOW());
  `, [orderId]);

  console.log("Successfully created real Medusa order in PostgreSQL:", orderId);

  await client.end();
}

main().catch(console.error);
