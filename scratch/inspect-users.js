const { Client } = require("../frontend/node_modules/pg");

const connectionString =
  process.env.DATABASE_URL ||
  "[REDACTED_DATABASE_CREDENTIAL]";

async function run() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  const usersRes = await client.query(`SELECT id, email, first_name, last_name, metadata FROM "user"`);
  console.log("Users in user table:", usersRes.rows);

  const authIdentityRes = await client.query(`SELECT id, provider_identities FROM "auth_identity" LIMIT 10`).catch(async () => {
    return await client.query(`SELECT * FROM "provider_identity" LIMIT 10`).catch(() => ({ rows: [] }));
  });
  console.log("Provider identities:", authIdentityRes.rows);

  await client.end();
}

run().catch(console.error);
