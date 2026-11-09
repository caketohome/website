const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const match = env.match(/DATABASE_URL=([^\r\n]+)/);
const connStr = match[1].replace(/["']/g, '').trim();

async function main() {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('--- BRANCH INSPECTION ---');
  const branches = await client.query(`
    SELECT id, code, name, branch_type, is_active 
    FROM public.branch 
    ORDER BY code 
    LIMIT 10;
  `);
  console.table(branches.rows);

  const hoCheck = await client.query(`
    SELECT id, code, name, branch_type, is_active 
    FROM public.branch 
    WHERE code ILIKE '%HO%' OR name ILIKE '%Head%' OR name ILIKE '%Central%';
  `);
  console.log('Head Office / Central branch check:', hoCheck.rows);

  console.log('--- CHART OF ACCOUNTS GROUP ACCOUNTS ---');
  const groupAccounts = await client.query(`
    SELECT code, name, type, subtype, is_group, parent_code, is_active
    FROM public.accounting_account
    WHERE is_group = true
    ORDER BY code;
  `);
  console.table(groupAccounts.rows);

  console.log('--- RECENT JOURNAL LINES WITH COST_CENTRE_ID ---');
  const ccLines = await client.query(`
    SELECT COUNT(*) as count_with_cc
    FROM public.accounting_journal_line
    WHERE cost_centre_id IS NOT NULL;
  `);
  console.log('Lines with cost_centre_id:', ccLines.rows[0]);

  await client.end();
}

main().catch(console.error);
