import { ApiEngine } from "../src/lib/api-engine";

async function checkSize() {
  await ApiEngine.ensureHydrated();
  const page = ApiEngine.getCmsPage("cmspg_home");
  if (!page) {
    console.log("No cmspg_home found");
    return;
  }
  for (const [k, v] of Object.entries(page)) {
    const s = JSON.stringify(v);
    console.log(`${k}: ${(s ? s.length / 1024 : 0).toFixed(2)} KB`);
  }
  if (page.sections) {
    console.log(`\nSections (${page.sections.length}):`);
    page.sections.forEach((sec: any, i: number) => {
      console.log(`  [${i}] ${sec.id} (${sec.type}): ${(JSON.stringify(sec).length / 1024).toFixed(2)} KB`);
      if (sec.type === "hero") {
        for (const [k, v] of Object.entries(sec)) {
          console.log(`    hero.${k}: ${(JSON.stringify(v).length / 1024).toFixed(2)} KB`);
        }
        if (sec.config) {
          for (const [k, v] of Object.entries(sec.config)) {
            console.log(`      hero.config.${k}: ${(JSON.stringify(v).length / 1024).toFixed(2)} KB`);
          }
        }
      }

    });
  }

  if (page.version_history) {
    console.log(`\nVersion History (${page.version_history.length}):`);
    page.version_history.forEach((vh: any, i: number) => {
      console.log(`  [${i}] version ${vh.version}: ${(JSON.stringify(vh).length / 1024).toFixed(2)} KB`);
    });
  }
}

checkSize().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});

