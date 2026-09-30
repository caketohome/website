const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
}

async function run() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  const tables = [
    'purchase',
    'purchase_item',
    'purchase_payment',
    'supplier',
    'product',
    'product_category',
    'product_variant',
    'branch',
    'branch_inventory',
    'expense',
    'expense_category',
    'payment_transaction'
  ];

  const report = {};
  for (const t of tables) {
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [t]);

    const countRes = await client.query(`SELECT count(*)::int as cnt FROM public."${t}";`);
    
    report[t] = {
      count: countRes.rows[0].cnt,
      columns: cols.rows
    };
  }

  // Also inspect suppliers sample
  const supSample = await client.query(`SELECT id, name, gstin, state, branch_id, is_active FROM public.supplier LIMIT 5;`);
  report['supplier_sample'] = supSample.rows;

  // Also inspect tax categories / tax configurations
  const taxConfigs = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE '%tax%';
  `);
  report['tax_tables'] = taxConfigs.rows.map(r => r.table_name);

  for (const tt of report['tax_tables']) {
    const taxRows = await client.query(`SELECT * FROM public."${tt}" LIMIT 10;`);
    report[`tax_data_${tt}`] = taxRows.rows;
  }

  fs.writeFileSync(path.join(__dirname, 'operational_entities_report.json'), JSON.stringify(report, null, 2));
  console.log("Forensic operational report generated successfully.");

  await client.end();
}

run().catch(console.error);
