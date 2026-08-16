/**
 * Playwright Verification: Edit Staff Member with Multiple Profiles
 */

import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

const ARTIFACTS_DIR = "C:\\Users\\alexc\\.gemini\\antigravity-ide\\brain\\494e1f14-65a8-4093-9062-5bdf6f901811";

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await context.addCookies([
    { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
    { name: "role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
    { name: "c2h_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
    {
      name: "c2h_user",
      value: encodeURIComponent(
        JSON.stringify({
          id: "admin_01",
          user_id: "admin_01",
          phone: "+91 98765 00000",
          email: "admin@cakes2home.com",
          role: "SUPER_ADMIN",
          name: "Super Admin",
        })
      ),
      domain: "localhost",
      path: "/",
    },
  ]);

  const page = await context.newPage();
  page.on("dialog", async (dialog) => {
    console.log(`[Browser Alert]: "${dialog.message()}"`);
    await dialog.accept();
  });

  await page.goto("http://localhost:3000/dashboard?tab=staff_profiles", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Click on Staff Profiles Tab
  const staffTabBtn = page.getByRole("button", { name: /Staff Profiles/i }).first();
  if (await staffTabBtn.isVisible()) {
    await staffTabBtn.click();
    await page.waitForTimeout(1000);
  }

  // Find the Edit button for Aarav Sharma (or last staff row)
  console.log("Finding staff row for editing...");
  const editButtons = page.locator('button:has-text("Edit")');
  const count = await editButtons.count();
  console.log(`Found ${count} edit buttons. Clicking last one...`);
  
  if (count > 0) {
    await editButtons.nth(count - 1).click();
    await page.waitForTimeout(1000);

    const shotEditModal = path.join(ARTIFACTS_DIR, "staff_multiselect_04_edit_modal.png");
    await page.screenshot({ path: shotEditModal });
    console.log(`✓ Saved ${shotEditModal}`);

    // Interact with Multi-Select to remove Telecaller and add SEO Manager
    const combobox = page.locator('[role="combobox"]').first();
    await combobox.click();
    await page.waitForTimeout(600);

    const seoOption = page.locator('[role="option"]:has-text("SEO Manager")').first();
    if (await seoOption.isVisible()) {
      await seoOption.click();
      await page.waitForTimeout(300);
    }

    const doneBtn = page.getByRole("button", { name: "Done" }).first();
    if (await doneBtn.isVisible()) {
      await doneBtn.click();
      await page.waitForTimeout(400);
    }

    const saveBtn = page.getByRole("button", { name: "Save Staff Account" }).first();
    await saveBtn.click();
    await page.waitForTimeout(2000);

    const shotEditedTable = path.join(ARTIFACTS_DIR, "staff_multiselect_05_edited_table_view.png");
    await page.screenshot({ path: shotEditedTable });
    console.log(`✓ Saved ${shotEditedTable}`);
  }

  await browser.close();
}

main().catch((e) => console.error(e));
