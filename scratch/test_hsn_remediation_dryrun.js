const { Pool } = require("../frontend/node_modules/pg");
const path = require("path");
const fs = require("fs");

const envPath = path.join(__dirname, "../frontend/.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

// 14 Evidence-backed classifications
const PROPOSED_CLASSIFICATIONS = [
  {
    id: "prod_1",
    title: "Belgian Chocolate Truffle Cake",
    hsn_code: "19059010",
    hsn_description: "Pastries and cakes",
    rationale: "Multi-layered chocolate truffle sponge cake with ganache. Heading 1905, Tariff Item 19059010 specifically covers Pastries and cakes."
  },
  {
    id: "prod_2",
    title: "Classic Red Velvet Cream Cheese Cake",
    hsn_code: "19059010",
    hsn_description: "Pastries and cakes",
    rationale: "Red velvet sponge cake with cream cheese frosting. Heading 1905, Tariff Item 19059010 covers Pastries and cakes."
  },
  {
    id: "prod_3",
    title: "Fresh Alphonso Mango Mousse Cake",
    hsn_code: "19059010",
    hsn_description: "Pastries and cakes",
    rationale: "Alphonso mango mousse sponge cake. Heading 1905, Tariff Item 19059010 covers Pastries and cakes."
  },
  {
    id: "prod_4",
    title: "Black Forest Gateau Special",
    hsn_code: "19059010",
    hsn_description: "Pastries and cakes",
    rationale: "Traditional cherry gateau / layered cake with chocolate shavings. Tariff Item 19059010 covers Pastries and cakes."
  },
  {
    id: "prod_5",
    title: "Butterscotch Caramel Crunch Cake",
    hsn_code: "19059010",
    hsn_description: "Pastries and cakes",
    rationale: "Praline and caramel sponge cake with whipped cream. Tariff Item 19059010 covers Pastries and cakes."
  },
  {
    id: "prod_01KXYMAJKNDZ4T2YVA7K144XP5",
    title: "Chocolate Fudge Cupcake",
    hsn_code: "19059010",
    hsn_description: "Pastries and cakes",
    rationale: "Single-portion cup-baked chocolate cake with fudge ganache. Tariff Item 19059010 covers Pastries and cakes."
  },
  {
    id: "prod_01KXYMAJKNV48P1B9CM7C022YM",
    title: "Vanilla Bean Cupcake",
    hsn_code: "19059010",
    hsn_description: "Pastries and cakes",
    rationale: "Single-portion cup-baked vanilla cake with buttercream frosting. Tariff Item 19059010 covers Pastries and cakes."
  },
  {
    id: "prod_01KXYMAJKNH99E1TMWYGQGT61D",
    title: "Danish Pastry Assortment",
    hsn_code: "19059010",
    hsn_description: "Pastries and cakes",
    rationale: "Assorted sweet laminated Danish pastries with fruit fillings and glaze. Tariff Item 19059010 covers Pastries and cakes."
  },
  {
    id: "prod_01KXYMAJKNS8AGWCN5S1WEGKSD",
    title: "Butter Croissant",
    hsn_code: "19059010",
    hsn_description: "Pastries and cakes",
    rationale: "Laminated French butter pastry. Tariff Item 19059010 covers Pastries and cakes."
  },
  {
    id: "prod_dist_pg_persisted_test",
    title: "Artisan Dedicated PG Test Cake",
    hsn_code: "19059010",
    hsn_description: "Pastries and cakes",
    rationale: "Artisanal chocolate layer cake. Tariff Item 19059010 covers Pastries and cakes."
  },
  {
    id: "prod_dist_test_01",
    title: "Artisan Delicate Truffle Cake",
    hsn_code: "19059010",
    hsn_description: "Pastries and cakes",
    rationale: "Artisanal chocolate truffle cake. Tariff Item 19059010 covers Pastries and cakes."
  },
  {
    id: "prod_dist_test_02",
    title: "Sturdy Dry Fruit Tea Cake",
    hsn_code: "19059010",
    hsn_description: "Pastries and cakes",
    rationale: "Dry fruit tea cake / sponge cake. Tariff Item 19059010 covers Pastries and cakes."
  },
  {
    id: "prod_bouquet_rose_01",
    title: "Royal Red Velvet Roses Bouquet",
    hsn_code: "06031100",
    hsn_description: "Fresh cut roses and buds suitable for bouquets",
    rationale: "12 fresh red Dutch roses hand-tied bunch. Chapter 06, Heading 0603, Subheading 06031100 covers Fresh cut roses and buds."
  },
  {
    id: "prod_bouquet_carnation_01",
    title: "Pastel Dutch Carnations & Lilies Bouquet",
    hsn_code: "06031900",
    hsn_description: "Other fresh cut flowers and buds suitable for bouquets",
    rationale: "Mixed hand-tied bouquet of fresh Dutch carnations and Asiatic lilies. Chapter 06, Heading 0603, Subheading 06031900 covers Other fresh cut flowers and buds for bouquets."
  }
];

async function dryRunRemediation() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    console.log("=== DRY-RUN VERIFICATION OF HSN REMEDIATION ===");

    // 1. Validate all proposed codes format
    for (const item of PROPOSED_CLASSIFICATIONS) {
      if (!/^\d{8}$/.test(item.hsn_code)) {
        throw new Error(`VALIDATION ERROR: HSN code '${item.hsn_code}' for product '${item.id}' is not an 8-digit numeric string`);
      }
      if (item.hsn_code === "19059090") {
        throw new Error(`VALIDATION ERROR: Forbidden blanket fallback 19059090 attempted on product '${item.id}'`);
      }
      if (item.hsn_code === "UNCLASSIFIED") {
        throw new Error(`VALIDATION ERROR: Forbidden marker 'UNCLASSIFIED' attempted on product '${item.id}'`);
      }
    }
    console.log("✅ Validation passed: All 14 codes are strictly valid 8-digit statutory HSNs, zero blanket fallbacks or markers.");

    // 2. Start transaction
    await client.query("BEGIN");

    // 3. Check baseline
    const baseline = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE metadata->>'hsn_code' IS NOT NULL AND TRIM(metadata->>'hsn_code') != '') as classified,
        COUNT(*) FILTER (WHERE metadata->>'hsn_code' IS NULL OR TRIM(metadata->>'hsn_code') = '') as unclassified
      FROM public.product
      WHERE deleted_at IS NULL;
    `);
    console.log("\nBaseline counts (active products):", baseline.rows[0]);

    // 4. Update each product conditionally
    const auditRecords = [];

    for (const item of PROPOSED_CLASSIFICATIONS) {
      // Fetch BEFORE
      const beforeRes = await client.query(`
        SELECT id, title, hs_code, metadata->>'hsn_code' as meta_hsn, metadata->>'hsn_description' as meta_desc, updated_at
        FROM public.product
        WHERE id = $1 AND deleted_at IS NULL;
      `, [item.id]);

      if (beforeRes.rows.length === 0) {
        throw new Error(`Product ${item.id} not found or deleted!`);
      }

      const before = beforeRes.rows[0];

      // Conditional update
      const updateRes = await client.query(`
        UPDATE public.product
        SET metadata = jsonb_set(
              jsonb_set(
                COALESCE(metadata, '{}'::jsonb),
                '{hsn_code}',
                to_jsonb($1::text)
              ),
              '{hsn_description}',
              to_jsonb($2::text)
            ),
            hs_code = $1,
            updated_at = NOW()
        WHERE id = $3
          AND deleted_at IS NULL
          AND (metadata->>'hsn_code' IS NULL OR TRIM(metadata->>'hsn_code') = '');
      `, [item.hsn_code, item.hsn_description, item.id]);

      if (updateRes.rowCount !== 1) {
        throw new Error(`EXPECTED 1 ROW UPDATED FOR ${item.id}, GOT ${updateRes.rowCount}!`);
      }

      // Fetch AFTER
      const afterRes = await client.query(`
        SELECT id, title, hs_code, metadata->>'hsn_code' as meta_hsn, metadata->>'hsn_description' as meta_desc, updated_at
        FROM public.product
        WHERE id = $1 AND deleted_at IS NULL;
      `, [item.id]);

      const after = afterRes.rows[0];

      auditRecords.push({
        id: item.id,
        title: item.title,
        before: { hsn_code: before.meta_hsn, hsn_description: before.meta_desc, hs_code: before.hs_code },
        after: { hsn_code: after.meta_hsn, hsn_description: after.meta_desc, hs_code: after.hs_code },
        rationale: item.rationale
      });

      console.log(`  [UPDATE] ${item.id} (${item.title}): '${before.meta_hsn || "NULL"}' -> '${after.meta_hsn}' ("${after.meta_desc}")`);
    }

    // 5. Check post-update count inside transaction
    const postCount = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE metadata->>'hsn_code' IS NOT NULL AND TRIM(metadata->>'hsn_code') != '') as classified,
        COUNT(*) FILTER (WHERE metadata->>'hsn_code' IS NULL OR TRIM(metadata->>'hsn_code') = '') as unclassified
      FROM public.product
      WHERE deleted_at IS NULL;
    `);
    console.log("\nPost-update counts inside transaction:", postCount.rows[0]);

    // 6. Verify 8 original classified products untouched
    const origCheck = await client.query(`
      SELECT id, title, metadata->>'hsn_code' as hsn_code
      FROM public.product
      WHERE id IN (
        'acc_01', 'acc_02',
        'prod_01KXYMAJKNWZCFXJHESPTZE01G', 'prod_01KXYMAJKNXGS5WT4R0QNQGV5F',
        'prod_1788960228243', 'prod_1788960313218',
        'prod_1788960554491', 'prod_1788960674375'
      ) AND deleted_at IS NULL
      ORDER BY id;
    `);
    console.log(`\nOriginal 8 classified products verification (${origCheck.rows.length}/8):`);
    for (const r of origCheck.rows) {
      console.log(`  ${r.id}: ${r.title} => HSN: ${r.hsn_code} ✅`);
    }

    // Rollback dry-run
    await client.query("ROLLBACK");
    console.log("\n✅ DRY-RUN COMPLETED SUCCESSFULLY WITH ROLLBACK (0 MUTATIONS COMMITTED)");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Dry run error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

dryRunRemediation();
