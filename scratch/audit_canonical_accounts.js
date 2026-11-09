const fs = require('fs');
const { Client } = require('../frontend/node_modules/pg');

function getConn() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
}

const MANDATED_CODES = [
  { code: '1111', name: 'Cash' },
  { code: '1112', name: 'Operating bank' },
  { code: '1113', name: 'Gateway clearing' },
  { code: '1114', name: 'Petty cash' },
  { code: '1121', name: 'Accounts receivable' },
  { code: '1122', name: 'Undeposited COD' },
  { code: '1131', name: 'Accessory inventory' },
  { code: '1132', name: 'Cake inventory' },
  { code: '1133', name: 'Packaging inventory' },
  { code: '1141', name: 'Input GST CGST' },
  { code: '1142', name: 'Input GST SGST' },
  { code: '1143', name: 'Input GST IGST' },
  { code: '2111', name: 'Accounts payable' },
  { code: '3210', name: 'Retained earnings' },
  { code: '3220', name: 'Current-year earnings' },
  { code: '3300', name: 'Opening-balance offset' },
  { code: '4110', name: 'Bakery sales' },
  { code: '4120', name: 'Accessory sales' },
  { code: '4130', name: 'Other sales' },
  { code: '4190', name: 'Sales returns' },
  { code: '5110', name: 'Cake COGS' },
  { code: '5120', name: 'Accessory COGS' },
  { code: '5130', name: 'Packaging COGS' },
  { code: '5290', name: 'Gateway MDR' },
  { code: '5295', name: 'Cash rounding / MDR variance' },
  { code: '5296', name: 'Cash over/short' },
  { code: '5310', name: 'Bank charges' },
];

async function run() {
  const client = new Client({ connectionString: getConn(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== AUDITING MANDATED CANONICAL ACCOUNTS ===\n');
  const results = [];

  for (const m of MANDATED_CODES) {
    const res = await client.query(
      'SELECT id, code, name, type, subtype, is_group, is_active FROM public.accounting_account WHERE code = $1 AND deleted_at IS NULL',
      [m.code]
    );
    if (res.rows.length === 0) {
      console.log(`❌ MISSING: ${m.code} (${m.name})`);
      results.push({ code: m.code, expectedName: m.name, found: false });
    } else {
      const row = res.rows[0];
      console.log(`✓ FOUND: [${row.code}] "${row.name}" | Type: ${row.type} | Subtype: ${row.subtype} | Group: ${row.is_group} | Active: ${row.is_active}`);
      results.push({ code: m.code, expectedName: m.name, found: true, row });
    }
  }

  const missing = results.filter(r => !r.found);
  console.log(`\nTOTAL MANDATED: ${MANDATED_CODES.length} | FOUND: ${results.length - missing.length} | MISSING: ${missing.length}`);

  await client.end();
}

run().catch(console.error);
