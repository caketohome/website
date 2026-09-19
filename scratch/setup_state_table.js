const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

const CANONICAL_STATES = [
  { id: "state_ka", code: "KA", gst_state_code: "29", name: "Karnataka", country_id: "country_in", country_code: "IN", timezone: "Asia/Kolkata", currency: "INR", currency_symbol: "₹", status: "active", display_order: 1 },
  { id: "state_kl", code: "KL", gst_state_code: "32", name: "Kerala", country_id: "country_in", country_code: "IN", timezone: "Asia/Kolkata", currency: "INR", currency_symbol: "₹", status: "active", display_order: 2 },
  { id: "state_tn", code: "TN", gst_state_code: "33", name: "Tamil Nadu", country_id: "country_in", country_code: "IN", timezone: "Asia/Kolkata", currency: "INR", currency_symbol: "₹", status: "active", display_order: 3 },
  { id: "state_mh", code: "MH", gst_state_code: "27", name: "Maharashtra", country_id: "country_in", country_code: "IN", timezone: "Asia/Kolkata", currency: "INR", currency_symbol: "₹", status: "active", display_order: 4 },
  { id: "state_dl", code: "DL", gst_state_code: "07", name: "Delhi NCR", country_id: "country_in", country_code: "IN", timezone: "Asia/Kolkata", currency: "INR", currency_symbol: "₹", status: "active", display_order: 5 },
  { id: "state_tg", code: "TG", gst_state_code: "36", name: "Telangana", country_id: "country_in", country_code: "IN", timezone: "Asia/Kolkata", currency: "INR", currency_symbol: "₹", status: "active", display_order: 6 },
  { id: "state_ap", code: "AP", gst_state_code: "37", name: "Andhra Pradesh", country_id: "country_in", country_code: "IN", timezone: "Asia/Kolkata", currency: "INR", currency_symbol: "₹", status: "active", display_order: 7 },
  { id: "state_gj", code: "GJ", gst_state_code: "24", name: "Gujarat", country_id: "country_in", country_code: "IN", timezone: "Asia/Kolkata", currency: "INR", currency_symbol: "₹", status: "active", display_order: 8 },
  { id: "state_wb", code: "WB", gst_state_code: "19", name: "West Bengal", country_id: "country_in", country_code: "IN", timezone: "Asia/Kolkata", currency: "INR", currency_symbol: "₹", status: "active", display_order: 9 },
  { id: "state_rj", code: "RJ", gst_state_code: "08", name: "Rajasthan", country_id: "country_in", country_code: "IN", timezone: "Asia/Kolkata", currency: "INR", currency_symbol: "₹", status: "active", display_order: 10 },
];

async function main() {
  console.log('1. Creating table "state" in PostgreSQL if not exists...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "state" (
      "id" TEXT PRIMARY KEY,
      "code" TEXT NOT NULL UNIQUE,
      "name" TEXT NOT NULL,
      "gst_state_code" TEXT,
      "country_id" TEXT DEFAULT 'country_in',
      "country_code" TEXT DEFAULT 'IN',
      "timezone" TEXT DEFAULT 'Asia/Kolkata',
      "currency" TEXT DEFAULT 'INR',
      "currency_symbol" TEXT DEFAULT '₹',
      "is_active" BOOLEAN DEFAULT true,
      "status" TEXT DEFAULT 'active',
      "display_order" INTEGER DEFAULT 1,
      "created_at" TIMESTAMPTZ DEFAULT NOW(),
      "updated_at" TIMESTAMPTZ DEFAULT NOW(),
      "deleted_at" TIMESTAMPTZ
    );
  `);
  console.log('  ✓ Table "state" created or verified.');

  console.log('2. Ensuring state_id column in table "city"...');
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'city' AND column_name = 'state_id'
      ) THEN
        ALTER TABLE "city" ADD COLUMN "state_id" TEXT;
      END IF;
    END $$;
  `);
  console.log('  ✓ Column "state_id" ensured in "city".');

  console.log('3. Seeding canonical states into PostgreSQL...');
  for (const s of CANONICAL_STATES) {
    await pool.query(`
      INSERT INTO "state" ("id", "code", "name", "gst_state_code", "country_id", "country_code", "timezone", "currency", "currency_symbol", "is_active", "status", "display_order", "created_at", "updated_at")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "name" = EXCLUDED.name,
        "code" = EXCLUDED.code,
        "gst_state_code" = EXCLUDED.gst_state_code,
        "updated_at" = NOW();
    `, [s.id, s.code, s.name, s.gst_state_code, s.country_id, s.country_code, s.timezone, s.currency, s.currency_symbol, s.status === 'active', s.status, s.display_order]);
  }
  console.log('  ✓ Seeded 10 canonical states.');

  console.log('4. Linking existing cities to state_id in PostgreSQL...');
  await pool.query(`
    UPDATE "city" c
    SET "state_id" = s.id
    FROM "state" s
    WHERE LOWER(c.state) = LOWER(s.name) AND (c.state_id IS NULL OR c.state_id = '');
  `);
  console.log('  ✓ Cities state_id linked.');

  // Verification query
  const res = await pool.query(`SELECT id, code, name, gst_state_code, is_active FROM "state" ORDER BY display_order;`);
  console.log('\nPostgreSQL "state" Table Verification:');
  console.table(res.rows);

  await pool.end();
}

main().catch(err => {
  console.error("Migration failed:", err);
  pool.end();
  process.exit(1);
});
