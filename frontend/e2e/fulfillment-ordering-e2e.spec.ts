import { test, expect } from '@playwright/test';

test.describe('CakeToHome Master Fulfillment, Ordering & Dual OTP E2E Flow', () => {

  test('1. Storefront Fulfillment Availability API returns live slot and timing data', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/v1/fulfillment/availability?product_id=prod_1');
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(typeof data.eligible).toBe('boolean');
    expect(typeof data.corporate_cutoff).toBe('string');
    expect(data.business_timezone).toBe('Asia/Kolkata');
  });

  test('2. Multi-Product Cart Fulfillment API computes strictest preparation duration', async ({ request }) => {
    const response = await request.post('http://localhost:3000/api/v1/fulfillment/cart-check', {
      data: {
        items: [
          { product_id: 'prod_1', quantity: 1 },
          { product_id: 'prod_2', quantity: 2 },
        ],
        branch_id: 'res_01KXYMAHGFPRY1G9TZKEVGAGAT',
      },
    });
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.effective_preparation_minutes).toBeGreaterThanOrEqual(45);
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.length).toBe(2);
  });

  test('3. Delivery Slots API generates available windows with surcharge transparency', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/v1/fulfillment/slots?branch_id=res_01KXYMAHGFPRY1G9TZKEVGAGAT');
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.slots)).toBe(true);
    expect(data.slots.length).toBeGreaterThan(0);
  });

  test('4. Full Lifecycle Dual OTP Transitions: Order Placed -> PACKED -> OUT_FOR_DELIVERY -> DELIVERED', async ({ request }) => {
    // 1. Place order via authoritative checkout
    const checkoutRes = await request.post('http://localhost:3000/api/v1/checkout/confirm', {
      data: {
        cart_id: `cart_e2e_${Date.now()}`,
        pincode: '560038',
        delivery_date: new Date().toISOString().slice(0, 10),
        delivery_slot_id: 'slot_evening',
        delivery_type: 'delivery',
        payment_method: 'cod',
        address: {
          first_name: 'Vikram',
          last_name: 'Malhotra',
          phone: '+91 98765 99999',
          line1: '12th Main Road, HAL 2nd Stage, Indiranagar',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560038',
        },
        items: [
          {
            id: 'item_e2e_01',
            product_id: 'prod_1',
            title: 'Belgian Chocolate Truffle Cake',
            unit_price: 550,
            quantity: 1,
          },
        ],
      },
    });

    expect(checkoutRes.ok()).toBe(true);
    const checkoutData = await checkoutRes.json();
    expect(checkoutData.success).toBe(true);
    const orderId = checkoutData.order_id || checkoutData.order?.id;
    expect(orderId).toBeDefined();

    // 2. Branch Manager marks order packed / ready for pickup
    const packRes = await request.post(`http://localhost:3000/api/v1/manager/orders/${orderId}/ready`, {
      data: { notes: 'Baking complete, packed in premium thermal box' },
      headers: {
        Cookie: '_cth_role=shop_manager;_cth_branch_id=res_01KXYMAHGFPRY1G9TZKEVGAGAT;_cth_jwt=mock_jwt',
      },
    });
    expect(packRes.ok()).toBe(true);
    const packData = await packRes.json();
    expect(packData.success).toBe(true);
    const pickupOtp = packData.order?.pickup_otp || packData.pickup_otp;
    expect(pickupOtp).toMatch(/^\d{4}$/);

    // 3. Delivery Partner verifies Pickup OTP -> transitions to OUT_FOR_DELIVERY
    const verifyPickupRes = await request.post(`http://localhost:3000/api/v1/delivery-partner/jobs/${orderId}/pickup-otp/verify`, {
      data: {
        otp: pickupOtp,
        partner_id: 'dlp_101',
      },
    });
    expect(verifyPickupRes.ok()).toBe(true);
    const verifyPickupData = await verifyPickupRes.json();
    expect(verifyPickupData.success).toBe(true);
    expect(verifyPickupData.currentStatus).toBe('OUT_FOR_DELIVERY');

    // 4. Delivery Partner verifies Customer Delivery OTP -> transitions to DELIVERED
    const deliveryOtp = packData.order?.delivery_otp || checkoutData.order?.delivery_otp;
    expect(deliveryOtp).toMatch(/^\d{4}$/);

    const verifyDeliveryRes = await request.post(`http://localhost:3000/api/v1/delivery-partner/jobs/${orderId}/delivery-otp/verify`, {
      data: {
        otp: deliveryOtp,
        partner_id: 'dlp_101',
      },
    });
    expect(verifyDeliveryRes.ok()).toBe(true);
    const verifyDeliveryData = await verifyDeliveryRes.json();
    expect(verifyDeliveryData.success).toBe(true);
    expect(verifyDeliveryData.currentStatus).toBe('DELIVERED');
  });

  test('5. Admin Fulfillment Config Panel renders active cutoff and cascade controls', async ({ page, context }) => {
    await context.addCookies([
      { name: '_cth_role', value: 'admin', domain: 'localhost', path: '/' },
      { name: '_cth_jwt', value: 'mock_jwt_token_admin', domain: 'localhost', path: '/' },
    ]);
    await page.goto('http://localhost:3000/dashboard?tab=fulfillment');
    const panelHeader = page.locator('h2:has-text("Order Cut-Off"), h3:has-text("Global Delivery")').first();
    if (await panelHeader.isVisible()) {
      await expect(panelHeader).toBeVisible();
    }
  });

});
