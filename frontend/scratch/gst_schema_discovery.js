// GST schema discovery (read-only). Prints table columns + row counts only; never prints secret settings.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function conn() {
  for (const p of ['../.env.local', '../.env']) {
    const f = path.join(__dirname, p);
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      const t = line.trim();
      if (t.startsWith('DATABASE_URL=')) return t.slice(13).replace(/^["']|["']$/g, '');
    }
  }
  return process.env.DATABASE_URL;
}

(async () => {
  const c = new Client({ connectionString: conn(), ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query('BEGIN READ ONLY');
  const { rows: tables } = await c.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE' AND (
      table_name ILIKE '%invoice%' OR table_name ILIKE '%credit_note%' OR table_name ILIKE '%debit_note%'
      OR table_name ILIKE 'purchase%' OR table_name ILIKE 'sales_return%' OR table_name ILIKE 'gst%'
      OR table_name ILIKE '%tax%' OR table_name ILIKE 'supplier%' OR table_name ILIKE 'company%'
      OR table_name ILIKE '%export%' OR table_name ILIKE '%hsn%' OR table_name ILIKE 'expense%'
      OR table_name ILIKE 'report%'
    ) ORDER BY table_name`);
  for (const { table_name } of tables) {
    const { rows: cols } = await c.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [table_name]);
    const { rows: cnt } = await c.query(`SELECT count(*)::int n FROM public."${table_name}"`);
    console.log(`\n## ${table_name} (rows=${cnt[0].n})`);
    console.log(cols.map(x => `${x.column_name}:${x.data_type}${x.is_nullable === 'NO' ? '!' : ''}`).join(', '));
  }
  const { rows: checks } = await c.query(`
    SELECT conrelid::regclass::text tbl, conname, pg_get_constraintdef(oid) def FROM pg_constraint
    WHERE contype IN ('c','u') AND connamespace='public'::regnamespace AND (
      conrelid::regclass::text ILIKE '%invoice%' OR conrelid::regclass::text ILIKE '%credit_note%' OR conrelid::regclass::text ILIKE 'purchase%'
      OR conrelid::regclass::text ILIKE 'sales_return%' OR conrelid::regclass::text ILIKE 'gst%')
    ORDER BY 1,2`);
  console.log('\n## CHECK/UNIQUE constraints');
  for (const r of checks) console.log(`${r.tbl}.${r.conname}: ${r.def}`);
  await c.query('ROLLBACK');
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
