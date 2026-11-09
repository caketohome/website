/**
 * CakeToHome — Complete Cross-Application Integration & Ledger Synchronization Migration
 * Target Database: cth_rehearsal_phase5 (Port 5433)
 * Protected Baseline: cth_test (0 writes)
 */
const { Client } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');

const DB_URL = 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5';

async function runMigration() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  try {
    await client.query('BEGIN');

    // 1. Central Transactional Outbox & Consumer Idempotency & Monitoring Tables
    await client.query(`
      DROP TABLE IF EXISTS public.outbox_consumer_receipt CASCADE;
      DROP TABLE IF EXISTS public.outbox_events CASCADE;
      DROP TABLE IF EXISTS public.system_monitoring_alert CASCADE;

      CREATE TABLE public.outbox_events (
        id bigserial PRIMARY KEY,
        event_id text UNIQUE NOT NULL,
        correlation_id text NOT NULL DEFAULT 'system',
        source_app text NOT NULL DEFAULT 'system',
        actor_id text,
        actor_role text,
        company_id text,
        branch_id text,
        role_visibility text[] NOT NULL DEFAULT ARRAY['SUPER_ADMIN','ADMIN'],
        aggregate_type text NOT NULL,
        aggregate_id text NOT NULL,
        event_type text NOT NULL,
        old_state jsonb,
        new_state jsonb,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        status text NOT NULL DEFAULT 'PENDING',
        retry_count integer NOT NULL DEFAULT 0,
        max_retries integer NOT NULL DEFAULT 5,
        next_retry_at timestamptz,
        last_error text,
        locked_at timestamptz,
        locked_by text,
        dead_lettered_at timestamptz,
        processed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_outbox_events_status_retry ON public.outbox_events (status, next_retry_at, created_at);
      CREATE INDEX IF NOT EXISTS idx_outbox_events_correlation ON public.outbox_events (correlation_id);
      CREATE INDEX IF NOT EXISTS idx_outbox_events_aggregate ON public.outbox_events (aggregate_type, aggregate_id);
      CREATE INDEX IF NOT EXISTS idx_outbox_events_branch ON public.outbox_events (branch_id, created_at DESC);

      CREATE TABLE public.outbox_consumer_receipt (
        id bigserial PRIMARY KEY,
        consumer_name text NOT NULL,
        event_id text NOT NULL,
        correlation_id text,
        result_summary jsonb DEFAULT '{}'::jsonb,
        result_metadata jsonb DEFAULT '{}'::jsonb,
        processed_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_outbox_consumer_event UNIQUE (event_id, consumer_name)
      );

      CREATE TABLE public.system_monitoring_alert (
        id text PRIMARY KEY,
        alert_type text NOT NULL,
        severity text NOT NULL DEFAULT 'WARNING',
        source_module text,
        reference_id text,
        correlation_id text,
        event_id text,
        entity_type text,
        entity_id text,
        message text NOT NULL,
        details jsonb DEFAULT '{}'::jsonb,
        metadata jsonb DEFAULT '{}'::jsonb,
        status text NOT NULL DEFAULT 'OPEN',
        resolved boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        resolved_at timestamptz
      );
    `);

    // 2. KOT Tickets & Delivery Tables for Cross-App Store/Kitchen/Delivery Sync
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.kot_tickets (
        id text PRIMARY KEY,
        order_id text UNIQUE NOT NULL,
        branch_id text NOT NULL,
        kot_number text UNIQUE NOT NULL,
        status text NOT NULL DEFAULT 'ACTIVE',
        items jsonb DEFAULT '[]'::jsonb,
        reprint_count integer NOT NULL DEFAULT 0,
        last_reprinted_at timestamptz,
        created_by text DEFAULT 'system',
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_kot_tickets_branch ON public.kot_tickets (branch_id, status, created_at DESC);

      CREATE TABLE IF NOT EXISTS public.delivery (
        id text PRIMARY KEY,
        order_id text,
        transaction_id text,
        branch_id text,
        delivery_partner_id text,
        delivery_status text NOT NULL DEFAULT 'PENDING',
        delivery_date text,
        delivery_slot_id text,
        recipient_name text,
        recipient_phone text,
        recipient_address text,
        recipient_pincode text,
        delivery_otp text,
        handover_otp text,
        otp_verified boolean NOT NULL DEFAULT false,
        assigned_at timestamptz,
        picked_up_at timestamptz,
        delivered_at timestamptz,
        metadata jsonb DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      );
      ALTER TABLE public.delivery ALTER COLUMN order_id DROP NOT NULL;
      ALTER TABLE public.delivery ALTER COLUMN branch_id DROP NOT NULL;
      ALTER TABLE public.delivery ADD COLUMN IF NOT EXISTS transaction_id text;
      ALTER TABLE public.delivery ADD COLUMN IF NOT EXISTS delivery_date text;
      ALTER TABLE public.delivery ADD COLUMN IF NOT EXISTS delivery_slot_id text;
      ALTER TABLE public.delivery ADD COLUMN IF NOT EXISTS recipient_name text;
      ALTER TABLE public.delivery ADD COLUMN IF NOT EXISTS recipient_phone text;
      ALTER TABLE public.delivery ADD COLUMN IF NOT EXISTS recipient_address text;
      ALTER TABLE public.delivery ADD COLUMN IF NOT EXISTS recipient_pincode text;
      ALTER TABLE public.delivery ADD COLUMN IF NOT EXISTS delivery_otp text;
      CREATE INDEX IF NOT EXISTS idx_delivery_branch_status ON public.delivery (branch_id, delivery_status);
      CREATE INDEX IF NOT EXISTS idx_delivery_partner ON public.delivery (delivery_partner_id, delivery_status);
    `);

    // 3. Gateway Payout Batch, Settlement Order, Bank Reconciliation Session & Match, Deposit Slip
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.gateway_payout_batch (
        id text PRIMARY KEY,
        company_id text NOT NULL,
        provider text NOT NULL DEFAULT 'cashfree',
        payout_reference text UNIQUE NOT NULL,
        settlement_reference text,
        bank_account_id text NOT NULL REFERENCES public.bank_account(id),
        settlement_date date NOT NULL,
        bank_value_date date,
        gross_amount numeric(15,2) NOT NULL DEFAULT 0.00,
        identified_fee_amount numeric(15,2) NOT NULL DEFAULT 0.00,
        reported_tax_amount numeric(15,2) NOT NULL DEFAULT 0.00,
        other_deductions_amount numeric(15,2) NOT NULL DEFAULT 0.00,
        net_amount numeric(15,2) NOT NULL DEFAULT 0.00,
        rounding_variance numeric(15,2) NOT NULL DEFAULT 0.00,
        currency text NOT NULL DEFAULT 'INR',
        status text NOT NULL DEFAULT 'DRAFT',
        unreconciled_exception_count integer NOT NULL DEFAULT 0,
        ingestion_source text DEFAULT 'CASHFREE_API',
        prepared_by text NOT NULL DEFAULT 'system',
        approved_by text,
        approved_at timestamptz,
        posted_by text,
        posted_at timestamptz,
        cancelled_by text,
        cancelled_at timestamptz,
        cancellation_reason text,
        voucher_ids jsonb DEFAULT '[]'::jsonb,
        metadata jsonb DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.gateway_settlement_order (
        id text PRIMARY KEY,
        payout_batch_id text NOT NULL REFERENCES public.gateway_payout_batch(id) ON DELETE CASCADE,
        order_id text NOT NULL,
        payment_transaction_id text,
        settlement_branch_id text NOT NULL,
        gross_order_amount numeric(15,2) NOT NULL,
        allocated_fee_amount numeric(15,2) NOT NULL DEFAULT 0.00,
        allocated_tax_amount numeric(15,2) NOT NULL DEFAULT 0.00,
        net_order_share numeric(15,2) NOT NULL,
        voucher_id text,
        status text NOT NULL DEFAULT 'MATCHED',
        exception_code text,
        exception_detail text,
        metadata jsonb DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.bank_reconciliation_session (
        id text PRIMARY KEY,
        bank_account_id text NOT NULL REFERENCES public.bank_account(id),
        company_id text NOT NULL,
        period_start date NOT NULL,
        period_end date NOT NULL,
        opening_balance_per_bank numeric(15,2) NOT NULL DEFAULT 0.00,
        closing_balance_per_bank numeric(15,2) NOT NULL DEFAULT 0.00,
        closing_balance_per_books numeric(15,2) NOT NULL DEFAULT 0.00,
        uncleared_deposits_total numeric(15,2) NOT NULL DEFAULT 0.00,
        outstanding_checks_total numeric(15,2) NOT NULL DEFAULT 0.00,
        unmatched_statement_lines_count integer NOT NULL DEFAULT 0,
        reconciled_variance numeric(15,2) NOT NULL DEFAULT 0.00,
        status text NOT NULL DEFAULT 'DRAFT',
        prepared_by text NOT NULL DEFAULT 'system',
        reviewed_by text,
        reviewed_at timestamptz,
        approved_by text,
        approved_at timestamptz,
        completed_at timestamptz,
        notes text,
        metadata jsonb DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.bank_reconciliation_match (
        id text PRIMARY KEY,
        session_id text REFERENCES public.bank_reconciliation_session(id) ON DELETE SET NULL,
        bank_account_id text NOT NULL REFERENCES public.bank_account(id),
        statement_line_id text NOT NULL REFERENCES public.bank_statement_line(id),
        source_type text NOT NULL,
        source_id text NOT NULL,
        match_type text NOT NULL DEFAULT 'EXACT_UTR',
        matched_amount numeric(15,2) NOT NULL,
        status text NOT NULL DEFAULT 'CONFIRMED',
        matched_by text NOT NULL DEFAULT 'system',
        confirmed_by text,
        confirmed_at timestamptz,
        voucher_id text,
        metadata jsonb DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.bank_deposit_slip (
        id text PRIMARY KEY,
        company_id text NOT NULL,
        branch_id text NOT NULL,
        bank_account_id text NOT NULL REFERENCES public.bank_account(id),
        slip_number text UNIQUE NOT NULL,
        deposit_date date NOT NULL,
        amount numeric(15,2) NOT NULL,
        status text NOT NULL DEFAULT 'DRAFT',
        prepared_by text NOT NULL DEFAULT 'system',
        approved_by text,
        approved_at timestamptz,
        posted_by text,
        posted_at timestamptz,
        transit_voucher_id text,
        credit_voucher_id text,
        metadata jsonb DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      );
    `);

    // 4. Enhance cashfree_settlement_batch, bank_statement_import/line, bank_reconciliation & bank_account
    await client.query(`
      DROP VIEW IF EXISTS public.bank_reconciliations CASCADE;
      DROP VIEW IF EXISTS public.bank_accounts CASCADE;

      ALTER TABLE public.cashfree_settlement_batch ALTER COLUMN settlement_id DROP NOT NULL;
      ALTER TABLE public.cashfree_settlement_batch ALTER COLUMN clearing_gl_account_id DROP NOT NULL;
      ALTER TABLE public.cashfree_settlement_batch ALTER COLUMN status TYPE text;
      ALTER TABLE public.cashfree_settlement_batch ADD COLUMN IF NOT EXISTS batch_ref text;
      ALTER TABLE public.cashfree_settlement_batch ADD COLUMN IF NOT EXISTS bank_account_id text;
      ALTER TABLE public.cashfree_settlement_batch ADD COLUMN IF NOT EXISTS gateway_fee numeric(15,2) NOT NULL DEFAULT 0.00;
      ALTER TABLE public.cashfree_settlement_batch ADD COLUMN IF NOT EXISTS gateway_tax numeric(15,2) NOT NULL DEFAULT 0.00;
      ALTER TABLE public.cashfree_settlement_batch ADD COLUMN IF NOT EXISTS utr_number text;
      ALTER TABLE public.cashfree_settlement_batch ADD COLUMN IF NOT EXISTS correlation_id text;
      ALTER TABLE public.cashfree_settlement_batch ADD COLUMN IF NOT EXISTS in_transit_voucher_id text;
      ALTER TABLE public.cashfree_settlement_batch ADD COLUMN IF NOT EXISTS realization_voucher_id text;
      ALTER TABLE public.cashfree_settlement_batch ADD COLUMN IF NOT EXISTS matched_statement_line_id text;
      ALTER TABLE public.cashfree_settlement_batch ADD COLUMN IF NOT EXISTS reconciled_at timestamptz;
      ALTER TABLE public.cashfree_settlement_batch ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT NOW();
      UPDATE public.cashfree_settlement_batch
      SET batch_ref = COALESCE(batch_ref, settlement_id),
          bank_account_id = COALESCE(bank_account_id, destination_bank_account_id),
          gateway_fee = COALESCE(gateway_fee, fee_amount, 0.00),
          gateway_tax = COALESCE(gateway_tax, tax_amount, 0.00)
      WHERE batch_ref IS NULL OR bank_account_id IS NULL;

      ALTER TABLE public.bank_statement_import ALTER COLUMN status TYPE text;
      ALTER TABLE public.bank_statement_import ADD COLUMN IF NOT EXISTS imported_by text DEFAULT 'system';
      ALTER TABLE public.bank_statement_import ADD COLUMN IF NOT EXISTS matched_lines integer NOT NULL DEFAULT 0;

      ALTER TABLE public.bank_statement_line ALTER COLUMN statement_import_id DROP NOT NULL;
      ALTER TABLE public.bank_statement_line ALTER COLUMN line_number SET DEFAULT 1;
      ALTER TABLE public.bank_statement_line ALTER COLUMN line_number DROP NOT NULL;
      ALTER TABLE public.bank_statement_line ALTER COLUMN narration DROP NOT NULL;
      ALTER TABLE public.bank_statement_line ADD COLUMN IF NOT EXISTS import_id text;
      ALTER TABLE public.bank_statement_line ADD COLUMN IF NOT EXISTS description text;
      ALTER TABLE public.bank_statement_line ADD COLUMN IF NOT EXISTS match_status text DEFAULT 'UNMATCHED';
      ALTER TABLE public.bank_statement_line ADD COLUMN IF NOT EXISTS matched_transaction_id text;

      ALTER TABLE public.bank_reconciliation ALTER COLUMN statement_closing_balance SET DEFAULT 0.00;
      ALTER TABLE public.bank_reconciliation ALTER COLUMN statement_closing_balance DROP NOT NULL;
      ALTER TABLE public.bank_reconciliation ALTER COLUMN book_closing_balance SET DEFAULT 0.00;
      ALTER TABLE public.bank_reconciliation ALTER COLUMN book_closing_balance DROP NOT NULL;
      ALTER TABLE public.bank_reconciliation ALTER COLUMN status TYPE text;
      ALTER TABLE public.bank_reconciliation ADD COLUMN IF NOT EXISTS statement_ending_balance numeric(15,2) NOT NULL DEFAULT 0.00;
      ALTER TABLE public.bank_reconciliation ADD COLUMN IF NOT EXISTS ledger_ending_balance numeric(15,2) NOT NULL DEFAULT 0.00;
      ALTER TABLE public.bank_reconciliation ADD COLUMN IF NOT EXISTS unreconciled_difference numeric(15,2) NOT NULL DEFAULT 0.00;
      ALTER TABLE public.bank_reconciliation ADD COLUMN IF NOT EXISTS reconciled_by text;
      ALTER TABLE public.bank_reconciliation ADD COLUMN IF NOT EXISTS reconciled_at timestamptz;

      ALTER TABLE public.bank_account ADD COLUMN IF NOT EXISTS expected_settlement_balance numeric(15,2) NOT NULL DEFAULT 0.00;
      ALTER TABLE public.inventory_movement ADD COLUMN IF NOT EXISTS reference_id text;
      ALTER TABLE public.inventory_movement ADD COLUMN IF NOT EXISTS notes text;
      ALTER TABLE public.inventory_movement ADD COLUMN IF NOT EXISTS created_by text;
      ALTER TABLE public.accounting_voucher ALTER COLUMN reference_type TYPE text;
      ALTER TABLE public.accounting_voucher ALTER COLUMN reference_event TYPE text;
      ALTER TABLE public.accounting_voucher ALTER COLUMN voucher_type TYPE text;

      CREATE TABLE IF NOT EXISTS public.customer_notification_queue (
        id text PRIMARY KEY,
        order_id text,
        customer_id text,
        channel text DEFAULT 'EMAIL',
        event_type text,
        recipient text,
        subject text,
        payload jsonb DEFAULT '{}'::jsonb,
        status text DEFAULT 'PENDING',
        created_at timestamptz DEFAULT NOW(),
        updated_at timestamptz DEFAULT NOW()
      );
      ALTER TABLE public.customer_notification_queue ADD COLUMN IF NOT EXISTS order_id text;
      ALTER TABLE public.customer_notification_queue ADD COLUMN IF NOT EXISTS customer_id text;
      ALTER TABLE public.customer_notification_queue ADD COLUMN IF NOT EXISTS channel text DEFAULT 'EMAIL';
      ALTER TABLE public.customer_notification_queue ADD COLUMN IF NOT EXISTS event_type text;
      ALTER TABLE public.customer_notification_queue ADD COLUMN IF NOT EXISTS recipient text;
      ALTER TABLE public.customer_notification_queue ADD COLUMN IF NOT EXISTS subject text;
      ALTER TABLE public.customer_notification_queue ADD COLUMN IF NOT EXISTS payload jsonb DEFAULT '{}'::jsonb;
      ALTER TABLE public.customer_notification_queue ADD COLUMN IF NOT EXISTS status text DEFAULT 'PENDING';
      ALTER TABLE public.customer_notification_queue ADD COLUMN IF NOT EXISTS template text DEFAULT 'ORDER_CONFIRMED';
      ALTER TABLE public.customer_notification_queue ALTER COLUMN template DROP NOT NULL;
      ALTER TABLE public.customer_notification_queue ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT NOW();
    `);

    // Recreate bank_accounts and bank_reconciliations views
    await client.query(`
      CREATE OR REPLACE VIEW public.bank_accounts AS SELECT * FROM public.bank_account;
      CREATE OR REPLACE VIEW public.bank_reconciliations AS SELECT * FROM public.bank_reconciliation;
    `);

    // 5. Ensure GL 1115 (Bank Settlement In Transit) & 1118 (Deposit in Transit) exist under 1110
    const parent1110 = await client.query(`SELECT id FROM public.accounting_account WHERE code = '1110' LIMIT 1`);
    const parentId = parent1110.rows[0]?.id || '1e2781c0-e633-4576-9014-aaacaa71337e';

    await client.query(`
      INSERT INTO public.accounting_account (
        id, code, name, type, subtype, parent_id, level, is_group, is_system, is_active,
        description, created_by, created_at, updated_at
      ) VALUES (
        'acc_gl_1115_settlement_transit', '1115', 'Bank Settlement In Transit', 'ASSET', 'CURRENT_ASSET',
        $1, 4, false, true, true,
        'Expected payment gateway settlements cleared from gateway clearing (1113) and awaiting actual bank statement credit confirmation',
        'system_migration', NOW(), NOW()
      ) ON CONFLICT (code) DO NOTHING;
    `, [parentId]);

    await client.query(`
      INSERT INTO public.accounting_account (
        id, code, name, type, subtype, parent_id, level, is_group, is_system, is_active,
        description, created_by, created_at, updated_at
      ) VALUES (
        'acc_gl_1118_deposit_transit', '1118', 'Cash Deposit In Transit', 'ASSET', 'CURRENT_ASSET',
        $1, 4, false, true, true,
        'Branch cash deposits in transit to company bank accounts awaiting bank statement credit confirmation',
        'system_migration', NOW(), NOW()
      ) ON CONFLICT (code) DO NOTHING;
    `, [parentId]);

    // 6. Synchronize Opening Balance GL Postings for Seeded Bank & Cash Accounts
    // Check if ba_hdfc_primary (1112, ₹2,50,000) has its opening balance journal entry in accounting_journal_line
    const offsetRes = await client.query(`SELECT id FROM public.accounting_account WHERE code = '3300' LIMIT 1`);
    const offsetGlId = offsetRes.rows[0]?.id;

    const banksToSync = await client.query(`
      SELECT ba.id, ba.bank_name, ba.account_name, ba.opening_balance, ba.opening_balance_date,
             ba.current_balance, ba.gl_account_id, ba.branch_id
      FROM public.bank_account ba
      WHERE ba.opening_balance > 0
    `);

    for (const b of banksToSync.rows) {
      const glSumRes = await client.query(`
        SELECT COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0)::numeric AS net_dr
        FROM public.accounting_journal_line jl
        JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
        WHERE jl.account_id = $1 AND COALESCE(je.is_reversed, false) = false
      `, [b.gl_account_id]);

      const currentGlBal = Number(glSumRes.rows[0]?.net_dr || 0);
      const openBal = Number(b.opening_balance);

      if (currentGlBal === 0 && openBal > 0 && offsetGlId) {
        const vchId = `vch_ob_seed_${b.id}`;
        const vchNo = `JV-OB-SEED-${b.id.slice(-6).toUpperCase()}`;
        const jeId = `je_ob_seed_${b.id}`;
        const jeNo = `JE-OB-SEED-${b.id.slice(-6).toUpperCase()}`;
        const branchId = b.branch_id || 'br_indiranagar_01';
        const obDate = b.opening_balance_date || '2026-04-01';

        await client.query(`
          INSERT INTO public.accounting_voucher (
            id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year,
            status, total_amount, currency, reference_type, reference_id, reference_event,
            narration, created_by, posted_by, posted_at, created_at, updated_at
          ) VALUES (
            $1, $2, 'OPENING_BALANCE', $3, $4, '26-27',
            'POSTED', $5, 'INR', 'BANK_ACCOUNT', $6, 'BANK_OPENING_BALANCE',
            $7, 'system_migration', 'system_migration', NOW(), NOW(), NOW()
          ) ON CONFLICT (id) DO NOTHING;
        `, [vchId, vchNo, obDate, branchId, openBal, b.id, `Opening balance initialization for ${b.bank_name} - ${b.account_name}`]);

        await client.query(`
          INSERT INTO public.accounting_journal_entry (
            id, entry_no, voucher_id, entry_date, branch_id, fiscal_year,
            total_debit, total_credit, is_reversed, narration, created_by, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, '26-27',
            $6, $6, false, $7, 'system_migration', NOW()
          ) ON CONFLICT (id) DO NOTHING;
        `, [jeId, jeNo, vchId, obDate, branchId, openBal, `Balanced opening journal for ${b.bank_name} - ${b.account_name}`]);

        await client.query(`
          INSERT INTO public.accounting_journal_line (
            id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration
          ) VALUES
            ($1, $3, 1, $4, $6, 0.00, $7, $8),
            ($2, $3, 2, $5, 0.00, $6, $7, $9)
          ON CONFLICT (id) DO NOTHING;
        `, [
          `jl_ob_seed_${b.id}_1`,
          `jl_ob_seed_${b.id}_2`,
          jeId,
          b.gl_account_id,
          offsetGlId,
          openBal,
          branchId,
          `Debit Bank Account ${b.account_name}`,
          `Credit Opening Balance Offset for ${b.account_name}`
        ]);

        // Ensure opening bank_transaction exists
        const txCheck = await client.query(`SELECT 1 FROM public.bank_transaction WHERE bank_account_id = $1 AND transaction_type = 'OPENING_BALANCE' LIMIT 1`, [b.id]);
        if (txCheck.rowCount === 0) {
          await client.query(`
            INSERT INTO public.bank_transaction (
              id, bank_account_id, transaction_date, value_date, transaction_type,
              reference_no, description, debit_amount, credit_amount, running_balance,
              reconciliation_status, voucher_id, journal_entry_id, created_by, created_at
            ) VALUES (
              $1, $2, $3, $3, 'OPENING_BALANCE',
              $4, $5, 0.00, $6, $6,
              'RECONCILED', $7, $8, 'system_migration', NOW()
            );
          `, [`btx_ob_seed_${b.id}`, b.id, obDate, vchNo, `Opening Balance for ${b.bank_name} (${b.account_name})`, openBal, vchId, jeId]);
        }
        console.log(`Synced opening balance GL voucher for bank account ${b.id} (${b.bank_name}): ₹${openBal}`);
      }
    }

    // Also sync cash_account opening balances (cash_main_01 -> GL 1114, ₹5,000.00)
    const cashToSync = await client.query(`
      SELECT ca.id, ca.account_name, ca.opening_balance, ca.current_balance, ca.gl_account_id, ca.branch_id
      FROM public.cash_account ca
      WHERE ca.opening_balance > 0
    `);

    for (const ca of cashToSync.rows) {
      const glSumRes = await client.query(`
        SELECT COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0)::numeric AS net_dr
        FROM public.accounting_journal_line jl
        JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
        WHERE jl.account_id = $1 AND COALESCE(je.is_reversed, false) = false
      `, [ca.gl_account_id]);

      const currentGlBal = Number(glSumRes.rows[0]?.net_dr || 0);
      const openBal = Number(ca.opening_balance);

      if (currentGlBal === 0 && openBal > 0 && offsetGlId) {
        const vchId = `vch_ob_seed_${ca.id}`;
        const vchNo = `JV-OB-CASH-${ca.id.slice(-6).toUpperCase()}`;
        const jeId = `je_ob_seed_${ca.id}`;
        const jeNo = `JE-OB-CASH-${ca.id.slice(-6).toUpperCase()}`;
        const branchId = ca.branch_id || 'br_indiranagar_01';

        await client.query(`
          INSERT INTO public.accounting_voucher (
            id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year,
            status, total_amount, currency, reference_type, reference_id, reference_event,
            narration, created_by, posted_by, posted_at, created_at, updated_at
          ) VALUES (
            $1, $2, 'OPENING_BALANCE', '2026-04-01', $3, '26-27',
            'POSTED', $4, 'INR', 'CASH_ACCOUNT', $5, 'CASH_OPENING_BALANCE',
            $6, 'system_migration', 'system_migration', NOW(), NOW(), NOW()
          ) ON CONFLICT (id) DO NOTHING;
        `, [vchId, vchNo, branchId, openBal, ca.id, `Opening balance initialization for Cash Account ${ca.account_name}`]);

        await client.query(`
          INSERT INTO public.accounting_journal_entry (
            id, entry_no, voucher_id, entry_date, branch_id, fiscal_year,
            total_debit, total_credit, is_reversed, narration, created_by, created_at
          ) VALUES (
            $1, $2, $3, '2026-04-01', $4, '26-27',
            $5, $5, false, $6, 'system_migration', NOW()
          ) ON CONFLICT (id) DO NOTHING;
        `, [jeId, jeNo, vchId, branchId, openBal, `Balanced opening journal for Cash Account ${ca.account_name}`]);

        await client.query(`
          INSERT INTO public.accounting_journal_line (
            id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration
          ) VALUES
            ($1, $3, 1, $4, $6, 0.00, $7, $8),
            ($2, $3, 2, $5, 0.00, $6, $7, $9)
          ON CONFLICT (id) DO NOTHING;
        `, [
          `jl_ob_seed_${ca.id}_1`,
          `jl_ob_seed_${ca.id}_2`,
          jeId,
          ca.gl_account_id,
          offsetGlId,
          openBal,
          branchId,
          `Debit Cash Account ${ca.account_name}`,
          `Credit Opening Balance Offset for ${ca.account_name}`
        ]);
        console.log(`Synced opening balance GL voucher for cash account ${ca.id} (${ca.account_name}): ₹${openBal}`);
      }
    }

    await client.query('COMMIT');
    console.log('✅ Cross-App Integration Migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  runMigration().catch(() => process.exit(1));
}

module.exports = { runMigration };
