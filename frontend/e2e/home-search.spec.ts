import { test, expect } from "@playwright/test";

test.describe("CakeToHome Home Page Search Experience E2E", () => {
  test("1. Search button is accessible in desktop and mobile header navigation", async ({ page }) => {
    await page.goto("http://localhost:3000/");

    // Check search button presence with accessible aria-label
    const searchBtn = page.locator("button[aria-label='Search products']").first();
    await expect(searchBtn).toBeVisible();

    // Verify search modal opens on click
    await searchBtn.click();
    const searchModal = page.locator("[role='dialog'][aria-label='Product Search Modal']");
    await expect(searchModal).toBeVisible();

    // Verify input is auto-focused
    const searchInput = searchModal.locator("input[aria-label='Search products']");
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeFocused();

    // Verify ESC closes the modal
    await page.keyboard.press("Escape");
    await expect(searchModal).not.toBeVisible();
  });

  test("2. Debounced live search displays real matching cakes and navigates to product detail", async ({ page }) => {
    await page.goto("http://localhost:3000/");

    const searchBtn = page.locator("button[aria-label='Search products']").first();
    await searchBtn.click();

    const searchModal = page.locator("[role='dialog'][aria-label='Product Search Modal']");
    const searchInput = searchModal.locator("input[aria-label='Search products']");

    // Type query "chocolate"
    await searchInput.fill("chocolate");

    // Wait for live search results to render
    const resultsContainer = searchModal.locator("a[href^='/products/']");
    await expect(resultsContainer.first()).toBeVisible({ timeout: 10000 });

    // Verify product card information is present
    const firstResult = resultsContainer.first();
    const resultText = await firstResult.textContent();
    expect(resultText?.toLowerCase()).toContain("chocolate");
    expect(resultText).toContain("₹");

    // Click product and verify navigation to /products/*
    await firstResult.click();
    await page.waitForURL(/\/products\//, { timeout: 10000 });
  });

  test("3. Search shortcut (Ctrl+K / Cmd+K) and full search page navigation", async ({ page }) => {
    await page.goto("http://localhost:3000/");

    // Trigger keyboard shortcut
    await page.keyboard.press("Control+k");
    const searchModal = page.locator("[role='dialog'][aria-label='Product Search Modal']");
    await expect(searchModal).toBeVisible();

    const searchInput = searchModal.locator("input[aria-label='Search products']");
    await searchInput.fill("truffle");

    // Press Enter to submit full search query
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/search\?q=truffle/, { timeout: 10000 });

    // Verify full search page renders results
    await expect(page.locator("body")).toContainText("truffle", { ignoreCase: true });
  });

  test("4. Empty query suggestions and no-results graceful states", async ({ page }) => {
    await page.goto("http://localhost:3000/");

    const searchBtn = page.locator("button[aria-label='Search products']").first();
    await searchBtn.click();

    const searchModal = page.locator("[role='dialog'][aria-label='Product Search Modal']");

    // Popular suggestions must be visible when query is empty
    await expect(searchModal.locator("text=Popular Searches")).toBeVisible();
    await expect(searchModal.locator("button:has-text('Chocolate Truffle')")).toBeVisible();

    // Type non-existent query
    const searchInput = searchModal.locator("input[aria-label='Search products']");
    await searchInput.fill("xyznonexistentcake9999");

    // Verify empty state is displayed
    await expect(searchModal.locator("text=No cakes found for")).toBeVisible({ timeout: 10000 });
  });
});
