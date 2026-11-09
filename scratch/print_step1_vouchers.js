const fs = require('fs');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

function getDbConn() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      return val;
    }
  }
}

async function run() {
  const client = new Client({ connectionString: getDbConn(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query(`
    SELECT id, voucher_no, voucher_type, voucher_date::text, status, total_amount, reference_type, reference_id, narration, created_by, submitted_by, approved_by, posted_by, branch_id, metadata 
    FROM public.accounting_voucher 
    WHERE id IN ('vch_00MUR19MJGEZP9JC', 'vch_00MUR1BRX9F9X7J8') 
    ORDER BY id;
  `);
  for (const r of res.rows) {
    console.log(JSON.stringify(r, null, 2));
  }
  await client.end();
  process.exit(0);
}
run().catch(console.error);
