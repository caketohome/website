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

  for (const t of ['inventory_item', 'inventory_level', 'branch_inventory', 'delivery_partner']) {
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position;
    `, [t]);
    console.log(`\nTable [${t}]:`);
    console.log(cols.rows.map(c => `  - ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`).join('\n'));

    const countRes = await client.query(`SELECT count(*)::int as cnt FROM "${t}"`);
    console.log(`  Row count: ${countRes.rows[0].cnt}`);
  }

  await client.end();
}

main().catch(err => {
  console.error("Error inspecting database:", err);
  process.exit(1);
});
