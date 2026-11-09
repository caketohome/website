const fs = require('fs');
const path = require('path');
const { Client } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const TEST_DB_URL = 'postgresql://cth_test_user:cth_test_password_2026@127.0.0.1:5433/cth_test';

async function setup() {
  const client = new Client({ connectionString: TEST_DB_URL });
  await client.connect();
  console.log('Connected to isolated PostgreSQL at 127.0.0.1:5433/cth_test');

  // 1. Ensure supplier table exists for FK reference
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.supplier (
      id TEXT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      gstin VARCHAR(15),
      phone VARCHAR(20),
      email VARCHAR(100),
      address TEXT,
      city VARCHAR(100),
      state VARCHAR(100),
      branch_id TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_by TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );
  `);
  console.log('✓ Verified public.supplier table');

  // 2. Read and execute frontend/migrate_phase4_accounting.js DDL
  const migrationScript = fs.readFileSync(path.join(__dirname, '../frontend/migrate_phase4_accounting.js'), 'utf8');
  // Extract migrationSql between backticks
  const match = migrationScript.match(/const migrationSql = `([\s\S]*?)`;/);
  if (!match) {
    throw new Error('Could not extract migrationSql from frontend/migrate_phase4_accounting.js');
  }
  const ddl = match[1];
  await client.query(ddl);
  console.log('✓ Executed Phase 4B accounting foundation DDL on cth_test');

  // 3. Seed 98 Chart of Accounts from seed_phase4d_chart_of_accounts.js if empty
  const accCount = (await client.query('SELECT count(*) as count FROM public.accounting_account')).rows[0].count;
  console.log(`Current accounting_account rows: ${accCount}`);

  if (Number(accCount) === 0) {
    const seedScript = fs.readFileSync(path.join(__dirname, '../frontend/seed_phase4d_chart_of_accounts.js'), 'utf8');
    // Extract AUTHORITATIVE_ACCOUNTS array
    const accountsMatch = seedScript.match(/const AUTHORITATIVE_ACCOUNTS = (\[[\s\S]*?\]);/);
    if (accountsMatch) {
      // Evaluate array safely
      const accounts = eval(accountsMatch[1]);
      console.log(`Found ${accounts.length} authoritative accounts to seed...`);
      for (const a of accounts) {
        await client.query(`
          INSERT INTO public.accounting_account
            (code, name, type, subtype, level, is_group, is_system, is_active, tax_rate, tax_class, description, created_by)
          VALUES
            ($1, $2, $3, $4, $5, $6, true, true, $7, $8, $9, 'system_seed')
          ON CONFLICT (code) DO NOTHING
        `, [a.code, a.name, a.type, a.subtype, a.level, a.is_group, a.tax_rate ?? null, a.tax_class ?? null, a.description ?? null]);
      }
      // Set parents
      for (const a of accounts) {
        if (a.parent) {
          await client.query(`
            UPDATE public.accounting_account
            SET parent_id = (SELECT id FROM public.accounting_account WHERE code = $1)
            WHERE code = $2
          `, [a.parent, a.code]);
        }
      }
      const seeded = (await client.query('SELECT count(*) as count FROM public.accounting_account')).rows[0].count;
      console.log(`✓ Seeded Chart of Accounts: ${seeded} rows active in cth_test`);
    }
  }

  // 4. Ensure payment_transaction and payment_audit_trail exist
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.payment_transaction (
      id TEXT PRIMARY KEY,
      company_id TEXT,
      branch_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      amount NUMERIC(15,2) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      idempotency_key TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      settlement_status TEXT NOT NULL DEFAULT 'unsettled',
      provider TEXT NOT NULL DEFAULT 'cod',
      provider_ref TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );
  `);
  console.log('✓ Verified public.payment_transaction table');

  // Verify created tables
  const res = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('accounting_account', 'accounting_voucher', 'accounting_journal_entry', 'accounting_journal_line', 'accounting_fiscal_period', 'payment_transaction', 'supplier')
    ORDER BY table_name;
  `);
  console.log('Accounting tables active in cth_test:', res.rows.map(r => r.table_name));

  await client.end();
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
