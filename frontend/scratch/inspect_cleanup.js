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

async function main() {
  const conn = getConnectionString();
  const client = new Client({
    connectionString: conn,
    ssl: conn.includes('supabase') ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  try {
    console.log("Deleting run lines...");
    await client.query('DELETE FROM public.cost_allocation_run_line;');
    console.log("Deleting runs...");
    await client.query('DELETE FROM public.cost_allocation_run;');
    console.log("Deleting rule targets...");
    await client.query('DELETE FROM public.cost_allocation_rule_target;');
    console.log("Deleting rules...");
    await client.query('DELETE FROM public.cost_allocation_rule;');
    console.log("Deleting cost centres...");
    await client.query('DELETE FROM public.cost_centre;');
    console.log("✓ All deleted successfully!");
  } catch (err) {
    console.error("Error deleting:", err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
