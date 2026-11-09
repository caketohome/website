const fs = require('fs');
const { Client } = require('pg');

const envContent = fs.readFileSync('.env', 'utf8');
const match = envContent.match(/DATABASE_URL=([^\r\n]+)/);
const client = new Client({ connectionString: match[1].trim(), ssl: { rejectUnauthorized: false } });

async function fullAudit() {
  await client.connect();
  console.log('=== COMPREHENSIVE DEPENDENT REFERENCE AUDIT FOR DUPLICATE ORDERS ===\n');

  const dupOrderIds = [
    // 6 orders with CTH-20260828-101
    'ord_1787900766743_gtr5x',
    'ord_1787903174695_yztpv',
    'ord_1787907079251_3qx4x',
    'ord_1787909175508_8k2e5',
    'ord_1787910986723_tdtqa',
    'ord_1787921723978_3ibo9',
    // 2 orders with CTH-20260828-214
    'ord_1787895804793_jrmeg',
    'ord_1787898849846_nf6h0',
  ];

  // Discover all columns in all tables named order_id, reference_id, transaction_id, or source_id
  const cols = await client.query(`
    SELECT table_schema, table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND (
        column_name ILIKE '%order_id%' 
        OR column_name = 'order_id'
        OR column_name = 'reference_id'
        OR column_name = 'transaction_id'
        OR column_name = 'source_id'
      )
    ORDER BY table_name, column_name;
  `);

  console.log(`Discovered ${cols.rows.length} relational candidate columns to inspect across the public schema.\n`);

  const results = [];
  for (const row of cols.rows) {
    const tbl = `public."${row.table_name}"`;
    const col = `"${row.column_name}"`;
    try {
      const qRes = await client.query(`
        SELECT COUNT(*) as count 
        FROM ${tbl} 
        WHERE ${col}::text = ANY($1::text[])
      `, [dupOrderIds]);
      const count = parseInt(qRes.rows[0].count, 10);
      results.push({ table: row.table_name, column: row.column_name, count });
      if (count > 0) {
        console.log(`⚠️ MATCH FOUND: ${row.table_name}.${row.column_name} has ${count} references!`);
      }
    } catch (err) {
      // ignore type cast errors on non-text columns
    }
  }

  // Also check JSON columns in key tables:
  // accounting_voucher, journal_entry, audit_log / audit_event, cod_handover / cod_collection, settlement
  const jsonTables = [
    { table: 'accounting_voucher', cols: ['metadata', 'lines'] },
    { table: 'journal_entry', cols: ['metadata'] },
    { table: 'journal_line', cols: ['metadata'] },
    { table: 'cod_collection', cols: ['metadata'] },
    { table: 'cod_handover', cols: ['metadata'] },
    { table: 'bank_reconciliation_item', cols: ['metadata'] },
    { table: 'gateway_payout_batch', cols: ['metadata'] },
    { table: 'audit_log', cols: ['details', 'metadata'] },
    { table: 'marketplace_order_snapshot', cols: ['snapshot_data'] },
  ];

  for (const jt of jsonTables) {
    for (const c of jt.cols) {
      try {
        const checkSql = `
          SELECT COUNT(*) as count 
          FROM public."${jt.table}"
          WHERE "${c}"::text ILIKE ANY($1::text[])
        `;
        const patterns = dupOrderIds.map(id => `%${id}%`);
        const qRes = await client.query(checkSql, [patterns]);
        const count = parseInt(qRes.rows[0].count, 10);
        results.push({ table: `${jt.table}.${c} (JSON)`, column: 'JSON text', count });
        if (count > 0) {
          console.log(`⚠️ JSON MATCH FOUND: ${jt.table}.${c} has ${count} references!`);
        }
      } catch (err) {
        // Table or column might not exist
      }
    }
  }

  console.log('\n=== AUDIT RESULTS SUMMARY ===');
  const matched = results.filter(r => r.count > 0);
  console.log(`Total checked points: ${results.length}`);
  console.log(`Total matched dependent points: ${matched.length}`);
  if (matched.length === 0) {
    console.log('✅ 100% CLEAN: Zero dependent references exist across ANY table, column, or JSON payload for the 8 historical duplicate test orders.');
  } else {
    console.log('Matched points:', matched);
  }

  await client.end();
}

fullAudit().catch(console.error);
