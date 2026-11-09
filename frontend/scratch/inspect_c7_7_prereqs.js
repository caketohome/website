const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

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

async function inspect() {
  const conn = getConnectionString();
  const pool = new Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } });

  const branches = await pool.query('SELECT id, name, code, metadata FROM branch WHERE deleted_at IS NULL LIMIT 3');
  console.log('BRANCHES_LIST:', branches.rows.map(b => ({ id: b.id, name: b.name, code: b.code, state: b.metadata?.state })));

  const custCols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='customer'`);
  console.log('Customer cols:', custCols.rows.map(r => r.column_name));

  const customers = await pool.query('SELECT id, first_name, last_name, email, is_corporate, credit_enabled, credit_status, credit_limit FROM customer WHERE deleted_at IS NULL LIMIT 5');
  console.log('Customers:', JSON.stringify(customers.rows, null, 2));

  const users = await pool.query('SELECT id, email FROM public."user" LIMIT 3');
  console.log('USERS:', users.rows);

  await pool.end();
}

inspect().catch(console.error);
