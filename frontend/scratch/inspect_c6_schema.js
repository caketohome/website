const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConn() {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  throw new Error("No DATABASE_URL");
}

async function inspect() {
  const client = new Client({ connectionString: getConn(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("==================================================================");
  console.log("FORENSIC SCHEMA INSPECTION FOR PHASE C6 (MANUAL JOURNAL / JV)");
  console.log("==================================================================\n");

  const tables = ['accounting_voucher', 'accounting_journal_entry', 'accounting_journal_line', 'accounting_account'];
  for (const t of tables) {
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1 
      ORDER BY ordinal_position
    `, [t]);
    console.log(`\nTABLE: ${t} (${cols.rows.length} columns)`);
    console.log(cols.rows.map(r => `  - ${r.column_name}: ${r.data_type} (${r.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}) default=${r.column_default}`).join('\n'));
  }

  // Trigger function definition
  const trgFunc = await client.query(`
    SELECT pg_get_functiondef(oid) as def
    FROM pg_proc
    WHERE proname = 'fn_check_journal_balance'
  `);
  console.log("\n--- TRIGGER FUNCTION fn_check_journal_balance() ---");
  console.log(trgFunc.rows[0]?.def || "NOT FOUND");

  // Check constraints
  const constraints = await client.query(`
    SELECT tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public' AND tc.table_name IN ('accounting_voucher', 'accounting_journal_entry', 'accounting_journal_line')
    ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name
  `);
  console.log("\n--- CONSTRAINTS & FOREIGN KEYS ---");
  console.table(constraints.rows);

  // Check database triggers (e.g. balancing triggers)
  const triggers = await client.query(`
    SELECT event_object_table, trigger_name, action_timing, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE trigger_schema = 'public' AND event_object_table IN ('accounting_voucher', 'accounting_journal_entry', 'accounting_journal_line')
  `);
  console.log("\n--- DATABASE TRIGGERS ---");
  console.table(triggers.rows);

  // Check existing JOURNAL vouchers in DB
  const jVouchers = await client.query(`
    SELECT id, voucher_no, voucher_type, voucher_date, branch_id, status, total_amount, currency, reference_type, reference_event, narration, created_by, approved_by, posted_by
    FROM public.accounting_voucher
    WHERE voucher_type = 'JOURNAL'
    ORDER BY created_at DESC LIMIT 10
  `);
  console.log("\n--- EXISTING JOURNAL VOUCHERS IN DB ---");
  console.table(jVouchers.rows);

  await client.end();
}

inspect().catch(console.error);
