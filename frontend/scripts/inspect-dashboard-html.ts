async function checkAssets() {
  const url = "http://localhost:3000/dashboard";
  console.log(`Fetching: ${url}`);
  const res = await fetch(url, {
    headers: {
      Cookie: "_cth_role=SUPER_ADMIN;_cth_jwt=jwt_super_admin_token;_cth_user_id=admin_01"
    }
  });

  console.log(`HTTP Status: ${res.status}`);
  const html = await res.text();
  console.log(`HTML Length: ${html.length} chars`);

  const tagRegex = /<(script|link)\b[^>]*>/gi;
  let match;
  const assetUrls: string[] = [];

  while ((match = tagRegex.exec(html)) !== null) {
    const tag = match[0];
    const srcMatch = tag.match(/src=["']([^"']+)["']/i);
    const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
    const relMatch = tag.match(/rel=["']([^"']+)["']/i);
    const url = srcMatch ? srcMatch[1] : (hrefMatch ? hrefMatch[1] : null);
    const rel = relMatch ? relMatch[1] : "";
    if (url) {
      assetUrls.push(url);
      console.log(`Tag: ${tag.slice(0, 150)}... -> URL: ${url} (rel=${rel})`);
    }
  }

  console.log(`\nTesting all ${assetUrls.length} extracted assets:`);
  for (const assetUrl of assetUrls) {
    const fullUrl = assetUrl.startsWith("http") ? assetUrl : `http://localhost:3000${assetUrl}`;
    try {
      const aRes = await fetch(fullUrl);
      const ct = aRes.headers.get("content-type");
      const len = aRes.headers.get("content-length");
      console.log(`  [${aRes.status}] ${fullUrl} (Content-Type: ${ct}, Size: ${len || "chunked"})`);
    } catch (err: any) {
      console.log(`  [ERROR] ${fullUrl} -> ${err.message}`);
    }
  }
}

checkAssets();
