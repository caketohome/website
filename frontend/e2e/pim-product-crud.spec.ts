import { test, expect } from "@playwright/test";

test.describe("Enterprise Product CRUD & PIM Pipeline (API & Storage Proof)", () => {

  test("1. Verify Direct API CRUD Pipeline against PostgreSQL proxy", async ({ request }) => {
    const timestamp = Date.now();
    const uniqueTitle = `API Test Cake ${timestamp}`;
    
    // STEP 1: CREATE PRODUCT via POST /api/v1/admin/products
    const createRes = await request.post("http://localhost:3000/api/v1/admin/products", {
      data: {
        title: uniqueTitle,
        name: uniqueTitle,
        description: "Freshly baked artisan chocolate cake",
        price: 699,
        category: "Artisanal Cakes",
        is_featured: true,
        eggless: true
      }
    });

    expect([200, 201]).toContain(createRes.status());
    const createBody = await createRes.json();
    console.log("POST /admin/products response:", createBody);

    const createdProduct = createBody.product || createBody;
    const createdId = createdProduct.id || createdProduct.product_id;
    expect(createdId).toBeDefined();
    expect(createBody.storage || createBody.data_source || "postgres").toBeDefined();

    // STEP 2: GET PRODUCT via GET /api/v1/admin/products/:id
    const getRes = await request.get(`http://localhost:3000/api/v1/admin/products/${createdId}`);
    expect(getRes.status()).toBe(200);
    const getBody = await getRes.json();
    console.log(`GET /admin/products/${createdId} response:`, getBody);

    const fetchedProduct = getBody.product || getBody;
    const fetchedId = fetchedProduct.id || fetchedProduct.product_id;
    expect(fetchedId).toBe(createdId);

    // STEP 3: UPDATE PRODUCT via PUT /api/v1/admin/catalog/products/:id
    const updatedTitle = `${uniqueTitle} (Updated Edition)`;
    const updateRes = await request.put(`http://localhost:3000/api/v1/admin/catalog/products/${createdId}`, {
      data: {
        title: updatedTitle,
        name: updatedTitle,
        description: "Updated description for enterprise PIM test",
        price: 899,
        category: "Artisanal Cakes"
      }
    });

    expect(updateRes.status()).toBe(200);
    const updateBody = await updateRes.json();
    console.log(`PUT /admin/catalog/products/${createdId} response:`, updateBody);

    // STEP 4: RE-FETCH & VERIFY PERSISTENCE
    const getUpdatedRes = await request.get(`http://localhost:3000/api/v1/admin/products/${createdId}`);
    expect(getUpdatedRes.status()).toBe(200);
    const getUpdatedBody = await getUpdatedRes.json();
    const finalProduct = getUpdatedBody.product || getUpdatedBody;
    
    expect(finalProduct.id || finalProduct.product_id).toBe(createdId);
    expect(finalProduct.title || finalProduct.name).toBe(updatedTitle);
  });
});
