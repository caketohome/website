const { Client } = require('pg');
require('dotenv').config({ path: './.env' });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const txns = await client.query(`SELECT id, amount, status, provider, settlement_status FROM "payment_transaction" ORDER BY created_at DESC LIMIT 5;`);
  console.log("PostgreSQL payment_transaction rows:", txns.rows);

  const audits = await client.query(`SELECT id, action, transaction_id, created_at FROM "payment_audit_trail" ORDER BY created_at DESC LIMIT 5;`);
  console.log("PostgreSQL payment_audit_trail rows:", audits.rows);

  await client.end();
}

main().catch(console.error);
