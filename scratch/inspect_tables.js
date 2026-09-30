const fs = require('fs');
const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

function getConnectionString() {
  const envContent = fs.readFileSync(path.join(__dirname, '../backend/.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      return line.trim().substring('DATABASE_URL='.length).replace(/['"]/g, '').trim();
    }
  }
  throw new Error("No DATABASE_URL");
}

async function inspect() {
  const pool = new Pool({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false }
  });
  const client = await pool.connect();
  try {
    const tables = ['order_status_history', 'delivery', 'delivery_partner', 'payment_transaction', 'order', 'accounting_voucher', 'accounting_journal_line'];
    for (const t of tables) {
      const res = await client.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1 
        ORDER BY ordinal_position
      `, [t]);
      console.log(`\n=== TABLE: ${t} ===`);
      console.log(res.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
    }

    // Also check foreign keys and sample row from delivery and payment_transaction
    const delSample = await client.query(`SELECT * FROM public.delivery LIMIT 1`);
    console.log(`\n=== SAMPLE DELIVERY ROW ===`, delSample.rows[0]);

    const ptSample = await client.query(`SELECT * FROM public.payment_transaction LIMIT 1`);
    console.log(`\n=== SAMPLE PAYMENT_TRANSACTION ROW ===`, ptSample.rows[0]);

  } finally {
    client.release();
    await pool.end();
  }
}

inspect().catch(err => {
  console.error("Inspect error:", err);
  process.exit(1);
});
