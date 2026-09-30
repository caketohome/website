/**
 * Inspect refund and order_lifecycle_refund tables
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

async function inspectRefundTables() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();
  try {
    for (const t of ['refund', 'order_lifecycle_refund', 'order_credit_line']) {
      const cols = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [t]);
      console.log(`\nColumns of ${t}:`);
      console.table(cols.rows);

      const cons = await client.query(`
        SELECT conname, pg_get_constraintdef(c.oid) as def
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        JOIN pg_class cl ON cl.oid = c.conrelid
        WHERE n.nspname = 'public' AND cl.relname = $1;
      `, [t]);
      console.log(`Constraints of ${t}:`);
      console.table(cons.rows);
    }
  } finally {
    await client.end();
  }
}

inspectRefundTables().catch(console.error);
