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
    const tables = ['cms_page', 'cms_homepage_section', 'cms_navigation', 'cms_block', 'cms_revision', 'cms_redirect'];
    for (const t of tables) {
      const cols = await client.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = '${t}' ORDER BY ordinal_position`);
      console.log(`\n=== Table: ${t} ===`);
      console.log(cols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
    }
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
