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
    const tables = ['user', 'admin_user', 'staff', 'company', 'customer', 'cost_centre', 'order', 'delivery', 'invoice', 'product', 'product_variant'];
    for (const t of tables) {
      const exists = (await client.query(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1)`, [t])).rows[0].exists;
      if (exists) {
        const pkRes = await client.query(`
          SELECT c.column_name, c.data_type, c.udt_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
          JOIN information_schema.columns c ON c.table_name = tc.table_name AND c.column_name = ccu.column_name
          WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = $1
        `, [t]);
        console.log(`Table [${t}]: PK = ${pkRes.rows.map(r => `${r.column_name} (${r.data_type})`).join(', ')}`);
      } else {
        console.log(`Table [${t}]: DOES NOT EXIST`);
      }
    }

    // Check if corporate_gifting_batch or corporate_gifting_recipient already exists
    const cgb = (await client.query(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='corporate_gifting_batch')`)).rows[0].exists;
    const cgr = (await client.query(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='corporate_gifting_recipient')`)).rows[0].exists;
    console.log(`\nTable corporate_gifting_batch exists: ${cgb}`);
    console.log(`Table corporate_gifting_recipient exists: ${cgr}`);

    // Check foreign keys
    const fks = await client.query(`
      SELECT
        tc.table_name, kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.table_name IN ('cost_centre', 'cost_allocation_rule', 'cost_allocation_run', 'invoice', 'delivery');
    `);
    console.log('Foreign keys on sample tables:');
    fks.rows.forEach(r => console.log(`  ${r.table_name}.${r.column_name} -> ${r.foreign_table_name}.${r.foreign_column_name} (${r.delete_rule})`));

    const rlsRes = await client.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity 
      FROM pg_class 
      JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace 
      WHERE pg_namespace.nspname = 'public' 
        AND relname IN ('customer', 'cost_centre', 'cost_allocation_rule', 'cost_allocation_run', 'invoice', 'accounting_account');
    `);
    console.log('RLS status on key tables:');
    rlsRes.rows.forEach(r => console.log(`  ${r.relname}: rls=${r.relrowsecurity}, force=${r.relforcerowsecurity}`));

  } finally {
    client.release();
    await pool.end();
  }
}
inspect().catch(console.error);
