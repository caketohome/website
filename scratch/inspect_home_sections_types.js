const path = require('path');
const pgPath = path.resolve(__dirname, '../frontend/node_modules/pg');
const { Client } = require(pgPath);
const fs = require('fs');

const env = fs.readFileSync('frontend/.env', 'utf8');
const match = env.match(/DATABASE_URL=([^\r\n]+)/);
const dbUrl = match ? match[1].replace(/["']/g, '') : '';
const client = new Client({ connectionString: dbUrl });

async function run() {
  await client.connect();
  const res = await client.query("SELECT id, blocks FROM cms_page WHERE id = 'cmspg_home'");
  if (res.rows[0]) {
    const parsed = JSON.parse(res.rows[0].blocks);
    console.log('parsed keys:', Object.keys(parsed));
    const occSec = parsed.sections?.find(s => s.id === 'sec_1789569705149');
    console.log('occSec.config keys:', Object.keys(occSec?.config || {}));
    console.log('manual_occasions length:', occSec?.config?.manual_occasions?.length);
    console.log('First manual occasion:', occSec?.config?.manual_occasions?.[0]);
  }
  await client.end();
}
run().catch(console.error);
