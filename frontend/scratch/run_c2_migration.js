/**
 * CakeToHome ERP — Phase C2: Apply Teller & Cash Custody Schema Migration
 * Migration file: backend/src/migrations/20261004_phase_c_teller_management.sql
 */

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

async function runMigration() {
  const migrationPath = path.join(__dirname, '../../backend/src/migrations/20261004_phase_c_teller_management.sql');
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found at: ${migrationPath}`);
  }

  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  console.log(`Read migration SQL (${migrationSql.length} bytes)...`);

  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  await client.connect();
  console.log('Connected to PostgreSQL.');

  try {
    await client.query('BEGIN');
    console.log('Executing Phase C2 migration transaction...');
    await client.query(migrationSql);
    await client.query('COMMIT');
    console.log('Phase C2 migration COMMITTED successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed and was ROLLED BACK:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration().catch(err => {
  console.error('Migration runner fatal error:', err);
  process.exit(1);
});
