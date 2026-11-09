const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const branches = await pool.query(`
    SELECT id, name, metadata->'manager_account' as mgr
    FROM branch
    WHERE metadata->'manager_account' IS NOT NULL
    LIMIT 5
  `);
  console.log('Branches with manager_account in PG:', branches.rows);

  // How does Admin update availability for any branch?
  // Let's test calling PATCH with role SUPER_ADMIN
  const adminRes = await fetch('http://localhost:3000/api/v1/branches/br_koramangala/products/prod_01KXYMAJKNDZ4T2YVA7K144XP5/availability', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'SUPER_ADMIN',
      'Cookie': '_cth_role=SUPER_ADMIN; _cth_user_id=admin_01'
    },
    body: JSON.stringify({ status: 'OUT_OF_STOCK' })
  });
  console.log('Admin PATCH to Branch B status:', adminRes.status);
  const data = await adminRes.json().catch(() => ({}));
  console.log('Admin PATCH response:', data);

  const pgB = await pool.query('SELECT metadata FROM branch WHERE id = $1', ['br_koramangala']);
  console.log('Branch B metadata in PG after admin PATCH:', pgB.rows[0]?.metadata?.product_availability);

  await pool.end();
}

run().catch(console.error);
