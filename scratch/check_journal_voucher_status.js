const { Client } = require('../frontend/node_modules/pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../frontend/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
let dbUrl = '';
for (const line of envContent.split('\n')) {
  if (line.trim().startsWith('DATABASE_URL=')) {
    dbUrl = line.trim().substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
    break;
  }
}

async function main() {
  const c = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const r = await c.query(`
    SELECT v.status, COUNT(DISTINCT v.id) as vouchers, COUNT(DISTINCT e.id) as entries, COUNT(l.id) as lines
    FROM public.accounting_journal_line l
    JOIN public.accounting_journal_entry e ON e.id = l.journal_entry_id
    JOIN public.accounting_voucher v ON v.id = e.voucher_id
    GROUP BY v.status;
  `);
  console.log('Voucher status breakdown for journal lines:');
  console.table(r.rows);

  const orphaned = await c.query(`
    SELECT COUNT(*) as orphaned_lines
    FROM public.accounting_journal_line l
    LEFT JOIN public.accounting_journal_entry e ON e.id = l.journal_entry_id
    LEFT JOIN public.accounting_voucher v ON v.id = e.voucher_id
    WHERE v.id IS NULL;
  `);
  console.log('Orphaned journal lines without voucher:', orphaned.rows[0]);

  await c.end();
}

main().catch(console.error);
