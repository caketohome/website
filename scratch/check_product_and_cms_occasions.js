const fs = require('fs');
const path = require('path');
const pgPath = path.resolve(__dirname, '../frontend/node_modules/pg');
const { Client } = require(pgPath);

let dbUrl = '';
if (fs.existsSync('frontend/.env.local')) {
  const env = fs.readFileSync('frontend/.env.local', 'utf8');
  const match = env.match(/DATABASE_URL=([^\r\n]+)/);
  if (match) dbUrl = match[1].replace(/["']/g, '');
}
if (!dbUrl && fs.existsSync('frontend/.env')) {
  const env = fs.readFileSync('frontend/.env', 'utf8');
  const match = env.match(/DATABASE_URL=([^\r\n]+)/);
  if (match) dbUrl = match[1].replace(/["']/g, '');
}

const client = new Client({ connectionString: dbUrl });

async function check() {
  await client.connect();
  console.log('Connected to DB successfully');

  const prods = await client.query('SELECT id, title, metadata FROM product LIMIT 20');
  console.log('--- Sample Products ---');
  for (const p of prods.rows) {
    console.log(`${p.id} | ${p.title} | occ: ${p.metadata?.occasion} | occ_ids: ${JSON.stringify(p.metadata?.occasion_ids)}`);
  }

  const allOccs = await client.query("SELECT DISTINCT metadata->>'occasion' as occ, metadata->>'occasion_ids' as occ_ids FROM product");
  console.log('--- All Distinct Occasions in DB ---');
  console.log(allOccs.rows);

  const cols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'cms_page'");
  console.log('--- cms_page columns ---');
  console.log(cols.rows);

  const home = await client.query("SELECT * FROM cms_page WHERE id = 'cmspg_home' OR slug = 'home'");
  if (home.rows[0]) {
    const rawBlocks = home.rows[0].blocks;
    const parsed = typeof rawBlocks === 'string' ? JSON.parse(rawBlocks) : rawBlocks;
    const sections = parsed.sections || parsed.blocks || [];
    console.log('Sections count:', sections.length);
    for (const s of sections) {
      if (s.type?.includes('occasion') || s.type?.includes('categor') || s.id?.includes('1789569705149')) {
        console.log('Found section:', s.id, s.type);
        console.log('Section content:', JSON.stringify(s, null, 2));
      }
    }
  }

  await client.end();
}

check().catch(console.error);
