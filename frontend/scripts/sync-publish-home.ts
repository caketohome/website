import { ApiEngine } from "../src/lib/api-engine";
import { getHomepage } from "../src/lib/data/cms";

async function main() {
  console.log("Publishing cmspg_home via ApiEngine.publishCmsPage...");
  const pubRes: any = await ApiEngine.publishCmsPage("cmspg_home");
  console.log("Publish result success:", pubRes.success);
  if (pubRes.errors) {
    console.error("Publish errors:", pubRes.errors);
  }

  const live = await getHomepage();
  const hero = live.sections.find((s: any) => s.type === "hero" || s.type === "scroll_frame" || s.type === "kitchen_story");
  console.log("Live Storefront Hero Sections count:", live.sections.length);
  console.log("Live Storefront Hero Desktop frames count:", hero?.config?.desktop?.frames?.length);
  if (hero?.config?.desktop?.frames?.length > 0) {
    console.log("Live Storefront Frame 01:", hero.config.desktop.frames[0].id, hero.config.desktop.frames[0].url.substring(0, 60));
  }
}

main().catch(console.error);
