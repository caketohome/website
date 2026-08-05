# 21 — Master Dependency Mapping Graph

## Storefront & Dashboard Component Dependency Matrix

| Frontend Component | Current API Path | Target API Path | Database Tables | Events Emitted | Migration Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Storefront Auth Modal** (`otp-login-form.tsx`) | `POST /store/auth/otp/*` | `POST /api/v1/auth/otp/*` | `customers`, `customer_phones`, `login_events` | `CustomerRegistered` | ✅ **Migrated** |
| **Customer Address Manager** (`address-manager.tsx`) | `GET/POST /store/customers/addresses` | `GET/POST /api/v1/customers/addresses` | `customer_addresses` | None | ✅ **Migrated** |
| **System Settings & Flags** (`use-settings.ts`) | `GET /store/settings` | `GET /api/v1/settings/feature-flags` | `settings` | None | ✅ **Migrated** |
| **Product Browse & Search** (`product-filters.tsx`) | `GET /store/products` | `GET /api/v1/products` | `products`, `product_meta`, `categories` | None | ⏳ **Pending (Phase 3)** |
| **Product Detail PDP** (`product-detail-client.tsx`) | `GET /store/products/:id` | `GET /api/v1/products/:id` | `products`, `product_reviews`, `wishlist` | `ProductViewed` | ⏳ **Pending (Phase 3)** |
| **Branch Switcher & Stock** (`shop-status.tsx`) | `GET /store/branches` | `GET /api/v1/branches` | `branches`, `branch_inventories` | `StockDepleted` | ⏳ **Pending (Phase 4)** |
| **Pincode Delivery Slot Widget** (`slot-picker.tsx`) | `POST /store/delivery/slots` | `GET /api/v1/delivery/slots` | `delivery_zones`, `delivery_slots` | None | ⏳ **Pending (Phase 5)** |
| **Cart & Custom Cake Options** (`cart-drawer.tsx`) | `POST /store/carts` | `POST /api/v1/carts` | `carts`, `cart_line_items` | `CartUpdated` | ⏳ **Pending (Phase 6)** |
| **Kitchen KDS Live Board** (`delivery-column.tsx`) | `GET /admin/orders` | `GET /api/v1/orders` | `orders`, `order_items`, `order_status_logs` | `OrderStatusUpdated` | ⏳ **Pending (Phase 7)** |
| **Driver Delivery Board** (`delivery-partner/page.tsx`)| `GET /admin/deliveries` | `GET /api/v1/deliveries` | `deliveries`, `delivery_partners` | `DeliveryClaimed` | ⏳ **Pending (Phase 7)** |
