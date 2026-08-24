import fs from "fs";
import path from "path";

async function testWithAuth() {
  console.log("================================================================================");
  console.log("🔍 TESTING /dashboard?tab=cms WITH ADMIN AUTH COOKIES");
  console.log("================================================================================\n");

  const port = 3000;
  const url = `http://localhost:${port}/dashboard?tab=cms`;
  const res = await fetch(url, {
    headers: {
      Cookie: "_cth_role=SUPER_ADMIN; _cth_user_id=admin_01; _cth_jwt=mock_admin_token",
    },
    redirect: "manual",
  });

  console.log(`HTTP Status for ${url} (with Auth): ${res.status}`);
  if (res.status >= 300 && res.status < 400) {
    console.log(`Redirect Location: ${res.headers.get("location")}`);
  }

  const html = await res.text();
  console.log(`HTML Length: ${html.length} bytes`);

  // Extract all scripts
  const scriptMatches = html.match(/src="(\/_next\/[^"]+)"/g) || [];
  const scriptUrls = scriptMatches.map((m) => m.replace(/^src="/, "").replace(/"$/, ""));
  console.log(`\nTotal _next scripts referenced in Dashboard HTML: ${scriptUrls.length}`);
  
  let has404 = false;
  for (const sUrl of scriptUrls) {
    const sRes = await fetch(`http://localhost:${port}${sUrl}`);
    const statusIcon = sRes.status === 200 ? "✅" : "❌";
    if (sRes.status !== 200) has404 = true;
    console.log(`  ${statusIcon} [${sRes.status}] ${sUrl}`);
  }

  // Extract all links
  const linkMatches = html.match(/href="(\/_next\/[^"]+)"/g) || [];
  const linkUrls = linkMatches.map((m) => m.replace(/^href="/, "").replace(/"$/, ""));
  console.log(`\nTotal _next links referenced in Dashboard HTML: ${linkUrls.length}`);
  for (const lUrl of linkUrls) {
    const lRes = await fetch(`http://localhost:${port}${lUrl}`);
    const statusIcon = lRes.status === 200 ? "✅" : "❌";
    if (lRes.status !== 200) has404 = true;
    console.log(`  ${statusIcon} [${lRes.status}] ${lUrl}`);
  }

  console.log(`\nResult has 404: ${has404}`);
}

testWithAuth().catch(console.error);
