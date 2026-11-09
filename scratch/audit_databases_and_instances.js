const fs = require('fs');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

function getDbConn() {
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
  const connStr = getDbConn();
  const parsed = new URL(connStr);
  console.log('Host:', parsed.hostname);
  console.log('Port:', parsed.port);
  console.log('Database Path:', parsed.pathname);

  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('\n--- DATABASES ON CLUSTER ---');
  const dbs = await client.query('SELECT datname, datistemplate, pg_size_pretty(pg_database_size(datname)) as size FROM pg_database;');
  console.table(dbs.rows);

  console.log('\n--- SCHEMAS IN CURRENT DATABASE ---');
  const schemas = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast');");
  console.table(schemas.rows);

  await client.end();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
