const { Client } = require("../frontend/node_modules/pg");
const path = require("path");
const fs = require("fs");

const envPath = path.join(__dirname, "../frontend/.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

async function inspectSchema() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const cols = await c.query(`
    SELECT column_name, is_nullable, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'teller_movement' 
    ORDER BY ordinal_position;
  `);
  console.log('teller_movement columns:\n', cols.rows);

  const sessionCols = await c.query(`
    SELECT column_name, is_nullable, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'teller_session' 
    ORDER BY ordinal_position;
  `);
  console.log('teller_session columns:\n', sessionCols.rows);

  const fks = await c.query(`
    SELECT conname, pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conrelid = 'public.teller_movement'::regclass;
  `);
  console.log('teller_movement constraints:\n', fks.rows);

  const triggers = await c.query(`
    SELECT tgname, pg_get_triggerdef(oid) 
    FROM pg_trigger 
    WHERE tgrelid = 'public.teller_movement'::regclass;
  `);
  console.log('teller_movement triggers:\n', triggers.rows);

  const vaultCols = await c.query(`
    SELECT column_name, is_nullable, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'branch_vault_movement' 
    ORDER BY ordinal_position;
  `);
  console.log('branch_vault_movement columns:\n', vaultCols.rows);

  const procs = await c.query(`
    SELECT proname, prosrc 
    FROM pg_proc 
    WHERE proname IN ('fn_teller_movement_immutability', 'fn_teller_session_immutability');
  `);
  for (const row of procs.rows) {
    console.log(`\n=== FUNCTION ${row.proname} ===\n`, row.prosrc);
  }

  const indexes = await c.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'teller_session';
  `);
  console.log('\nteller_session indexes:\n', indexes.rows);

  await c.end();
}

inspectSchema().catch(console.error);
