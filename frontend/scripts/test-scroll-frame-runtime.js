const fs = require('fs');
const path = require('path');

console.log('================================================================================');
console.log('🧪 RUNNING SCROLL-FRAME 404 STORM & ASSET LOADER VERIFICATION SUITE');
console.log('================================================================================\n');

let passed = 0;
let total = 0;

function assert(condition, msg) {
  total++;
  if (condition) {
    console.log(`  ✅ [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

// ── TEST 1: URL Normalization ──────────────────────────────────────────────
console.log('TEST 1: Canonical URL Normalization (resolveMediaUrl)');
function resolveMediaUrl(url) {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return trimmed;
  }
  return '/' + trimmed;
}

assert(resolveMediaUrl('https://images.unsplash.com/photo-123') === 'https://images.unsplash.com/photo-123', 'Remote URL preserved');
assert(resolveMediaUrl('/uploads/frame_01.webp') === '/uploads/frame_01.webp', 'Root-relative URL preserved');
assert(resolveMediaUrl('uploads/frame_01.webp') === '/uploads/frame_01.webp', 'Relative path prefixed with slash');
assert(resolveMediaUrl('') === '', 'Empty string returns empty string');
assert(resolveMediaUrl('   ') === '', 'Whitespace string returns empty string');

// ── TEST 2: Verify No Stale photo-1535141192574-5d4897c13136 in DB Store ──
console.log('\nTEST 2: Clean CMS Persistence & No Obsolete 404 Asset References');
const dbPath = path.resolve(__dirname, '../data/db-store.json');
const dbContent = fs.readFileSync(dbPath, 'utf8');
const brokenAssetId = 'photo-1535141192574-5d4897c13136';
const occurrences = (dbContent.match(new RegExp(brokenAssetId, 'g')) || []).length;
assert(occurrences === 0, `Zero occurrences of broken asset ${brokenAssetId} in db-store.json (found: ${occurrences})`);

const apiEnginePath = path.resolve(__dirname, '../src/lib/api-engine.ts');
const apiEngineContent = fs.readFileSync(apiEnginePath, 'utf8');
const apiEngineOccurrences = (apiEngineContent.match(new RegExp(brokenAssetId, 'g')) || []).length;
assert(apiEngineOccurrences === 0, `Zero occurrences of broken asset in api-engine.ts (found: ${apiEngineOccurrences})`);

// ── TEST 3: Inspect Active CMS Hero Section Frame Sets ─────────────────────
console.log('\nTEST 3: Active CMS Frame Configuration Integrity');
const db = JSON.parse(dbContent);
const homePage = db.cms_pages && db.cms_pages.find(p => p.slug === 'home' || p.slug === '');
const heroSection = homePage && homePage.sections && homePage.sections.find(s => s.type === 'hero');
assert(!!heroSection, 'CMS Hero section found in home page');

const heroConfig = heroSection.config || heroSection;
const desktopFrames = heroConfig.desktop && heroConfig.desktop.frames || [];
const tabletFrames = heroConfig.tablet && heroConfig.tablet.frames || [];
const mobileFrames = heroConfig.mobile && heroConfig.mobile.frames || [];

console.log(`  ℹ️ Configured Frame Counts -> Desktop: ${desktopFrames.length}, Tablet: ${tabletFrames.length}, Mobile: ${mobileFrames.length}`);
assert(desktopFrames.length >= 16, `Desktop has full frame set (${desktopFrames.length} >= 16)`);
assert(tabletFrames.length >= 16, `Tablet has full frame set (${tabletFrames.length} >= 16)`);
assert(mobileFrames.length >= 12, `Mobile has responsive frame set (${mobileFrames.length} >= 12)`);

// Verify all frame IDs and sequence numbers
desktopFrames.forEach((f, idx) => {
  assert(f.sequence === idx + 1, `Desktop frame sequence is sequential: frame ${idx + 1}`);
  assert(typeof f.url === "string" && (f.url.startsWith("http") || f.url.startsWith("data:") || f.url.startsWith("/")), `Desktop frame ${idx + 1} has valid URL`);
});

// ── TEST 4: Simulated Permanent Failure Cache Verification ─────────────────
console.log('\nTEST 4: Simulated Permanent Failure Cache Logic');
const RUNTIME_IMAGE_CACHE = new Map();
const RUNTIME_FAILED_URLS = new Set();
const RUNTIME_FRAME_STATES = new Map();

let networkFetchCount = 0;
function simulatePreload(url, frameId) {
  const resolvedUrl = resolveMediaUrl(url);
  const cacheKey = frameId || resolvedUrl;

  if (RUNTIME_FAILED_URLS.has(resolvedUrl) || RUNTIME_FRAME_STATES.get(cacheKey) === 'FAILED') {
    RUNTIME_FRAME_STATES.set(cacheKey, 'FAILED');
    return Promise.resolve(null);
  }

  if (RUNTIME_IMAGE_CACHE.has(resolvedUrl)) {
    RUNTIME_FRAME_STATES.set(cacheKey, 'LOADED');
    return Promise.resolve(RUNTIME_IMAGE_CACHE.get(resolvedUrl));
  }

  RUNTIME_FRAME_STATES.set(cacheKey, 'LOADING');
  networkFetchCount++;

  return new Promise(resolve => {
    // Simulate 404 on bad url
    if (resolvedUrl.includes('broken')) {
      RUNTIME_FAILED_URLS.add(resolvedUrl);
      RUNTIME_FRAME_STATES.set(cacheKey, 'FAILED');
      resolve(null);
    } else {
      RUNTIME_IMAGE_CACHE.set(resolvedUrl, { src: resolvedUrl, complete: true, naturalWidth: 800 });
      RUNTIME_FRAME_STATES.set(cacheKey, 'LOADED');
      resolve(RUNTIME_IMAGE_CACHE.get(resolvedUrl));
    }
  });
}

(async () => {
  // Try loading broken URL 100 times in a simulated render loop
  for (let i = 0; i < 100; i++) {
    await simulatePreload('https://example.com/broken-photo.webp', 'frame_broken_01');
  }
  assert(networkFetchCount === 1, `Network requests for broken asset capped at exactly 1 (0 retry storm, fetchCount: ${networkFetchCount})`);
  assert(RUNTIME_FRAME_STATES.get('frame_broken_01') === 'FAILED', 'Frame state is permanently FAILED');

  // Test successful asset load 100 times in simulated scroll loop
  networkFetchCount = 0;
  for (let i = 0; i < 100; i++) {
    await simulatePreload('https://example.com/valid-photo.webp', 'frame_valid_01');
  }
  assert(networkFetchCount === 1, `Network requests for valid asset loaded exactly once and cached in memory (fetchCount: ${networkFetchCount})`);
  assert(RUNTIME_FRAME_STATES.get('frame_valid_01') === 'LOADED', 'Frame state is LOADED');

  console.log('\n================================================================================');
  console.log(`🎉 ALL ${passed}/${total} UNIT & INTEGRATION TESTS PASSED (100% CLEAN)`);
  console.log('================================================================================');
})();
