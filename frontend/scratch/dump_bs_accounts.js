const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const projectRoot = path.resolve(__dirname, '..');
const envContent = fs.readFileSync(path.join(projectRoot, '.env'), 'utf8');
let connStr = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    connStr = line.substring('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
  }
}

(async () => {
  const db = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const res = await db.query(`
    SELECT a.id, a.code, a.name, a.type, a.subtype, a.is_group, a.level, a.parent_id,
           p.code as parent_code, p.name as parent_name
    FROM public.accounting_account a
    LEFT JOIN public.accounting_account p ON a.parent_id = p.id
    WHERE a.type IN ('ASSET', 'LIABILITY', 'EQUITY') AND a.deleted_at IS NULL
    ORDER BY a.code;
  `);

  console.log(`TOTAL BS ACCOUNTS FOUND: ${res.rows.length}`);
  
  const byType = { ASSET: [], LIABILITY: [], EQUITY: [] };
  for (const r of res.rows) {
    byType[r.type].push({
      code: r.code,
      name: r.name,
      subtype: r.subtype,
      is_group: r.is_group,
      level: r.level,
      parent: r.parent_code ? `${r.parent_code} - ${r.parent_name}` : null
    });
  }

  fs.writeFileSync(path.join(__dirname, 'bs_accounts_dump.json'), JSON.stringify(byType, null, 2));
  console.log('Saved to bs_accounts_dump.json');

  await db.end();
})();
