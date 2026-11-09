const fs = require('fs');
const path = require('path');
const { Client } = require('../frontend/node_modules/pg');

const env = fs.readFileSync(path.join(__dirname, '../frontend/.env'), 'utf8');
const dbUrl = env.split('\n').find(l => l.startsWith('DATABASE_URL=')).replace('DATABASE_URL=', '').trim().replace(/['"]/g, '');

const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function run() {
  await client.connect();

  console.log('--- CMS PAGES IN DATABASE ---');
  const cmsRes = await client.query('SELECT id, slug, title, status FROM public.cms_page ORDER BY slug');
  console.table(cmsRes.rows);

  console.log('\n--- BLOG POSTS IN DATABASE / CODE ---');
  try {
    const blogRes = await client.query('SELECT * FROM public.blog_post LIMIT 10');
    console.table(blogRes.rows);
  } catch (e) {
    console.log('No public.blog_post table:', e.message);
  }

  await client.end();
}

run().catch(console.error);
