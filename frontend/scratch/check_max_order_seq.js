const fs = require('fs');
const { Client } = require('pg');
const envContent = fs.readFileSync('.env', 'utf8');
const match = envContent.match(/DATABASE_URL=([^\r\n]+)/);
const client = new Client({ connectionString: match[1].trim(), ssl: { rejectUnauthorized: false } });

async function check() {
  await client.connect();

  // Find max numeric value from metadata->>'order_number'
  const maxMetaSeq = await client.query(`
    SELECT 
      metadata->>'order_number' as order_number,
      SUBSTRING(metadata->>'order_number' FROM '([0-9]+)$') as trailing_num
    FROM public."order"
    WHERE metadata->>'order_number' IS NOT NULL
    ORDER BY CAST(SUBSTRING(metadata->>'order_number' FROM '([0-9]+)$') AS INTEGER) DESC NULLS LAST
    LIMIT 10;
  `);
  console.log("TOP 10 TRAILING NUMBERS IN METADATA ORDER_NUMBER:");
  maxMetaSeq.rows.forEach(r => console.log(`  order_number: ${r.order_number} -> trailing_num: ${r.trailing_num}`));

  // Check display_id max
  const maxDisplay = await client.query(`
    SELECT MAX(display_id) as max_disp, MIN(display_id) as min_disp, COUNT(*) as cnt
    FROM public."order";
  `);
  console.log("Display ID summary:", maxDisplay.rows[0]);

  // Check order_display_id_seq last_value
  const dispSeq = await client.query(`
    SELECT sequencename, last_value FROM pg_sequences WHERE sequencename = 'order_display_id_seq';
  `);
  console.log("order_display_id_seq:", dispSeq.rows);

  await client.end();
}

check().catch(console.error);
