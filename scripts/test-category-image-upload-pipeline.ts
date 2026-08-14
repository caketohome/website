import assert from "node:assert";

const BASE_URL = "http://localhost:3000";

async function runTests() {
  console.log("🚀 Running Category Image Upload & Management Pipeline Test Suite...\n");

  // Sample 1x1 base64 WebP pixel
  const sampleWebPBase64 = "data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v3AgAA=";
  
  // Sample 1x1 base64 PNG pixel
  const samplePngBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  // Malicious / SVG payload
  const maliciousSvg = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD48L3N2Zz4=";

  // ── TEST 1: Media Upload Endpoint (Valid WebP) ─────────────────────────
  console.log("TEST 1: Upload Valid Compressed WebP Asset");
  const webpRes = await fetch(`${BASE_URL}/api/v1/admin/media/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "test_category_thumb",
      filename: "test_category_thumb.webp",
      dataUrl: sampleWebPBase64,
      mime_type: "image/webp",
      size: 1024,
      folder: "categories",
    }),
  });
  const webpData = await webpRes.json();
  assert.strictEqual(webpRes.status, 201, "Expected 201 Created for WebP upload");
  assert.ok(webpData.success, "Expected success: true");
  assert.ok(webpData.url || webpData.media?.url, "Expected valid media URL returned");
  const uploadedThumbUrl = webpData.url || webpData.media.url;
  console.log(`  ✓ WebP uploaded successfully: ${uploadedThumbUrl}`);

  // ── TEST 2: Media Upload Endpoint (Valid PNG / Hero Banner) ───────────
  console.log("\nTEST 2: Upload Valid Hero Banner Image");
  const heroRes = await fetch(`${BASE_URL}/api/v1/admin/media/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "test_category_hero",
      filename: "test_category_hero.png",
      dataUrl: samplePngBase64,
      mime_type: "image/png",
      size: 2048,
      folder: "categories",
    }),
  });
  const heroData = await heroRes.json();
  assert.strictEqual(heroRes.status, 201, "Expected 201 Created for Hero image upload");
  const uploadedHeroUrl = heroData.url || heroData.media.url;
  console.log(`  ✓ Hero banner uploaded successfully: ${uploadedHeroUrl}`);

  // ── TEST 3: Security Validation: Reject Prohibited SVG / HTML ─────────
  console.log("\nTEST 3: Security Validation (Reject Prohibited SVG Format & Script tags)");
  const svgRes = await fetch(`${BASE_URL}/api/v1/admin/media/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "malicious_svg",
      filename: "exploit.svg",
      dataUrl: maliciousSvg,
      mime_type: "image/svg+xml",
      size: 512,
    }),
  });
  assert.strictEqual(svgRes.status, 400, "Expected 400 Bad Request for SVG / script payload");
  const svgData = await svgRes.json();
  assert.ok(svgData.error, "Expected security error message returned");
  console.log(`  ✓ SVG properly rejected with security alert: "${svgData.error}"`);

  // ── TEST 4: Max Size Validation (>10MB) ───────────────────────────────
  console.log("\nTEST 4: Max Size Validation (> 10MB upload rejection)");
  const oversizedRes = await fetch(`${BASE_URL}/api/v1/admin/media/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "oversized_image",
      filename: "huge.jpg",
      dataUrl: sampleWebPBase64,
      mime_type: "image/jpeg",
      size: 15 * 1024 * 1024, // 15MB
    }),
  });
  assert.strictEqual(oversizedRes.status, 400, "Expected 400 Bad Request for >10MB upload");
  console.log("  ✓ Oversized upload properly rejected");

  // ── TEST 5: Create Category with Uploaded Images ───────────────────────
  console.log("\nTEST 5: Create Category with Uploaded Thumbnail & Hero Banner");
  const createCatRes = await fetch(`${BASE_URL}/api/v1/admin/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Luxury Designer Cakes",
      slug: "luxury-designer-cakes",
      description: "Handcrafted tier cakes for VIP luxury celebrations.",
      image_url: uploadedThumbUrl,
      banner_url: uploadedHeroUrl,
      status: "active",
      visibility: "public",
      display_order: 1,
    }),
  });
  const createCatData = await createCatRes.json();
  assert.strictEqual(createCatRes.status, 201, "Expected 201 Created for Category registration");
  assert.ok(createCatData.category?.id, "Expected category ID");
  assert.strictEqual(createCatData.category.image_url, uploadedThumbUrl, "Expected stored image_url to match uploaded WebP");
  assert.strictEqual(createCatData.category.banner_url, uploadedHeroUrl, "Expected stored banner_url to match uploaded Hero");
  const createdCatId = createCatData.category.id;
  console.log(`  ✓ Category created: ${createdCatId} ("${createCatData.category.name}")`);

  // ── TEST 6: Update Category (Replace Thumbnail, Keep Hero) ────────────
  console.log("\nTEST 6: Update Category (Replace Thumbnail, Keep Existing Hero Banner)");
  const newThumbUrl = "https://images.unsplash.com/photo-1535141192574-5d4897c13136?w=800";
  const updateCatRes = await fetch(`${BASE_URL}/api/v1/admin/categories/${createdCatId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: newThumbUrl,
      // banner_url left untouched / preserved
    }),
  });
  const updateCatData = await updateCatRes.json();
  assert.ok(updateCatData.success, "Expected update success");
  assert.strictEqual(updateCatData.category.image_url, newThumbUrl, "Expected updated thumbnail URL");
  assert.strictEqual(updateCatData.category.banner_url, uploadedHeroUrl, "Expected banner_url to remain intact");
  console.log(`  ✓ Category thumbnail replaced and hero banner preserved`);

  // ── TEST 7: Storefront Category API Delivery ──────────────────────────
  console.log("\nTEST 7: Verify Storefront Category Retrieval & Image Delivery");
  const storeCatRes = await fetch(`${BASE_URL}/api/v1/categories`);
  const storeCatData = await storeCatRes.json();
  const foundInStore = storeCatData.categories?.find((c: any) => c.id === createdCatId);
  assert.ok(foundInStore, "Expected new category to be available in Storefront Category API");
  assert.strictEqual(foundInStore.image_url, newThumbUrl);
  console.log(`  ✓ Storefront API correctly serves category with updated image URL`);

  // ── TEST 8: Backward Compatibility with External URLs ─────────────────
  console.log("\nTEST 8: Backward Compatibility (External https:// URLs continue working)");
  const externalCatRes = await fetch(`${BASE_URL}/api/v1/admin/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Vintage Fondant Cakes",
      slug: "vintage-fondant-cakes",
      image_url: "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=800",
      banner_url: "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=1600",
      status: "active",
    }),
  });
  const externalCatData = await externalCatRes.json();
  assert.ok(externalCatData.category?.id);
  assert.strictEqual(externalCatData.category.image_url, "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=800");
  console.log(`  ✓ External URL categories seamlessly supported`);

  console.log("\n========================================================");
  console.log("🎉 ALL 8 CATEGORY IMAGE UPLOADER & PIPELINE TESTS PASSED!");
  console.log("========================================================\n");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
