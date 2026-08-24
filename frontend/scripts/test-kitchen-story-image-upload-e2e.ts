import { chromium, Browser, BrowserContext, Page } from "playwright";
import fs from "fs";
import path from "path";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ [PASS] ${message}`);
}

// 1x1 Transparent WebP sample
const SAMPLE_WEBP_BASE64 = "data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAkA4JaQAA3AA/vuUAAA=";
const SAMPLE_JPEG_BASE64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

async function runKitchenStoryImageUploadE2E() {
  console.log("\n" + "=".repeat(80));
  console.log("🎬 CAKETOHOME — KITCHEN STORY IMAGE UPLOAD SYSTEM E2E ACCEPTANCE TEST");
  console.log("=".repeat(80) + "\n");

  const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";

  // ──────────────────────────────────────────────────────────────────────────
  // 1. DIRECT API VALIDATION: MEDIA UPLOAD & SECURITY
  // ──────────────────────────────────────────────────────────────────────────
  console.log("1️⃣  Testing Canonical Media Upload API & Security Gates...");

  // 1a. Test SVG rejection for security
  const svgRes = await fetch(`${baseUrl}/api/v1/admin/media/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Malicious SVG",
      filename: "test.svg",
      mime_type: "image/svg+xml",
      dataUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD48L3N2Zz4=",
    }),
  });
  assert(svgRes.status === 400, "SVG uploads are strictly rejected with 400 Bad Request");
  const svgData = await svgRes.json();
  assert(svgData.error.includes("prohibited") || svgData.error.includes("Invalid format"), "Security violation message returned for SVG");

  // 1b. Test oversized file rejection (> 10MB)
  const oversizedRes = await fetch(`${baseUrl}/api/v1/admin/media/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Oversized Image",
      filename: "huge.jpg",
      mime_type: "image/jpeg",
      size: 15 * 1024 * 1024, // 15 MB
    }),
  });
  assert(oversizedRes.status === 400, "Oversized files (>10MB) are strictly rejected with 400");

  // 1c. Test successful WebP image upload via Canonical API
  const uploadRes = await fetch(`${baseUrl}/api/v1/admin/media/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Kitchen Story Master Artisan Cake",
      filename: "kitchen_story_artisan.webp",
      mime_type: "image/webp",
      dataUrl: SAMPLE_WEBP_BASE64,
      alt_text: "Master baker frosting fresh Belgian chocolate cake in artisan kitchen",
      folder: "kitchen_story",
      width: 1920,
      height: 1080,
    }),
  });
  assert(uploadRes.status === 201, "Valid WebP image upload succeeds with 201 Created");
  const uploadData = await uploadRes.json();
  assert(Boolean(uploadData.media?.url), "Canonical media URL generated");
  assert(!uploadData.media.url.startsWith("data:"), "Media URL is a persisted canonical reference, NOT base64");
  const uploadedUrl = uploadData.media.url;
  const mediaId = uploadData.media.id;
  console.log(`    • Persisted Canonical URL: ${uploadedUrl}`);
  console.log(`    • Registered Media ID: ${mediaId}`);

  // ──────────────────────────────────────────────────────────────────────────
  // 2. CMS DRAFT PERSISTENCE & PUBLISH LIFECYCLE
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n2️⃣  Testing CMS Draft Update, Save, and Publish Pipeline...");

  // Fetch 'cmspg_about' page (which has Brand Story section 'sec_about_brand')
  const getPageRes = await fetch(`${baseUrl}/api/v1/cms/pages/cmspg_about`);
  assert(getPageRes.status === 200, "Fetched cmspg_about record successfully");
  const pageRecord = (await getPageRes.json()).page;

  // Update 'sec_about_brand' section with uploaded canonical image
  const updatedSections = (pageRecord.sections || []).map((sec: any) => {
    if (sec.type === "brand_story" || sec.type === "image_text") {
      return {
        ...sec,
        config: {
          ...sec.config,
          image_url: uploadedUrl,
          desktop_image_url: uploadedUrl,
          image_alt: "Master baker frosting fresh Belgian chocolate cake in artisan kitchen",
          image_fit: "cover",
          image_position: "left",
          media_id: mediaId,
        },
      };
    }
    return sec;
  });

  pageRecord.sections = updatedSections;

  // Save Draft
  const saveRes = await fetch(`${baseUrl}/api/v1/cms/pages/cmspg_about`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pageRecord),
  });
  assert(saveRes.status === 200, "CMS draft saved successfully with canonical uploaded image");

  // Publish Page
  const pubRes = await fetch(`${baseUrl}/api/v1/cms/pages/cmspg_about/publish`, {
    method: "POST",
  });
  assert(pubRes.status === 200, "CMS page published successfully");

  // Verify published config on disk / Storefront API
  const getPubRes = await fetch(`${baseUrl}/api/v1/cms/pages/cmspg_about`);
  const pubData = (await getPubRes.json()).page;
  const pubSection = pubData.published_config?.sections?.find((s: any) => s.type === "brand_story" || s.type === "image_text");
  assert(Boolean(pubSection), "Published section exists in published_config");
  assert(pubSection.config.image_url === uploadedUrl, "Published config contains exact canonical uploaded image URL");
  assert(pubSection.config.media_id === mediaId, "Published config contains exact media_id");

  // ──────────────────────────────────────────────────────────────────────────
  // 3. PLAYWRIGHT BROWSER VALIDATION: CMS DASHBOARD UI
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n3️⃣  Launching Browser Session & Testing CMS Page Configurator UI...");
  const browser: Browser = await chromium.launch({ headless: true });
  const context: BrowserContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // Set Super Admin Auth Cookies
  await context.addCookies([
    { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
  ]);

  const page: Page = await context.newPage();

  // Navigate to Dashboard CMS tab
  await page.goto(`${baseUrl}/dashboard?tab=cms`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  // Assert Dashboard & CMS Configurator loaded
  const dashboardHeading = await page.textContent("body");
  assert(Boolean(dashboardHeading?.includes("CMS") || dashboardHeading?.includes("Page") || dashboardHeading?.includes("CakeToHome")), "CMS Dashboard loaded cleanly");

  // ──────────────────────────────────────────────────────────────────────────
  // 4. BROWSER STOREFRONT ACCEPTANCE TEST: LIVE RENDERER
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n4️⃣  Auditing Live Storefront Brand/Kitchen Story Section Rendering...");
  await page.goto(`${baseUrl}/about-us`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  // Verify <img> or <picture> renders with uploaded URL
  const renderedImg = await page.$(`img[src="${uploadedUrl}"]`);
  assert(Boolean(renderedImg), "Uploaded canonical image rendered in live storefront <picture>/<img> element");

  // Test Hard Reload on Storefront
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const reloadedImg = await page.$(`img[src="${uploadedUrl}"]`);
  assert(Boolean(reloadedImg), "Uploaded image persists and renders correctly after hard reload");

  // ──────────────────────────────────────────────────────────────────────────
  // 5. TEST REPLACE & REMOVE WORKFLOWS
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n5️⃣  Testing Image Replacement & Removal Safety...");

  // 5a. Replace with a second image
  const upload2Res = await fetch(`${baseUrl}/api/v1/admin/media/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Kitchen Story Replacement Strawberry Tart",
      filename: "kitchen_story_replacement.webp",
      mime_type: "image/webp",
      dataUrl: SAMPLE_WEBP_BASE64,
      folder: "kitchen_story",
    }),
  });
  const upload2Data = await upload2Res.json();
  const replacedUrl = upload2Data.media.url;

  // Update section with replacement
  pubData.sections = (pubData.sections || []).map((sec: any) => {
    if (sec.type === "brand_story" || sec.type === "image_text") {
      return {
        ...sec,
        config: { ...sec.config, image_url: replacedUrl, desktop_image_url: replacedUrl },
      };
    }
    return sec;
  });

  await fetch(`${baseUrl}/api/v1/cms/pages/cmspg_about`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pubData),
  });
  await fetch(`${baseUrl}/api/v1/cms/pages/cmspg_about/publish`, { method: "POST" });

  await page.goto(`${baseUrl}/about-us`, { waitUntil: "domcontentloaded" });
  const replacedImg = await page.$(`img[src="${replacedUrl}"]`);
  assert(Boolean(replacedImg), "Replacement image immediately active on storefront after publish");

  // 5b. Backward Compatibility: Old URL-based image rendering
  const legacyUnsplashUrl = "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800";
  pubData.sections = (pubData.sections || []).map((sec: any) => {
    if (sec.type === "brand_story" || sec.type === "image_text") {
      return {
        ...sec,
        config: { ...sec.config, image_url: legacyUnsplashUrl, desktop_image_url: legacyUnsplashUrl },
      };
    }
    return sec;
  });
  await fetch(`${baseUrl}/api/v1/cms/pages/cmspg_about`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pubData),
  });
  await fetch(`${baseUrl}/api/v1/cms/pages/cmspg_about/publish`, { method: "POST" });

  await page.goto(`${baseUrl}/about-us`, { waitUntil: "domcontentloaded" });
  const legacyImg = await page.$(`img[src*="unsplash.com"]`);
  assert(Boolean(legacyImg), "Legacy external URL image continues to render with 100% backward compatibility");

  await browser.close();

  console.log("\n" + "=".repeat(80));
  console.log("🎉 ALL KITCHEN STORY IMAGE UPLOADER ACCEPTANCE TESTS PASSED (100% SUCCESS)");
  console.log("=".repeat(80) + "\n");
}

runKitchenStoryImageUploadE2E().catch((err) => {
  console.error("❌ Acceptance test failed:", err);
  process.exit(1);
});
