import fs from "fs";
import path from "path";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runMobileOverflowTestSuite() {
  console.log("==================================================================");
  console.log("📱 CAKETOHOME — MOBILE VIEWPORT HORIZONTAL OVERFLOW AUDIT SUITE");
  console.log("==================================================================\n");

  const frontendDir = path.join(process.cwd(), "frontend", "src");

  // 1. AUDIT layout.tsx FOR RESPONSIVE BOUNDS
  console.log("--- STEP 1: AUDIT STOREFRONT ROOT LAYOUT ---");
  const layoutPath = path.join(frontendDir, "app", "(store)", "layout.tsx");
  const layoutContent = fs.readFileSync(layoutPath, "utf-8");

  assert(!layoutContent.includes("px-4 md:px-10 h-16 bg-[#111111] text-white justify-between items-center sticky top-0 z-40 border-b border-white/10 shadow-[0_4px_18px_rgba(0,0,0,0.25)]\">"), "Un-responsive header container fixed");
  assert(layoutContent.includes("px-3 sm:px-6 md:px-10"), "Header uses responsive horizontal padding");
  assert(layoutContent.includes("shrink-0"), "Brand logo link contains shrink-0 to prevent flex displacement");
  assert(layoutContent.includes("w-full max-w-full min-w-0 overflow-x-clip"), "Main container enforces w-full min-w-0 overflow-x-clip bounds");

  // 2. AUDIT delivery-location-header.tsx FOR DROPDOWN OVERFLOW
  console.log("\n--- STEP 2: AUDIT DELIVERY LOCATION HEADER POPUP ---");
  const locationHeaderPath = path.join(frontendDir, "components", "store", "location", "delivery-location-header.tsx");
  const locationHeaderContent = fs.readFileSync(locationHeaderPath, "utf-8");

  assert(!locationHeaderContent.includes("className=\"absolute left-0 mt-2 w-80 rounded-xl"), "Unbounded absolute left-0 w-80 popup fixed");
  assert(locationHeaderContent.includes("w-[calc(100vw-24px)]"), "Location popup uses responsive viewport-constrained width");
  assert(locationHeaderContent.includes("truncate max-w-[95px] sm:max-w-[170px]"), "Deliver to pincode text truncates safely on mobile");

  // 3. AUDIT ai-chat-assistant.tsx & whatsapp-support-button.tsx
  console.log("\n--- STEP 3: AUDIT FLOATING ASSISTANT & SUPPORT WIDGETS ---");
  const aiAssistantPath = path.join(frontendDir, "components", "store", "ai-chat-assistant.tsx");
  const aiAssistantContent = fs.readFileSync(aiAssistantPath, "utf-8");

  assert(!aiAssistantContent.includes("w-[360px] md:w-[400px]"), "Fixed w-[360px] AI Assistant popup width fixed");
  assert(aiAssistantContent.includes("w-[calc(100vw-24px)] max-w-[380px]"), "AI Assistant popup uses responsive calc width");

  const whatsappPath = path.join(frontendDir, "components", "store", "whatsapp-support-button.tsx");
  const whatsappContent = fs.readFileSync(whatsappPath, "utf-8");
  assert(whatsappContent.includes("w-[calc(100vw-24px)] max-w-72"), "WhatsApp Support popup uses responsive calc width");

  // 4. AUDIT footer.tsx FOR FLEX WRAP
  console.log("\n--- STEP 4: AUDIT FOOTER TEXT FLEX WRAPPING ---");
  const footerPath = path.join(frontendDir, "components", "common", "footer.tsx");
  const footerContent = fs.readFileSync(footerPath, "utf-8");

  assert(footerContent.includes("flex-wrap"), "Footer copyright text contains flex-wrap");
  assert(footerContent.includes("text-center") && footerContent.includes("justify-center"), "Footer text centers cleanly on mobile screens");

  // 5. AUDIT globals.css ROOT RULES
  console.log("\n--- STEP 5: AUDIT GLOBALS.CSS RESPONSIVE SYSTEM ---");
  const globalsCssPath = path.join(frontendDir, "app", "globals.css");
  const globalsCssContent = fs.readFileSync(globalsCssPath, "utf-8");

  assert(globalsCssContent.includes("box-sizing: border-box"), "Global box-sizing applied to all elements");
  assert(globalsCssContent.includes("max-width: 100%"), "Root html, body enforce max-width 100%");
  assert(globalsCssContent.includes("img, video"), "Global media rules constrain images and videos to max-width 100%");

  console.log("\n==================================================================");
  console.log("🎉 ALL MOBILE HORIZONTAL OVERFLOW AUDIT CHECKS PASSED!");
  console.log("==================================================================\n");
}

runMobileOverflowTestSuite().catch((err) => {
  console.error("❌ MOBILE OVERFLOW AUDIT SUITE FAILED:", err);
  process.exit(1);
});
