const fs = require('fs');
const path = require('path');

// Helper to load env file without external dotenv dependency
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

async function enableRLS() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL is not set in backend/.env or frontend/.env');
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

    // 1. Fetch current status of public tables
    const tableRes = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename ASC;
    `);

    const allTables = tableRes.rows;
    const disabledTables = allTables.filter(t => !t.rowsecurity);
    console.log(`\n📊 Current Public Schema Audit:`);
    console.log(`   Total tables: ${allTables.length}`);
    console.log(`   RLS already enabled: ${allTables.length - disabledTables.length}`);
    console.log(`   RLS disabled: ${disabledTables.length}\n`);

    // 2. Generate and write SQL migration file
    const sqlStatements = allTables.map(t => `ALTER TABLE public."${t.tablename}" ENABLE ROW LEVEL SECURITY;`);
    const sqlContent = `-- CakeToHome Supabase Migration: Enable Row Level Security on Public Schema
-- Generated: ${new Date().toISOString()}
-- Total Tables Protected: ${allTables.length}

BEGIN;

${sqlStatements.join('\n')}

COMMIT;
`;

    const migrationPath = path.join(__dirname, '../migration/Migration_Enable_RLS_Public_Tables.sql');
    fs.writeFileSync(migrationPath, sqlContent, 'utf8');
    console.log(`📄 Saved SQL migration file: ${migrationPath}`);

    if (disabledTables.length === 0) {
      console.log('✨ All public tables already have Row Level Security enabled!');
      await client.end();
      return;
    }

    // 3. Apply ALTER TABLE ... ENABLE ROW LEVEL SECURITY in an atomic transaction
    console.log(`🚀 Applying ENABLE ROW LEVEL SECURITY across ${disabledTables.length} tables in a single atomic transaction...`);
    const startTime = Date.now();
    await client.query('BEGIN');

    for (let i = 0; i < disabledTables.length; i++) {
      const table = disabledTables[i].tablename;
      await client.query(`ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY;`);
      if ((i + 1) % 25 === 0 || i === disabledTables.length - 1) {
        console.log(`   Processed ${i + 1}/${disabledTables.length} tables...`);
      }
    }

    await client.query('COMMIT');
    const duration = Date.now() - startTime;
    console.log(`✅ Transaction committed successfully in ${duration}ms!`);

    // 4. Verify post-migration state
    const verifyRes = await client.query(`
      SELECT 
        count(*) as total,
        count(*) FILTER (WHERE rowsecurity = true) as rls_enabled,
        count(*) FILTER (WHERE rowsecurity = false) as rls_disabled
      FROM pg_tables 
      WHERE schemaname = 'public';
    `);

    const stats = verifyRes.rows[0];
    console.log(`\n🔒 Final Post-Migration Verification:`);
    console.log(`   Total public tables: ${stats.total}`);
    console.log(`   RLS enabled:         ${stats.rls_enabled}`);
    console.log(`   RLS disabled:        ${stats.rls_disabled}`);

    if (parseInt(stats.rls_disabled, 10) === 0) {
      console.log(`\n🎉 SUCCESS: All ${stats.total} public tables now have Row Level Security enabled!`);
    } else {
      console.warn(`\n⚠️ Warning: ${stats.rls_disabled} tables still have RLS disabled.`);
    }

    await client.end();
  } catch (err) {
    console.error('❌ Error executing RLS migration:', err);
    try {
      await client.query('ROLLBACK');
      console.log('🔄 Rolled back transaction safely.');
    } catch (_) {}
    try {
      await client.end();
    } catch (_) {}
    process.exit(1);
  }
}

enableRLS();
