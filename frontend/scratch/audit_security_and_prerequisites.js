// audit_security_and_prerequisites.js
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function getConnectionString() {
  const envFiles = [
    path.join(__dirname, '../.env.local'),
    path.join(__dirname, '../.env'),
    path.join(__dirname, '../../.env')
  ];
  for (const envPath of envFiles) {
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('DATABASE_URL=')) {
          let val = trimmed.substring('DATABASE_URL='.length).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          return val;
        }
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
  console.log('==================================================================');
  console.log('AUDIT: SETTINGS TABLE & PREREQUISITES');
  console.log('==================================================================\n');

  // Check setting table
  const colRes = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'setting'
    ORDER BY ordinal_position;
  `);
  console.log('Columns of setting:');
  colRes.rows.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`));

  const setRes = await pool.query(`SELECT * FROM setting LIMIT 25;`);
  console.log(`\nRows in setting (${setRes.rows.length}):`);
  setRes.rows.forEach(s => {
    console.log(`  - ${s.id || s.key}: ${JSON.stringify(s.value || s)}`);
  });

  await pool.end();
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
