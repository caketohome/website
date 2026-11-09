const fs = require('fs');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

function getConn() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      return val;
    }
  }
}

async function run() {
  const client = new Client({ connectionString: getConn(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('--- ALL NON-TEMPLATE DATABASES ---');
  const dbs = await client.query('SELECT datname FROM pg_database WHERE datistemplate = false');
  console.table(dbs.rows);

  console.log('\n--- CURRENT USER & PERMISSIONS ---');
  const usr = await client.query('SELECT current_user, current_database(), session_user');
  console.table(usr.rows);

  console.log('\n--- CHECK IF LOCAL TEST DATABASE OR LOCAL POSTGRES EXISTS ---');
  // Check if .env or .env.test or similar exists
  const envFiles = fs.readdirSync('.').filter(f => f.startsWith('.env'));
  console.log('Env files in root:', envFiles);
  const frontendEnvFiles = fs.existsSync('frontend') ? fs.readdirSync('frontend').filter(f => f.startsWith('.env')) : [];
  console.log('Env files in frontend:', frontendEnvFiles);

  await client.end();
}

run().catch(console.error);
