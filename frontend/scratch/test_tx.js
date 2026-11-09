const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = l.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/);
      if (m) { connectionString = m[1].trim(); break; }
    }
  }
}
if (!connectionString) throw new Error('DATABASE_URL not set');
const pool = new Pool({ connectionString, ssl: connectionString.includes('supabase') ? { rejectUnauthorized: false } : false });

async function executeInTransaction(client, callback) {
  if (!client) {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const res = await callback(c);
      await c.query('COMMIT');
      return res;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }

  try {
    await client.query("SAVEPOINT sp_test");
    try {
      const res = await callback(client);
      await client.query("RELEASE SAVEPOINT sp_test");
      return res;
    } catch (err) {
      await client.query("ROLLBACK TO SAVEPOINT sp_test");
      throw err;
    }
  } catch (err) {
    if (err.code === "25P01" || (err.message && err.message.includes("transaction blocks"))) {
      await client.query("BEGIN");
      try {
        const res = await callback(client);
        await client.query("COMMIT");
        return res;
      } catch (innerErr) {
        await client.query("ROLLBACK");
        throw innerErr;
      }
    }
    throw err;
  }
}

async function run() {
  const client = await pool.connect();
  
  // Test Case 1: Client without transaction
  console.log('Testing Case 1: Client without transaction...');
  let val1 = await executeInTransaction(client, async (c) => {
    const r = await c.query('SELECT 123 AS num');
    return r.rows[0].num;
  });
  console.log('Case 1 result:', val1);

  // Test Case 2: Client inside active transaction
  console.log('Testing Case 2: Client with active transaction...');
  await client.query('BEGIN');
  let val2 = await executeInTransaction(client, async (c) => {
    const r = await c.query('SELECT 456 AS num');
    return r.rows[0].num;
  });
  await client.query('COMMIT');
  console.log('Case 2 result:', val2);

  client.release();
  await pool.end();
}

run().catch(console.error);
