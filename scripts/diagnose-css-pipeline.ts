async function diagnoseCss() {
  console.log("==================================================================");
  console.log("🔍 CAKETOHOME — EMPIRICAL CSS PIPELINE & HTTP DIAGNOSTIC SUITE");
  console.log("==================================================================\n");

  const routes = ["/", "/products/prod_1", "/login", "/dashboard"];

  for (const route of routes) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Testing Route: http://localhost:3000${route}`);
    console.log(`--------------------------------------------------`);

    try {
      const res = await fetch(`http://localhost:3000${route}`);
      console.log(`Page HTTP Status: ${res.status} ${res.statusText}`);
      console.log(`Page Content-Type: ${res.headers.get("content-type")}`);
      const html = await res.text();
      console.log(`Page HTML Total Length: ${html.length} bytes`);

      // Extract all <link> tags
      const linkMatches = html.match(/<link[^>]*>/gi) || [];
      const stylesheetLinks = linkMatches.filter(l => l.includes("stylesheet"));
      console.log(`Total <link> tags: ${linkMatches.length}`);
      console.log(`Stylesheet <link> tags (${stylesheetLinks.length}):`, stylesheetLinks);

      // Extract all <style> tags
      const styleMatches = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
      console.log(`Inline <style> tags count: ${styleMatches.length}`);

      for (const linkTag of stylesheetLinks) {
        const hrefMatch = linkTag.match(/href=["'](.*?)["']/);
        if (hrefMatch) {
          const rawHref = hrefMatch[1];
          const fullCssUrl = rawHref.startsWith("http") ? rawHref : `http://localhost:3000${rawHref}`;
          console.log(`\n  >>> Fetching Stylesheet: ${fullCssUrl}`);
          const cssRes = await fetch(fullCssUrl);
          const cssContentType = cssRes.headers.get("content-type");
          const cssBuffer = await cssRes.arrayBuffer();
          const cssText = new TextDecoder().decode(cssBuffer);

          console.log(`  URL: ${fullCssUrl}`);
          console.log(`  STATUS: ${cssRes.status} ${cssRes.statusText}`);
          console.log(`  CONTENT-TYPE: ${cssContentType}`);
          console.log(`  SIZE: ${cssBuffer.byteLength} bytes`);

          const isHtml = cssText.trim().startsWith("<!DOCTYPE") || cssText.includes("<html") || cssContentType?.includes("text/html");
          console.log(`  IS SERVING HTML (ERROR): ${isHtml ? "⚠️ YES (404/500 Error HTML!)" : "NO (Valid CSS!)"}`);

          if (isHtml) {
            console.log(`  Preview of Error Response:\n${cssText.slice(0, 400)}...\n`);
          } else {
            console.log(`  Preview of CSS Response:\n${cssText.slice(0, 300)}...\n`);
            // Check for key Tailwind classes
            const checkClasses = ["bg-", "text-", "flex", "grid", "rounded", "shadow", "hover:", "dark:"];
            const foundClasses = checkClasses.filter(c => cssText.includes(c));
            console.log(`  Found Tailwind patterns:`, foundClasses);
          }
        }
      }

      // Check classes in HTML
      const classMatches = html.match(/class=["'](.*?)["']/gi) || [];
      console.log(`\nTotal elements with 'class' attribute in HTML: ${classMatches.length}`);
      console.log(`Sample classes from HTML:`, classMatches.slice(0, 5));

    } catch (err: any) {
      console.error(`Failed to diagnose route ${route}:`, err.message);
    }
  }

  console.log("\n==================================================================");
  console.log("🏁 DIAGNOSTIC RUN COMPLETE");
  console.log("==================================================================\n");
}

diagnoseCss();
