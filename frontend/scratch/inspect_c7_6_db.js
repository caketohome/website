const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const match = env.match(/DATABASE_URL=([^\r\n]+)/);
const connStr = match[1].replace(/["']/g, '').trim();

async function main() {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('--- COST_CENTRE TABLE STRUCTURE ---');
  const tableCols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cost_centre'
    ORDER BY ordinal_position;
  `);
  console.table(tableCols.rows);

  console.log('--- COST_CENTRE CONSTRAINTS ---');
  const constraints = await client.query(`
    SELECT conname, contype, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public' AND conrelid = 'public.cost_centre'::regclass;
  `);
  console.table(constraints.rows);

  console.log('--- COST_CENTRE INDEXES ---');
  const indexes = await client.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'cost_centre';
  `);
  console.table(indexes.rows);

  console.log('--- COST_CENTRE ROWS ---');
  const rows = await client.query(`SELECT * FROM public.cost_centre ORDER BY code;`);
  console.log(`Found ${rows.rows.length} cost centre rows:`);
  console.table(rows.rows);

  console.log('--- JOURNAL LINE COST_CENTRE_ID REFERENCES ---');
  const lineCc = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounting_journal_line' AND column_name LIKE '%cost_centre%';
  `);
  console.table(lineCc.rows);

  console.log('--- VOUCHER COST_CENTRE_ID REFERENCES ---');
  const vchCc = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounting_voucher' AND column_name LIKE '%cost_centre%';
  `);
  console.table(vchCc.rows);

  console.log('--- ANY COST_CENTRE_ALLOCATION OR SIMILAR TABLES ---');
  const ccTables = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND (table_name LIKE '%cost_centre%' OR table_name LIKE '%allocation%');
  `);
  console.table(ccTables.rows);

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
