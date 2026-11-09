const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

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

const pool = new Pool({ connectionString: getConnectionString() });

async function inspect() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE '%price%'
    `);
    console.log('Price tables:', res.rows.map(r => r.table_name));

    for (const t of res.rows.map(r => r.table_name)) {
      const count = (await client.query(`SELECT COUNT(*) FROM "${t}"`)).rows[0].count;
      console.log(`Table [${t}] row count: ${count}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}
inspect().catch(console.error);
