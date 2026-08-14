/**
 * Verification script to test that all Next.js static assets, CSS, and JS chunks
 * return HTTP 200 and no 404s exist on the running server.
 */

async function verifyPageAssets(path: string) {
  const baseUrl = "http://localhost:3000";
  const url = `${baseUrl}${path}`;
  console.log(`\nTesting Page: ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Page ${url} returned status ${res.status}`);
  }
  const html = await res.text();
  console.log(`  ✅ Page HTML loaded (Status ${res.status}, Length: ${html.length} bytes)`);

  // Extract all /_next/static CSS and JS references
  const assetRegex = /([/_]next\/static\/[^\s"'><]+)/g;
  const matches = Array.from(html.matchAll(assetRegex)).map((m) => m[1].replace(/\\+$/, ""));
  const uniqueAssets = Array.from(new Set(matches));

  console.log(`  Found ${uniqueAssets.length} unique Next.js static asset references`);

  let passed = 0;
  let failed = 0;

  for (const assetPath of uniqueAssets) {
    const fullAssetUrl = assetPath.startsWith("http") ? assetPath : `${baseUrl}${assetPath.startsWith("/") ? "" : "/"}${assetPath}`;
    try {
      const assetRes = await fetch(fullAssetUrl);
      if (assetRes.status === 200) {
        const body = await assetRes.arrayBuffer();
        console.log(`    ✅ [200 OK] ${assetPath} (${body.byteLength} bytes)`);
        passed++;
      } else {
        console.error(`    ❌ [${assetRes.status} FAIL] ${assetPath}`);
        failed++;
      }
    } catch (err: any) {
      console.error(`    ❌ [FETCH ERROR] ${assetPath}: ${err.message}`);
      failed++;
    }
  }

  return { passed, failed, total: uniqueAssets.length };
}

async function run() {
  console.log("================================================================================");
  console.log("   CAKETOHOME: NEXT.JS STATIC ASSET & CSS/JS 200 VERIFICATION AUDIT");
  console.log("================================================================================");

  const pages = ["/", "/login", "/dashboard", "/account"];
  let totalPassed = 0;
  let totalFailed = 0;

  for (const page of pages) {
    const result = await verifyPageAssets(page);
    totalPassed += result.passed;
    totalFailed += result.failed;
  }

  console.log("\n================================================================================");
  console.log(`   FINAL AUDIT RESULT: ${totalPassed} ASSETS RETURNED 200 OK, ${totalFailed} FAILED`);
  console.log("================================================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Asset audit error:", err);
  process.exit(1);
});
