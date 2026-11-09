const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('DATABASE_URL=')) {
        let val = trimmed.substring('DATABASE_URL='.length).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        return val;
      }
    }
  }
  return process.env.DATABASE_URL;
}

const pool = new Pool({
  connectionString: getConnectionString(),
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('=== MARKETPLACE, RIDERS & COMPLAINTS SCHEMA INSPECTION ===\n');

  // Count active delivery partners
  const dpCount = await pool.query('SELECT count(*) FROM delivery_partner WHERE deleted_at IS NULL');
  console.log('Active delivery partners count (deleted_at IS NULL):', dpCount.rows[0].count);

  // Check marketplace_complaint table
  const compExists = await pool.query(`
    SELECT table_name FROM information_schema.tables WHERE table_name = 'marketplace_complaint'
  `);
  console.log('\nmarketplace_complaint table exists:', compExists.rows.length > 0);
  if (compExists.rows.length > 0) {
    const compCols = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'marketplace_complaint'
    `);
    console.log('marketplace_complaint columns:');
    compCols.rows.forEach(c => console.log(`- ${c.column_name} (${c.data_type})`));
  }

  // Check marketplace_partner table
  const mpCols = await pool.query(`
    SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'marketplace_partner'
  `);
  console.log('\nmarketplace_partner columns:');
  mpCols.rows.forEach(c => console.log(`- ${c.column_name} (${c.data_type})`));

  // Check partner stores
  const storeCols = await pool.query(`
    SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'marketplace_store'
  `);
  console.log('\nmarketplace_store columns:');
  storeCols.rows.forEach(c => console.log(`- ${c.column_name} (${c.data_type})`));

  // Check partner agreements
  const agrCols = await pool.query(`
    SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'marketplace_partner_agreement'
  `);
  console.log('\nmarketplace_partner_agreement columns:');
  agrCols.rows.forEach(c => console.log(`- ${c.column_name} (${c.data_type})`));

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
