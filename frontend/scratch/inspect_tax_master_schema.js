const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts[0] && parts[1]) {
      process.env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function inspect() {
  const client = await pool.connect();
  try {
    console.log('=== 1. Environment & DB Identity ===');
    const dbInfo = await client.query(`
      SELECT current_database(), current_user, inet_server_addr(), inet_server_port(), version();
    `);
    console.table(dbInfo.rows);
    console.log('DATABASE_URL Host:', new URL(process.env.DATABASE_URL).host);

    console.log('\n=== 2. Columns of tax_rate ===');
    const trCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'tax_rate'
      ORDER BY ordinal_position;
    `);
    console.table(trCols.rows);

    console.log('\n=== 3. Indexes on tax_rate ===');
    const trIdx = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND tablename = 'tax_rate';
    `);
    console.table(trIdx.rows);

    console.log('\n=== 4. Foreign Keys referencing tax_rate ===');
    const fks = await client.query(`
      SELECT
        tc.table_name AS referencing_table,
        kcu.column_name AS referencing_column,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON rc.unique_constraint_name = ccu.constraint_name
      WHERE ccu.table_name = 'tax_rate';
    `);
    console.table(fks.rows);

    console.log('\n=== 5. Exact Row in tax_rate ===');
    const trRows = await client.query(`SELECT * FROM public.tax_rate;`);
    console.log(JSON.stringify(trRows.rows, null, 2));

    console.log('\n=== 6. Region txreg_01KY2B1R2YVX5040412JCZM1H6 ===');
    const regRes = await client.query(`SELECT * FROM public.tax_region WHERE id = 'txreg_01KY2B1R2YVX5040412JCZM1H6';`);
    console.log(JSON.stringify(regRes.rows, null, 2));

    console.log('\n=== 7. Check references to txr_01KY2B1R7WKC3Z3MMQ85EEH8X6 in other tables ===');
    for (const fk of fks.rows) {
      const refCount = await client.query(`
        SELECT count(*) FROM public."${fk.referencing_table}" WHERE "${fk.referencing_column}" = 'txr_01KY2B1R7WKC3Z3MMQ85EEH8X6';
      `);
      console.log(`Table ${fk.referencing_table}.${fk.referencing_column} references: ${refCount.rows[0].count}`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}
inspect().catch(console.error);
