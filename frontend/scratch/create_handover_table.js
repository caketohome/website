const { Pool } = require('pg');
const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const ddl = `
    CREATE TABLE IF NOT EXISTS public.delivery_cash_handover (
      id TEXT PRIMARY KEY,
      handover_number TEXT UNIQUE NOT NULL,
      branch_id TEXT NOT NULL REFERENCES public.branch(id),
      delivery_partner_id TEXT NOT NULL REFERENCES public.delivery_partner(id),
      teller_session_id TEXT REFERENCES public.teller_session(id),
      status TEXT NOT NULL DEFAULT 'SUBMITTED', -- DRAFT, SUBMITTED, ACKNOWLEDGED, DISPUTED, CANCELLED
      expected_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
      declared_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
      acknowledged_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
      shortage_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
      surplus_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
      digital_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
      order_ids TEXT[] NOT NULL DEFAULT '{}',
      discrepancy_reason TEXT,
      submitted_by TEXT,
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      received_by TEXT,
      acknowledged_at TIMESTAMPTZ,
      settlement_voucher_id TEXT,
      teller_movement_id TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_delivery_cash_handover_branch_status ON public.delivery_cash_handover (branch_id, status);
    CREATE INDEX IF NOT EXISTS idx_delivery_cash_handover_partner ON public.delivery_cash_handover (delivery_partner_id);
    CREATE INDEX IF NOT EXISTS idx_delivery_cash_handover_session ON public.delivery_cash_handover (teller_session_id);
  `;
  await pool.query(ddl);
  console.log("Table public.delivery_cash_handover verified/created successfully.");
  await pool.end();
}

main().catch(console.error);
