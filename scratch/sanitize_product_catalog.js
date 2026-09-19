const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log('[Sanitize] Starting safe product catalog sanitization in PostgreSQL...');

    // 1. Clean forensic audit suffix from product titles
    const cleanTitleRes = await pool.query(`
      UPDATE product
      SET title = 'Red Velvet Dream Cake', updated_at = NOW()
      WHERE id = 'prod_01KXYMAJKNXGS5WT4R0QNQGV5F' AND title LIKE '%FORENSIC_DB_AUDIT%';
    `);
    console.log(`[Sanitize] Cleaned test titles: ${cleanTitleRes.rowCount} row(s) updated.`);

    // 2. Replace broken localhost URLs with valid local image assets
    const mapping = [
      { id: 'prod_01KXYMAJKNXGS5WT4R0QNQGV5F', thumb: '/images/red-velvet-heart.jpg' },
      { id: 'prod_01KXYMAJKNWZCFXJHESPTZE01G', thumb: '/images/belgian-truffle.jpg' },
      { id: 'prod_01KXYMAJKNDZ4T2YVA7K144XP5', thumb: '/images/chocolate-cake.jpg' },
      { id: 'prod_01KXYMAJKNV48P1B9CM7C022YM', thumb: '/images/default-cake.jpg' },
      { id: 'prod_01KXYMAJKNS8AGWCN5S1WEGKSD', thumb: '/images/strawberry-cake.jpg' },
      { id: 'prod_01KXYMAJKNH99E1TMWYGQGT61D', thumb: '/images/placeholder-cake.jpg' },
      { id: 'prod_1', thumb: '/images/belgian-truffle.jpg' },
      { id: 'prod_2', thumb: '/images/red-velvet-heart.jpg' },
      { id: 'prod_3', thumb: '/images/default-cake.jpg' },
      { id: 'prod_4', thumb: '/images/chocolate-cake.jpg' },
      { id: 'prod_5', thumb: '/images/strawberry-cake.jpg' },
    ];

    for (const item of mapping) {
      const res = await pool.query(
        `UPDATE product SET thumbnail = $1, updated_at = NOW() WHERE id = $2`,
        [item.thumb, item.id]
      );
      if (res.rowCount > 0) {
        console.log(`[Sanitize] Updated thumbnail for ${item.id} -> ${item.thumb}`);
      }
    }

    // 3. For any remaining product with NULL thumbnail or broken localhost, set default-cake.jpg
    const fallbackRes = await pool.query(`
      UPDATE product
      SET thumbnail = '/images/chocolate-cake.jpg', updated_at = NOW()
      WHERE thumbnail IS NULL OR thumbnail LIKE 'http://localhost:3000/_%';
    `);
    console.log(`[Sanitize] Updated fallbacks for ${fallbackRes.rowCount} remaining product(s).`);

    console.log('[Sanitize] Finished catalog sanitization successfully.');
  } catch (err) {
    console.error('[Sanitize] Error:', err);
  } finally {
    await pool.end();
  }
}

run();
