const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  throw new Error("DATABASE_URL not found");
}

const pool = new Pool({ connectionString: getConnectionString() });

async function inspect() {
  const client = await pool.connect();
  try {
    // Check how prices are mapped to product_variant
    const res = await client.query(`
      SELECT 
        pv.id AS variant_id,
        pv.sku,
        pv.title AS variant_title,
        p.id AS product_id,
        p.title AS product_title,
        p.metadata AS product_meta,
        pv.metadata AS variant_meta
      FROM public.product_variant pv
      JOIN public.product p ON p.id = pv.product_id
      LIMIT 5;
    `);
    console.log('Sample variants and metadata:');
    res.rows.forEach(r => console.log(JSON.stringify(r, null, 2)));

    // Check price table
    const branches = await client.query(`
      SELECT id, name, code, metadata
      FROM public.branch LIMIT 5;
    `);
    console.log('\nBranches:', branches.rows);

  } finally {
    client.release();
    await pool.end();
  }
}
inspect().catch(console.error);
