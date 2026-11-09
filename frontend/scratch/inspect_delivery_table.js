const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getDbUrl() {
  const envPath = path.join(__dirname, '../.env');
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const l of lines) {
    if (l.trim().startsWith('DATABASE_URL=')) {
      return l.trim().substring('DATABASE_URL='.length).trim().replace(/['"]/g, '');
    }
  }
  throw new Error('DATABASE_URL not found');
}

async function main() {
  const client = new Client({ connectionString: getDbUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const sample = await client.query('SELECT id, status, metadata FROM "order" WHERE metadata IS NOT NULL LIMIT 2');
    console.log('order sample:', JSON.stringify(sample.rows, null, 2));

    const delOrders = await client.query(`
      SELECT o.id as order_id, o.status, d.id as delivery_id, d.delivery_status, d.delivery_partner_id 
      FROM "order" o 
      LEFT JOIN delivery d ON d.transaction_id = o.id OR o.metadata->>'delivery_id' = d.id 
      LIMIT 5
    `);
    console.log('joined order & delivery:', delOrders.rows);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
