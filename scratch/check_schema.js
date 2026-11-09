const { Client } = require('../frontend/node_modules/pg');
const client = new Client({ connectionString: '[REDACTED_DATABASE_CREDENTIAL]' });

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  console.log('All Public Tables:', res.rows.map(r => r.table_name));

  const targetTables = res.rows.map(r => r.table_name).filter(t => 
    t.includes('voucher') || t.includes('journal') || t.includes('vault') || t.includes('teller') || t.includes('account') || t.includes('handover') || t.includes('branch')
  );

  console.log('\nRelevant Tables:', targetTables);

  for (const table of targetTables) {
    const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1 
      ORDER BY ordinal_position
    `, [table]);
    console.log(`\n=== ${table} ===`);
    console.log(cols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
  }

  await client.end();
}

run().catch(console.error);
