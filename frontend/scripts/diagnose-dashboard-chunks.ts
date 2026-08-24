import fs from "fs";
import path from "path";

async function diagnose() {
  console.log("================================================================================");
  console.log("🔍 DIAGNOSING NEXT.JS DASHBOARD CHUNKS & SERVER STATE");
  console.log("================================================================================\n");

  for (const port of [3000, 3001]) {
    try {
      console.log(`\n--- Inspecting Server on Port ${port} ---`);
      const url = `http://localhost:${port}/dashboard?tab=cms`;
      const res = await fetch(url);
      console.log(`HTTP Status for ${url}: ${res.status}`);
      const html = await res.text();
      console.log(`HTML Response Length: ${html.length} bytes`);

      // Extract all script src
      const scriptMatches = html.match(/src="(\/_next\/[^"]+)"/g) || [];
      const scriptUrls = scriptMatches.map((m) => m.replace(/^src="/, "").replace(/"$/, ""));
      
      console.log(`Total _next scripts referenced in HTML: ${scriptUrls.length}`);
      for (const sUrl of scriptUrls) {
        try {
          const sRes = await fetch(`http://localhost:${port}${sUrl}`);
          const statusIcon = sRes.status === 200 ? "✅" : "❌";
          console.log(`  ${statusIcon} [${sRes.status}] ${sUrl}`);
        } catch (err: any) {
          console.log(`  ❌ [FETCH_ERR] ${sUrl}: ${err.message}`);
        }
      }

      // Extract all link href (css & preloads)
      const linkMatches = html.match(/href="(\/_next\/[^"]+)"/g) || [];
      const linkUrls = linkMatches.map((m) => m.replace(/^href="/, "").replace(/"$/, ""));
      console.log(`\nTotal _next links referenced in HTML: ${linkUrls.length}`);
      for (const lUrl of linkUrls) {
        try {
          const lRes = await fetch(`http://localhost:${port}${lUrl}`);
          const statusIcon = lRes.status === 200 ? "✅" : "❌";
          console.log(`  ${statusIcon} [${lRes.status}] ${lUrl}`);
        } catch (err: any) {
          console.log(`  ❌ [FETCH_ERR] ${lUrl}: ${err.message}`);
        }
      }
    } catch (err: any) {
      console.log(`Port ${port} not reachable: ${err.message}`);
    }
  }

  // Check .next manifests on disk
  console.log("\n--- Checking .next Build Manifests on Disk ---");
  const dotNextDir = path.resolve("./.next");
  if (fs.existsSync(dotNextDir)) {
    console.log(`.next directory exists: ${dotNextDir}`);
    const buildIdPath = path.join(dotNextDir, "BUILD_ID");
    if (fs.existsSync(buildIdPath)) {
      console.log(`BUILD_ID on disk: ${fs.readFileSync(buildIdPath, "utf-8").trim()}`);
    } else {
      console.log(`BUILD_ID file NOT found on disk (normal for dev mode)`);
    }

    const appBuildManifestPath = path.join(dotNextDir, "app-build-manifest.json");
    if (fs.existsSync(appBuildManifestPath)) {
      const abm = JSON.parse(fs.readFileSync(appBuildManifestPath, "utf-8"));
      console.log("\nApp Build Manifest Pages:");
      console.log(JSON.stringify(abm.pages, null, 2));
    }
  } else {
    console.log(`.next directory does not exist on disk!`);
  }
}

diagnose().catch(console.error);
