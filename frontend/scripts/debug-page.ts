import { chromium } from "playwright";

async function checkPage() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  
  await context.addCookies([
    { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
    { name: "_cth_jwt", value: "mock_admin_jwt_token_super_admin_2026", domain: "localhost", path: "/" },
  ]);

  const page = await context.newPage();
  await page.goto("http://localhost:3000/dashboard?tab=branches", { waitUntil: "networkidle" });
  
  console.log("Current URL:", page.url());
  const title = await page.title();
  console.log("Page Title:", title);
  
  const buttons = await page.$$eval("button", (elems) => elems.map((e) => ((e as HTMLElement).innerText || e.textContent || "").trim()).filter(Boolean));
  console.log("Buttons on page:", buttons);
  
  const headings = await page.$$eval("h1, h2, h3, h4", (elems) => elems.map((e) => ((e as HTMLElement).innerText || e.textContent || "").trim()).filter(Boolean));
  console.log("Headings on page:", headings);

  await browser.close();
}

checkPage();
