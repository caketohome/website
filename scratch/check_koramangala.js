const { Client } = require('../frontend/node_modules/pg');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '../frontend/.env');
let conn = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DATABASE_URL=')) {
      conn = trimmed.slice('DATABASE_URL='.length).trim();
    }
  }
}

async function run() {
  const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(`
    SELECT jl.branch_id, a.code, a.name, SUM(jl.debit_amount - jl.credit_amount) as bal
    FROM accounting_journal_line jl
    JOIN accounting_account a ON a.id = jl.account_id
    WHERE jl.branch_id = 'br_koramangala' AND a.code IN ('1111', '1114', '1122')
    GROUP BY jl.branch_id, a.code, a.name
  `);
  console.log('Koramangala GL balances:\n', r.rows);
  await c.end();
}
run();
