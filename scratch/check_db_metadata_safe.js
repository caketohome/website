const fs = require('fs');
const path = require('path');
const { Client } = require('../frontend/node_modules/pg');

function getDatabaseConfig() {
  const envContent = fs.readFileSync(path.join(__dirname, '../frontend/.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      const raw = line.trim().substring('DATABASE_URL='.length).trim().replace(/['"]/g, '');
      const parsed = new URL(raw);
      return {
        raw,
        host: parsed.hostname,
        port: parsed.port,
        database: parsed.pathname.replace(/^\//, ''),
        user: parsed.username,
        redactedUrl: `${parsed.protocol}//${parsed.username}:***@${parsed.hostname}:${parsed.port}${parsed.pathname}`
      };
    }
  }
  throw new Error("DATABASE_URL not found");
}

async function inspectDbMetadata() {
  const conf = getDatabaseConfig();
  console.log("Database Connection Target (Sanitized):");
  console.log(`  Host:      ${conf.host}`);
  console.log(`  Port:      ${conf.port}`);
  console.log(`  Database:  ${conf.database}`);
  console.log(`  User:      ${conf.user}`);
  console.log(`  Target:    ${conf.redactedUrl}`);

  const client = new Client({ connectionString: conf.raw, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const verRes = await client.query('SELECT version(), current_database(), current_user, inet_server_addr(), inet_server_port()');
  console.log("\nPostgreSQL Server Identity:");
  console.log(`  Version:          ${verRes.rows[0].version}`);
  console.log(`  Current Database: ${verRes.rows[0].current_database}`);
  console.log(`  Current User:     ${verRes.rows[0].current_user}`);

  const entityCounts = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM public.branch) AS branch_count,
      (SELECT COUNT(*) FROM public.product) AS product_count,
      (SELECT COUNT(*) FROM public.customer) AS customer_count,
      (SELECT COUNT(*) FROM public."order") AS order_count,
      (SELECT COUNT(*) FROM public.accounting_account) AS account_count,
      (SELECT COUNT(*) FROM public.accounting_voucher) AS voucher_count,
      (SELECT COUNT(*) FROM public.accounting_journal_entry) AS journal_entry_count,
      (SELECT COUNT(*) FROM public.accounting_journal_line) AS journal_line_count,
      (SELECT COUNT(*) FROM public.invoice) AS invoice_count,
      (SELECT COUNT(*) FROM public.tax_rate) AS tax_rate_count
  `);
  console.log("\nAuthoritative Entity Counts in PostgreSQL:");
  console.table(entityCounts.rows);

  await client.end();
}

inspectDbMetadata().catch(err => {
  console.error("Failed to query DB metadata:", err);
  process.exit(1);
});
