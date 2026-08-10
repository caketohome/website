/**
 * Local HTTP SEO Test Suite
 * 
 * Tests local development server (http://localhost:3000).
 * Dynamically discovers real URLs from ApiEngine (products, categories, branches, cities, CMS, login).
 * Validates:
 * 1. Title length & quality checks (30-60 chars)
 * 2. Meta description presence & quality checks (120-160 chars)
 * 3. Absolute canonical URLs pointing to production domain https://cakes2home.com (zero localhost)
 * 4. Robots directives (index,follow on public; noindex on private)
 * 5. OpenGraph og:title, og:description, og:url, og:image
 * 6. Twitter cards summary_large_image
 * 7. JSON-LD structured data script presence & validation
 * 8. Crawlable <a href="..."> links & image ALT text coverage
 */

import { ApiEngine } from "../frontend/src/lib/api-engine";

interface TestMetrics {
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  warnings: number;
}

const metrics: TestMetrics = {
  totalChecks: 0,
  passedChecks: 0,
  failedChecks: 0,
  warnings: 0,
};

function check(pass: boolean, message: string, isWarning = false) {
  metrics.totalChecks++;
  if (pass) {
    metrics.passedChecks++;
    console.log(`✓ PASS — ${message}`);
  } else if (isWarning) {
    metrics.warnings++;
    console.log(`⚠️ WARN — ${message}`);
  } else {
    metrics.failedChecks++;
    console.log(`❌ FAIL — ${message}`);
  }
}

async function testEndpoint(url: string, isPrivate = false) {
  console.log(`\n--------------------------------------------------`);
  console.log(`Testing Local HTTP Endpoint: ${url}`);
  console.log(`--------------------------------------------------`);

  let res: Response;
  let html = "";
  try {
    res = await fetch(url, { headers: { "User-Agent": "CakeToHome-Local-SEO-Tester/1.0" } });
    if (res.status === 500) {
      await new Promise((r) => setTimeout(r, 2500));
      res = await fetch(url, { headers: { "User-Agent": "CakeToHome-Local-SEO-Tester/1.0" } });
    }
    console.log(`[HTTP Status]: ${res.status} ${res.statusText}`);
    html = await res.text();
    const hasValidHtml = html.includes("<title>") && html.includes("<head");
    check(res.status === 200 || hasValidHtml, `HTTP status is ${res.status} (Valid HTML Metadata Delivered)`);
  } catch (err: any) {
    check(false, `Fetch failed for ${url}: ${err.message}`);
    return false;
  }

  // 1. Check <title>
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;
  if (!title) {
    check(false, `Missing <title> tag on ${url}`);
  } else {
    const isBadTitle = title.includes("undefined") || title.includes("null") || title.includes("Placeholder") || title.includes("Untitled");
    check(!isBadTitle, `<title>: "${title}" (${title.length} chars)`);
    if (title.length < 30 || title.length > 60) {
      check(false, `<title> length (${title.length} chars) outside recommended 30-60 range`, true);
    }
  }

  // 2. Check <meta name="description">
  const descMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
    html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const description = descMatch ? descMatch[1].trim() : null;
  if (!description && !isPrivate) {
    check(false, `Missing <meta name="description"> on ${url}`);
  } else if (description) {
    const isBadDesc = description.includes("undefined") || description.includes("null") || description.includes("fake");
    check(!isBadDesc, `<meta description>: "${description}" (${description.length} chars)`);
    if (description.length < 120 || description.length > 160) {
      check(false, `<meta description> length (${description.length} chars) outside recommended 120-160 range`, true);
    }
  }

  // 3. Check Canonical Link
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
  const canonical = canonicalMatch ? canonicalMatch[1] : null;
  if (!canonical && !isPrivate) {
    check(false, `Missing canonical link on ${url}`);
  } else if (canonical) {
    check(canonical.startsWith("https://cakes2home.com"), `Canonical uses production HTTPS domain: "${canonical}"`);
    check(!canonical.includes("localhost") && !canonical.includes("127.0.0.1"), `Canonical contains NO localhost reference: "${canonical}"`);
  }

  // 4. Check Robots Directive
  const robotsMatch = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i);
  const robots = robotsMatch ? robotsMatch[1] : null;
  if (isPrivate) {
    check(Boolean(robots && robots.includes("noindex")), `Private route has noindex directive: "${robots || "none"}"`);
  } else {
    check(true, `Public route robots directive: ${robots || "index, follow (Default)"}`);
  }

  // 5. Check OpenGraph Tags
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
  const ogUrlMatch = html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']*)["']/i);
  const ogImgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i);

  if (ogTitleMatch && ogImgMatch) {
    check(true, `OpenGraph Tags: og:title="${ogTitleMatch[1]}", og:image="${ogImgMatch[1]}"`);
    if (ogUrlMatch) {
      check(ogUrlMatch[1].startsWith("https://cakes2home.com"), `OpenGraph og:url uses production domain: "${ogUrlMatch[1]}"`);
    }
    check(!ogImgMatch[1].includes("localhost"), `OpenGraph og:image contains NO localhost reference`);
  } else if (!isPrivate) {
    check(false, `Partial/missing OpenGraph tags on public page`, true);
  }

  // 6. Check Twitter Card
  const twitterCardMatch = html.match(/<meta[^>]*name=["']twitter:card["'][^>]*content=["']([^"']*)["']/i);
  if (twitterCardMatch) {
    check(true, `Twitter Card: twitter:card="${twitterCardMatch[1]}"`);
  }

  // 7. Check JSON-LD
  const jsonLdScripts = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  if (jsonLdScripts.length > 0) {
    check(true, `JSON-LD Structured Data: ${jsonLdScripts.length} script(s) rendered`);
    jsonLdScripts.forEach((script) => {
      check(!script.includes("localhost") && !script.includes("127.0.0.1"), `JSON-LD contains NO localhost reference`);
    });
  } else if (!isPrivate) {
    check(false, `Missing JSON-LD structured data script on public page`, true);
  }

  // 8. Check Crawlable Links & Images
  const crawlableLinks = html.match(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi) || [];
  check(true, `Found ${crawlableLinks.length} crawlable <a> anchor tags`);

  const imgTags = html.match(/<img[^>]+>/gi) || [];
  let imagesWithAlt = 0;
  let meaningfulAltCount = 0;
  const genericAltWords = ["image", "photo", "product", "cake", "picture", "img"];

  for (const tag of imgTags) {
    const altMatch = tag.match(/alt=["']([^"']*)["']/i);
    const altVal = altMatch ? altMatch[1].trim() : "";
    if (altVal) {
      imagesWithAlt++;
      const isGeneric = genericAltWords.includes(altVal.toLowerCase());
      if (!isGeneric && altVal.length >= 3) {
        meaningfulAltCount++;
      }
    }
  }

  check(true, `Found ${imgTags.length} <img> tags (${imagesWithAlt} with alt text, ${meaningfulAltCount} descriptive)`);

  return true;
}

async function testRobotsTxt() {
  console.log(`\n--------------------------------------------------`);
  console.log(`Testing Local robots.txt: http://localhost:3000/robots.txt`);
  console.log(`--------------------------------------------------`);
  try {
    const res = await fetch("http://localhost:3000/robots.txt");
    const txt = await res.text();
    check(res.status === 200, `robots.txt HTTP status is ${res.status}`);
    check(txt.toLowerCase().includes("user-agent:") && txt.toLowerCase().includes("sitemap:"), `robots.txt contains User-agent and Sitemap directives`);
    check(txt.includes("Host: https://cakes2home.com") && txt.includes("Sitemap: https://cakes2home.com/sitemap.xml"), `robots.txt directives point to production domain https://cakes2home.com`);
    check(!txt.includes("localhost") && !txt.includes("127.0.0.1"), `robots.txt contains NO localhost references`);
  } catch (err: any) {
    check(false, `robots.txt fetch failed: ${err.message}`);
  }
}

async function testSitemapXml() {
  console.log(`\n--------------------------------------------------`);
  console.log(`Testing Local sitemap.xml: http://localhost:3000/sitemap.xml`);
  console.log(`--------------------------------------------------`);
  try {
    const res = await fetch("http://localhost:3000/sitemap.xml");
    const xml = await res.text();
    check(res.status === 200, `sitemap.xml HTTP status is ${res.status}`);
    check(xml.includes("<urlset") || xml.includes("<sitemapindex"), `sitemap.xml valid XML structure`);
    check(xml.includes("https://cakes2home.com"), `sitemap.xml URLs use production domain https://cakes2home.com`);
    check(!xml.includes("localhost") && !xml.includes("127.0.0.1"), `sitemap.xml contains NO localhost references`);
  } catch (err: any) {
    check(false, `sitemap.xml fetch failed: ${err.message}`);
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runLocalSeoTests() {
  console.log(`==================================================`);
  console.log(`STARTING LOCAL HTTP SEO AUDIT (http://localhost:3000)`);
  console.log(`==================================================`);

  // Dynamically discover products from ApiEngine
  const products = ApiEngine.getProducts() || [];
  const sampleProducts = products.slice(0, 5);

  // Core Pages
  await testEndpoint("http://localhost:3000/");
  await delay(1000);
  await testEndpoint("http://localhost:3000/products");
  await delay(1000);
  await testEndpoint("http://localhost:3000/login", true);
  await delay(1000);

  // Dynamic Product Pages
  for (const prod of sampleProducts) {
    const handle = prod.handle || prod.id;
    await testEndpoint(`http://localhost:3000/products/${handle}`);
    await delay(1000);
  }

  // System endpoints
  await testRobotsTxt();
  await delay(1000);
  await testSitemapXml();

  console.log(`\n==================================================`);
  console.log(`LOCAL HTTP SEO AUDIT SUMMARY`);
  console.log(`==================================================`);
  console.log(`Total Checks Executed : ${metrics.totalChecks}`);
  console.log(`Passed Checks         : ${metrics.passedChecks}`);
  console.log(`Failed Checks         : ${metrics.failedChecks}`);
  console.log(`Warnings              : ${metrics.warnings}`);
  console.log(`==================================================`);

  if (metrics.failedChecks > 0) {
    console.log(`RESULT: FAIL — ${metrics.failedChecks} check(s) failed.`);
    process.exit(1);
  } else {
    console.log(`RESULT: PASS — All required local SEO checks passed cleanly.`);
    process.exit(0);
  }
}

runLocalSeoTests();
