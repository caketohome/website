const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,
  statement_timeout: 5000
});
(async () => {
  try {
    const res = await pool.query(`
      SELECT pid, state, query, age(clock_timestamp(), query_start) as duration
      FROM pg_stat_activity
      WHERE state != 'idle' AND query NOT ILIKE '%pg_stat_activity%';
    `);
    console.log('Active queries count:', res.rows.length);
    console.log('Active queries:', res.rows);
    await pool.end();
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
