const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
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
  throw new Error("DATABASE_URL not found in .env");
}

async function testConnection() {
  const connString = getConnectionString();
  const isSupabase = connString.includes('supabase');
  const client = new Client({
    connectionString: connString,
    ssl: isSupabase ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    const infoRes = await client.query('SELECT current_database(), current_schema();');
    console.log('Database Info:', infoRes.rows[0]);

    const tablesRes = await client.query(`
      SELECT COUNT(*) as public_table_count 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    console.log('Public Tables Count:', tablesRes.rows[0].public_table_count);

    console.log('DB_CONNECTIVITY_SUCCESS');
  } catch (err) {
    console.error('DB_CONNECTIVITY_ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

testConnection();
