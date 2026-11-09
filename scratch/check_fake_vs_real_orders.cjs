const fs = require('fs');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

function getConn() {
  const env = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      return val;
    }
  }
}

async function main() {
  const client = new Client({
    connectionString: getConn(),
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    const fakeIdCheck = await client.query("SELECT * FROM public.\"order\" WHERE id = 'ord_test_cod_1792217116641'");
    console.log(`Checking ord_test_cod_1792217116641: rowCount = ${fakeIdCheck.rowCount}`);

    // Let's get ALL columns for the 13 real orders:
    const real13 = await client.query(`
      SELECT * FROM public."order" WHERE id LIKE 'ord_test_cod_%' ORDER BY created_at ASC
    `);
    console.log(`\nREAL 13 ORDERS DUMP (${real13.rowCount} rows):`);
    for (const r of real13.rows) {
      console.log(JSON.stringify({
        id: r.id,
        order_number: r.order_number,
        status: r.status,
        delivery_status: r.delivery_status,
        payment_method: r.payment_method,
        payment_status: r.payment_status,
        total: r.metadata ? r.metadata.total : null,
        cod_event: r.metadata ? r.metadata.cod_custody_event : null,
        created_at: r.created_at,
        metadata: r.metadata
      }, null, 2));
    }
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error("DB probe error:", err);
  process.exit(1);
});
