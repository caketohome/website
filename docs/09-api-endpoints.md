# 09 — API Endpoints Registry

## Core API Specifications (Version 1 — `/api/v1`)

### 1. Auth & Customer Identity (`/api/v1/auth`, `/api/v1/customers`)
* `POST /api/v1/auth/otp/request` — Request 6-digit SMS OTP
* `POST /api/v1/auth/otp/verify` — Verify OTP, issue JWT, lazy-create customer
* `GET /api/v1/customers/me` — Retrieve logged-in customer profile
* `GET /api/v1/customers/addresses` — List customer delivery addresses
* `POST /api/v1/customers/addresses` — Add new customer delivery address
* `PATCH /api/v1/customers/addresses/:id` — Update customer delivery address
* `DELETE /api/v1/customers/addresses/:id` — Delete customer delivery address

### 2. Settings & Feature Flags (`/api/v1/settings`)
* `GET /api/v1/settings` — Get public system settings
* `GET /api/v1/settings/feature-flags` — Get active feature flags

### 3. Catalog, Products & Reviews (`/api/v1/products`)
* `GET /api/v1/products` — List / search products with filters
* `GET /api/v1/products/:id` — Get product detail PDP with metadata
* `GET /api/v1/products/:id/reviews` — List approved product reviews
* `POST /api/v1/products/:id/reviews` — Submit product review
* `GET /api/v1/wishlist` — List customer wishlist items
* `POST /api/v1/wishlist` — Add item to wishlist
* `DELETE /api/v1/wishlist/:id` — Remove item from wishlist

### 4. Branches & Multi-Shop Inventory (`/api/v1/branches`)
* `GET /api/v1/branches` — List all active bakery branches
* `GET /api/v1/branches/:id` — Get branch detail
* `GET /api/v1/branches/:id/inventory` — List branch 3-state inventory matrix
* `PATCH /api/v1/branches/:id/inventory` — Update branch item stock status

### 5. Delivery Zones & Slot Capacities (`/api/v1/delivery`)
* `POST /api/v1/delivery/serviceability` — Check pincode serviceability & fee
* `GET /api/v1/delivery/slots` — Get active hourly delivery slots for branch

### 6. Cart & Custom Cake Checkout (`/api/v1/carts`)
* `GET /api/v1/carts/:id` — Retrieve cart by ID
* `POST /api/v1/carts` — Create cart session
* `POST /api/v1/carts/:id/items` — Add line item with custom cake metadata
* `DELETE /api/v1/carts/:id/items/:line_id` — Remove line item

### 7. Orders & Kitchen KDS (`/api/v1/orders`)
* `GET /api/v1/orders` — List customer / branch orders
* `POST /api/v1/orders` — Place order (inventory lock & slot booking)
* `GET /api/v1/orders/:id` — Get order detail
* `PATCH /api/v1/orders/:id/status` — Transition KDS status (Pending $\rightarrow$ Accepted $\rightarrow$ Preparing $\rightarrow$ In-Transit $\rightarrow$ Delivered)
