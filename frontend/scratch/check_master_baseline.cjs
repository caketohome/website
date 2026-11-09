const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

const { Pool } = require(path.resolve(__dirname, '../node_modules/pg'));

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();

    // 1. Sequences
    const orderSeq = await client.query('SELECT * FROM public.order_sequence');
    const invSeq = await client.query('SELECT * FROM public.invoice_sequence');
    console.log('Order Sequence:', orderSeq.rows);
    console.log('Invoice Sequence:', invSeq.rows);

    // 2. Invoice Columns
    const invCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'invoice'
      ORDER BY ordinal_position
    `);
    console.log('Invoice Columns:', invCols.rows.map(r => r.column_name).join(', '));

    // 3. Existing Invoices
    const invoices = await client.query('SELECT * FROM public.invoice ORDER BY created_at ASC');
    console.log('Existing Invoices count:', invoices.rows.length);
    console.log('Existing Invoices details:', invoices.rows.map(r => ({
      id: r.id,
      invoice_number: r.invoice_number,
      order_id: r.order_id,
      created_at: r.created_at,
      metadata: r.metadata
    })));

    // 4. 13 test fixtures status
    const test13 = await client.query(`
      SELECT id, order_number, status, metadata->>'classification' as classification, metadata->>'invoicing_exempt' as exempt, metadata->>'source' as source
      FROM public."order"
      WHERE id LIKE 'ord_test_cod_%'
    `);
    console.log('13 Test Orders count:', test13.rows.length);
    console.log('13 Test Orders items:', test13.rows.map(r => ({
      id: r.id,
      order_number: r.order_number,
      status: r.status,
      classification: r.classification,
      exempt: r.exempt,
      source: r.source
    })));

    // 5. Queue stats
    const queueStats = await client.query('SELECT COUNT(*) as count FROM public.invoice_generation_queue');
    console.log('Invoice Queue count:', queueStats.rows[0].count);

    // 6. Allocation log stats
    const logStats = await client.query('SELECT COUNT(*) as count FROM public.invoice_allocation_log');
    console.log('Allocation Log count:', logStats.rows[0].count);

    client.release();
  } catch (err) {
    console.error('Error running baseline:', err);
  } finally {
    await pool.end();
  }
}

run();
