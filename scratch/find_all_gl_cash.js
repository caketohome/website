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

  const res = await c.query(`
    SELECT 
      jl.branch_id, 
      b.name as branch_name,
      a.code, 
      a.name as account_name, 
      SUM(jl.debit_amount - jl.credit_amount) as balance
    FROM public.accounting_journal_line jl
    JOIN public.accounting_account a ON a.id = jl.account_id
    LEFT JOIN public.branch b ON b.id = jl.branch_id
    WHERE a.code IN ('1111', '1114', '1122')
    GROUP BY jl.branch_id, b.name, a.code, a.name
    HAVING SUM(jl.debit_amount - jl.credit_amount) <> 0
    ORDER BY jl.branch_id, a.code;
  `);

  console.table(res.rows);
  await c.end();
}
run();
