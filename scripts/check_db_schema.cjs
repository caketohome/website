const path = require('path');
const Client = require(path.resolve('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg')).Client;

async function check() {
  const client = new Client({
    connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5'
  });
  await client.connect();
  const tables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('=== ALL TABLES ===');
  console.log(tables.rows.map(r => r.table_name));

  console.log('\n=== ACCOUNTING RELATED TABLES ===');
  const accTables = tables.rows
    .map(r => r.table_name)
    .filter(t => t.includes('acc') || t.includes('bank') || t.includes('cash') || t.includes('journal') || t.includes('voucher') || t.includes('ledger') || t.includes('trans'));
  console.log(accTables);

  for (const t of accTables) {
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [t]);
    console.log(`\nTable ${t}:`);
    cols.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`));
  }

  // Also check company and branch tables
  const comp = await client.query(`SELECT * FROM company LIMIT 5;`);
  console.log('\nCompanies:', comp.rows);
  const branches = await client.query(`SELECT id, code, name FROM branch LIMIT 5;`);
  console.log('\nBranches:', branches.rows);

  await client.end();
}

check().catch(console.error);
