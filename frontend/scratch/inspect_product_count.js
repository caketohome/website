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
    const pCount = await client.query('SELECT count(*) FROM product');
    console.log('Total products in public.product:', pCount.rows[0].count);
    const activeProducts = await client.query('SELECT count(*) FROM product WHERE deleted_at IS NULL');
    console.log('Active products in public.product:', activeProducts.rows[0].count);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
