const { Pool } = require('pg');
const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});
async function main() {
  const fkRes = await pool.query(`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'corporate_account' AND tc.constraint_type = 'FOREIGN KEY';
  `);
  console.log('FKs:', fkRes.rows);

  const uRes = await pool.query(`SELECT * FROM public."user" LIMIT 5;`);
  console.log('Users in public."user":', uRes.rows);
  await pool.end();
}
main().catch(console.error);
