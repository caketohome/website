const fs = require('fs');
const path = require('path');
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
  throw new Error("DATABASE_URL not found in .env");
}

const pool = new Pool({ connectionString: getConnectionString() });

async function dump() {
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM public.accounting_journal_line WHERE id LIKE 'jl_c71_%'");
    await client.query("DELETE FROM public.accounting_journal_entry WHERE id LIKE 'je_c71_%'");
    await client.query("DELETE FROM public.accounting_voucher WHERE id LIKE 'vch_c71_%'");
    await client.query("DELETE FROM public.cost_centre WHERE id LIKE 'cc_test_%'");
    console.log('Cleaned up lingering test records.');
    return;
    for (const t of tables) {
      const cols = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [t]);
      const fks = await client.query(`
        SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name, rc.delete_rule
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
        JOIN information_schema.referential_constraints AS rc ON rc.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1;
      `, [t]);
      const rls = await client.query(`
        SELECT relrowsecurity, relforcerowsecurity
        FROM pg_class
        WHERE relname = $1 AND relnamespace = 'public'::regnamespace;
      `, [t]);
      const cnt = await client.query(`SELECT count(*)::int as c FROM public."${t}"`);

      console.log(`==================== TABLE: ${t} (Rows: ${cnt.rows[0].c}, RLS: ${rls.rows[0]?.relrowsecurity}) ====================`);
      console.log('Columns:');
      cols.rows.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable}, default: ${c.column_default})`));
      console.log('Foreign Keys:');
      fks.rows.forEach(f => console.log(`  - ${f.constraint_name}: ${f.column_name} -> ${f.foreign_table_name}(${f.foreign_column_name}) [ON DELETE ${f.delete_rule}]`));
    }
  } finally {
    client.release();
    await pool.end();
  }
}
dump().catch(console.error);
