const fs = require('fs');
const path = require('path');

const frontendDir = path.resolve(__dirname, '../frontend');
const pg = require(path.join(frontendDir, 'node_modules/pg'));

// Parse .env.local manually
const envLocalPath = path.join(frontendDir, '.env.local');
let dbUrl = "postgresql://cth_test_user@127.0.0.1:5433/cth_test";
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('TEST_DATABASE_URL=')) {
      dbUrl = trimmed.split('=')[1].trim();
      break;
    } else if (trimmed.startsWith('DATABASE_URL=')) {
      dbUrl = trimmed.split('=')[1].trim();
    }
  }
}

console.log("Using Database URL:", dbUrl.replace(/:[^:@]+@/, ':***@'));
if (!dbUrl.includes(':5433')) {
  console.error("FAIL-CLOSED: Expected port 5433 test database URL. Got:", dbUrl);
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: dbUrl });

async function main() {
  const client = await pool.connect();
  try {
    const colRes = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'branch_inventory' 
      ORDER BY ordinal_position;
    `);
    console.log("=== COLUMNS OF branch_inventory ===");
    console.table(colRes.rows);

    const tblRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE '%invent%'
      ORDER BY table_name;
    `);
    console.log("=== INVENTORY RELATED TABLES ===");
    console.table(tblRes.rows);

    const sampleRes = await client.query(`
      SELECT * FROM branch_inventory LIMIT 5;
    `);
    console.log("=== SAMPLE ROWS FROM branch_inventory ===");
    console.table(sampleRes.rows);

    const accRes = await client.query(`
      SELECT * FROM branch_inventory WHERE product_id = 'acc_01';
    `);
    console.log("=== ROWS FOR acc_01 ===");
    console.table(accRes.rows);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
