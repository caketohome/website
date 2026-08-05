# 22 — Master Module Registry

## Enterprise Domain Module Directory

### 1. Customers & Identity (`customers`)
* **Owner**: Auth Team
* **Dependencies**: None
* **Routes**: `POST /api/v1/auth/otp/request`, `POST /api/v1/auth/otp/verify`, `GET/POST/DELETE /api/v1/customers/addresses`
* **Database Tables**: `customers`, `customer_phones`, `customer_addresses`, `login_events`
* **Events Emitted**: `CustomerRegistered`, `CustomerLoggedIn`
* **Redis Keys**: `otp:rate:<phone>`, `otp:cooldown:<phone>`
* **BullMQ Queues**: `notification-queue` (SMS dispatch)
* **Permissions**: `customer`, `admin`
* **Status**: ✅ **Migrated & Verified**

### 2. Settings & Feature Flags (`settings`)
* **Owner**: Core Platform Team
* **Dependencies**: None
* **Routes**: `GET /api/v1/settings/feature-flags`, `GET /api/v1/settings/groups/:group`, `POST /api/v1/settings`
* **Database Tables**: `settings`
* **Events Emitted**: `SettingUpdated`
* **Redis Keys**: `cache:settings:<group>`
* **Permissions**: Public (`GET`), `admin` (`POST`)
* **Status**: ✅ **Migrated & Verified**

### 3. Catalog & Search (`catalog`)
* **Owner**: Commerce Team
* **Dependencies**: `settings`
* **Routes**: `GET /api/v1/products`, `GET /api/v1/products/:id`, `GET/POST /api/v1/products/:id/reviews`
* **Database Tables**: `products`, `product_meta`, `product_reviews`, `wishlist`
* **Events Emitted**: `ProductViewed`, `ReviewSubmitted`
* **Redis Keys**: `cache:product:<id>`, `cache:search:<query>`
* **Permissions**: Public (`GET`), `customer` (`POST`)
* **Status**: ⏳ **Pending (Phase 3)**

### 4. Branches & Multi-Shop Inventory (`branches`)
* **Owner**: Operations Team
* **Dependencies**: `catalog`
* **Routes**: `GET /api/v1/branches`, `GET/PATCH /api/v1/branches/:id/inventory`
* **Database Tables**: `branches`, `branch_inventories`
* **Events Emitted**: `StockDepleted`, `InventoryReserved`
* **Redis Keys**: `lock:inventory:<branch_id>:<variant_id>`
* **Permissions**: `shop_manager`, `admin`
* **Status**: ⏳ **Pending (Phase 4)**

### 5. Delivery Zones & Slot Capacity (`delivery`)
* **Owner**: Logistics Team
* **Dependencies**: `branches`
* **Routes**: `POST /api/v1/delivery/serviceability`, `GET /api/v1/delivery/slots`
* **Database Tables**: `delivery_zones`, `delivery_slots`
* **Events Emitted**: `SlotBooked`
* **Redis Keys**: `capacity:slot:<branch_id>:<date>:<slot_id>`
* **Permissions**: Public (`POST/GET`), `admin`
* **Status**: ⏳ **Pending (Phase 5)**

### 6. Cart & Custom Cake Checkout (`cart`)
* **Owner**: Checkout Team
* **Dependencies**: `catalog`, `branches`, `delivery`
* **Routes**: `GET/POST /api/v1/carts`, `POST /api/v1/carts/:id/items`
* **Database Tables**: `carts`, `cart_line_items`
* **Events Emitted**: `CartUpdated`
* **Redis Keys**: `cart:<cart_id>`
* **Permissions**: Customer / Guest Session
* **Status**: ⏳ **Pending (Phase 6)**

### 7. Orders & Kitchen KDS (`orders`)
* **Owner**: Operations & Kitchen Team
* **Dependencies**: `cart`, `branches`, `delivery`, `customers`
* **Routes**: `POST /api/v1/orders`, `GET/PATCH /api/v1/orders/:id/status`
* **Database Tables**: `orders`, `order_items`, `order_status_logs`
* **Events Emitted**: `OrderCreated`, `OrderStatusUpdated`
* **BullMQ Queues**: `kds-dispatch-queue`, `notification-queue`
* **Permissions**: `customer`, `shop_manager`, `delivery_partner`, `admin`
* **Status**: ⏳ **Pending (Phase 7)**
