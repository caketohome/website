const http = require('http');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  throw new Error("DATABASE_URL not found");
}

async function main() {
  console.log('1. Checking GET http://localhost:3000/api/v1/health ...');
  const healthPromise = new Promise((resolve, reject) => {
    const req = http.get('http://localhost:3000/api/v1/health', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Health check timed out'));
    });
  });

  try {
    const health = await healthPromise;
    console.log('Health check result:', health.statusCode, health.body);
  } catch (e) {
    console.error('Health check failed:', e.message);
  }

  console.log('\n2. Checking PostgreSQL Baseline Counts ...');
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM accounting_account) as account_count,
      (SELECT COUNT(*) FROM accounting_voucher) as voucher_count,
      (SELECT COUNT(*) FROM accounting_journal_entry) as entry_count,
      (SELECT COUNT(*) FROM accounting_journal_line) as line_count,
      (SELECT COUNT(*) FROM bank_account) as bank_count,
      (SELECT COUNT(*) FROM company) as company_count,
      (SELECT COUNT(*) FROM gst_registration) as gst_count,
      (SELECT COUNT(*) FROM teller) as teller_count,
      (SELECT COUNT(*) FROM teller_session) as session_count,
      (SELECT COUNT(*) FROM teller_movement) as movement_count,
      (SELECT COUNT(*) FROM "user" WHERE id LIKE 'usr_bw_%' OR id LIKE 'usr_test_%') as test_users_count;
  `);

  console.log('PostgreSQL Current State:');
  console.table(res.rows);

  console.log('\n3. Verifying FK teller_session_settlement_voucher_id_fkey ...');
  const fkRes = await client.query(`
    SELECT conname, confrelid::regclass::text as foreign_table, conrelid::regclass::text as source_table
    FROM pg_constraint
    WHERE conname = 'teller_session_settlement_voucher_id_fkey';
  `);
  console.table(fkRes.rows);

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
