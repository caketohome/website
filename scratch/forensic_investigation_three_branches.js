/**
 * Deep Forensic Investigation of the Three Exception Branches:
 * 1. br_indiranagar (Indiranagar Flagship Bakery)
 * 2. br_whitefield (Whitefield Tech Hub)
 * 3. br_01KYWH05FY08YH6XJKATV0NXDR (PostgreSQL Authenticated Branch)
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('../frontend/node_modules/pg');

function getDatabaseUrl() {
  const envContent = fs.readFileSync(path.join(__dirname, '../frontend/.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      return line.trim().substring('DATABASE_URL='.length).trim().replace(/['"]/g, '');
    }
  }
}

const dbUrl = getDatabaseUrl();

async function investigate() {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const targetBranchIds = [
    'br_indiranagar',
    'br_whitefield',
    'br_01KYWH05FY08YH6XJKATV0NXDR'
  ];

  const results = {};

  for (const branchId of targetBranchIds) {
    console.log(`\n================================================================================`);
    console.log(`FORENSIC AUDIT FOR BRANCH: ${branchId}`);
    console.log(`================================================================================`);

    // 1. Branch Metadata & Counters
    const bMeta = await client.query(`SELECT id, name, code, metadata, created_at FROM public.branch WHERE id = $1`, [branchId]);
    console.log(`Branch Name: ${bMeta.rows[0]?.name} (${bMeta.rows[0]?.code})`);

    // 2. Journal Lines for Account 1111, 1114, 1122
    const jlRes = await client.query(`
      SELECT 
        jl.id AS line_id,
        jl.journal_entry_id,
        je.entry_no,
        je.entry_date,
        v.id AS voucher_id,
        v.voucher_no,
        v.voucher_type,
        v.status AS voucher_status,
        v.narration AS voucher_narration,
        a.code AS account_code,
        a.name AS account_name,
        jl.debit_amount,
        jl.credit_amount,
        jl.narration AS line_narration,
        jl.metadata AS line_metadata,
        je.created_at
      FROM public.accounting_journal_line jl
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      JOIN public.accounting_account a ON a.id = jl.account_id
      LEFT JOIN public.accounting_voucher v ON v.id = je.voucher_id
      WHERE jl.branch_id = $1
        AND a.code IN ('1111', '1114', '1122')
      ORDER BY je.created_at ASC;
    `, [branchId]);

    console.log(`\n--- 1. Posted Journal Lines (1111, 1114, 1122) [Count: ${jlRes.rows.length}] ---`);
    console.table(jlRes.rows.map(r => ({
      entry_no: r.entry_no,
      voucher_no: r.voucher_no,
      type: r.voucher_type,
      status: r.voucher_status,
      acc: r.account_code,
      debit: Number(r.debit_amount),
      credit: Number(r.credit_amount),
      narration: (r.line_narration || r.voucher_narration || '').slice(0, 40),
      created_at: r.created_at
    })));

    // 3. Teller Sessions
    const sessRes = await client.query(`
      SELECT 
        s.*,
        t.name AS teller_name
      FROM public.teller_session s
      LEFT JOIN public.teller t ON t.id = s.teller_id
      WHERE s.branch_id = $1
      ORDER BY s.created_at ASC;
    `, [branchId]);

    console.log(`\n--- 2. Teller Sessions [Count: ${sessRes.rows.length}] ---`);
    console.table(sessRes.rows);

    // 4. Teller Movements
    const movRes = await client.query(`
      SELECT 
        m.id,
        m.teller_session_id,
        m.direction,
        m.movement_type,
        m.amount,
        m.source_type,
        m.source_id,
        m.narration,
        m.created_at,
        m.created_by
      FROM public.teller_movement m
      WHERE m.branch_id = $1
      ORDER BY m.created_at ASC;
    `, [branchId]);

    console.log(`\n--- 3. Teller Movements [Count: ${movRes.rows.length}] ---`);
    console.table(movRes.rows.map(r => ({
      id: r.id,
      session_id: r.teller_session_id,
      dir: r.direction,
      type: r.movement_type,
      amount: Number(r.amount),
      src_type: r.source_type,
      src_id: r.source_id,
      created_at: r.created_at
    })));

    // 5. Vault Movements
    const vmRes = await client.query(`
      SELECT *
      FROM public.branch_vault_movement
      WHERE branch_id = $1
      ORDER BY created_at ASC;
    `, [branchId]);
    console.log(`\n--- 4. Vault Movements [Count: ${vmRes.rows.length}] ---`);
    console.table(vmRes.rows);

    // 6. Delivery Cash Handovers
    const hoRes = await client.query(`
      SELECT 
        id,
        handover_number,
        status,
        expected_amount,
        declared_amount,
        acknowledged_amount,
        shortage_amount,
        surplus_amount,
        teller_session_id,
        teller_movement_id,
        settlement_voucher_id,
        created_at,
        acknowledged_at
      FROM public.delivery_cash_handover
      WHERE branch_id = $1
      ORDER BY created_at ASC;
    `, [branchId]);
    console.log(`\n--- 5. Delivery Cash Handovers [Count: ${hoRes.rows.length}] ---`);
    console.table(hoRes.rows);

    results[branchId] = {
      branch: bMeta.rows[0],
      journalLines: jlRes.rows,
      sessions: sessRes.rows,
      movements: movRes.rows,
      vaultMovements: vmRes.rows,
      handovers: hoRes.rows
    };
  }

  fs.writeFileSync(path.join(__dirname, 'forensic_investigation_three_branches.json'), JSON.stringify(results, null, 2));
  console.log("\nComplete forensic raw data saved to scratch/forensic_investigation_three_branches.json");

  await client.end();
}

investigate().catch(console.error);
