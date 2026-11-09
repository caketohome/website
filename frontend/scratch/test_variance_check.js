const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConnectionString() {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
}

async function testVarianceConstraint() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query('BEGIN');
  try {
    await client.query(`
      CREATE TEMP TABLE test_variance (
        id text primary key,
        expected_cash numeric(15,2) not null default 0.00,
        closing_count numeric(15,2),
        variance numeric(15,2),
        CONSTRAINT chk_test_variance CHECK (
          (closing_count IS NULL AND variance IS NULL) OR
          (closing_count IS NOT NULL AND variance IS NOT NULL AND variance = (closing_count - expected_cash))
        )
      );
    `);

    // Valid: open session (null count, null variance)
    await client.query(`INSERT INTO test_variance (id, expected_cash, closing_count, variance) VALUES ('1', 100.00, NULL, NULL);`);
    console.log('Test 1 (open session) passed');

    // Valid: closed session with matching variance (+10.00)
    await client.query(`INSERT INTO test_variance (id, expected_cash, closing_count, variance) VALUES ('2', 100.00, 110.00, 10.00);`);
    console.log('Test 2 (matching excess variance) passed');

    // Valid: closed session with matching shortage (-15.00)
    await client.query(`INSERT INTO test_variance (id, expected_cash, closing_count, variance) VALUES ('3', 100.00, 85.00, -15.00);`);
    console.log('Test 3 (matching shortage variance) passed');

    // Invalid: incorrect variance
    let caught = false;
    try {
      await client.query(`INSERT INTO test_variance (id, expected_cash, closing_count, variance) VALUES ('4', 100.00, 85.00, 0.00);`);
    } catch (e) {
      caught = true;
      console.log('Test 4 (incorrect variance rejected) caught as expected:', e.message);
    }
    if (!caught) throw new Error('Test 4 failed to reject invalid variance!');

  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
}

testVarianceConstraint().catch(console.error);
