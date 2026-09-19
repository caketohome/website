const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const nullMetaIds = [
    'prod_01KYYZ8PJA5MVZNN7FK4JD532X',
    'prod_01KYYZ6SZE0HCH853P0TGEWNE7',
    'prod_01KYYZ5A1BKX4G4BZ3BDRWFXK0',
    'prod_01KYYXK0VG2SFPGJNJVGEVPP60',
    'prod_01KYYNW615XB496FV282VHAFD9',
    'prod_01KYYNSMJD6F0YZ994556TJNT0',
    'prod_01KYXMS0HWS2YJYQWS3EJT5BE9',
    'prod_01KYXKK6TVNRRXR1VV5A6Q9X49',
    'prod_01KYXK0EH754JM6AFE207JMCRN',
    'prod_01KYXJP1XAMJBS4FQKNH2W2W31',
    'prod_01KYXJJG1V5DVZAEYB33DJYFJM',
    'prod_01KYXJGQ8SWAB8QC869J0D3NYP'
  ];

  const invMatch = await pool.query(`
    SELECT * FROM branch_inventory WHERE product_id = ANY($1);
  `, [nullMetaIds]);

  console.log(`Rows in branch_inventory belonging to null-meta test products: ${invMatch.rows.length}`);
  
  await pool.end();
}

main().catch(console.error);
