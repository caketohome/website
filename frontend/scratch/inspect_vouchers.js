const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConnectionString() {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  throw new Error("DATABASE_URL not found in .env");
}

async function inspect() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    const res = await client.query(`SELECT id, voucher_no, voucher_type, narration, reference_id, metadata FROM public.accounting_voucher ORDER BY created_at DESC`);
    console.log("Vouchers count:", res.rows.length);
    for (const v of res.rows) {
      console.log(`- ID: ${v.id}, No: ${v.voucher_no}, Narration: ${v.narration}, Ref: ${v.reference_id}, Meta: ${JSON.stringify(v.metadata)}`);
    }
  } finally {
    await client.end();
  }
}

inspect().catch(console.error);
