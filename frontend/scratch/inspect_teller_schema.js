const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function inspect() {
  try {
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'teller' 
      ORDER BY ordinal_position
    `);
    console.log('--- TELLER COLUMNS ---');
    cols.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable}, default: ${r.column_default})`));
    const constraints = await pool.query(`
      SELECT conname, contype, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid = 'public.teller'::regclass
    `);
    console.log('--- TELLER CONSTRAINTS ---');
    constraints.rows.forEach(r => console.log(`${r.conname} (${r.contype}): ${r.def}`));

    const indexes = await pool.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'teller'
    `);
    console.log('--- TELLER INDEXES ---');
    indexes.rows.forEach(r => console.log(`${r.indexname}: ${r.indexdef}`));

    const userCount = await pool.query(`SELECT count(*) FROM public."user"`);
    console.log('Total users in public.user:', userCount.rows[0].count);

    const allUsers = await pool.query(`SELECT id, email FROM public."user" LIMIT 30`);
    console.log('Sample users:');
    console.table(allUsers.rows);

    const uConstraints = await pool.query(`
      SELECT conname, contype, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid = 'public.user'::regclass
    `);
    console.log('--- USER CONSTRAINTS ---');
    console.table(uConstraints.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspect();
