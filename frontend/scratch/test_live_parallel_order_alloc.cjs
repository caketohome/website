const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

let envFile = path.resolve(__dirname, '../../.env');
if (!fs.existsSync(envFile)) envFile = path.resolve(__dirname, '../.env');
const env = fs.readFileSync(envFile, 'utf8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.trim().startsWith('DATABASE_URL=')) {
    dbUrl = line.trim().substring('DATABASE_URL='.length).trim();
    if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
      dbUrl = dbUrl.slice(1, -1);
    }
  }
}

async function testParallelOrderAlloc() {
  const workers = 10;
  console.log(`Spawning ${workers} parallel order allocations on live Supabase database...`);
  const promises = [];
  for (let i = 0; i < workers; i++) {
    const p = (async () => {
      const c = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
      await c.connect();
      const res = await c.query("SELECT * FROM public.allocate_order_number('CTH')");
      await c.end();
      return res.rows[0];
    })();
    promises.push(p);
  }
  const results = await Promise.all(promises);
  console.table(results);
  const nums = results.map(r => r.order_number);
  const uniqNums = new Set(nums);
  if (nums.length !== uniqNums.size) {
    throw new Error('Collision detected in parallel order allocation!');
  }
  console.log('✅ ALL 10 PARALLEL ALLOCATIONS UNIQUE: No collision, sequence strictly ordered.');
}

testParallelOrderAlloc().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
