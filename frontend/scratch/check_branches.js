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

const pool = new Pool({ connectionString: getConnectionString() });

async function checkBranches() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT id, name, code, is_open FROM public.branch ORDER BY name");
    console.log("Total branches:", res.rows.length);
    const ho = res.rows.filter(b => b.name.toLowerCase().includes('head') || b.name.toLowerCase().includes('office') || b.code.toLowerCase().includes('ho') || b.code.toLowerCase().includes('hq'));
    console.log("Head Office matches:", ho);
    console.log("Sample 10 branches:", res.rows.slice(0, 10));
  } finally {
    client.release();
    await pool.end();
  }
}

checkBranches().catch(console.error);
