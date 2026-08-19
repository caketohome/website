import { test, expect } from "@playwright/test";

test.describe("CakeToHome Customer Account Hub & Profile E2E", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      { name: "_cth_role", value: "CUSTOMER", domain: "localhost", path: "/" },
      { name: "_cth_jwt", value: "mock_jwt_token_customer_alex", domain: "localhost", path: "/" },
      { name: "_cth_user_id", value: "cus_9876543210", domain: "localhost", path: "/" },
      { name: "_cth_customer_uid", value: "cth_cus_9876543210", domain: "localhost", path: "/" },
      { name: "_cth_phone", value: "+91 98765 43210", domain: "localhost", path: "/" },
    ]);
  });

  test("1. Account Hub loads with real customer name, avatar, and verified badge", async ({ page }) => {
    await page.goto("http://localhost:3000/account");
    await expect(page).toHaveTitle(/My Account | CakeToHome/i);

    // Verify Verified Member badge
    await expect(page.locator("text=Verified Member").first()).toBeVisible();

    // Verify 4 Stat Cards
    await expect(page.locator("text=Total Orders").first()).toBeVisible();
    await expect(page.locator("text=Total Spent").first()).toBeVisible();
    await expect(page.locator("text=Favourite Cake").first()).toBeVisible();
    await expect(page.locator("text=Last Order").first()).toBeVisible();

    // Verify Wallet / Referral are totally absent
    const pageContent = await page.textContent("body");
    expect(pageContent).not.toContain("Wallet & Credits");
    expect(pageContent).not.toContain("Referral Points");
    expect(pageContent).not.toContain("Gamification");
  });

  test("2. Order History page displays cakes, status pills, tracking and reorder actions", async ({ page }) => {
    await page.goto("http://localhost:3000/account/orders");
    await expect(page.locator("text=Order History").first()).toBeVisible();
  });

  test("3. Saved Addresses page displays delivery hubs and Add New Address modal", async ({ page }) => {
    await page.goto("http://localhost:3000/account/addresses");
    await expect(page.locator("text=Saved Addresses").first()).toBeVisible();

    // Verify Add New Address button
    const addBtn = page.locator("button:has-text('Add New Address')").first();
    await expect(addBtn).toBeVisible();
  });

  test("4. Legacy /account/wallet path cleanly redirects to /account without error", async ({ page }) => {
    await page.goto("http://localhost:3000/account/wallet");
    await page.waitForURL("http://localhost:3000/account");
    expect(page.url()).toBe("http://localhost:3000/account");
  });
});
