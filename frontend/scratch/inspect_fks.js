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

async function showFks() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    try {
      await client.query("SET session_replication_role = 'replica';");
      console.log("session_replication_role = replica is ALLOWED");
      await client.query("SET session_replication_role = 'origin';");
    } catch(e) {
      console.log("session_replication_role error:", e.message);
    }
  } finally {
    await client.end();
  }
}

showFks().catch(console.error);
