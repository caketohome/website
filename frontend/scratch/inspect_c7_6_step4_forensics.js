const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

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
  throw new Error("DATABASE_URL not found in .env");
}

async function runForensics() {
  const conn = getConnectionString();
  const client = new Client({
    connectionString: conn,
    ssl: conn.includes('supabase') ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  try {
    const fpCol = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'accounting_fiscal_period';
    `);
    console.log("Fiscal period columns:");
    console.table(fpCol.rows);

    const fpRows = await client.query(`SELECT * FROM public.accounting_fiscal_period LIMIT 5;`);
    console.log("Fiscal periods sample:", fpRows.rows);

    // Matching tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name LIKE '%allocat%' OR table_name LIKE '%cost%' OR table_name LIKE '%rule%')
      ORDER BY table_name;
    `);
    console.log("Matching tables:", tablesRes.rows);

    // Foreign keys on cost_centre
    const fkRes = await client.query(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_schema = 'public'
        AND (tc.table_name IN ('cost_centre', 'accounting_voucher', 'accounting_journal_line') OR ccu.table_name = 'cost_centre');
    `);
    console.log("Cost centre foreign keys:");
    console.table(fkRes.rows);

    // Check staff permissions
    const staffRes = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND (table_name LIKE '%staff%' OR table_name LIKE '%user%' OR table_name LIKE '%role%');
    `);
    console.log("Staff / User / Role tables in DB:", staffRes.rows);

  } finally {
    await client.end();
  }
}

runForensics().catch(err => {
  console.error("Forensic script error:", err);
  process.exit(1);
});
