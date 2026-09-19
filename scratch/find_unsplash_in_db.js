const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const searchTerm = '%1535141192574%';
  
  // 1. Check product table
  const prodRes = await pool.query(`SELECT id, title, thumbnail, metadata FROM product WHERE thumbnail ILIKE $1 OR metadata::text ILIKE $1`, [searchTerm]);
  console.log('Products matching:', prodRes.rows.length);
  prodRes.rows.forEach(r => {
    console.log('  Product:', r.id, r.title);
    const mStr = JSON.stringify(r.metadata);
    const idx = mStr.indexOf('1535141192574');
    if (idx !== -1) {
      console.log('    Snippet:', mStr.substring(Math.max(0, idx - 40), idx + 60));
    }
  });

  // 2. Check media table
  const mediaRes = await pool.query(`SELECT id, url, title FROM media WHERE url ILIKE $1`, [searchTerm]);
  console.log('Media records matching:', mediaRes.rows.length);
  mediaRes.rows.forEach(r => console.log('  Media:', r.id, r.url));

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
