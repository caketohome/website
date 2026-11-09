/**
 * Database migration for Bank & Cash Management Module
 * Database: cth_rehearsal_phase5 (PostgreSQL port 5433)
 */
const path = require('path');
const Client = require(path.resolve('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg')).Client;

async function migrate() {
  const client = new Client({
    connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5'
  });

  console.log('Connecting to cth_rehearsal_phase5...');
  await client.connect();

  try {
    await client.query('BEGIN');

    console.log('1. Creating bank_account table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.bank_account (
        id text PRIMARY KEY,
        company_id text NOT NULL REFERENCES public.company(id) ON DELETE RESTRICT,
        account_name text NOT NULL,
        bank_name text NOT NULL,
        account_number text NOT NULL,
        account_number_masked text NOT NULL,
        ifsc_code varchar(11) NOT NULL,
        account_type varchar(30) NOT NULL DEFAULT 'CURRENT',
        branch_name text,
        branch_id text REFERENCES public.branch(id) ON DELETE SET NULL,
        currency varchar(10) NOT NULL DEFAULT 'INR',
        gl_account_id text NOT NULL REFERENCES public.accounting_account(id) ON DELETE RESTRICT,
        bank_charges_gl_account_id text REFERENCES public.accounting_account(id) ON DELETE SET NULL,
        interest_gl_account_id text REFERENCES public.accounting_account(id) ON DELETE SET NULL,
        offset_gl_account_id text REFERENCES public.accounting_account(id) ON DELETE SET NULL,
        opening_balance numeric(15,2) NOT NULL DEFAULT 0.00,
        opening_balance_date date,
        current_balance numeric(15,2) NOT NULL DEFAULT 0.00,
        statement_balance numeric(15,2) NOT NULL DEFAULT 0.00,
        last_reconciled_date date,
        is_primary boolean NOT NULL DEFAULT false,
        allow_payments boolean NOT NULL DEFAULT true,
        allow_receipts boolean NOT NULL DEFAULT true,
        reconciliation_required boolean NOT NULL DEFAULT true,
        status varchar(20) NOT NULL DEFAULT 'ACTIVE',
        metadata jsonb DEFAULT '{}'::jsonb,
        created_by text NOT NULL DEFAULT 'system',
        updated_by text NOT NULL DEFAULT 'system',
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        deleted_at timestamptz,
        CONSTRAINT uq_bank_account_company_ifsc_acc UNIQUE (company_id, ifsc_code, account_number),
        CONSTRAINT uq_bank_account_gl_account UNIQUE (gl_account_id)
      );
      CREATE INDEX IF NOT EXISTS idx_bank_account_company ON public.bank_account(company_id);
      CREATE INDEX IF NOT EXISTS idx_bank_account_status ON public.bank_account(status);
      CREATE INDEX IF NOT EXISTS idx_bank_account_gl ON public.bank_account(gl_account_id);
    `);

    console.log('2. Creating cash_account table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.cash_account (
        id text PRIMARY KEY,
        company_id text NOT NULL REFERENCES public.company(id) ON DELETE RESTRICT,
        branch_id text REFERENCES public.branch(id) ON DELETE SET NULL,
        account_name text NOT NULL,
        account_type varchar(30) NOT NULL DEFAULT 'MAIN_CASH',
        currency varchar(10) NOT NULL DEFAULT 'INR',
        gl_account_id text NOT NULL REFERENCES public.accounting_account(id) ON DELETE RESTRICT,
        opening_balance numeric(15,2) NOT NULL DEFAULT 0.00,
        current_balance numeric(15,2) NOT NULL DEFAULT 0.00,
        status varchar(20) NOT NULL DEFAULT 'ACTIVE',
        metadata jsonb DEFAULT '{}'::jsonb,
        created_by text NOT NULL DEFAULT 'system',
        updated_by text NOT NULL DEFAULT 'system',
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        deleted_at timestamptz
      );
      CREATE INDEX IF NOT EXISTS idx_cash_account_company ON public.cash_account(company_id);
      CREATE INDEX IF NOT EXISTS idx_cash_account_branch ON public.cash_account(branch_id);
    `);

    console.log('3. Creating bank_transaction table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.bank_transaction (
        id text PRIMARY KEY,
        bank_account_id text NOT NULL REFERENCES public.bank_account(id) ON DELETE CASCADE,
        transaction_date date NOT NULL,
        value_date date,
        transaction_type varchar(30) NOT NULL,
        reference_no text,
        description text NOT NULL,
        debit_amount numeric(15,2) NOT NULL DEFAULT 0.00,
        credit_amount numeric(15,2) NOT NULL DEFAULT 0.00,
        running_balance numeric(15,2) NOT NULL DEFAULT 0.00,
        reconciliation_status varchar(30) NOT NULL DEFAULT 'UNRECONCILED',
        reconciliation_id text,
        voucher_id text REFERENCES public.accounting_voucher(id) ON DELETE SET NULL,
        journal_entry_id text REFERENCES public.accounting_journal_entry(id) ON DELETE SET NULL,
        metadata jsonb DEFAULT '{}'::jsonb,
        created_by text NOT NULL DEFAULT 'system',
        created_at timestamptz NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_bank_trans_account ON public.bank_transaction(bank_account_id);
      CREATE INDEX IF NOT EXISTS idx_bank_trans_date ON public.bank_transaction(transaction_date);
      CREATE INDEX IF NOT EXISTS idx_bank_trans_recon ON public.bank_transaction(reconciliation_status);
    `);

    console.log('4. Creating bank_transfer table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.bank_transfer (
        id text PRIMARY KEY,
        source_bank_account_id text NOT NULL REFERENCES public.bank_account(id) ON DELETE RESTRICT,
        dest_bank_account_id text NOT NULL REFERENCES public.bank_account(id) ON DELETE RESTRICT,
        transfer_amount numeric(15,2) NOT NULL,
        transfer_date date NOT NULL,
        reference_no text NOT NULL,
        description text NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'POSTED',
        voucher_id text REFERENCES public.accounting_voucher(id) ON DELETE SET NULL,
        journal_entry_id text REFERENCES public.accounting_journal_entry(id) ON DELETE SET NULL,
        metadata jsonb DEFAULT '{}'::jsonb,
        created_by text NOT NULL DEFAULT 'system',
        created_at timestamptz NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_bank_transfer_source ON public.bank_transfer(source_bank_account_id);
      CREATE INDEX IF NOT EXISTS idx_bank_transfer_dest ON public.bank_transfer(dest_bank_account_id);
    `);

    console.log('5. Creating bank_statement_import table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.bank_statement_import (
        id text PRIMARY KEY,
        bank_account_id text NOT NULL REFERENCES public.bank_account(id) ON DELETE CASCADE,
        file_name text NOT NULL,
        file_format varchar(10) NOT NULL DEFAULT 'CSV',
        opening_balance numeric(15,2) DEFAULT 0.00,
        closing_balance numeric(15,2) DEFAULT 0.00,
        total_lines integer NOT NULL DEFAULT 0,
        imported_lines integer NOT NULL DEFAULT 0,
        status varchar(20) NOT NULL DEFAULT 'COMPLETED',
        metadata jsonb DEFAULT '{}'::jsonb,
        created_by text NOT NULL DEFAULT 'system',
        created_at timestamptz NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_statement_import_bank ON public.bank_statement_import(bank_account_id);
    `);

    console.log('6. Creating bank_statement_line table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.bank_statement_line (
        id text PRIMARY KEY,
        statement_import_id text NOT NULL REFERENCES public.bank_statement_import(id) ON DELETE CASCADE,
        bank_account_id text NOT NULL REFERENCES public.bank_account(id) ON DELETE CASCADE,
        line_number integer NOT NULL,
        transaction_date date NOT NULL,
        value_date date,
        reference_no text,
        narration text NOT NULL,
        debit_amount numeric(15,2) NOT NULL DEFAULT 0.00,
        credit_amount numeric(15,2) NOT NULL DEFAULT 0.00,
        balance numeric(15,2) NOT NULL DEFAULT 0.00,
        is_matched boolean NOT NULL DEFAULT false,
        matched_bank_transaction_id text REFERENCES public.bank_transaction(id) ON DELETE SET NULL,
        matched_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_stmt_line_import ON public.bank_statement_line(statement_import_id);
      CREATE INDEX IF NOT EXISTS idx_stmt_line_bank ON public.bank_statement_line(bank_account_id);
      CREATE INDEX IF NOT EXISTS idx_stmt_line_match ON public.bank_statement_line(is_matched);
    `);

    console.log('7. Creating bank_reconciliation table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.bank_reconciliation (
        id text PRIMARY KEY,
        bank_account_id text NOT NULL REFERENCES public.bank_account(id) ON DELETE CASCADE,
        statement_date date NOT NULL,
        statement_closing_balance numeric(15,2) NOT NULL,
        book_closing_balance numeric(15,2) NOT NULL,
        reconciled_amount numeric(15,2) NOT NULL DEFAULT 0.00,
        unmatched_deposits numeric(15,2) NOT NULL DEFAULT 0.00,
        unmatched_withdrawals numeric(15,2) NOT NULL DEFAULT 0.00,
        difference numeric(15,2) NOT NULL DEFAULT 0.00,
        status varchar(20) NOT NULL DEFAULT 'IN_PROGRESS',
        completed_at timestamptz,
        completed_by text,
        notes text,
        created_by text NOT NULL DEFAULT 'system',
        created_at timestamptz NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_bank_recon_account ON public.bank_reconciliation(bank_account_id);
    `);

    console.log('8. Creating cashfree_settlement_batch table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.cashfree_settlement_batch (
        id text PRIMARY KEY,
        settlement_id text NOT NULL UNIQUE,
        settlement_date date NOT NULL,
        clearing_gl_account_id text NOT NULL REFERENCES public.accounting_account(id) ON DELETE RESTRICT,
        destination_bank_account_id text REFERENCES public.bank_account(id) ON DELETE SET NULL,
        gross_amount numeric(15,2) NOT NULL,
        fee_amount numeric(15,2) NOT NULL DEFAULT 0.00,
        tax_amount numeric(15,2) NOT NULL DEFAULT 0.00,
        net_amount numeric(15,2) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'SETTLED',
        voucher_id text REFERENCES public.accounting_voucher(id) ON DELETE SET NULL,
        metadata jsonb DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_settlement_batch_date ON public.cashfree_settlement_batch(settlement_date);
    `);

    console.log('9. Creating convenience views (plural aliases)...');
    await client.query(`
      CREATE OR REPLACE VIEW public.bank_accounts AS SELECT * FROM public.bank_account;
      CREATE OR REPLACE VIEW public.cash_accounts AS SELECT * FROM public.cash_account;
      CREATE OR REPLACE VIEW public.bank_transactions AS SELECT * FROM public.bank_transaction;
      CREATE OR REPLACE VIEW public.bank_transfers AS SELECT * FROM public.bank_transfer;
      CREATE OR REPLACE VIEW public.bank_reconciliations AS SELECT * FROM public.bank_reconciliation;
    `);

    console.log('10. Seeding default cash account & sample company bank account if empty...');
    const companyRes = await client.query(`SELECT id FROM public.company LIMIT 1;`);
    const compId = companyRes.rows[0]?.id;

    // Check if cash account exists
    const cashCount = await client.query(`SELECT count(*) FROM public.cash_account;`);
    if (parseInt(cashCount.rows[0].count, 10) === 0 && compId) {
      // Find Petty Cash or Cash GL Account
      const cashGl = await client.query(`SELECT id FROM public.accounting_account WHERE code = '1114' LIMIT 1;`);
      const cashGlId = cashGl.rows[0]?.id;
      if (cashGlId) {
        await client.query(`
          INSERT INTO public.cash_account (
            id, company_id, branch_id, account_name, account_type, gl_account_id,
            opening_balance, current_balance, status, created_by
          ) VALUES (
            'cash_main_01', $1, 'br_indiranagar_01', 'Main Branch Cash Drawer', 'MAIN_CASH', $2,
            5000.00, 5000.00, 'ACTIVE', 'system_seed'
          );
        `, [compId, cashGlId]);
        console.log(' - Seeded Main Branch Cash Drawer (cash_main_01)');
      }
    }

    // Check if primary bank account exists
    const bankCount = await client.query(`SELECT count(*) FROM public.bank_account;`);
    if (parseInt(bankCount.rows[0].count, 10) === 0 && compId) {
      const bankGl = await client.query(`SELECT id FROM public.accounting_account WHERE code = '1112' LIMIT 1;`);
      const bankGlId = bankGl.rows[0]?.id;
      if (bankGlId) {
        await client.query(`
          INSERT INTO public.bank_account (
            id, company_id, account_name, bank_name, account_number, account_number_masked,
            ifsc_code, account_type, branch_name, branch_id, gl_account_id,
            opening_balance, opening_balance_date, current_balance, statement_balance,
            is_primary, allow_payments, allow_receipts, reconciliation_required, status, created_by
          ) VALUES (
            'ba_hdfc_primary', $1, 'Operating Current Account', 'HDFC Bank', '50200012345678', '•••• •••• •••• 5678',
            'HDFC0000053', 'CURRENT', 'Indiranagar Bangalore', 'br_indiranagar_01', $2,
            250000.00, '2026-04-01', 250000.00, 250000.00,
            true, true, true, true, 'ACTIVE', 'system_seed'
          );
        `, [compId, bankGlId]);
        console.log(' - Seeded Primary HDFC Bank Account (ba_hdfc_primary)');

        // Seed opening balance bank transaction
        await client.query(`
          INSERT INTO public.bank_transaction (
            id, bank_account_id, transaction_date, value_date, transaction_type,
            reference_no, description, debit_amount, credit_amount, running_balance,
            reconciliation_status, created_by
          ) VALUES (
            'bt_init_hdfc_01', 'ba_hdfc_primary', '2026-04-01', '2026-04-01', 'OPENING_BALANCE',
            'OB-2026-001', 'Opening Balance Equity Offset', 0.00, 250000.00, 250000.00,
            'RECONCILED', 'system_seed'
          );
        `);
        console.log(' - Seeded Opening Balance transaction for Primary Bank Account');
      }
    }

    await client.query('COMMIT');
    console.log('Migration successfully applied to cth_rehearsal_phase5!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    throw err;
  } finally {
    await client.end();
  }
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
