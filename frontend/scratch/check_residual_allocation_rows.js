const { Client } = require('pg');
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

async function check() {
  const conn = getConnectionString();
  const client = new Client({
    connectionString: conn,
    ssl: conn.includes('supabase') ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  const res = await client.query(`
    SELECT 
      (SELECT count(*)::int FROM cost_allocation_rule) as rules,
      (SELECT count(*)::int FROM cost_allocation_rule_target) as targets,
      (SELECT count(*)::int FROM cost_allocation_run) as runs,
      (SELECT count(*)::int FROM cost_allocation_run_line) as run_lines,
      (SELECT count(*)::int FROM cost_centre WHERE code LIKE 'CC-TEST%') as test_ccs,
      (SELECT count(*)::int FROM cost_centre) as total_ccs
  `);

  console.log("Database Residual Verification:", JSON.stringify(res.rows[0], null, 2));
  await client.end();
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
