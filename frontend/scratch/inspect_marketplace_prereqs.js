const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getDbUrl() {
  const envPath = path.join(__dirname, '../.env');
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const l of lines) {
    if (l.trim().startsWith('DATABASE_URL=')) {
      return l.trim().substring('DATABASE_URL='.length).trim().replace(/['"]/g, '');
    }
  }
  throw new Error('DATABASE_URL not found');
}

async function main() {
  const client = new Client({ connectionString: getDbUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== STEP A: DATABASE RECONNAISSANCE ===");

  // 1. All public tables
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  const tableNames = tablesRes.rows.map(r => r.table_name);
  console.log(`\nFound ${tableNames.length} tables in public schema.`);

  // Filter relevant tables
  const relevantKeywords = ['inv', 'stock', 'reserv', 'sched', 'holiday', 'closur', 'sett', 'feat', 'flag', 'partn', 'market', 'vendor', 'agree', 'bill', 'payab'];
  const matches = tableNames.filter(t => relevantKeywords.some(k => t.toLowerCase().includes(k)));
  console.log("\nRelevant existing tables:", matches);

  // Inspect column details for each matched table
  for (const t of matches) {
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position;
    `, [t]);
    console.log(`\nTable [${t}]:`);
    console.log(cols.rows.map(c => `  - ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`).join('\n'));
  }

  // Also check product and branch tables
  for (const t of ['product', 'branch', 'setting']) {
    if (tableNames.includes(t)) {
      const cols = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `, [t]);
      console.log(`\nTable [${t}]:`);
      console.log(cols.rows.map(c => `  - ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`).join('\n'));
    }
  }

  await client.end();
}

main().catch(err => {
  console.error("Error inspecting database:", err);
  process.exit(1);
});
