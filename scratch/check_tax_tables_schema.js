const { Client } = require("../frontend/node_modules/pg");
const path = require("path");
const fs = require("fs");

const envPath = path.join(__dirname, "../frontend/.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

async function check() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const tables = ['tax_rate', 'tax_region', 'tax_rate_rule', 'product', 'product_variant'];
  for (const t of tables) {
    const res = await c.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1 
      ORDER BY ordinal_position
    `, [t]);
    console.log('\n=== TABLE:', t, '===');
    console.log(res.rows.map(r => `${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`).join('\n'));
  }

  // Also check foreign keys and constraints on tax_rate_rule
  const fkRes = await c.query(`
    SELECT
      tc.table_name, kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name IN ('tax_rate_rule', 'product', 'tax_rate');
  `);
  console.log('\n=== FOREIGN KEYS ===');
  console.table(fkRes.rows);

  // Check tax_rate rows
  const trRows = await c.query(`SELECT * FROM public.tax_rate`);
  console.log('\n=== TAX RATE ROWS ===');
  console.table(trRows.rows);

  // Check tax_region rows
  const regRows = await c.query(`SELECT * FROM public.tax_region`);
  console.log('\n=== TAX REGION ROWS ===');
  console.table(regRows.rows);

  // Check tax_rate_rule rows
  const trrRows = await c.query(`SELECT * FROM public.tax_rate_rule`);
  console.log('\n=== TAX RATE RULE ROWS ===');
  console.table(trrRows.rows);

  await c.end();
}
check().catch(console.error);
