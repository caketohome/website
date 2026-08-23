async function inspectPort(port: number) {
  console.log(`\n============================================================`);
  console.log(`🔍 INSPECTING CSS PIPELINE ON PORT ${port}`);
  console.log(`============================================================`);
  try {
    const res = await fetch(`http://localhost:${port}/`);
    console.log(`Root page HTTP Status: ${res.status}`);
    const html = await res.text();
    console.log(`HTML Length: ${html.length} bytes`);

    // Match all stylesheet links
    const linkMatches = [...html.matchAll(/<link([^>]+)>/gi)];
    const stylesheetLinks = linkMatches.filter(m => m[0].includes("stylesheet"));

    console.log(`Found ${stylesheetLinks.length} stylesheet <link> tags:`);
    for (const match of stylesheetLinks) {
      console.log(`  Tag: ${match[0]}`);
      const hrefMatch = match[0].match(/href="([^"]+)"/);
      if (hrefMatch) {
        const href = hrefMatch[1];
        const cssUrl = href.startsWith("http") ? href : `http://localhost:${port}${href}`;
        console.log(`  -> Fetching CSS from: ${cssUrl}`);
        const cssRes = await fetch(cssUrl);
        console.log(`  -> CSS Response Status: ${cssRes.status} (${cssRes.statusText})`);
        const cssText = await cssRes.text();
        console.log(`  -> CSS Payload Size: ${cssText.length} bytes`);
        console.log(`  -> CSS Content-Type: ${cssRes.headers.get("content-type")}`);
        if (cssRes.status === 200 && cssText.length > 500 && !cssText.includes("__next_error__")) {
          console.log(`  ✅ CSS LOADED SUCCESSFULLY! Preview: ${cssText.slice(0, 150).replace(/\n/g, " ")}...`);
        } else {
          console.log(`  ❌ CSS FAILED TO LOAD! Body preview: ${cssText.slice(0, 200)}`);
        }
      }
    }
  } catch (err: any) {
    console.error(`Port ${port} error: ${err.message}`);
  }
}

async function main() {
  await inspectPort(3000);
}

main();
