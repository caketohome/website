async function inspect() {
  const res = await fetch("http://localhost:3000/");
  const html = await res.text();
  console.log("HTML length:", html.length);
  const links = html.match(/<link[^>]*>/gi) || [];
  console.log("Links found:", links);
  const styles = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  console.log("Style tags count:", styles.length);
  for (const link of links) {
    if (link.includes("stylesheet")) {
      const hrefMatch = link.match(/href=["'](.*?)["']/);
      if (hrefMatch) {
        const cssUrl = hrefMatch[1].startsWith("http") ? hrefMatch[1] : `http://localhost:3000${hrefMatch[1]}`;
        const cssRes = await fetch(cssUrl);
        const cssText = await cssRes.text();
        console.log(`CSS ${cssUrl} -> status: ${cssRes.status}, length: ${cssText.length}`);
        console.log("CSS preview:", cssText.slice(0, 300));
      }
    }
  }
}
inspect();
