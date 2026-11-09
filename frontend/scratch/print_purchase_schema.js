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
  throw new Error("DATABASE_URL not found in .env");
}

const pool = new Pool({ connectionString: getConnectionString() });

async function main() {
  const c = await pool.connect();
  const res = await c.query(`
    SELECT table_name, column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_schema='public' AND table_name IN ('purchase', 'purchase_item', 'purchase_payment', 'supplier') 
    ORDER BY table_name, ordinal_position;
  `);
  res.rows.forEach(r => {
    console.log(`${r.table_name}.${r.column_name} (${r.data_type}, null: ${r.is_nullable}, def: ${r.column_default})`);
  });
  c.release();
  await pool.end();
}

main().catch(console.error);
