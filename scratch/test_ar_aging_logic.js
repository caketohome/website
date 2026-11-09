const fs = require('fs');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

function getConn() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      return val;
    }
  }
}

async function run() {
  const client = new Client({ connectionString: getConn(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=============================================================================');
  console.log('Testing Prototype AR Aging Logic against PostgreSQL');
  console.log('=============================================================================\n');

  const asOfDate = '2026-10-16';

  const sql = `
    SELECT
      inv.id AS invoice_id,
      inv.invoice_number,
      inv.order_id,
      inv.customer_id,
      COALESCE(c.company_name, inv.customer_name, 'Guest Customer') AS customer_name,
      c.company_name,
      c.phone AS customer_phone,
      c.email AS customer_email,
      inv.branch_id,
      b.name AS branch_name,
      inv.created_at::date::text AS invoice_date,
      COALESCE(inv.due_date, inv.created_at::date)::text AS due_date,
      inv.grand_total::numeric AS invoice_total,
      inv.payment_status,
      inv.payment_method,
      inv.is_corporate,
      COALESCE(cra.total_allocated, 0)::numeric AS allocated_paid,
      COALESCE(ret.total_returns, 0)::numeric AS returns_amount
    FROM public.invoice inv
    LEFT JOIN public.customer c ON c.id = inv.customer_id AND c.deleted_at IS NULL
    LEFT JOIN public.branch b ON b.id = inv.branch_id
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(cra_inner.allocated_amount), 0) AS total_allocated
      FROM public.customer_receipt_allocation cra_inner
      LEFT JOIN public.accounting_voucher v_rcpt ON v_rcpt.id = cra_inner.voucher_id
      WHERE cra_inner.invoice_id = inv.id
        AND (v_rcpt.id IS NULL OR (v_rcpt.status = 'POSTED' AND v_rcpt.deleted_at IS NULL AND v_rcpt.voucher_date <= $1))
        AND cra_inner.created_at::date <= $1
    ) cra ON TRUE
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(v_ret.total_amount), 0) AS total_returns
      FROM public.accounting_voucher v_ret
      WHERE v_ret.reference_type = 'ORDER_RETURN'
        AND v_ret.metadata->>'order_id' = inv.order_id
        AND v_ret.status = 'POSTED'
        AND v_ret.deleted_at IS NULL
        AND v_ret.voucher_date <= $1
    ) ret ON TRUE
    WHERE inv.deleted_at IS NULL
      AND inv.created_at::date <= $1
    ORDER BY inv.due_date ASC, inv.created_at ASC
  `;

  const res = await client.query(sql, [asOfDate]);
  console.log(`Found ${res.rows.length} total invoices up to ${asOfDate}:`);
  console.table(res.rows);

  const asOfTime = new Date(asOfDate).getTime();
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  let grandCurrent = 0;
  let grand1_30 = 0;
  let grand31_60 = 0;
  let grand61_90 = 0;
  let grand90Plus = 0;
  let grandTotal = 0;
  let invoiceCount = 0;

  const customerMap = new Map();

  for (const row of res.rows) {
    const invoiceTotal = Number(row.invoice_total);
    let paidAmount = Number(row.allocated_paid);
    const returnsAmount = Number(row.returns_amount);

    // If retail invoice was fully paid at checkout (prepaid_online or payment_status = 'paid')
    if (paidAmount === 0 && (row.payment_status === 'paid' || row.payment_method === 'prepaid_online')) {
      paidAmount = invoiceTotal;
    }

    const balanceDue = Math.max(0, Math.round((invoiceTotal - paidAmount - returnsAmount) * 100) / 100);

    if (balanceDue <= 0.005) {
      console.log(`  - Invoice ${row.invoice_number}: settled (Balance: ₹${balanceDue.toFixed(2)}), excluding from aging.`);
      continue;
    }

    const dueTime = new Date(row.due_date).getTime();
    const daysOverdue = Math.floor((asOfTime - dueTime) / MS_PER_DAY);

    let bucket = 'CURRENT';
    if (daysOverdue <= 0) bucket = 'CURRENT';
    else if (daysOverdue <= 30) bucket = 'DAYS_1_30';
    else if (daysOverdue <= 60) bucket = 'DAYS_31_60';
    else if (daysOverdue <= 90) bucket = 'DAYS_61_90';
    else bucket = 'DAYS_90_PLUS';

    console.log(`  + Open Invoice: ${row.invoice_number} | Due: ${row.due_date} | Overdue: ${daysOverdue}d | Bucket: ${bucket} | Balance: ₹${balanceDue.toFixed(2)}`);

    invoiceCount++;
    grandTotal += balanceDue;
    if (bucket === 'CURRENT') grandCurrent += balanceDue;
    else if (bucket === 'DAYS_1_30') grand1_30 += balanceDue;
    else if (bucket === 'DAYS_31_60') grand31_60 += balanceDue;
    else if (bucket === 'DAYS_61_90') grand61_90 += balanceDue;
    else grand90Plus += balanceDue;
  }

  console.log('\n--- Aging Summary ---');
  console.log({
    as_of_date: asOfDate,
    summary: {
      total_current: grandCurrent,
      total_1_30: grand1_30,
      total_31_60: grand31_60,
      total_61_90: grand61_90,
      total_90_plus: grand90Plus,
      grand_total: grandTotal,
      invoice_count: invoiceCount
    }
  });

  await client.end();
}

run();
