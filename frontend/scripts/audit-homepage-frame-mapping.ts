import { getHomepage, getCmsPage } from "../src/lib/data/cms";
import { ApiEngine } from "../src/lib/api-engine";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

async function runAudit() {
  console.log("================================================================================");
  console.log("🔍 CAKETOHOME — HOMEPAGE FRAME MAPPING AUDIT (ALL LAYERS)");
  console.log("================================================================================\n");

  // 1. Raw DB Store File
  const dbPath = join(process.cwd(), "data", "db-store.json");
  let dbCmsPages: any[] = [];
  if (existsSync(dbPath)) {
    try {
      const raw = JSON.parse(readFileSync(dbPath, "utf-8"));
      dbCmsPages = raw.cms_pages || [];
    } catch (e: any) {
      console.error("Failed to read db-store.json:", e.message);
    }
  }

  const rawHomeDb = dbCmsPages.find((p: any) => p.id === "cmspg_home" || p.slug === "home");
  console.log("1. DATABASE PERSISTENCE (data/db-store.json):");
  if (!rawHomeDb) {
    console.log("   ❌ cmspg_home NOT FOUND in db-store.json!");
  } else {
    console.log(`   Page ID: ${rawHomeDb.id} | Slug: ${rawHomeDb.slug} | Status: ${rawHomeDb.status}`);
    console.log(`   Updated At: ${rawHomeDb.updated_at} | Published At: ${rawHomeDb.published_at}`);
    
    // Check raw sections
    const rawHeroSection = (rawHomeDb.sections || []).find((s: any) => s.type === "hero" || s.id === "sec_home_hero");
    const rawPubHeroSection = (rawHomeDb.published_config?.sections || []).find((s: any) => s.type === "hero" || s.id === "sec_home_hero");
    
    console.log(`   Draft Sections Count: ${(rawHomeDb.sections || []).length}`);
    console.log(`   Published Config Sections Count: ${(rawHomeDb.published_config?.sections || []).length}`);
    
    if (rawHeroSection) {
      const df = rawHeroSection.config?.desktop?.frames || [];
      console.log(`   [Draft db] Hero Section ID: ${rawHeroSection.id} | Type: ${rawHeroSection.type} | Desktop frames: ${df.length}`);
      if (df.length > 0) {
        console.log(`      Frame 01: id=${df[0].id} url=${df[0].url.substring(0, 80)}...`);
      }
    }
    if (rawPubHeroSection) {
      const pf = rawPubHeroSection.config?.desktop?.frames || [];
      console.log(`   [Published db] Hero Section ID: ${rawPubHeroSection.id} | Type: ${rawPubHeroSection.type} | Desktop frames: ${pf.length}`);
      if (pf.length > 0) {
        console.log(`      Frame 01: id=${pf[0].id} url=${pf[0].url.substring(0, 80)}...`);
      }
    }
  }

  // 2. ApiEngine In-Memory Store
  console.log("\n2. API ENGINE IN-MEMORY STORE:");
  const apiPages = ApiEngine.listCmsPages();
  const apiHome = ApiEngine.getCmsPage("home");
  if (!apiHome) {
    console.log("   ❌ ApiEngine.getCmsPage('home') returned null!");
  } else {
    console.log(`   Page ID: ${apiHome.id} | Status: ${apiHome.status}`);
    const apiDraftHero = (apiHome.sections || []).find((s: any) => s.type === "hero" || s.id === "sec_home_hero");
    const apiPubHero = (apiHome.published_config?.sections || []).find((s: any) => s.type === "hero" || s.id === "sec_home_hero");
    
    if (apiDraftHero) {
      const df = apiDraftHero.config?.desktop?.frames || [];
      console.log(`   [ApiEngine Draft] Hero Section ID: ${apiDraftHero.id} | Desktop frames: ${df.length}`);
      if (df.length > 0) {
        console.log(`      Frame 01: id=${df[0].id} url=${df[0].url.substring(0, 80)}...`);
      }
    }
    if (apiPubHero) {
      const pf = apiPubHero.config?.desktop?.frames || [];
      console.log(`   [ApiEngine Published] Hero Section ID: ${apiPubHero.id} | Desktop frames: ${pf.length}`);
      if (pf.length > 0) {
        console.log(`      Frame 01: id=${pf[0].id} url=${pf[0].url.substring(0, 80)}...`);
      }
    }
  }

  // 3. Homepage Storefront API (getHomepage)
  console.log("\n3. CANONICAL HOMEPAGE STOREFRONT API (getHomepage):");
  const homepageData = await getHomepage();
  console.log(`   Page status: ${homepageData.page?.status} | Sections count: ${homepageData.sections.length}`);
  const storeHero = homepageData.sections.find((s: any) => s.type === "hero" || s.id === "sec_home_hero");
  if (!storeHero) {
    console.log("   ❌ No hero section found in getHomepage() output!");
  } else {
    console.log(`   Hero Section ID: ${storeHero.id} | Type: ${storeHero.type}`);
    console.log(`   disable_scroll_sequence: ${storeHero.config?.disable_scroll_sequence}`);
    console.log(`   bg_image: ${storeHero.config?.bg_image}`);
    console.log(`   desktop config present: ${!!storeHero.config?.desktop}`);
    const df = storeHero.config?.desktop?.frames || [];
    const tf = storeHero.config?.tablet?.frames || [];
    const mf = storeHero.config?.mobile?.frames || [];
    console.log(`   Desktop frames count: ${df.length}`);
    console.log(`   Tablet frames count: ${tf.length}`);
    console.log(`   Mobile frames count: ${mf.length}`);

    console.log("\n--- DETAILED FRAME COMPARISON ACROSS ALL 16 DESKTOP FRAMES ---");
    for (let i = 0; i < Math.max(df.length, 16); i++) {
      const frame = df[i];
      if (frame) {
        console.log(`FRAME ${(i + 1).toString().padStart(2, "0")}: seq=${frame.sequence} id=${frame.id} url=${frame.url.substring(0, 70)}...`);
      } else {
        console.log(`FRAME ${(i + 1).toString().padStart(2, "0")}: MISSING`);
      }
    }
  }

  console.log("\n================================================================================");
}

runAudit().catch(console.error);
