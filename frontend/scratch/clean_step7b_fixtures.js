const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

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
  throw new Error("DATABASE_URL not found");
}

async function clean() {
  const pool = new Pool({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });

  const custs = await pool.query("SELECT id FROM customer WHERE id LIKE 'cus_corp_%' OR id LIKE 'cus_ret_%' OR id LIKE 'cus_dis_%' OR id LIKE 'cus_pen_%' OR id LIKE 'cus_low_%' OR id LIKE 'cus_conc_%'");
  const cIds = custs.rows.map(r => r.id);
  console.log('Orphan test customers to clean:', cIds);

  if (cIds.length > 0) {
    const invs = await pool.query('SELECT id FROM invoice WHERE customer_id = ANY($1::text[])', [cIds]);
    const invIds = invs.rows.map(r => r.id);
    if (invIds.length > 0) {
      const vRes = await pool.query('SELECT id FROM accounting_voucher WHERE reference_id = ANY($1::text[])', [invIds]);
      const vIds = vRes.rows.map(r => r.id);
      if (vIds.length > 0) {
        const jRes = await pool.query('SELECT id FROM accounting_journal_entry WHERE voucher_id = ANY($1::text[])', [vIds]);
        const jIds = jRes.rows.map(r => r.id);
        if (jIds.length > 0) {
          await pool.query('DELETE FROM accounting_journal_line WHERE journal_entry_id = ANY($1::text[])', [jIds]);
          await pool.query('DELETE FROM accounting_journal_entry WHERE id = ANY($1::text[])', [jIds]);
        }
        await pool.query('DELETE FROM accounting_voucher WHERE id = ANY($1::text[])', [vIds]);
      }
      await pool.query('DELETE FROM invoice WHERE id = ANY($1::text[])', [invIds]);
    }
    await pool.query('DELETE FROM delivery WHERE transaction_id IN (SELECT id FROM "order" WHERE customer_id = ANY($1::text[]))', [cIds]);
    await pool.query('DELETE FROM "order" WHERE customer_id = ANY($1::text[])', [cIds]);
    await pool.query('DELETE FROM corporate_gifting_recipient WHERE batch_id IN (SELECT id FROM corporate_gifting_batch WHERE customer_id = ANY($1::text[]))', [cIds]);
    await pool.query('DELETE FROM corporate_gifting_batch WHERE customer_id = ANY($1::text[])', [cIds]);
    await pool.query('DELETE FROM customer WHERE id = ANY($1::text[])', [cIds]);
  }
  const ccs = await pool.query("DELETE FROM cost_centre WHERE code LIKE 'CC-GIFT-%'");
  console.log('Cleaned test cost centres:', ccs.rowCount);

  // Check baseline
  const coa = (await pool.query('SELECT count(*)::int as count FROM accounting_account')).rows[0].count;
  const tb = (await pool.query('SELECT COALESCE(SUM(debit_amount),0)::numeric(12,2) as dr, COALESCE(SUM(credit_amount),0)::numeric(12,2) as cr FROM accounting_journal_line')).rows[0];
  console.log(`Baseline status: CoA ${coa} accounts | TB Dr ₹${tb.dr} = Cr ₹${tb.cr}`);

  await pool.end();
}

clean().catch(console.error);
