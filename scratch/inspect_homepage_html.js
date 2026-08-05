async function inspectHomepageHtml() {
  console.log("=== INSPECTING STOREFRONT HOMEPAGE HTML & CSS LINKS ===");
  try {
    const res = await fetch("http://localhost:3000/");
    const text = await res.text();
    console.log(`HTTP Status: ${res.status}`);
    
    // Search for stylesheet links
    const cssLinks = text.match(/<link[^>]*rel="stylesheet"[^>]*>/g) || [];
    console.log(`\nStylesheet <link> tags found (${cssLinks.length}):`);
    cssLinks.forEach(l => console.log("  ", l));

    // Search for style tags
    const styleTags = text.match(/<style[^>]*>[\s\S]*?<\/style>/g) || [];
    console.log(`\n<style> tags found (${styleTags.length})`);

    // Search for script tags
    const scriptTags = text.match(/<script[^>]*src="[^"]+"[^>]*>/g) || [];
    console.log(`\nJS <script> tags found (${scriptTags.length}):`);
    scriptTags.slice(0, 5).forEach(s => console.log("  ", s));

    // Check head content
    const headMatch = text.match(/<head>([\s\S]*?)<\/head>/);
    if (headMatch) {
      console.log("\nHead snippet:", headMatch[1].slice(0, 500));
    }

    // Check main body class names
    const bodyMatch = text.match(/<body[^>]*>/);
    console.log("\nBody tag:", bodyMatch ? bodyMatch[0] : "No body tag");

    // Check if Tailwind class names exist in HTML
    const sampleClasses = ["flex", "grid", "bg-", "text-", "p-", "rounded"];
    sampleClasses.forEach(cls => {
      const count = (text.match(new RegExp(cls, "g")) || []).length;
      console.log(`Tailwind class substring '${cls}' occurrences: ${count}`);
    });
  } catch (err) {
    console.error("Failed to fetch http://localhost:3000/:", err.message);
  }
}

inspectHomepageHtml();
