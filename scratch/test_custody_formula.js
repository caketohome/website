const { Client } = require('../frontend/node_modules/pg');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '../frontend/.env');
let conn = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DATABASE_URL=')) {
      conn = trimmed.slice('DATABASE_URL='.length).trim();
    }
  }
}

async function run() {
  const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const query = `
    WITH branch_scope AS (
      SELECT id, name, code
      FROM public.branch
      WHERE id NOT LIKE 'br_tc_%'
        AND id NOT LIKE 'br_conc_%'
        AND id NOT LIKE 'br_test_%'
        AND id NOT LIKE 'test_%'
    ),
    latest_sessions_per_teller AS (
      SELECT DISTINCT ON (s.teller_id)
        s.id,
        s.branch_id,
        s.teller_id,
        s.status,
        s.opening_float,
        s.closing_count,
        s.created_at
      FROM public.teller_session s
      JOIN branch_scope b ON b.id = s.branch_id
      ORDER BY s.teller_id, s.created_at DESC
    ),
    active_drawer AS (
      SELECT
        ls.branch_id,
        COUNT(ls.id) AS active_sessions_count,
        ROUND(COALESCE(SUM(ls.opening_float), 0), 2) AS total_opening_float,
        ROUND(COALESCE(SUM(
          COALESCE((
            SELECT SUM(CASE WHEN m.direction = 'IN' THEN m.amount ELSE -m.amount END)
            FROM public.teller_movement m
            WHERE m.teller_session_id = ls.id
          ), 0)
        ), 0), 2) AS total_net_movements
      FROM latest_sessions_per_teller ls
      WHERE ls.status = 'OPEN'
      GROUP BY ls.branch_id
    ),
    closed_awaiting_disposition AS (
      SELECT
        ls.branch_id,
        ROUND(COALESCE(SUM(
          GREATEST(0,
            COALESCE(ls.closing_count, 0)
            - COALESCE((
                SELECT SUM(CASE WHEN vm.direction = 'IN' THEN vm.amount ELSE -vm.amount END)
                FROM public.branch_vault_movement vm
                WHERE vm.teller_session_id = ls.id
              ), 0)
            - COALESCE((
                SELECT SUM(m.amount)
                FROM public.teller_movement m
                WHERE m.teller_session_id = ls.id
                  AND m.movement_type = 'BANK_DEPOSIT'
                  AND m.direction = 'OUT'
              ), 0)
          )
        ), 0), 2) AS closed_sessions_cash
      FROM latest_sessions_per_teller ls
      WHERE ls.status IN ('CLOSED', 'SETTLED', 'VERIFIED')
      GROUP BY ls.branch_id
    ),
    vault_balances AS (
      SELECT
        vm.branch_id,
        ROUND(COALESCE(SUM(CASE WHEN vm.direction = 'IN' THEN vm.amount ELSE -vm.amount END), 0), 2) AS vault_cash
      FROM public.branch_vault_movement vm
      JOIN branch_scope b ON b.id = vm.branch_id
      GROUP BY vm.branch_id
    ),
    gl_balances AS (
      SELECT
        jl.branch_id,
        ROUND(COALESCE(SUM(CASE WHEN a.code = '1111' THEN jl.debit_amount - jl.credit_amount ELSE 0 END), 0), 2) AS gl_cash_in_hand,
        ROUND(COALESCE(SUM(CASE WHEN a.code = '1114' THEN jl.debit_amount - jl.credit_amount ELSE 0 END), 0), 2) AS gl_petty_cash
      FROM public.accounting_journal_line jl
      JOIN public.accounting_account a ON a.id = jl.account_id
      JOIN branch_scope b ON b.id = jl.branch_id
      WHERE a.code IN ('1111', '1114')
      GROUP BY jl.branch_id
    )
    SELECT
      b.id,
      b.name,
      COALESCE(gl.gl_cash_in_hand, 0) AS gl_1111,
      COALESCE(gl.gl_petty_cash, 0) AS gl_1114,
      ROUND((COALESCE(ad.total_opening_float, 0) + COALESCE(ad.total_net_movements, 0))::NUMERIC, 2) AS active_drawer_cash,
      COALESCE(cad.closed_sessions_cash, 0) AS closed_sessions_cash,
      COALESCE(vb.vault_cash, 0) AS vault_cash,
      ROUND((
        ROUND((COALESCE(ad.total_opening_float, 0) + COALESCE(ad.total_net_movements, 0))::NUMERIC, 2)
        + COALESCE(cad.closed_sessions_cash, 0)
        + COALESCE(vb.vault_cash, 0)
      )::NUMERIC, 2) AS total_physical_cash,
      ROUND((
        COALESCE(gl.gl_cash_in_hand, 0)
        - (
          ROUND((COALESCE(ad.total_opening_float, 0) + COALESCE(ad.total_net_movements, 0))::NUMERIC, 2)
          + COALESCE(cad.closed_sessions_cash, 0)
          + COALESCE(vb.vault_cash, 0)
        )
      )::NUMERIC, 2) AS variance_1111_vs_physical
    FROM branch_scope b
    LEFT JOIN gl_balances gl ON gl.branch_id = b.id
    LEFT JOIN active_drawer ad ON ad.branch_id = b.id
    LEFT JOIN closed_awaiting_disposition cad ON cad.branch_id = b.id
    LEFT JOIN vault_balances vb ON vb.branch_id = b.id
    ORDER BY b.id;
  `;

  const res = await c.query(query);
  console.table(res.rows);
  await c.end();
}
run();
