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
    const orderCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'order' ORDER BY ordinal_position");
    console.log("Order table columns:", orderCols.rows.map(c => c.column_name).join(', '));

    // Get 1 row from order
    const sample = await client.query('SELECT * FROM public."order" LIMIT 1');
    console.log("Sample order keys:", Object.keys(sample.rows[0]));

    // Query all orders with id LIKE 'ord_test_cod_%'
    const orders = await client.query(`SELECT * FROM public."order" WHERE id LIKE 'ord_test_cod_%' ORDER BY created_at ASC`);
    console.log(`\nFound ${orders.rowCount} orders matching ord_test_cod_%:`);
    for (const o of orders.rows) {
      console.log(`- ID: ${o.id} | No: ${o.order_number || o.order_id} | Total: ${o.total_amount || o.grand_total || o.amount} | Status: ${o.status || o.order_status} | Pay: ${o.payment_method}/${o.payment_status} | Customer: ${o.customer_name} | Metadata: ${JSON.stringify(o.metadata)}`);
    }

    // Also check prompt 13 IDs:
    const promptIds = [
      'ord_test_cod_1792216816562',
      'ord_test_cod_1792216866898',
      'ord_test_cod_1792217303420',
      'ord_test_cod_1792217567929',
      'ord_test_cod_1792218199553',
      'ord_test_cod_1792218268062',
      'ord_test_cod_1792218470807',
      'ord_test_cod_1792219136677',
      'ord_test_cod_1792219161849',
      'ord_test_cod_1792219239431',
      'ord_test_cod_1792219314509',
      'ord_test_cod_1792219412950',
      'ord_test_cod_1792220817636'
    ];
    const promptCheck = await client.query('SELECT * FROM public."order" WHERE id = ANY($1)', [promptIds]);
    console.log(`\nFound ${promptCheck.rowCount} of the 13 prompt IDs in DB:`);
    for (const o of promptCheck.rows) {
      console.log(`  * ID: ${o.id} | No: ${o.order_number} | Total: ${o.total_amount || o.grand_total || o.amount} | Status: ${o.status}`);
    }

  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error("DB probe error:", err);
  process.exit(1);
});
