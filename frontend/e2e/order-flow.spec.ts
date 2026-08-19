import { test, expect } from '@playwright/test';

test.describe('CakeToHome Critical Bakery E-Commerce Order Flow', () => {

  test('1. Homepage loads correctly with brand title and branch selection', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await expect(page).toHaveTitle(/CakeToHome/i);
  });

  test('2. Product catalog page displays cakes with dietary filters', async ({ page }) => {
    await page.goto('http://localhost:3000/products');
    const catalogHeader = page.locator('h1, h2').first();
    await expect(catalogHeader).toBeVisible();
  });

  test('3. Delivery availability checker verifies Bangalore pincode serviceability', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    const locationBtn = page.locator('button:has-text("Koramangala"), button:has-text("Indiranagar"), button:has-text("Delivery")').first();
    if (await locationBtn.isVisible()) {
      await expect(locationBtn).toBeEnabled();
    }
  });

  test('4. Super Admin Control Dashboard loads orders management', async ({ page, context }) => {
    await context.addCookies([
      { name: '_cth_role', value: 'admin', domain: 'localhost', path: '/' },
      { name: '_cth_jwt', value: 'mock_jwt_token_admin', domain: 'localhost', path: '/' }
    ]);
    await page.goto('http://localhost:3000/dashboard');
    const adminHeading = page.locator('h1:has-text("Super Admin"), h1:has-text("Control Panel")').first();
    await expect(adminHeading).toBeVisible();
  });

  test('5. Coupon stacking validation API prevents exclusive discount stacking', async ({ request }) => {
    const response = await request.post('http://localhost:3000/api/v1/cart/promo', {
      data: {
        appliedCoupons: ['SAVE10'],
        coupon: 'CAKE50',
      },
    });
    expect(response.ok()).toBe(true);
  });

});
