const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPaths = [
    path.join(__dirname, '../backend/.env'),
    path.join(__dirname, '../frontend/.env')
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const idx = trimmed.indexOf('=');
          if (idx !== -1) {
            const key = trimmed.substring(0, idx).trim();
            const val = trimmed.substring(idx + 1).trim();
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
    }
  }
}

loadEnv();

const pgPath = path.join(__dirname, '../frontend/node_modules/pg');
const { Client } = require(pgPath);

async function verifyRLS() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL is not set.');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database.');

    // 1. Audit RLS status across all schemas
    const schemaAudit = await client.query(`
      SELECT 
        schemaname,
        count(*) as total_tables,
        count(*) FILTER (WHERE rowsecurity = true) as rls_enabled,
        count(*) FILTER (WHERE rowsecurity = false) as rls_disabled
      FROM pg_tables 
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      GROUP BY schemaname
      ORDER BY schemaname;
    `);

    console.log('\n📋 Schema-Level RLS Status:');
    console.table(schemaAudit.rows);

    // 2. Check specifically for any public tables with RLS disabled
    const unshielded = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' AND rowsecurity = false
      ORDER BY tablename;
    `);

    if (unshielded.rows.length === 0) {
      console.log('✅ ALL public tables have Row Level Security ENABLED (0 unshielded tables).');
    } else {
      console.error(`❌ Found ${unshielded.rows.length} unshielded public tables:`, unshielded.rows.map(r => r.tablename));
      process.exit(1);
    }

    // 3. Functional check: Verify server queries continue to work via postgres connection
    console.log('\n🔍 Functional Application Query Verification:');
    
    const productCheck = await client.query('SELECT count(*) as count FROM public.product;');
    console.log(`   - SELECT COUNT(*) FROM product: ${productCheck.rows[0].count} products accessible`);

    const categoryCheck = await client.query('SELECT count(*) as count FROM public.product_category;');
    console.log(`   - SELECT COUNT(*) FROM product_category: ${categoryCheck.rows[0].count} categories accessible`);

    const pageCheck = await client.query('SELECT count(*) as count FROM public.cms_page;');
    console.log(`   - SELECT COUNT(*) FROM cms_page: ${pageCheck.rows[0].count} CMS pages accessible`);

    const orderCheck = await client.query('SELECT count(*) as count FROM public."order";');
    console.log(`   - SELECT COUNT(*) FROM "order": ${orderCheck.rows[0].count} orders accessible`);

    console.log('\n🎉 ALL VERIFICATION CHECKS PASSED CLEANLY.');
    await client.end();
  } catch (err) {
    console.error('❌ Verification failed:', err);
    try { await client.end(); } catch (_) {}
    process.exit(1);
  }
}

verifyRLS();
