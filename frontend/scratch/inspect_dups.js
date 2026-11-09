const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
let connStr = process.env.DATABASE_URL;
if (!connStr && fs.existsSync(path.join(__dirname, '../.env'))) {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  const match = envContent.match(/DATABASE_URL=([^\r\n]+)/);
  if (match) connStr = match[1].trim();
}
if (!connStr) {
  connStr = "[REDACTED_DATABASE_CREDENTIAL]";
}
const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

async function check() {
  await client.connect();

  const seqs = await client.query("SELECT sequencename, last_value FROM pg_sequences WHERE schemaname = 'public'");
  console.log("PG SEQUENCES:", seqs.rows);

  const dups = await client.query(`
    SELECT id, display_id, metadata->>'order_number' as order_number, status, created_at, deleted_at, metadata->>'idempotency_key' as idem_key
    FROM public."order"
    WHERE metadata->>'order_number' IN ('CTH-20260828-101', 'CTH-20260828-214')
    ORDER BY metadata->>'order_number', created_at;
  `);
  console.log("DUPLICATE ROWS DETAIL:", dups.rows);

  // Check if statutory_invoice_seq exists in pg_class
  const rawSeq = await client.query(`
    SELECT c.relname, c.relkind 
    FROM pg_class c 
    JOIN pg_namespace n ON n.oid = c.relnamespace 
    WHERE c.relname = 'statutory_invoice_seq' AND n.nspname = 'public';
  `);
  console.log("statutory_invoice_seq in pg_class:", rawSeq.rows);

  await client.end();
}

check().catch(console.error);
