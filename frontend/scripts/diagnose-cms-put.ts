import { ApiEngine } from "../src/lib/api-engine";
import { persistCmsPageToDb } from "../src/lib/db-persistence";
import { dbQuery } from "../src/lib/db";

async function diagnose() {
  console.log("Starting diagnosis...");

  console.log("1. Testing dbQuery directly...");
  const t0 = Date.now();
  try {
    const qRes = await dbQuery("SELECT 1 AS test");
    console.log(`dbQuery took ${Date.now() - t0}ms, rows:`, qRes.rows);
  } catch (err: any) {
    console.error(`dbQuery failed in ${Date.now() - t0}ms:`, err.message);
  }

  console.log("2. Ensuring ApiEngine hydrated...");
  const t1 = Date.now();
  await ApiEngine.ensureHydrated();
  console.log(`ensureHydrated took ${Date.now() - t1}ms`);

  const page = ApiEngine.getCmsPage("cmspg_home");
  console.log("Found cmspg_home, sections count:", page?.sections?.length);

  console.log("3. Testing ApiEngine.persist()...");
  const t2 = Date.now();
  ApiEngine.persist();
  console.log(`ApiEngine.persist took ${Date.now() - t2}ms`);

  console.log("4. Testing persistCmsPageToDb...");
  const t3 = Date.now();
  try {
    await persistCmsPageToDb(page);
    console.log(`persistCmsPageToDb took ${Date.now() - t3}ms`);
  } catch (err: any) {
    console.error(`persistCmsPageToDb failed in ${Date.now() - t3}ms:`, err.message);
  }

  console.log("5. Testing forwardToPostgresBackend target (port 9000)...");
  const t4 = Date.now();
  try {
    const res = await fetch("http://localhost:9000/cms/pages/cmspg_home", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(3000),
    });
    console.log(`Port 9000 fetch took ${Date.now() - t4}ms, status ${res.status}`);
  } catch (err: any) {
    console.log(`Port 9000 fetch aborted/failed in ${Date.now() - t4}ms:`, err.message);
  }

  process.exit(0);
}

diagnose().catch(console.error);
