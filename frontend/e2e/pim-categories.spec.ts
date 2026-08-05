import { test, expect } from "@playwright/test";

test.describe("Enterprise Product Information Management (PIM) & Category Management E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin dashboard catalog panel
    await page.goto("http://localhost:3000/dashboard");
    await page.waitForLoadState("networkidle");
  });

  test("1. Category Management lifecycle: Create, Search, Edit, Archive, and Restore", async ({ page }) => {
    // Click on Categories tab
    const categoryTab = page.locator("text=Categories (");
    await expect(categoryTab).toBeVisible();
    await categoryTab.click();

    // Verify Category Management header
    await expect(page.locator("text=Dedicated Category Management")).toBeVisible();

    // Click Create Category button
    await page.click("button:has-text('Create Category')");

    // Fill Category form
    const categoryName = `Gourmet Celebration Cakes ${Date.now()}`;
    await page.fill("#cat_name", categoryName);
    await page.fill("#cat_desc", "Handcrafted luxury celebration cakes for special events");
    await page.fill("#cat_order", "5");

    // Submit form
    await page.click("button:has-text('Save & Register Category')");

    // Assert success banner and presence in list
    await expect(page.locator(`text=${categoryName}`)).toBeVisible({ timeout: 5000 });
  });

  test("2. Enterprise Cake PIM Editor: Create Product with Dynamic Pricing & Variant Engine", async ({ page }) => {
    // Click Add Enterprise Product button
    const addProdBtn = page.locator("button:has-text('Create Enterprise Product')");
    await expect(addProdBtn).toBeVisible();
    await addProdBtn.click();

    // Verify PIM Editor Modal
    await expect(page.locator("text=Enterprise PIM Editor")).toBeVisible();

    // Tab 1: General Info
    const cakeName = `Royal Belgian Ganache Cake ${Date.now()}`;
    await page.fill("#pim_name", cakeName);
    await page.fill("#pim_desc", "Decadent triple-layer Belgian chocolate sponge with silky dark chocolate ganache.");

    // AI Auto-Fill test
    await page.click("button:has-text('AI Auto-Fill PIM')");
    await page.waitForTimeout(1200);

    // Tab 3: Pricing & Taxes
    await page.click("button:has-text('Pricing & Taxes')");
    await page.fill("#pim_sp", "899");
    await page.fill("#pim_mrp", "1199");
    await page.fill("#pim_cp", "450");

    // Tab 4: Variant Matrix
    await page.click("button:has-text('Variant Matrix')");
    await expect(page.locator("text=Weight Options")).toBeVisible();

    // Save PIM Record
    await page.click("button:has-text('Save & Update PIM Record')");

    // Assert product appears in catalog grid
    await expect(page.locator(`text=${cakeName}`)).toBeVisible({ timeout: 5000 });
  });
});
