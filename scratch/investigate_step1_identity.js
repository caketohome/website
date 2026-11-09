/**
 * CakeToHome ERP — Ground Truth Forensic Investigation Script
 * Investigation Step 1: Database identity, Cutoff, Schema & Inclusion Rules
 */

const fs = require('fs');
const path = require('path');

function getDatabaseUrl() {
  const envContent = fs.readFileSync(path.join(__dirname, '../frontend/.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      return line.trim().substring('DATABASE_URL='.length).trim().replace(/['"]/g, '');
    }
  }
  return "[REDACTED_DATABASE_CREDENTIAL]";
}

const { Client } = require('../frontend/node_modules/pg');

async function runStep1() {
  const client = new Client({ connectionString: getDatabaseUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== STEP 1: DATABASE IDENTITY & SCHEMA SANITY ===");
  const idRes = await client.query(`
    SELECT 
      current_database() AS db_name,
      current_user AS db_user,
      split_part(version(), ' ', 1) || ' ' || split_part(version(), ' ', 2) AS pg_version_short,
      inet_server_addr()::text AS server_ip,
      inet_server_port() AS server_port,
      NOW()::text AS current_time;
  `);
  console.log(JSON.stringify(idRes.rows[0], null, 2));

  console.log("\n=== POSTED VOUCHER CUTOFF & STATUS INVENTORY ===");
  const vchStatRes = await client.query(`
    SELECT 
      status, 
      COUNT(*) AS voucher_count,
      MIN(created_at)::text AS earliest_created,
      MAX(created_at)::text AS latest_created,
      MIN(posted_at)::text AS earliest_posted,
      MAX(posted_at)::text AS latest_posted,
      ROUND(SUM(total_amount)::numeric, 2) AS total_sum
    FROM public.accounting_voucher
    GROUP BY status
    ORDER BY status;
  `);
  vchStatRes.rows.forEach(r => console.log(JSON.stringify(r)));

  console.log("\n=== ALL BRANCHES INVENTORY (OPERATIONAL VS TEST) ===");
  const bRes = await client.query(`
    SELECT 
      CASE 
        WHEN id LIKE 'br_tc_%' THEN 'TEST_TC'
        WHEN id LIKE 'br_conc_%' THEN 'TEST_CONC'
        WHEN id LIKE 'br_test_%' THEN 'TEST_OTHER'
        ELSE 'OPERATIONAL'
      END AS branch_category,
      COUNT(*) AS count
    FROM public.branch
    GROUP BY 1;
  `);
  bRes.rows.forEach(r => console.log(JSON.stringify(r)));

  console.log("\n=== SPECIFIC BRANCHES UNDER SCRUTINY ===");
  const targetBranches = await client.query(`
    SELECT id, name, code, created_at::text, metadata
    FROM public.branch
    WHERE name ILIKE '%indiranagar%'
       OR name ILIKE '%whitefield%'
       OR name ILIKE '%postgres%auth%'
       OR id = 'br_01KYWH05FY08YH6XJKATV0NXDR'
       OR id = 'br_whitefield';
  `);
  const output = {
    identity: idRes.rows[0],
    voucherStatusSummary: vchStatRes.rows,
    branchCategories: bRes.rows,
    targetBranches: targetBranches.rows
  };

  fs.writeFileSync(path.join(__dirname, 'step1_identity_results.json'), JSON.stringify(output, null, 2));
  console.log("Step 1 results saved to scratch/step1_identity_results.json");
  await client.end();
}

runStep1().catch(console.error);
