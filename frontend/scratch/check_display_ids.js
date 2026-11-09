const fs = require('fs');
const { Client } = require('pg');
const envContent = fs.readFileSync('.env', 'utf8');
const match = envContent.match(/DATABASE_URL=([^\r\n]+)/);
const client = new Client({ connectionString: match[1].trim(), ssl: { rejectUnauthorized: false } });

async function check() {
  await client.connect();

  const dupDisplayIds = await client.query(`
    SELECT display_id, COUNT(*) as cnt
    FROM public."order"
    GROUP BY display_id
    HAVING COUNT(*) > 1;
  `);
  console.log("DUPLICATE DISPLAY_IDS COUNT:", dupDisplayIds.rows.length);
  console.log("DUPLICATE DISPLAY_IDS:", dupDisplayIds.rows);

  const nullMetaDisplayIds = await client.query(`
    SELECT display_id, COUNT(*) as cnt
    FROM public."order"
    WHERE metadata->>'order_number' IS NULL
    GROUP BY display_id
    HAVING COUNT(*) > 1;
  `);
  console.log("DUPLICATE DISPLAY_IDS AMONG NULL ORDER_NUMBER:", nullMetaDisplayIds.rows);

  await client.end();
}

check().catch(console.error);
