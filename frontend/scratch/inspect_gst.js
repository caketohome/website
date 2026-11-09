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
    const cols = await client.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'company' ORDER BY ordinal_position");
    console.log('company columns:', cols.rows);

    const fks = await client.query(`
      SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name 
      JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name 
      WHERE tc.table_name = 'gst_registration'
    `);
    console.log('gst_registration foreign keys:', fks.rows);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
