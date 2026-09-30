/**
 * Write focused forensic results to scratch JSON for full detailed inspection
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      let val = line.substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  throw new Error("No database connection string found");
}

async function exportForensics() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();
  try {
    const acc4190 = await client.query(`
      SELECT id, code, name, type, subtype, level, is_group, is_system, is_active, tax_rate, tax_class
      FROM public.accounting_account
      WHERE code = '4190';
    `);

    const relatedCoa = await client.query(`
      SELECT code, name, type, subtype, is_group, is_system, is_active
      FROM public.accounting_account
      WHERE code IN ('1111', '1112', '1113', '1121', '1122', '1131', '1132', '1133', '2111', '2121', '2122', '2123', '2124', '2125', '2126', '2127', '2128', '2129', '2170', '2180', '4110', '4120', '4130', '4190', '5110', '5120', '5130', '5290')
      ORDER BY code;
    `);

    const ptCons = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE n.nspname = 'public' AND cl.relname = 'payment_transaction';
    `);

    const avCons = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE n.nspname = 'public' AND cl.relname = 'accounting_voucher';
    `);

    const imCons = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE n.nspname = 'public' AND cl.relname = 'inventory_movement';
    `);

    const ptTypes = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payment_transaction';
    `);

    const avTypes = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'accounting_voucher';
    `);

    const output = {
      acc4190: acc4190.rows,
      relatedCoa: relatedCoa.rows,
      ptCons: ptCons.rows,
      avCons: avCons.rows,
      imCons: imCons.rows,
      ptTypes: ptTypes.rows,
      avTypes: avTypes.rows
    };

    fs.writeFileSync(path.join(__dirname, 'step4_6_forensic_dump.json'), JSON.stringify(output, null, 2));
    console.log('Successfully wrote step4_6_forensic_dump.json');
  } finally {
    await client.end();
  }
}

exportForensics().catch(console.error);
