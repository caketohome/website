const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPaths = [
    path.join(__dirname, '../backend/.env'),
    path.join(__dirname, '../frontend/.env')
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const idx = trimmed.indexOf('=');
          if (idx !== -1) {
            const key = trimmed.substring(0, idx).trim();
            const val = trimmed.substring(idx + 1).trim();
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
    }
  }
}

loadEnv();

const pgPath = path.join(__dirname, '../frontend/node_modules/pg');
const { Client } = require(pgPath);

async function disableRLS() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL is not set.');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database.');

    const tableRes = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' AND rowsecurity = true
      ORDER BY tablename ASC;
    `);

    const enabledTables = tableRes.rows;
    console.log(`\n⚠️ Emergency Rollback: Disabling RLS on ${enabledTables.length} public tables...`);

    if (enabledTables.length === 0) {
      console.log('No tables with RLS enabled found.');
      await client.end();
      return;
    }

    await client.query('BEGIN');
    for (let i = 0; i < enabledTables.length; i++) {
      const table = enabledTables[i].tablename;
      await client.query(`ALTER TABLE public."${table}" DISABLE ROW LEVEL SECURITY;`);
    }
    await client.query('COMMIT');
    console.log('✅ Rollback complete: Row Level Security disabled on all specified tables.');

    await client.end();
  } catch (err) {
    console.error('❌ Error executing RLS rollback:', err);
    try { await client.query('ROLLBACK'); } catch (_) {}
    try { await client.end(); } catch (_) {}
    process.exit(1);
  }
}

disableRLS();
