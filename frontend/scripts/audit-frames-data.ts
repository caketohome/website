import { getHomepage } from "../src/lib/data/cms";

async function main() {
  const homeData = await getHomepage();
  const hero = homeData.sections.find((s: any) => s.type === "hero" || s.id === "sec_home_hero");

console.log("================================================================================");
console.log("🔍 AUDITING CMS FRAME DATA QUALITY & ASSETS");
console.log("================================================================================");

const desktopFrames = hero?.config?.desktop?.frames || [];
const tabletFrames = hero?.config?.tablet?.frames || [];
const mobileFrames = hero?.config?.mobile?.frames || [];

console.log(`\nDesktop frames count: ${desktopFrames.length}`);
console.log(`Tablet frames count: ${tabletFrames.length}`);
console.log(`Mobile frames count: ${mobileFrames.length}`);

console.log("\n--- DESKTOP FRAMES (16) ---");
desktopFrames.forEach((f: any, i: number) => {
  console.log(`[${String(i + 1).padStart(2, "0")}] seq: ${f.sequence} | filename: ${f.filename} | url: ${f.url}`);
});

console.log("\n--- TABLET FRAMES (12) ---");
tabletFrames.forEach((f: any, i: number) => {
  console.log(`[${String(i + 1).padStart(2, "0")}] seq: ${f.sequence} | filename: ${f.filename} | url: ${f.url}`);
});

console.log("\n--- MOBILE FRAMES (10) ---");
mobileFrames.forEach((f: any, i: number) => {
  console.log(`[${String(i + 1).padStart(2, "0")}] seq: ${f.sequence} | filename: ${f.filename} | url: ${f.url}`);
});
}

main().catch(console.error);
