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

async function cleanup() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    console.log("Cleaning test voucher vch_00MV2H5JTEE7XN55...");
    const vId = 'vch_00MV2H5JTEE7XN55';
    const jes = await client.query(`SELECT id FROM public.accounting_journal_entry WHERE voucher_id = $1;`, [vId]);
    const jeIds = jes.rows.map(r => r.id);
    if (jeIds.length > 0) {
      await client.query(`DELETE FROM public.accounting_journal_line WHERE journal_entry_id = ANY($1);`, [jeIds]);
      await client.query(`DELETE FROM public.accounting_journal_entry WHERE id = ANY($1);`, [jeIds]);
    }
    await client.query(`DELETE FROM public.accounting_voucher WHERE id = $1;`, [vId]);
    console.log("Cleaned test voucher successfully!");
  } finally {
    await client.end();
  }
}

cleanup().catch(console.error);
