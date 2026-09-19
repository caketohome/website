# Checkpoint 05: Database-Backed Product Merchandising Sections

> **Phase**: Phase 5  
> **Status**: PENDING

---

## Scope & Objectives
1. Upgrade `product_grid` / `best_sellers` / `featured_products` / `new_arrivals` inside `PageRenderer` with luxury product card styling.
2. Maintain strict DB price authority: `selling_price`, `mrp`, and discount badge from PostgreSQL `ProductRepository`.
3. Preserve branch inventory and stock badges via `InventoryService.getBatchStock`.
4. Ensure `resolveProducts(config, allProducts)` handles dynamic selection (`best_sellers`, `featured`, `category`, `manual`).
5. Zero hardcoded prices.
