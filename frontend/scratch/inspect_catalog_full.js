const fs = require('fs');
const path = require('path');
const { Client } = require(path.join(__dirname, '../node_modules/pg'));

function getConnectionString() {
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
}

async function inspect() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  console.log("=== AUDIT_LOG COLUMNS ===");
  const auditCols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'audit_log'
    ORDER BY ordinal_position;
  `);
  console.table(auditCols.rows);

  const sample = await client.query(`SELECT * FROM public.audit_log ORDER BY created_at DESC LIMIT 3;`);
  console.log("audit_log sample:", sample.rows);

  await client.end();
}

inspect().catch(console.error);
