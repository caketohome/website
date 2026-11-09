const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConnectionString() {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
}

async function check() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  const cols = await client.query(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'accounting_account'
    ORDER BY ordinal_position;
  `);
  console.log('--- ACCOUNTING ACCOUNT COLUMNS ---');
  for (const c of cols.rows) {
    console.log(`${c.column_name}: ${c.data_type} (default: ${c.column_default}, nullable: ${c.is_nullable})`);
  }

  const sample = await client.query(`SELECT * FROM accounting_account WHERE code = '5295'`);
  console.log('--- SAMPLE 5295 ROW ---');
  console.log(sample.rows[0]);

  await client.end();
}

check().catch(console.error);
