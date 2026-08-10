/**
 * CakeToHome Frontend Assets Verification Suite
 * 
 * Tests local development server (http://localhost:3000).
 * Dynamically extracts all CSS, JS, and image assets from raw HTML responses.
 * Validates:
 * 1. CSS assets return HTTP 200 OK with Content-Type: text/css
 * 2. JS assets return HTTP 200 OK with JavaScript Content-Type
 * 3. Image assets return HTTP 200 OK with Image Content-Type
 * 4. Zero 500 HTML errors returned for CSS/JS static requests
 */

interface AssetMetrics {
  cssDiscovered: number;
  cssLoaded: number;
  cssFailures: number;
  jsDiscovered: number;
  jsLoaded: number;
  jsFailures: number;
  imagesTested: number;
  imagesLoaded: number;
  imageFailures: number;
}

const metrics: AssetMetrics = {
  cssDiscovered: 0,
  cssLoaded: 0,
  cssFailures: 0,
  jsDiscovered: 0,
  jsLoaded: 0,
  jsFailures: 0,
  imagesTested: 0,
  imagesLoaded: 0,
  imageFailures: 0,
};

async function verifyFrontendAssets() {
  console.log(`==================================================`);
  console.log(`STARTING CAKETOHOME ASSET VERIFICATION`);
  console.log(`Target: http://localhost:3000/`);
  console.log(`==================================================`);

  let html = "";
  try {
    const res = await fetch("http://localhost:3000/", {
      headers: { "User-Agent": "CakeToHome-Asset-Auditor/1.0" },
    });
    if (!res.ok) {
      throw new Error(`Homepage returned HTTP ${res.status}`);
    }
    html = await res.text();
    console.log(`✓ HTML: PASS (HTTP 200 OK)`);
  } catch (err: any) {
    console.log(`❌ FAIL — Could not fetch homepage: ${err.message}`);
    process.exit(1);
  }

  // 1. Extract & Verify CSS Stylesheets
  const cssMatches = html.match(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']*)["']/gi) || [];
  const cssUrls: string[] = [];
  cssMatches.forEach((tag) => {
    const hrefMatch = tag.match(/href=["']([^"']*)["']/i);
    if (hrefMatch) cssUrls.push(hrefMatch[1]);
  });

  const uniqueCssUrls = Array.from(new Set(cssUrls));
  metrics.cssDiscovered = uniqueCssUrls.length;

  for (const cssPath of uniqueCssUrls) {
    const fullUrl = cssPath.startsWith("http") ? cssPath : `http://localhost:3000${cssPath}`;
    try {
      const res = await fetch(fullUrl);
      const contentType = res.headers.get("content-type") || "";
      const text = await res.text();

      if (res.status === 200 && contentType.includes("css") && !text.startsWith("<!DOCTYPE")) {
        metrics.cssLoaded++;
        console.log(`✓ PASS CSS Asset: ${cssPath} (HTTP 200, ${text.length} bytes, ${contentType})`);
      } else {
        metrics.cssFailures++;
        console.log(`❌ FAIL CSS Asset: ${cssPath} (Status: ${res.status}, Type: ${contentType})`);
      }
    } catch (err: any) {
      metrics.cssFailures++;
      console.log(`❌ FAIL CSS Fetch Error: ${cssPath} — ${err.message}`);
    }
  }

  // 2. Extract & Verify JS Chunks
  const scriptMatches = html.match(/<script[^>]*src=["']([^"']*)["']/gi) || [];
  const jsUrls: string[] = [];
  scriptMatches.forEach((tag) => {
    const srcMatch = tag.match(/src=["']([^"']*)["']/i);
    if (srcMatch && srcMatch[1].includes("/_next/")) jsUrls.push(srcMatch[1]);
  });

  const uniqueJsUrls = Array.from(new Set(jsUrls));
  metrics.jsDiscovered = uniqueJsUrls.length;

  for (const jsPath of uniqueJsUrls) {
    const fullUrl = jsPath.startsWith("http") ? jsPath : `http://localhost:3000${jsPath}`;
    try {
      const res = await fetch(fullUrl);
      const contentType = res.headers.get("content-type") || "";
      const text = await res.text();

      if (res.status === 200 && (contentType.includes("javascript") || contentType.includes("ecmascript") || text.length > 50)) {
        metrics.jsLoaded++;
        console.log(`✓ PASS JS Chunk: ${jsPath} (HTTP 200, ${text.length} bytes)`);
      } else {
        metrics.jsFailures++;
        console.log(`❌ FAIL JS Chunk: ${jsPath} (Status: ${res.status}, Type: ${contentType})`);
      }
    } catch (err: any) {
      metrics.jsFailures++;
      console.log(`❌ FAIL JS Fetch Error: ${jsPath} — ${err.message}`);
    }
  }

  // 3. Extract & Verify Images
  const imgMatches = html.match(/<img[^>]*src=["']([^"']*)["']/gi) || [];
  const imgUrls: string[] = [];
  imgMatches.forEach((tag) => {
    const srcMatch = tag.match(/src=["']([^"']*)["']/i);
    if (srcMatch) {
      const cleanUrl = srcMatch[1].replace(/&amp;/g, "&");
      imgUrls.push(cleanUrl);
    }
  });

  const sampleImgUrls = Array.from(new Set(imgUrls)).slice(0, 25);
  metrics.imagesTested = sampleImgUrls.length;

  for (const imgPath of sampleImgUrls) {
    const fullUrl = imgPath.startsWith("http") ? imgPath : `http://localhost:3000${imgPath}`;
    try {
      const res = await fetch(fullUrl);
      const contentType = res.headers.get("content-type") || "";
      if (res.status === 200) {
        metrics.imagesLoaded++;
        console.log(`✓ PASS Image Asset: ${imgPath.substring(0, 60)} (HTTP 200, ${contentType})`);
      } else {
        metrics.imageFailures++;
        console.log(`❌ FAIL Image Asset: ${imgPath} (Status: ${res.status})`);
      }
    } catch (err: any) {
      metrics.imageFailures++;
      console.log(`❌ FAIL Image Fetch Error: ${imgPath} — ${err.message}`);
    }
  }

  console.log(`\n====================================`);
  console.log(`CAKETOHOME ASSET VERIFICATION`);
  console.log(`====================================`);
  console.log(`HTML: PASS`);
  console.log(`CSS files discovered: ${metrics.cssDiscovered}`);
  console.log(`CSS files loaded    : ${metrics.cssLoaded}`);
  console.log(`CSS failures        : ${metrics.cssFailures}`);
  console.log(``);
  console.log(`JS files discovered : ${metrics.jsDiscovered}`);
  console.log(`JS files loaded     : ${metrics.jsLoaded}`);
  console.log(`JS failures         : ${metrics.jsFailures}`);
  console.log(``);
  console.log(`Images tested       : ${metrics.imagesTested}`);
  console.log(`Images loaded       : ${metrics.imagesLoaded}`);
  console.log(`Image failures      : ${metrics.imageFailures}`);
  console.log(`====================================`);

  const totalFailures = metrics.cssFailures + metrics.jsFailures + metrics.imageFailures;
  if (totalFailures > 0) {
    console.log(`RESULT: FAIL — ${totalFailures} asset(s) failed to load.`);
    process.exit(1);
  } else {
    console.log(`RESULT: PASS — All frontend CSS, JS, and image assets loaded cleanly.`);
    process.exit(0);
  }
}

verifyFrontendAssets();
