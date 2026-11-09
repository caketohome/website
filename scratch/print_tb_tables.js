const fs = require('fs');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

function getDbConn() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      return val;
    }
  }
}

async function run() {
  const client = new Client({ connectionString: getDbConn(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  const targetCodes = ['1111', '1114', '1121', '1119', '2111', '4110', '1143', '1144'];
  const res = await client.query(`
    SELECT 
      acc.code, acc.name, acc.type,
      COALESCE(SUM(jl.debit_amount), 0)::numeric as dr,
      COALESCE(SUM(jl.credit_amount), 0)::numeric as cr,
      CASE 
        WHEN acc.type IN ('ASSET', 'EXPENSE') THEN COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0)
        ELSE COALESCE(SUM(jl.credit_amount - jl.debit_amount), 0)
      END as net_normal_balance
    FROM public.accounting_account acc
    LEFT JOIN public.accounting_journal_line jl ON jl.account_id = acc.id
    LEFT JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
    LEFT JOIN public.accounting_voucher v ON v.id = je.voucher_id AND v.status = 'POSTED' AND v.deleted_at IS NULL
    WHERE acc.code = ANY($1)
    GROUP BY acc.code, acc.name, acc.type
    ORDER BY acc.code;
  `, [targetCodes]);

  console.table(res.rows);

  await client.end();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
