const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

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
  const connStr = getConnectionString();
  const pool = new Pool({
    connectionString: connStr,
    ssl: connStr.includes('supabase') ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();
  try {
    await client.query("SET session_replication_role = 'replica';");
    await client.query("DELETE FROM public.corporate_employee_event WHERE account_id IN (SELECT id FROM public.corporate_account WHERE legal_name LIKE 'Federal Corp%');");
    await client.query("DELETE FROM public.corporate_employee WHERE account_id IN (SELECT id FROM public.corporate_account WHERE legal_name LIKE 'Federal Corp%');");
    await client.query("DELETE FROM public.corporate_account_event WHERE account_id IN (SELECT id FROM public.corporate_account WHERE legal_name LIKE 'Federal Corp%');");
    await client.query("DELETE FROM public.corporate_account_contact WHERE account_id IN (SELECT id FROM public.corporate_account WHERE legal_name LIKE 'Federal Corp%');");
    await client.query("DELETE FROM public.corporate_account_member WHERE account_id IN (SELECT id FROM public.corporate_account WHERE legal_name LIKE 'Federal Corp%');");
    await client.query("DELETE FROM public.corporate_account WHERE legal_name LIKE 'Federal Corp%';");
    await client.query("DELETE FROM public.customer WHERE company_name LIKE 'Federal Corp%';");
    await client.query('DELETE FROM public."user" WHERE id LIKE \'usr_maker_%\';');
    await client.query("SET session_replication_role = 'origin';");

    const res = await client.query('SELECT count(*)::int as cnt FROM public.corporate_account;');
    console.log('Corporate account count after clean:', res.rows[0].cnt);
  } finally {
    client.release();
    await pool.end();
  }
}

clean().catch(console.error);
