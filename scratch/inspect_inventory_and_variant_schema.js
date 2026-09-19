const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const pCols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'product'
      ORDER BY ordinal_position;
    `);
    console.log('--- PRODUCT COLUMNS ---');
    console.table(pCols.rows);

    const pvCols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'product_variant'
      ORDER BY ordinal_position;
    `);
    console.log('--- PRODUCT_VARIANT COLUMNS ---');
    console.table(pvCols.rows);

    const biCols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'branch_inventory'
      ORDER BY ordinal_position;
    `);
    console.log('--- BRANCH_INVENTORY COLUMNS ---');
    console.table(biCols.rows);

    const biConstraints = await pool.query(`
      SELECT conname, contype, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'branch_inventory';
    `);
    console.log('--- BRANCH_INVENTORY CONSTRAINTS ---');
    console.table(biConstraints.rows);

    const biIndexes = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'branch_inventory';
    `);
    console.log('--- BRANCH_INVENTORY INDEXES ---');
    console.table(biIndexes.rows);

    const branches = await pool.query(`
      SELECT id, name, code, is_active FROM branch ORDER BY id ASC LIMIT 10;
    `);
    console.log('--- SAMPLE BRANCHES ---');
    console.table(branches.rows);

    const branchCount = await pool.query(`SELECT COUNT(*)::int as count FROM branch WHERE is_active = true OR is_active IS NULL;`);
    console.log('Total operational/active branches:', branchCount.rows[0].count);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
