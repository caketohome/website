const path = require('path');
const fs = require('fs');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const mappingPath = path.join(__dirname, 'accessory_product_migration_mapping.json');
  const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('--- STARTING BRANCH INVENTORY SEEDING ---');

    // 1. Get all active branches
    const branchRes = await client.query(`
      SELECT id, name, code 
      FROM branch 
      WHERE deleted_at IS NULL 
      ORDER BY id ASC;
    `);
    const branches = branchRes.rows;
    console.log(`Found ${branches.length} active branches in PostgreSQL.`);

    // Static migration stock reference
    const initialStockMap = {
      'acc_01': 45,
      'acc_02': 80,
      'acc_03': 120,
      'acc_04': 25,
      'acc_05': 18,
      'acc_06': 30,
      'acc_07': 50,
      'acc_08': 12
    };

    let insertedCount = 0;
    for (const b of branches) {
      for (const m of mapping) {
        const invId = `binv_${b.id}_${m.proposed_variant_id}`;
        const initialQty = initialStockMap[m.proposed_product_id] || 20;

        await client.query(`
          INSERT INTO branch_inventory (
            id, branch_id, product_id, variant_id, quantity, reserved, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, 0, NOW(), NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            quantity = EXCLUDED.quantity,
            updated_at = NOW()
        `, [
          invId,
          b.id,
          m.proposed_product_id,
          m.proposed_variant_id,
          initialQty
        ]);
        insertedCount++;
      }
    }

    await client.query('COMMIT');
    console.log(`--- SUCCESSFULLY COMMITTED ${insertedCount} BRANCH INVENTORY ROWS ---`);

    // Verify row count
    const totalCountRes = await client.query(`
      SELECT count(*)::int as total, 
             count(DISTINCT branch_id)::int as branch_count,
             count(DISTINCT product_id)::int as product_count
      FROM branch_inventory
      WHERE deleted_at IS NULL;
    `);
    console.log('Verification in PostgreSQL branch_inventory:');
    console.table(totalCountRes.rows);

    // Sample branch inventory
    const sample = await client.query(`
      SELECT bi.branch_id, b.name as branch_name, bi.product_id, p.title as product_title, bi.quantity, bi.reserved
      FROM branch_inventory bi
      JOIN branch b ON b.id = bi.branch_id
      JOIN product p ON p.id = bi.product_id
      WHERE bi.branch_id = $1
      ORDER BY bi.product_id ASC;
    `, [branches[0].id]);
    console.log(`Sample branch inventory for ${branches[0].name} (${branches[0].id}):`);
    console.table(sample.rows);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during branch inventory seeding:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
