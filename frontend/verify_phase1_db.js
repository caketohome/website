const { Client } = require('./node_modules/pg');
const c = new Client({ connectionString: process.env.PG_URL, ssl: { rejectUnauthorized: false } });

c.connect().then(async () => {
  const hr = () => console.log('─'.repeat(80));

  // ── 1. Table existence ────────────────────────────────────────────────────
  hr();
  console.log('1. PHASE 1 TABLES');
  const tables = await c.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public'
      AND table_name IN ('supplier','purchase','purchase_item','purchase_payment','analytics_expense','expense_category','expense')
    ORDER BY table_name
  `);
  console.log('Found:', tables.rows.map(r => r.table_name).join(', '));

  // ── 2. Column detail for each table ─────────────────────────────────────
  for (const tbl of ['supplier','purchase','purchase_item','purchase_payment']) {
    hr();
    console.log(`2. COLUMNS: ${tbl}`);
    const cols = await c.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1
      ORDER BY ordinal_position
    `, [tbl]);
    cols.rows.forEach(r => {
      console.log(`  ${r.column_name.padEnd(25)} ${r.data_type.padEnd(25)} nullable=${r.is_nullable} default=${r.column_default || 'none'}`);
    });
  }

  // ── 3. Primary keys ──────────────────────────────────────────────────────
  hr();
  console.log('3. PRIMARY KEYS');
  const pks = await c.query(`
    SELECT tc.table_name, kcu.column_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    WHERE tc.table_schema='public'
      AND tc.table_name IN ('supplier','purchase','purchase_item','purchase_payment')
      AND tc.constraint_type = 'PRIMARY KEY'
    ORDER BY tc.table_name
  `);
  pks.rows.forEach(r => console.log(`  ${r.table_name}.${r.column_name} [${r.constraint_name}]`));

  // ── 4. Foreign keys ──────────────────────────────────────────────────────
  hr();
  console.log('4. FOREIGN KEYS');
  const fks = await c.query(`
    SELECT
      tc.table_name, kcu.column_name,
      ccu.table_name AS foreign_table, ccu.column_name AS foreign_column,
      tc.constraint_name, rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
    WHERE tc.table_schema='public'
      AND tc.table_name IN ('supplier','purchase','purchase_item','purchase_payment')
      AND tc.constraint_type = 'FOREIGN KEY'
    ORDER BY tc.table_name
  `);
  fks.rows.forEach(r => console.log(`  ${r.table_name}.${r.column_name} → ${r.foreign_table}.${r.foreign_column} ON DELETE ${r.delete_rule} [${r.constraint_name}]`));

  // ── 5. Indexes ───────────────────────────────────────────────────────────
  hr();
  console.log('5. INDEXES');
  const idx = await c.query(`
    SELECT schemaname, tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname='public'
      AND tablename IN ('supplier','purchase','purchase_item','purchase_payment')
    ORDER BY tablename, indexname
  `);
  console.log(`Total indexes: ${idx.rows.length}`);
  idx.rows.forEach(r => console.log(`  [${r.tablename}] ${r.indexname}\n    ${r.indexdef}`));

  // ── 6. Unique constraints ────────────────────────────────────────────────
  hr();
  console.log('6. UNIQUE CONSTRAINTS');
  const uq = await c.query(`
    SELECT tc.table_name, tc.constraint_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    WHERE tc.table_schema='public'
      AND tc.table_name IN ('supplier','purchase','purchase_item','purchase_payment')
      AND tc.constraint_type = 'UNIQUE'
    ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position
  `);
  uq.rows.forEach(r => console.log(`  ${r.table_name}: ${r.constraint_name} → ${r.column_name}`));

  // ── 7. Check constraints ─────────────────────────────────────────────────
  hr();
  console.log('7. CHECK CONSTRAINTS');
  const chk = await c.query(`
    SELECT tc.table_name, tc.constraint_name, cc.check_clause
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc ON cc.constraint_name = tc.constraint_name AND cc.constraint_schema = tc.table_schema
    WHERE tc.table_schema='public'
      AND tc.table_name IN ('supplier','purchase','purchase_item','purchase_payment')
    ORDER BY tc.table_name, tc.constraint_name
  `);
  chk.rows.forEach(r => console.log(`  ${r.table_name}: ${r.constraint_name} → ${r.check_clause}`));

  // ── 8. Row counts ────────────────────────────────────────────────────────
  hr();
  console.log('8. ROW COUNTS');
  for (const tbl of ['supplier','purchase','purchase_item','purchase_payment']) {
    const cnt = await c.query(`SELECT COUNT(*) FROM public.${tbl}`);
    console.log(`  ${tbl}: ${cnt.rows[0].count} rows`);
  }

  // ── 9. analytics_expense schema ──────────────────────────────────────────
  hr();
  console.log('9. analytics_expense SCHEMA');
  const ae = await c.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='analytics_expense'
    ORDER BY ordinal_position
  `);
  ae.rows.forEach(r => console.log(`  ${r.column_name.padEnd(25)} ${r.data_type.padEnd(25)} nullable=${r.is_nullable}`));
  const aeCnt = await c.query(`SELECT COUNT(*) FROM public.analytics_expense`);
  console.log(`  analytics_expense rows: ${aeCnt.rows[0].count}`);

  // ── 10. analytics_expense indexes ─────────────────────────────────────────
  const aeIdx = await c.query(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='analytics_expense' ORDER BY indexname`);
  console.log(`  analytics_expense indexes: ${aeIdx.rows.length}`);
  aeIdx.rows.forEach(r => console.log(`    ${r.indexname}: ${r.indexdef}`));

  await c.end();
  console.log('\nDone.');
}).catch(e => { console.error('ERROR:', e.message); c.end(); });
