const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts[0] && parts[1]) {
      process.env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const TARGET_REGION_ID = 'txreg_01KY2B1R2YVX5040412JCZM1H6';
const EXISTING_5_ID = 'txr_01KY2B1R7WKC3Z3MMQ85EEH8X6';

const STATUTORY_TAX_SLABS = [
  {
    code: 'GST_0',
    rate: 0.0,
    name: 'GST 0%',
    is_default: false,
    canonical_id: 'txr_gst_0_in',
    metadata: {
      description: 'Statutory GST 0% (Exempt / Nil-Rated Goods)',
      taxability: 'Exempt',
      tax_inclusive: true,
      supply_type: 'BOTH',
      customer_type: 'BOTH',
      effective_from: '2026-04-01',
    },
  },
  {
    code: 'GST_5',
    rate: 5.0,
    name: 'GST 5%',
    is_default: true,
    canonical_id: EXISTING_5_ID,
    metadata: {
      description: 'Statutory GST 5% on Bakery & Food Items',
      taxability: 'Taxable',
      tax_inclusive: true,
      supply_type: 'BOTH',
      customer_type: 'BOTH',
      effective_from: '2026-04-01',
    },
  },
  {
    code: 'GST_12',
    rate: 12.0,
    name: 'GST 12%',
    is_default: false,
    canonical_id: 'txr_gst_12_in',
    metadata: {
      description: 'Statutory GST 12% on Confectionery & Gifts',
      taxability: 'Taxable',
      tax_inclusive: true,
      supply_type: 'BOTH',
      customer_type: 'BOTH',
      effective_from: '2026-04-01',
    },
  },
  {
    code: 'GST_18',
    rate: 18.0,
    name: 'GST 18%',
    is_default: false,
    canonical_id: 'txr_gst_18_in',
    metadata: {
      description: 'Statutory GST 18% on Delivery Fees, Accessories & Merchandise',
      taxability: 'Taxable',
      tax_inclusive: true,
      supply_type: 'BOTH',
      customer_type: 'BOTH',
      effective_from: '2026-04-01',
    },
  },
  {
    code: 'GST_28',
    rate: 28.0,
    name: 'GST 28%',
    is_default: false,
    canonical_id: 'txr_gst_28_in',
    metadata: {
      description: 'Statutory GST 28% on Luxury Confectionery',
      taxability: 'Taxable',
      tax_inclusive: true,
      supply_type: 'BOTH',
      customer_type: 'BOTH',
      effective_from: '2026-04-01',
    },
  },
];

async function seedTaxMaster(dryRun = false) {
  const client = await pool.connect();
  try {
    console.log(`=== Starting GST Tax Master Seed (DryRun: ${dryRun}) ===`);
    await client.query('BEGIN');

    // 1. Verify region exists
    const regCheck = await client.query(
      `SELECT id, country_code FROM public.tax_region WHERE id = $1 AND deleted_at IS NULL`,
      [TARGET_REGION_ID]
    );
    if (regCheck.rows.length === 0) {
      throw new Error(`Target tax region '${TARGET_REGION_ID}' not found or deleted.`);
    }
    console.log(`[PASS] Target tax region verified: ${regCheck.rows[0].id} (Country: ${regCheck.rows[0].country_code})`);

    // 2. Process each statutory slab
    for (const slab of STATUTORY_TAX_SLABS) {
      // Check if existing record by ID or by (region + code) or (region + rate)
      const existingRes = await client.query(
        `SELECT id, rate, code, name, is_default, metadata
         FROM public.tax_rate
         WHERE tax_region_id = $1 
           AND (id = $2 OR code = $3 OR (rate = $4 AND deleted_at IS NULL))
         ORDER BY (id = $2) DESC, created_at ASC
         LIMIT 1`,
        [TARGET_REGION_ID, slab.canonical_id, slab.code, slab.rate]
      );

      if (existingRes.rows.length > 0) {
        const existing = existingRes.rows[0];
        console.log(`[FOUND EXISTING] Rate ${slab.rate}% -> Existing record ID: '${existing.id}', current code: '${existing.code}', name: '${existing.name}'`);

        // Update code, name, metadata while preserving primary key id, created_at, created_by, is_default
        const mergedMeta = { ...(existing.metadata || {}), ...slab.metadata };
        await client.query(
          `UPDATE public.tax_rate
           SET code = $1,
               name = $2,
               metadata = $3,
               updated_at = NOW()
           WHERE id = $4`,
          [slab.code, slab.name, JSON.stringify(mergedMeta), existing.id]
        );
        console.log(`[UPDATED] Record '${existing.id}' updated with code '${slab.code}', name '${slab.name}'`);
      } else {
        // Insert new record
        console.log(`[INSERTING NEW] Rate ${slab.rate}% (${slab.code}) with canonical ID '${slab.canonical_id}'`);
        await client.query(
          `INSERT INTO public.tax_rate (
             id, rate, code, name, is_default, is_combinable, tax_region_id, metadata, created_at, updated_at
           ) VALUES (
             $1, $2, $3, $4, $5, false, $6, $7, NOW(), NOW()
           )`,
          [
            slab.canonical_id,
            slab.rate,
            slab.code,
            slab.name,
            slab.is_default,
            TARGET_REGION_ID,
            JSON.stringify(slab.metadata),
          ]
        );
        console.log(`[INSERTED] New tax rate record '${slab.canonical_id}' created`);
      }
    }

    // 3. Query final records in tax_rate for verification
    const finalRates = await client.query(
      `SELECT id, rate, code, name, is_default, is_combinable, tax_region_id, deleted_at, metadata
       FROM public.tax_rate
       WHERE tax_region_id = $1 AND deleted_at IS NULL
       ORDER BY rate ASC`,
      [TARGET_REGION_ID]
    );
    console.log('\n=== Final Tax Rates in Database ===');
    console.table(
      finalRates.rows.map(r => ({
        id: r.id,
        rate: r.rate,
        code: r.code,
        name: r.name,
        is_default: r.is_default,
        description: r.metadata?.description,
      }))
    );

    if (dryRun) {
      await client.query('ROLLBACK');
      console.log('\n[DRY RUN] Transaction rolled back cleanly. No data was modified.');
    } else {
      await client.query('COMMIT');
      console.log('\n[COMMIT] Transaction successfully committed.');
    }

    return finalRates.rows;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ERROR] Seeding failed, rolled back:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// Check command line arg: node seed_gst_tax_master.js [--commit]
const isCommit = process.argv.includes('--commit');
seedTaxMaster(!isCommit).catch(e => {
  process.exit(1);
});
