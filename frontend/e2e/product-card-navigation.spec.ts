import { test, expect } from '@playwright/test';

test.describe('Homepage Product Card Navigation E2E', () => {
  test('Clicking a product card on homepage navigates to details page and back', async ({ page }) => {
    // 1. Open homepage
    await page.goto('http://localhost:3000/');
    await expect(page).toHaveURL('http://localhost:3000/');

    // 2. Locate first product card and click image/title
    const firstProductCard = page.locator('div.group.cursor-pointer').first();
    await expect(firstProductCard).toBeVisible();

    const productTitle = await firstProductCard.locator('h3').innerText();
    expect(productTitle.length).toBeGreaterThan(0);

    // 3. Click the product card
    await firstProductCard.click();

    // 4. Verify URL changed to /products/...
    await expect(page).toHaveURL(/\/products\/.+/);

    // 5. Verify product details page content loaded
    await expect(page.locator('h1, h2, h3').filter({ hasText: productTitle }).first()).toBeVisible();

    // 6. Verify back navigation returns to homepage
    await page.goBack();
    await expect(page).toHaveURL('http://localhost:3000/');
  });
});
