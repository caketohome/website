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

    console.log('--- 1. Company Table ---');
    const comp = await client.query('SELECT * FROM public.company');
    console.log('Company rows:', comp.rows);

    console.log('--- 2. GST Registrations ---');
    const gst = await client.query('SELECT * FROM public.gst_registration');
    console.log('GST Registrations:', gst.rows);

    console.log('--- 3. Suppliers ---');
    const sup = await client.query('SELECT * FROM public.supplier LIMIT 5');
    console.log('Suppliers count:', sup.rows.length, sup.rows);

    console.log('--- 4. Branches ---');
    const branches = await client.query('SELECT id, name, code, is_active FROM public.branch LIMIT 5');
    console.log('Branches:', branches.rows);

    console.log('--- 5. Marketplace Partners ---');
    const partners = await client.query('SELECT * FROM public.marketplace_partner');
    console.log('Partners:', partners.rows);

    console.log('--- 6. Bills Payable ---');
    const bills = await client.query('SELECT COUNT(*) as count FROM public.bill_payable');
    console.log('Bills count:', bills.rows[0].count);

    console.log('--- 7. Teller Sessions & Till ---');
    const sessions = await client.query('SELECT COUNT(*) as count FROM public.teller_session');
    console.log('Teller Sessions count:', sessions.rows[0].count);

    client.release();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

run();
