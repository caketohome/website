import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';
import fs from 'fs';
import pg from 'pg';

async function main() {
  const dbDir = path.resolve(__dirname, '../../.isolated-pg-data');
  console.log('Target isolated PG dir:', dbDir);

  const pidFile = path.join(dbDir, 'postmaster.pid');
  if (fs.existsSync(pidFile)) {
    console.log('Checking existing postmaster.pid...');
    const pidContent = fs.readFileSync(pidFile, 'utf8');
    const pid = parseInt(pidContent.split('\n')[0].trim(), 10);
    let isRunning = false;
    try {
      process.kill(pid, 0);
      isRunning = true;
    } catch {
      isRunning = false;
    }

    if (!isRunning) {
      console.log(`Stale postmaster.pid found (PID ${pid} is not running). Removing stale lock...`);
      fs.unlinkSync(pidFile);
    } else {
      console.log(`PostgreSQL is already running with PID ${pid}.`);
    }
  }

  const pgInstance = new EmbeddedPostgres({
    databaseDir: dbDir,
    port: 5433,
    user: 'cth_test_user',
    password: 'cth_test_password_2026',
    authMethod: 'password',
    persistent: true,
    onLog: (msg) => {
      if (msg.includes('error') || msg.includes('FATAL') || msg.includes('ready to accept')) {
        console.log('[PG-LOG]', msg.trim());
      }
    }
  });

  console.log('Starting EmbeddedPostgres on port 5433...');
  try {
    await pgInstance.start();
    console.log('✅ EmbeddedPostgres started on port 5433.');
  } catch (err: any) {
    console.log('Start notice:', err.message);
  }

  const client = new pg.Client({
    host: '127.0.0.1',
    port: 5433,
    user: 'cth_test_user',
    password: 'cth_test_password_2026',
    database: 'cth_test',
  });

  await client.connect();
  console.log('✅ Connected to cth_test successfully!');

  // Check tables
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  console.log(`Found ${tablesRes.rows.length} public tables in cth_test:`);
  console.log(tablesRes.rows.map(r => r.table_name).join(', '));

  // Check product table
  const hasProduct = tablesRes.rows.some(r => r.table_name === 'product');
  if (hasProduct) {
    const pCount = await client.query('SELECT count(*) as count FROM "product"');
    console.log(`Product count in "product" table: ${pCount.rows[0].count}`);
    const activeCount = await client.query('SELECT count(*) as count FROM "product" WHERE deleted_at IS NULL');
    console.log(`Active product count: ${activeCount.rows[0].count}`);
    const sample = await client.query('SELECT id, title, handle, metadata FROM "product" WHERE deleted_at IS NULL LIMIT 5');
    console.log('Sample products:');
    sample.rows.forEach(p => {
      console.log(`- [${p.id}] ${p.title} (${p.handle}) - price: ${p.metadata?.price || p.metadata?.selling_price}`);
    });
  } else {
    console.log('Table "product" does not exist in cth_test.');
  }

  await client.end();
  console.log('Probe complete.');
}

main().catch(err => {
  console.error('Fatal probe error:', err);
  process.exit(1);
});
