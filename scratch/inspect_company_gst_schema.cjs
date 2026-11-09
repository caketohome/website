const fs = require('fs');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

function getConn() {
  const env = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      return val;
    }
  }
}

async function main() {
  const client = new Client({
    connectionString: getConn(),
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    const compCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'company' 
      ORDER BY ordinal_position
    `);
    console.log("=== public.company COLUMNS ===");
    console.table(compCols.rows);

    const compConstraints = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid = 'public.company'::regclass
    `);
    console.log("=== public.company CONSTRAINTS ===");
    console.table(compConstraints.rows);

    const gstCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'gst_registration' 
      ORDER BY ordinal_position
    `);
    console.log("=== public.gst_registration COLUMNS ===");
    console.table(gstCols.rows);

    const gstConstraints = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid = 'public.gst_registration'::regclass
    `);
    console.log("=== public.gst_registration CONSTRAINTS ===");
    console.table(gstConstraints.rows);

  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
