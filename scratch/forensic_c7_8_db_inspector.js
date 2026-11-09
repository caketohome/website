const path = require('path');
const fs = require('fs');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

// Read connection string from root or frontend .env
let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  const envPath = fs.existsSync(path.join(__dirname, '../frontend/.env'))
    ? path.join(__dirname, '../frontend/.env')
    : path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/);
      if (match) {
        connectionString = match[1].trim();
        break;
      }
    }
  }
}

if (!connectionString) {
  console.error("No DATABASE_URL found");
  process.exit(1);
}

const isSupabase = connectionString.includes('supabase');
const pool = new Pool({
  connectionString,
  ssl: isSupabase ? { rejectUnauthorized: false } : false,
});

async function run() {
  const report = {};
  try {
    // 1. Installed PostgreSQL extensions
    const extRes = await pool.query(`SELECT extname, extversion FROM pg_extension ORDER BY extname;`);
    report.extensions = extRes.rows;

    // 2. Check all tables in public schema
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    report.all_tables = tablesRes.rows.map(r => r.table_name);

    // 3. Relevant tables to inspect in deep detail
    const targetTables = [
      'company',
      'customer',
      'customer_address',
      'corporate_gifting_batch',
      'corporate_gifting_recipient',
      'order',
      'delivery',
      'delivery_zone',
      'delivery_partner',
      'branch',
      'city',
      'state',
      'users',
      'staff',
      'access_profile',
      'staff_access_profile',
      'cost_centre',
      'accounting_voucher',
      'accounting_journal_line'
    ];

    report.table_details = {};

    for (const tbl of targetTables) {
      if (!report.all_tables.includes(tbl)) {
        report.table_details[tbl] = { exists: false };
        continue;
      }

      // Columns
      const colRes = await pool.query(`
        SELECT column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [tbl]);

      // Constraints
      const conRes = await pool.query(`
        SELECT
          con.conname AS constraint_name,
          con.contype AS constraint_type,
          pg_get_constraintdef(con.oid) AS definition
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public' AND rel.relname = $1
        ORDER BY con.conname;
      `, [tbl]);

      // Indexes
      const idxRes = await pool.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = $1
        ORDER BY indexname;
      `, [tbl]);

      // Sample row count
      const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM "${tbl}";`);

      report.table_details[tbl] = {
        exists: true,
        row_count: countRes.rows[0].count,
        columns: colRes.rows,
        constraints: conRes.rows,
        indexes: idxRes.rows
      };
    }

    // 4. Check for any spatial or geometry columns across the whole database
    const geomRes = await pool.query(`
      SELECT table_name, column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND (data_type ILIKE '%geometry%' OR data_type ILIKE '%geography%' OR udt_name ILIKE '%geometry%' OR udt_name ILIKE '%geography%' OR column_name ILIKE '%polygon%' OR column_name ILIKE '%coord%')
      ORDER BY table_name, column_name;
    `);
    report.spatial_columns = geomRes.rows;

    // 5. Inspect customer metadata structure
    const sampleCust = await pool.query(`
      SELECT id, email, first_name, last_name, phone, metadata, created_at
      FROM "customer"
      WHERE metadata IS NOT NULL AND jsonb_typeof(metadata::jsonb) = 'object'
      LIMIT 5;
    `);
    report.sample_customer_metadata = sampleCust.rows;

    // 6. Inspect delivery records & relationship to order
    if (report.all_tables.includes('delivery')) {
      const deliverySample = await pool.query(`
        SELECT * FROM "delivery" LIMIT 5;
      `);
      report.delivery_sample = deliverySample.rows;
    }

    // 7. Inspect delivery_partner records
    if (report.all_tables.includes('delivery_partner')) {
      const partnerSample = await pool.query(`
        SELECT * FROM "delivery_partner" LIMIT 5;
      `);
      report.partner_sample = partnerSample.rows;
    }

    // 8. Inspect delivery_zone records
    if (report.all_tables.includes('delivery_zone')) {
      const zoneSample = await pool.query(`
        SELECT * FROM "delivery_zone" LIMIT 5;
      `);
      report.zone_sample = zoneSample.rows;
    }

    // 9. Inspect branch records
    if (report.all_tables.includes('branch')) {
      const branchSample = await pool.query(`
        SELECT * FROM "branch" LIMIT 5;
      `);
      report.branch_sample = branchSample.rows;
    }

    // 10. Inspect company records
    if (report.all_tables.includes('company')) {
      const companySample = await pool.query(`
        SELECT * FROM "company" LIMIT 5;
      `);
      report.company_sample = companySample.rows;
    }

    fs.writeFileSync(path.join(__dirname, 'forensic_c7_8_db_report.json'), JSON.stringify(report, null, 2));
    console.log("Forensic DB inspection complete. Written to scratch/forensic_c7_8_db_report.json");
    console.log("Summary:");
    console.log("- Total tables in public schema:", report.all_tables.length);
    console.log("- Extensions:", report.extensions.map(e => e.extname).join(', '));
    console.log("- Target tables inspected:", Object.keys(report.table_details).length);
    console.log("- Spatial columns detected:", report.spatial_columns.length);
  } catch (err) {
    console.error("DB inspection failed:", err);
  } finally {
    await pool.end();
  }
}

run();
