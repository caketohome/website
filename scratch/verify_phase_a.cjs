const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

const DB_URL = '[REDACTED_DATABASE_CREDENTIAL]';

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // Enforce read-only transaction for safety
  await c.query('BEGIN TRANSACTION READ ONLY');

  const metaRes = await c.query(`
    SELECT 
      current_database() as db_name,
      current_user as db_user,
      inet_server_addr() as server_ip,
      inet_server_port() as server_port,
      version() as pg_version,
      current_setting('transaction_read_only') as is_read_only,
      NOW() as db_timestamp
  `);

  console.log('=== PHASE A: DATABASE METADATA (CREDENTIALS REDACTED) ===');
  console.log(JSON.stringify(metaRes.rows[0], null, 2));

  // Verify host metadata
  const parsed = new URL(DB_URL);
  console.log('Host:', parsed.hostname);
  console.log('Port:', parsed.port);
  console.log('Database:', parsed.pathname.replace('/', ''));
  console.log('User (masked):', parsed.username.split('.')[0] + '.[REDACTED]');

  await c.query('COMMIT');
  await c.end();
}

main().catch(console.error);
