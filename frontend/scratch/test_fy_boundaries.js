const fs = require('fs');
const { Client } = require('pg');
const envContent = fs.readFileSync('.env', 'utf8');
const match = envContent.match(/DATABASE_URL=([^\r\n]+)/);
const client = new Client({ connectionString: match[1].trim(), ssl: { rejectUnauthorized: false } });

function getIndianFY_JS(date) {
  // Indian Fiscal Year starts April 1, ends March 31
  // We format date in Asia/Kolkata timezone
  const dStr = date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const kolkataDate = new Date(dStr);
  const month = kolkataDate.getMonth(); // 0-indexed: 0=Jan, 2=Mar, 3=Apr
  const year = kolkataDate.getFullYear();
  const startYear = month >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  const short = `${String(startYear).slice(2)}-${String(endYear).slice(2)}`;
  return { startYear, endYear, short, code: `FY${startYear}-${endYear}` };
}

async function testBoundaries() {
  await client.connect();
  console.log("=== RUNNING TEST SUITE: INDIAN FISCAL YEAR BOUNDARIES ===");

  const testDates = [
    { desc: "FY25-26 End (31 March 2026 23:59:59 IST)", iso: "2026-03-31T18:29:59Z" }, // 23:59:59 IST
    { desc: "FY26-27 Start (1 April 2026 00:00:01 IST)", iso: "2026-03-31T18:30:01Z" }, // 00:00:01 IST
    { desc: "FY26-27 Mid (15 October 2026 12:00:00 IST)", iso: "2026-10-15T06:30:00Z" },
    { desc: "FY26-27 End (31 March 2027 23:59:59 IST)", iso: "2027-03-31T18:29:59Z" },
    { desc: "FY27-28 Start (1 April 2027 00:00:01 IST)", iso: "2027-03-31T18:30:01Z" },
  ];

  for (const t of testDates) {
    const d = new Date(t.iso);
    const jsResult = getIndianFY_JS(d);

    // Test PostgreSQL FY calculation expression
    const sqlRes = await client.query(`
      SELECT 
        CASE 
          WHEN EXTRACT(MONTH FROM $1::timestamptz AT TIME ZONE 'Asia/Kolkata') >= 4 
          THEN EXTRACT(YEAR FROM $1::timestamptz AT TIME ZONE 'Asia/Kolkata')::int
          ELSE EXTRACT(YEAR FROM $1::timestamptz AT TIME ZONE 'Asia/Kolkata')::int - 1
        END AS sql_fy,
        LPAD(((CASE 
          WHEN EXTRACT(MONTH FROM $1::timestamptz AT TIME ZONE 'Asia/Kolkata') >= 4 
          THEN EXTRACT(YEAR FROM $1::timestamptz AT TIME ZONE 'Asia/Kolkata')::int
          ELSE EXTRACT(YEAR FROM $1::timestamptz AT TIME ZONE 'Asia/Kolkata')::int - 1
        END) % 100)::text, 2, '0') || '-' || 
        LPAD((((CASE 
          WHEN EXTRACT(MONTH FROM $1::timestamptz AT TIME ZONE 'Asia/Kolkata') >= 4 
          THEN EXTRACT(YEAR FROM $1::timestamptz AT TIME ZONE 'Asia/Kolkata')::int
          ELSE EXTRACT(YEAR FROM $1::timestamptz AT TIME ZONE 'Asia/Kolkata')::int - 1
        END) + 1) % 100)::text, 2, '0') AS sql_short_fy;
    `, [t.iso]);

    const sqlRow = sqlRes.rows[0];
    const match = jsResult.startYear === sqlRow.sql_fy && jsResult.short === sqlRow.sql_short_fy;
    console.log(`[${t.desc}]`);
    console.log(`  ISO: ${t.iso}`);
    console.log(`  JS:  FY=${jsResult.startYear} (${jsResult.short})`);
    console.log(`  SQL: FY=${sqlRow.sql_fy} (${sqlRow.sql_short_fy})`);
    console.log(`  Status: ${match ? 'PASS (JS == SQL)' : 'FAIL MISMATCH'}\n`);
  }

  await client.end();
}

testBoundaries().catch(console.error);
