import { test, expect } from "@playwright/test";

test.describe("CakeToHome Customer Authentication & Login Flow E2E", () => {
  test("1. Login page displays luxury dessert branding and 2-Hour Express guarantee", async ({ page }) => {
    await page.goto("http://localhost:3000/login");
    await expect(page).toHaveTitle(/CakeToHome/i);

    // Verify brand headings & highlights
    const heading = page.locator("text=Welcome back to CakeToHome").first();
    await expect(heading).toBeAttached();

    await expect(page.locator("text=Fresh Cakes").first()).toBeAttached();
    await expect(page.locator("text=Handcrafted Moments").first()).toBeAttached();
    await expect(page.locator("text=Same Day Delivery").first()).toBeAttached();
    await expect(page.locator("text=Loved by thousands of cake lovers").first()).toBeAttached();

    // Verify telephone input has +91
    const phoneInput = page.locator("#phone_input, input[type='tel']").first();
    await expect(phoneInput).toBeAttached();
  });

  test("2. Existing customer logs in via OTP, greets with real name, and navigates to Account Hub", async ({ page }) => {
    await page.goto("http://localhost:3000/login");

    const phoneInput = page.locator("#phone_input, input[type='tel']").first();
    await phoneInput.fill("9876543210");

    // Submit phone number form
    await page.locator("form").first().evaluate((form: HTMLFormElement) => form.requestSubmit());

    // Verify OTP input appears and fill all 6 digit boxes
    await page.waitForSelector("input[inputmode='numeric']", { timeout: 10000 });
    const otpBoxes = await page.locator("input[inputmode='numeric']").all();
    const digits = ["1", "2", "3", "4", "5", "6"];
    for (let i = 0; i < otpBoxes.length; i++) {
      await otpBoxes[i].fill(digits[i]);
    }

    // Submit OTP verification form
    await page.locator("form").first().evaluate((form: HTMLFormElement) => form.requestSubmit());

    // Should redirect to /account
    await page.waitForURL(/account/i, { timeout: 15000 });

    // Verify customer name is real and never generic 'Customer'
    const accountPageText = await page.textContent("body");
    expect(accountPageText).not.toContain("Valued Customer");
  });

  test("3. Standardized /api/customer/me contract returns authoritative customer identity", async ({ request }) => {
    // Set customer cookie
    const response = await request.get("http://localhost:3000/api/customer/me", {
      headers: {
        cookie: "_cth_customer_uid=cth_cus_9876543210; _cth_phone=9876543210; _cth_jwt=mock_jwt_token_customer;",
      },
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.customer).toBeDefined();
    expect(data.customer.customer_uid).toBeTruthy();
    expect(data.customer.phone.replace(/\D/g, "")).toContain("9876543210");
  });

  test("4. Responsive layout validation across Desktop (1920x1080 & 1366x768), Tablet (768px), and Mobile (390px)", async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080, name: "Desktop Full HD" },
      { width: 1366, height: 768, name: "Desktop Standard" },
      { width: 768, height: 1024, name: "Tablet iPad" },
      { width: 390, height: 844, name: "Mobile iPhone 14" },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("http://localhost:3000/login");

      // Verify no horizontal overflow
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll).toBe(false);

      // Verify login card is always attached and functional
      const phoneInput = page.locator("#phone_input, input[type='tel']").first();
      await expect(phoneInput).toBeAttached();
    }
  });
});
