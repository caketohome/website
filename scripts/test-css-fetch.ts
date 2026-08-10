async function testCssFetch() {
  console.log("Fetching http://localhost:3000/ ...");
  const res = await fetch("http://localhost:3000/");
  const html = await res.text();

  const match = html.match(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']*)["']/i);
  console.log("CSS LINK URL:", match ? match[1] : "NONE FOUND");

  if (match) {
    const cssUrl = match[1].startsWith("http") ? match[1] : `http://localhost:3000${match[1]}`;
    console.log(`Fetching CSS URL: ${cssUrl} ...`);
    const cssRes = await fetch(cssUrl);
    console.log("CSS HTTP STATUS:", cssRes.status);
    console.log("CSS CONTENT-TYPE:", cssRes.headers.get("content-type"));
    const cssText = await cssRes.text();
    console.log("CSS TEXT LENGTH:", cssText.length, "bytes");
    console.log("CSS HEAD:\n", cssText.substring(0, 300));
  }
}

testCssFetch();
