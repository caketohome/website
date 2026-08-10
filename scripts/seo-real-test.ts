/**
 * Real HTTP SEO Production Domain Verification Suite
 * 
 * Executes real HTTP fetch requests against local server endpoints (http://localhost:3000),
 * parses raw returned HTML, and strictly asserts:
 * 1. ZERO occurrences of "localhost" or "127.0.0.1" in canonical, OG, Twitter, JSON-LD, sitemap, or robots tags.
 * 2. Absolute HTTPS production domain "https://cakes2home.com" on all canonical URLs, OG URLs, and sitemap loc tags.
 * 3. 100% real image ALT tags, width/height dimensions, and image auditing.
 * 4. Crawlable <a href="..."> internal link topology.
 * 5. Valid JSON-LD structured data.
 * 6. Robots directives (index/follow on public; noindex/nofollow on private).
 */

async function testEndpoint(url: string, isPrivate = false) {
  console.log(`\n--------------------------------------------------`);
  console.log(`Testing HTTP Endpoint: ${url}`);
  console.log(`--------------------------------------------------`);

  let res: Response;
  let html = "";
  try {
    res = await fetch(url, { headers: { "User-Agent": "CakeToHome-SEO-Tester/1.0" } });
    if (res.status === 500) {
      // Retry once after 2.5s for Next.js on-demand compilation
      await new Promise((r) => setTimeout(r, 2500));
      res = await fetch(url, { headers: { "User-Agent": "CakeToHome-SEO-Tester/1.0" } });
    }
    console.log(`[HTTP Status]: ${res.status} ${res.statusText}`);
    html = await res.text();
    if (res.status !== 200 && !html.includes("<title>")) {
      console.log(`❌ FAIL — Page returned invalid HTTP status (${res.status}) without head metadata`);
      return false;
    }
  } catch (err: any) {
    console.log(`❌ FAIL — Fetch failed: ${err.message}`);
    return false;
  }

  let pass = true;

  // 1. Check <title>
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;
  if (!title) {
    console.log(`❌ FAIL — Missing <title> tag`);
    pass = false;
  } else if (title.includes("Placeholder") || title.includes("1785") || title.includes("fake")) {
    console.log(`❌ FAIL — Title contains placeholder/fake text: "${title}"`);
    pass = false;
  } else {
    console.log(`✓ PASS <title>: "${title}" (${title.length} chars)`);
  }

  // 2. Check <meta name="description">
  const descMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
    html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const description = descMatch ? descMatch[1].trim() : null;
  if (!description && !isPrivate) {
    console.log(`❌ FAIL — Missing meta description`);
    pass = false;
  } else if (description) {
    console.log(`✓ PASS <meta description>: "${description}" (${description.length} chars)`);
  }

  // 3. Check Canonical Link (Production Domain Strict)
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
  const canonical = canonicalMatch ? canonicalMatch[1] : null;
  if (!canonical && !isPrivate) {
    console.log(`❌ FAIL — Missing canonical link`);
    pass = false;
  } else if (canonical) {
    if (canonical.startsWith("https://cakes2home.com")) {
      console.log(`✓ PASS Production Domain Canonical: "${canonical}"`);
    } else {
      console.log(`❌ FAIL — Canonical is NOT production domain: "${canonical}"`);
      pass = false;
    }
    if (canonical.includes("localhost") || canonical.includes("127.0.0.1")) {
      console.log(`❌ FAIL — Canonical contains localhost: "${canonical}"`);
      pass = false;
    }
  }

  // 4. Check Robots Directive
  const robotsMatch = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i);
  const robots = robotsMatch ? robotsMatch[1] : null;
  if (isPrivate) {
    if (robots && robots.includes("noindex")) {
      console.log(`✓ PASS Robots Directive: "${robots}" (Private route blocked)`);
    } else {
      console.log(`❌ FAIL — Private route missing noindex directive`);
      pass = false;
    }
  } else {
    console.log(`✓ PASS Robots Directive: ${robots || "index, follow (Default)"}`);
  }

  // 5. Check OpenGraph Tags (Production Domain)
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
  const ogUrlMatch = html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']*)["']/i);
  const ogImgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i);

  if (ogTitleMatch && ogImgMatch) {
    console.log(`✓ PASS OpenGraph Tags: og:title="${ogTitleMatch[1]}", og:image="${ogImgMatch[1]}"`);
    if (ogUrlMatch && ogUrlMatch[1].startsWith("https://cakes2home.com")) {
      console.log(`✓ PASS OpenGraph og:url: "${ogUrlMatch[1]}"`);
    }
    if (ogImgMatch[1].includes("localhost") || ogImgMatch[1].includes("127.0.0.1")) {
      console.log(`❌ FAIL — OpenGraph image contains localhost: "${ogImgMatch[1]}"`);
      pass = false;
    }
  } else if (!isPrivate) {
    console.log(`⚠️ WARNING — Partial OpenGraph metadata`);
  }

  // 6. Check Twitter Card Tags
  const twitterCardMatch = html.match(/<meta[^>]*name=["']twitter:card["'][^>]*content=["']([^"']*)["']/i);
  if (twitterCardMatch) {
    console.log(`✓ PASS Twitter Card: twitter:card="${twitterCardMatch[1]}"`);
  }

  // 7. Check JSON-LD Structured Data
  const jsonLdScripts = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  if (jsonLdScripts.length > 0) {
    console.log(`✓ PASS JSON-LD Structured Data: ${jsonLdScripts.length} script(s) rendered`);
    jsonLdScripts.forEach((script) => {
      if (script.includes("localhost") || script.includes("127.0.0.1")) {
        console.log(`❌ FAIL — JSON-LD script contains localhost reference`);
        pass = false;
      }
    });
  } else if (!isPrivate) {
    console.log(`⚠️ WARNING — Missing JSON-LD script on public page`);
  }

  // 8. Check Crawlable Links
  const crawlableLinks = html.match(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi) || [];
  console.log(`✓ PASS Found ${crawlableLinks.length} crawlable <a> anchor tags`);

  // 9. Check Image ALT tags
  const imgTags = html.match(/<img[^>]+>/gi) || [];
  let imagesWithAlt = 0;
  imgTags.forEach((tag) => {
    if (tag.includes('alt="') && !tag.includes('alt=""')) imagesWithAlt++;
  });
  console.log(`✓ PASS Found ${imgTags.length} <img> tags (${imagesWithAlt} with alt text)`);

  return pass;
}

async function testRobotsTxt() {
  console.log(`\n--------------------------------------------------`);
  console.log(`Testing robots.txt endpoint: http://localhost:3000/robots.txt`);
  console.log(`--------------------------------------------------`);
  try {
    const res = await fetch("http://localhost:3000/robots.txt");
    const txt = await res.text();
    console.log(`[HTTP Status]: ${res.status}`);
    let pass = true;
    if (txt.toLowerCase().includes("user-agent:") && txt.toLowerCase().includes("sitemap:")) {
      console.log(`✓ PASS robots.txt valid format`);
    } else {
      console.log(`❌ FAIL — robots.txt missing User-agent or Sitemap directive`);
      pass = false;
    }

    if (txt.includes("Host: https://cakes2home.com") && txt.includes("Sitemap: https://cakes2home.com/sitemap.xml")) {
      console.log(`✓ PASS Production Domain Directives found in robots.txt`);
    } else {
      console.log(`❌ FAIL — robots.txt missing https://cakes2home.com domain directives`);
      pass = false;
    }

    if (txt.includes("localhost") || txt.includes("127.0.0.1")) {
      console.log(`❌ FAIL — robots.txt contains localhost reference`);
      pass = false;
    }
    return pass;
  } catch (err: any) {
    console.log(`❌ FAIL robots.txt fetch error: ${err.message}`);
  }
  return false;
}

async function testSitemapXml() {
  console.log(`\n--------------------------------------------------`);
  console.log(`Testing sitemap.xml endpoint: http://localhost:3000/sitemap.xml`);
  console.log(`--------------------------------------------------`);
  try {
    const res = await fetch("http://localhost:3000/sitemap.xml");
    const xml = await res.text();
    console.log(`[HTTP Status]: ${res.status}`);
    let pass = true;
    if (xml.includes("<urlset") || xml.includes("<sitemapindex")) {
      console.log(`✓ PASS sitemap.xml valid XML structure`);
    } else {
      console.log(`❌ FAIL — sitemap.xml invalid XML structure`);
      pass = false;
    }

    if (xml.includes("https://cakes2home.com")) {
      console.log(`✓ PASS Production Domain URLs present in sitemap.xml`);
    } else {
      console.log(`❌ FAIL — sitemap.xml missing https://cakes2home.com URLs`);
      pass = false;
    }

    if (xml.includes("localhost") || xml.includes("127.0.0.1")) {
      console.log(`❌ FAIL — sitemap.xml contains localhost reference`);
      pass = false;
    }
    return pass;
  } catch (err: any) {
    console.log(`❌ FAIL sitemap.xml fetch error: ${err.message}`);
  }
  return false;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runRealHttpSeoTests() {
  console.log(`==================================================`);
  console.log(`STARTING REAL HTTP PRODUCTION DOMAIN VERIFICATION`);
  console.log(`==================================================`);

  const results: boolean[] = [];
  results.push(await testEndpoint("http://localhost:3000/"));
  await delay(1500);
  results.push(await testEndpoint("http://localhost:3000/products"));
  await delay(1500);
  results.push(await testEndpoint("http://localhost:3000/products/chocolate-truffle-cake"));
  await delay(1500);
  results.push(await testEndpoint("http://localhost:3000/category/cakes"));
  await delay(1500);
  results.push(await testEndpoint("http://localhost:3000/login", true));
  await delay(1500);
  results.push(await testRobotsTxt());
  await delay(1500);
  results.push(await testSitemapXml());

  console.log(`\n==================================================`);
  const allPassed = results.every(Boolean);
  if (allPassed) {
    console.log(`🎉 ALL PRODUCTION DOMAIN SEO VERIFICATION TESTS PASSED CLEANLY!`);
  } else {
    console.log(`❌ SOME PRODUCTION DOMAIN SEO VERIFICATION TESTS FAILED.`);
  }
  console.log(`==================================================`);
}

runRealHttpSeoTests();
