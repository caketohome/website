async function diagnoseJs() {
  console.log("==================================================================");
  console.log("🔍 CAKETOHOME — EMPIRICAL NEXT.JS JS CHUNKS DIAGNOSTIC");
  console.log("==================================================================\n");

  const routes = ["/", "/dashboard", "/login"];

  for (const route of routes) {
    console.log(`\nTesting Route: http://localhost:3000${route}`);
    const res = await fetch(`http://localhost:3000${route}`);
    console.log(`Status: ${res.status}`);
    const html = await res.text();
    
    // Extract script tags
    const scripts = html.match(/<script[^>]*src=["'](.*?)["'][^>]*>/gi) || [];
    console.log(`Found ${scripts.length} script tags with src:`);
    
    for (const scriptTag of scripts) {
      const srcMatch = scriptTag.match(/src=["'](.*?)["']/);
      if (srcMatch) {
        const rawSrc = srcMatch[1];
        const fullUrl = rawSrc.startsWith("http") ? rawSrc : `http://localhost:3000${rawSrc}`;
        const scriptRes = await fetch(fullUrl);
        const scriptText = await scriptRes.text();
        const is404 = scriptRes.status === 404 || scriptText.includes("<!DOCTYPE html>");
        console.log(`  [${scriptRes.status}] ${rawSrc} -> Size: ${scriptText.length} bytes ${is404 ? "❌ 404 NOT FOUND" : "✅ 200 OK"}`);
      }
    }
  }
}
diagnoseJs();
