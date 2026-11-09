const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

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

const pool = new Pool({ connectionString: getConnectionString() });

async function inspectPreMigration() {
  const client = await pool.connect();
  try {
    console.log("=== PRE-MIGRATION C7.1 FORENSIC INSPECTION ===\n");

    const tablesToInspect = [
      'purchase',
      'purchase_payment',
      'accounting_voucher',
      'accounting_journal_entry',
      'accounting_journal_line',
      'customer',
      'supplier',
      'branch',
      'company',
      'bank_account',
      'teller_session',
      'teller_movement',
      'invoice'
    ];

    for (const table of tablesToInspect) {
      console.log(`>>> TABLE: ${table}`);
      
      // Columns & Types
      const colRes = await client.query(`
        SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [table]);
      console.log("  Columns:");
      for (const c of colRes.rows) {
        console.log(`    - ${c.column_name}: ${c.data_type} (null: ${c.is_nullable}, default: ${c.column_default})`);
      }

      // Foreign Keys
      const fkRes = await client.query(`
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          rc.delete_rule,
          rc.update_rule
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints AS rc
          ON rc.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1;
      `, [table]);
      if (fkRes.rows.length > 0) {
        console.log("  Foreign Keys:");
        for (const fk of fkRes.rows) {
          console.log(`    - [${fk.constraint_name}] ${fk.column_name} -> ${fk.foreign_table_name}(${fk.foreign_column_name}) [ON DELETE ${fk.delete_rule}]`);
        }
      }

      // Unique Constraints
      const uqRes = await client.query(`
        SELECT tc.constraint_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = $1 AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
        ORDER BY tc.constraint_type, kcu.ordinal_position;
      `, [table]);
      console.log("  Keys & Constraints:");
      for (const uq of uqRes.rows) {
        console.log(`    - [${uq.constraint_name}] ${uq.column_name}`);
      }

      // Indexes
      const idxRes = await client.query(`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE schemaname = 'public' AND tablename = $1;
      `, [table]);
      console.log("  Indexes:");
      for (const idx of idxRes.rows) {
        console.log(`    - ${idx.indexname}: ${idx.indexdef}`);
      }

      // RLS status
      const rlsRes = await client.query(`
        SELECT relname, relrowsecurity, relforcerowsecurity
        FROM pg_class
        WHERE relname = $1 AND relnamespace = 'public'::regnamespace;
      `, [table]);
      if (rlsRes.rows.length > 0) {
        console.log(`  RLS: enabled=${rlsRes.rows[0].relrowsecurity}, forced=${rlsRes.rows[0].relforcerowsecurity}`);
      }

      // Existing RLS policies
      const polRes = await client.query(`
        SELECT policyname, permissive, roles, cmd, qual, with_check
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = $1;
      `, [table]);
      if (polRes.rows.length > 0) {
        console.log("  RLS Policies:");
        for (const p of polRes.rows) {
          console.log(`    - [${p.policyname}] (${p.cmd}) permissive=${p.permissive}`);
        }
      }

      // Row count
      const countRes = await client.query(`SELECT count(*)::int as count FROM public."${table}"`);
      console.log(`  Row count: ${countRes.rows[0].count}`);
      console.log("--------------------------------------------------\n");
    }

    // Check if cost_centre, purchase_payment_allocation, customer_receipt_allocation exist
    console.log(">>> CHECKING TARGET NEW TABLES:");
    const newTargetTables = [
      'cost_centre',
      'purchase_payment_allocation',
      'customer_receipt_allocation',
      'corporate_gifting_batch',
      'corporate_gifting_recipient'
    ];
    for (const nt of newTargetTables) {
      const exists = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        ) as ex;
      `, [nt]);
      console.log(`  - ${nt}: exists = ${exists.rows[0].ex}`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

inspectPreMigration().catch(console.error);
