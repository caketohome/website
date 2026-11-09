const fs = require('fs');
const path = require('path');

let Client;
try {
  Client = require(path.resolve('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg')).Client;
} catch (e) {
  try {
    Client = require(path.resolve('E:/vig/cakes2home-main/cakes2home-main/node_modules/pg')).Client;
  } catch (e2) {
    console.log('pg require failed:', e2.message);
  }
}

async function inspect() {
  console.log('=== 1. FRONTEND APP ROUTES ===');
  const appDir = path.resolve('E:/vig/cakes2home-main/cakes2home-main/frontend/src/app');
  if (fs.existsSync(appDir)) {
    console.log('Directories in frontend/src/app:');
    fs.readdirSync(appDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .forEach(d => console.log(' - ' + d.name));
  } else {
    console.log('frontend/src/app not found at', appDir);
  }

  console.log('\n=== 2. NESTJS BACKEND MODULES ===');
  const apiDir = path.resolve('E:/vig/cakes2home-main/cakes2home-main/apps/api/src');
  if (fs.existsSync(apiDir)) {
    console.log('Entries in apps/api/src:');
    function listDir(dir, prefix = '') {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        if (item.name === 'node_modules' || item.name === 'dist') continue;
        console.log(prefix + (item.isDirectory() ? '[DIR] ' : '[FILE] ') + item.name);
        if (item.isDirectory() && prefix.length < 6) {
          listDir(path.join(dir, item.name), prefix + '  ');
        }
      }
    }
    listDir(apiDir);
  }

  console.log('\n=== 3. DATABASE TABLES IN cth_rehearsal_phase5 ===');
  const client = new Client({
    connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5'
  });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('Tables in cth_rehearsal_phase5:');
    res.rows.forEach(r => console.log(' - ' + r.table_name));

    // Inspect accounting_account columns and sample rows
    const accCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'accounting_account'
      ORDER BY ordinal_position;
    `);
    console.log('\naccounting_account columns:');
    accCols.rows.forEach(c => console.log(`   ${c.column_name} (${c.data_type})`));

    const sampleAcc = await client.query(`
      SELECT * FROM accounting_account LIMIT 10;
    `);
    console.log('\nSample accounting_account records:', sampleAcc.rows);

    await client.end();
  } catch (err) {
    console.error('Database inspection error:', err.message);
  }
}

inspect();
