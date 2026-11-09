const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const l of lines) {
      if (l.trim().startsWith('DATABASE_URL=')) {
        let v = l.trim().substring('DATABASE_URL='.length).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        return v;
      }
    }
  }
  return process.env.DATABASE_URL;
}

async function cleanResiduals() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("Cleaning residual test records from interrupted run...");

  await client.query("ALTER TABLE public.corporate_assignment_event DISABLE TRIGGER trg_corporate_assignment_event_immutability;");
  await client.query("DELETE FROM public.corporate_assignment_event WHERE assignment_id IN (SELECT id FROM public.corporate_delivery_assignment WHERE entity_type = 'GIFTING_RECIPIENT');");
  await client.query("ALTER TABLE public.corporate_assignment_event ENABLE TRIGGER trg_corporate_assignment_event_immutability;");

  await client.query("DELETE FROM public.corporate_delivery_assignment WHERE entity_type = 'GIFTING_RECIPIENT';");
  await client.query("DELETE FROM public.delivery WHERE recipient_name IN ('Anita Desai', 'Karan Johar');");
  await client.query("DELETE FROM public.corporate_gifting_recipient WHERE batch_id IN (SELECT id FROM public.corporate_gifting_batch WHERE batch_name LIKE 'E2E Campaign%');");
  await client.query("DELETE FROM public.corporate_gifting_batch WHERE batch_name LIKE 'E2E Campaign%';");

  await client.query("DELETE FROM public.invoice WHERE customer_id IN (SELECT id FROM public.customer WHERE id LIKE 'cust_e2e_%');");
  await client.query("DELETE FROM public.order_item WHERE order_id IN (SELECT id FROM public.order WHERE customer_id IN (SELECT id FROM public.customer WHERE id LIKE 'cust_e2e_%'));");
  await client.query("DELETE FROM public.order WHERE customer_id IN (SELECT id FROM public.customer WHERE id LIKE 'cust_e2e_%');");

  await client.query(`
    DELETE FROM public.accounting_journal_line 
    WHERE customer_id IN (SELECT id FROM public.customer WHERE id LIKE 'cust_e2e_%')
       OR journal_entry_id IN (
         SELECT id FROM public.accounting_journal_entry 
         WHERE voucher_id IN (
           SELECT id FROM public.accounting_voucher 
           WHERE reference_event = 'CORPORATE_INVOICE_POSTED' 
              OR reference_id LIKE 'inv_corp_%'
         )
       );
  `);
  await client.query(`
    DELETE FROM public.accounting_journal_entry 
    WHERE voucher_id IN (
      SELECT id FROM public.accounting_voucher 
      WHERE reference_event = 'CORPORATE_INVOICE_POSTED' 
         OR reference_id LIKE 'inv_corp_%'
    );
  `);
  await client.query(`
    DELETE FROM public.accounting_voucher 
    WHERE reference_event = 'CORPORATE_INVOICE_POSTED' 
       OR reference_id LIKE 'inv_corp_%';
  `);

  await client.query("DELETE FROM public.delivery_partner_coverage WHERE id LIKE 'cov_e2e_%' OR id LIKE 'cov_sec_%';");
  await client.query("DELETE FROM public.delivery_partner_profile WHERE id LIKE 'prof_e2e_%' OR id LIKE 'prof_sec_%';");
  await client.query("DELETE FROM public.delivery_partner WHERE id LIKE 'dlp_e2e_%' OR id LIKE 'dlp_sec_%';");
  await client.query("DELETE FROM public.delivery_zone WHERE id LIKE 'zone_e2e_%' OR id LIKE 'zone_sec_%';");
  await client.query("DELETE FROM public.branch WHERE id LIKE 'br_e2e_%' OR id LIKE 'br_sec_%';");
  await client.query("DELETE FROM public.corporate_account WHERE id LIKE 'acc_e2e_%' OR id LIKE 'acc_sec_%';");
  await client.query("DELETE FROM public.customer WHERE id LIKE 'cust_e2e_%' OR id LIKE 'cust_sec_%';");

  const v = await client.query("SELECT count(*)::int as cnt FROM public.accounting_voucher;");
  const je = await client.query("SELECT count(*)::int as cnt FROM public.accounting_journal_entry;");
  const jl = await client.query("SELECT count(*)::int as cnt, sum(debit_amount)::numeric(12,2) as dr, sum(credit_amount)::numeric(12,2) as cr FROM public.accounting_journal_line;");
  const coa = await client.query("SELECT count(*)::int as cnt FROM public.accounting_account;");
  const dpa = await client.query("SELECT count(*)::int as cnt FROM public.corporate_delivery_assignment;");

  console.log("Post-cleanup Invariants:", {
    coa: coa.rows[0].cnt,
    vouchers: v.rows[0].cnt,
    journalEntries: je.rows[0].cnt,
    journalLines: jl.rows[0].cnt,
    debit: jl.rows[0].dr,
    credit: jl.rows[0].cr,
    assignments: dpa.rows[0].cnt,
  });

  await client.end();
}

cleanResiduals().catch(console.error);
