const fs = require('fs');
const path = require('path');
const { Client } = require('../frontend/node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      let val = line.substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  throw new Error("No database connection string found");
}

async function checkHistorical() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();
  try {
    const res = await client.query(`
      SELECT id, metadata, status, created_at 
      FROM public."order" 
      WHERE deleted_at IS NULL AND id NOT LIKE 'ord_test_%' 
      ORDER BY created_at ASC 
      LIMIT 1
    `);
    console.log("Historical order sample:", res.rows[0]);
  } finally {
    await client.end();
  }
}

checkHistorical().catch(console.error);
