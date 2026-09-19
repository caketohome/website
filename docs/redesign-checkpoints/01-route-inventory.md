# Checkpoint 01 — Route Inventory

- **Checkpoint ID**: `CP-01-ROUTE-INVENTORY`
- **Date**: 2026-09-11
- **Current Phase**: Phase 1 — Current-State Audit
- **Objective**: Exhaustively inventory and categorize every customer, checkout, account, and operational route across CakeToHome.
- **Risk Level**: LOW (Documentation & Audit)

---

## 1. Route Inventory Overview

| Category | Route Count | Primary Storage Authority |
| :--- | :--- | :--- |
| **Customer Storefront & Discovery** | 19 routes | PostgreSQL (`cms_page`, `product`, `product_category`, `offer`, `city`) |
| **Cart & Checkout** | 3 routes | PostgreSQL (`cart`, `order`, `price`, `tax_rate`) |
| **Customer Account & Portal** | 7 routes | PostgreSQL (`customer`, `customer_address`, `order`, `rewards_wallet`) |
| **Admin & Operational Console** | 4 routes (22 panels) | PostgreSQL (`order`, `branch`, `delivery_partner`, `setting`, `cms_page`, etc.) |
| **PWA & Offline** | 1 route | Service Worker cache + fallback UI |
| **Total Distinct Routes** | **34 routes** | **100% PostgreSQL Source of Truth** |

---

## 2. Exhaustive Route-by-Route Specification

### 1. Storefront Homepage
- **Route**: `/`
- **File**: `frontend/src/app/(store)/page.tsx`
- **Category**: Customer storefront
- **Purpose**: Primary customer entry point, brand introduction, hero scroll animation, signature collections, bestsellers, trust signals, and direct ordering.
- **Current UI**: Canonical `<PageRenderer>` rendering modular CMS sections (`hero`, `category_grid`, `product_grid`, `occasions_grid`, `brand_story`, `features`, `custom_cake_cta`, `testimonials`, `cta`).
- **Data Source**: PostgreSQL `cms_page` (slug: `home`), `product`, `product_category`, `offer`.
- **API Endpoint**: Server Component direct data layer `getHomepage()`, `listProducts()`, `listPimCategories()`.
- **Service**: `CmsService`, `ProductService`.
- **Repository**: `CmsRepository`, `ProductRepository`.
- **Database Tables**: `cms_page`, `product`, `product_category`, `price`, `offer`.
- **Permissions**: Public (guest and authenticated).
- **Loading State**: Next.js streaming skeleton / suspense fallback.
- **Empty State**: Fallback catalog `<StorefrontProductHomepage>`.
- **Error State**: Root `error.tsx` boundary with graceful recovery.
- **Mobile Behaviour**: Responsive single-column cards, touch carousel, mobile-optimized canvas viewport with 44px tap targets.
- **SEO Requirements**: SSR meta title, Open Graph image, JSON-LD Organization & WebSite schema.
- **CMS Dependency**: 100% CMS-driven from `cms_page.published_config`.
- **Known Issues**: CMS Page Builder previously had limited editorial controls for hero fallback.
- **Status**: `PRODUCTION-READY`

### 2. Product Catalog
- **Route**: `/products`
- **File**: `frontend/src/app/(store)/products/page.tsx`
- **Category**: Product discovery
- **Purpose**: Browse full patisserie catalog with multifaceted filtering (category, dietary/eggless, occasion, price range, flavor, weight).
- **Current UI**: Sticky filter sidebar, responsive product grid, sort dropdown, quick-view drawer.
- **Data Source**: PostgreSQL `product`, `product_category`, `price`, `product_variant`.
- **API Endpoint**: Direct SSR `listProducts({ branchId, pincode, category, search })` + Client `/api/v1/products`.
- **Service**: `ProductService`.
- **Repository**: `ProductRepository`.
- **Database Tables**: `product`, `product_variant`, `price`, `product_category_product`.
- **Permissions**: Public.
- **Loading State**: Grid card skeletons.
- **Empty State**: "No confections match your filters" with clear filter reset button.
- **Error State**: Error card with reload trigger.
- **Mobile Behaviour**: Slide-over filter sheet, 2-column card grid.
- **SEO Requirements**: Dynamic canonical URL, `CollectionPage` structured data.
- **CMS Dependency**: Optional promo banner injection at top.
- **Known Issues**: None.
- **Status**: `PRODUCTION-READY`

### 3. Product Detail Page (PDP)
- **Route**: `/products/[id]`
- **File**: `frontend/src/app/(store)/products/[id]/page.tsx`
- **Category**: Product detail
- **Purpose**: High-intent product showcase, gallery, weight selection, cake message personalization, delivery date/time slot eligibility, and add-to-cart.
- **Current UI**: Dual-column layout (gallery left, purchase controls right), weight selector pills, message input, pincode delivery checker.
- **Data Source**: PostgreSQL `product`, `product_variant`, `product_option`, `price`.
- **API Endpoint**: Server Component `getProduct(id)` + `/api/v1/products/[id]`.
- **Service**: `ProductService`, `DeliveryService`.
- **Repository**: `ProductRepository`, `BranchRepository`.
- **Database Tables**: `product`, `product_variant`, `product_option_value`, `price`, `branch_inventory`.
- **Permissions**: Public.
- **Loading State**: Shimmer skeleton of image gallery and price card.
- **Empty State**: Product not found 404 screen with recommended alternatives.
- **Error State**: Controlled error alert with retry button.
- **Mobile Behaviour**: Sticky bottom purchase bar with price and "Add to Cart" button.
- **SEO Requirements**: `Product` schema with real-time price, availability, and high-res image gallery.
- **CMS Dependency**: CMS-configured related product carousels.
- **Known Issues**: None; PIM attributes are strictly database-backed.
- **Status**: `PRODUCTION-READY`

### 4. Category Landing Page
- **Route**: `/category/[slug]`
- **File**: `frontend/src/app/(store)/category/[slug]/page.tsx`
- **Category**: Category
- **Purpose**: Curated category showcase (e.g. Designer Cakes, Cheesecakes, Pastries, Cupcakes).
- **Current UI**: Hero category banner, breadcrumbs, filtered product grid.
- **Data Source**: PostgreSQL `product_category`, `product`, `price`.
- **API Endpoint**: `getCategoryBySlug(slug)` $\rightarrow$ `listProducts({ category: slug })`.
- **Service**: `ProductService`.
- **Repository**: `ProductRepository`.
- **Database Tables**: `product_category`, `product`, `price`.
- **Permissions**: Public.
- **Loading State**: Shimmer cards.
- **Empty State**: "New creations coming soon to this category".
- **Error State**: Graceful fallback to `/products`.
- **Mobile Behaviour**: Sticky category pill selector, 2-column grid.
- **SEO Requirements**: Unique category meta description and Breadcrumb schema.
- **CMS Dependency**: Category header banner can be customized via CMS.
- **Status**: `PRODUCTION-READY`

### 5. Occasion Discovery
- **Route**: `/occasions/[slug]`
- **File**: `frontend/src/app/(store)/occasions/[slug]/page.tsx`
- **Category**: Occasion
- **Purpose**: Emotion-led shopping for Birthdays, Anniversaries, Weddings, Romantic milestones, and Corporate events.
- **Current UI**: Themed header with celebration styling, occasion filter pills, occasion-specific cake catalog.
- **Data Source**: PostgreSQL `product`, `tag`, `setting`.
- **API Endpoint**: `listProducts({ occasion: slug })`.
- **Service**: `ProductService`.
- **Repository**: `ProductRepository`.
- **Database Tables**: `product`, `product_tag`, `price`.
- **Permissions**: Public.
- **Loading State**: Festive card skeletons.
- **Empty State**: Alternative occasion suggestions.
- **Error State**: Error banner.
- **Mobile Behaviour**: Touch carousel for quick occasion switching.
- **SEO Requirements**: Event/Occasion gift landing page metadata.
- **CMS Dependency**: CMS-driven occasion curation.
- **Status**: `PRODUCTION-READY`

### 6. Search Results
- **Route**: `/search`
- **File**: `frontend/src/app/(store)/search/page.tsx`
- **Category**: Search
- **Purpose**: Real-time product search with keyword matching, typo tolerance, and category suggestions.
- **Current UI**: Search input bar, active query indicator, product grid.
- **Data Source**: PostgreSQL `product` ILIKE and full-text index.
- **API Endpoint**: `/api/v1/products?q=[query]`.
- **Service**: `ProductService`.
- **Repository**: `ProductRepository`.
- **Database Tables**: `product`, `price`.
- **Permissions**: Public.
- **Loading State**: Grid skeleton.
- **Empty State**: "No cakes match your query" with top 5 bestsellers recommendations.
- **Error State**: Search error alert.
- **Mobile Behaviour**: Full-width search bar with clear icon.
- **SEO Requirements**: `noindex, follow` on dynamic query parameter pages.
- **CMS Dependency**: None.
- **Status**: `PRODUCTION-READY`

### 7. Cart
- **Route**: `/cart`
- **File**: `frontend/src/app/(store)/cart/page.tsx`
- **Category**: Cart
- **Purpose**: Review selected cakes, quantity adjust, message preview/edit, add-on upsells (candles, greeting cards), delivery estimate.
- **Current UI**: List of cart line items, weight/variant tag, message modal trigger, order summary card.
- **Data Source**: PostgreSQL `cart`, `cart_line_item`, `price`.
- **API Endpoint**: `/api/v1/cart`.
- **Service**: `OrderService`.
- **Repository**: `OrderRepository`.
- **Database Tables**: `cart`, `cart_line_item`, `price`.
- **Permissions**: Public (session cookie).
- **Loading State**: Skeleton item list.
- **Empty State**: Empty cart illustration with "Discover Signature Cakes" CTA.
- **Error State**: Inline item alert if stock changes.
- **Mobile Behaviour**: Compact line item cards, fixed bottom checkout button.
- **SEO Requirements**: `noindex, nofollow`.
- **CMS Dependency**: Cross-sell carousel can be managed in CMS.
- **Status**: `PRODUCTION-READY`

### 8. Checkout
- **Route**: `/checkout`
- **File**: `frontend/src/app/(checkout)/checkout/page.tsx`
- **Category**: Checkout
- **Purpose**: Multi-step checkout: Customer Contact $\rightarrow$ Delivery Address & Pincode $\rightarrow$ Slot Selection $\rightarrow$ Payment method.
- **Current UI**: Accordion/stepped checkout form, real-time pincode validation, Razorpay integration, live summary.
- **Data Source**: PostgreSQL `cart`, `customer`, `branch`, `delivery_zone`, `tax_rate`.
- **API Endpoint**: `/api/v1/checkout`, `/api/v1/orders`.
- **Service**: `OrderService`, `DeliveryService`.
- **Repository**: `OrderRepository`, `CustomerRepository`, `BranchRepository`.
- **Database Tables**: `cart`, `customer_address`, `order`, `branch`, `delivery_zone`.
- **Permissions**: Public (guest checkout supported with phone OTP).
- **Loading State**: Step loading spinner.
- **Empty State**: Redirect to `/cart` if cart is empty.
- **Error State**: Highlighted form field errors, payment retry banner.
- **Mobile Behaviour**: Mobile-first single column, sticky step navigation.
- **SEO Requirements**: `noindex, nofollow`.
- **CMS Dependency**: None (pure transactional workflow).
- **Status**: `PRODUCTION-READY`

### 9. Order Confirmation
- **Route**: `/your-order`
- **File**: `frontend/src/app/(checkout)/your-order/page.tsx`
- **Category**: Payment & confirmation
- **Purpose**: Display verified order receipt, order ID, delivery time slot, payment status, and live tracking link.
- **Current UI**: Luxury celebration banner, order summary, tracking timeline, invoice download.
- **Data Source**: PostgreSQL `order`, `order_line_item`, `delivery`.
- **API Endpoint**: `/api/v1/orders/[id]`.
- **Service**: `OrderService`.
- **Repository**: `OrderRepository`.
- **Database Tables**: `order`, `order_status_history`, `payment_transaction`.
- **Permissions**: Customer session or order token.
- **Loading State**: Celebration shimmer.
- **Empty State**: Order not found error.
- **Error State**: Customer support hotline trigger.
- **Mobile Behaviour**: Card-based receipt with WhatsApp share button.
- **SEO Requirements**: `noindex, nofollow`.
- **CMS Dependency**: None.
- **Status**: `PRODUCTION-READY`

### 10. Live Order Tracking
- **Route**: `/track`
- **File**: `frontend/src/app/(store)/track/page.tsx`
- **Category**: Order tracking
- **Purpose**: Real-time status lookup (Received $\rightarrow$ Baking in Kitchen $\rightarrow$ Quality Checked $\rightarrow$ Out in Chilled Fleet $\rightarrow$ Delivered).
- **Current UI**: Order lookup form (Phone + Order Number), step progress bar, delivery driver details.
- **Data Source**: PostgreSQL `order`, `order_status_history`, `delivery`.
- **API Endpoint**: `/api/v1/orders/track`.
- **Service**: `OrderService`, `DeliveryService`.
- **Repository**: `OrderRepository`.
- **Database Tables**: `order`, `order_status_history`, `delivery_partner`.
- **Permissions**: Public (requires order number + phone match).
- **Loading State**: Step shimmer.
- **Empty State**: "Enter your order number to track".
- **Error State**: "No active order found with these credentials".
- **Mobile Behaviour**: Touch-friendly timeline with direct driver call trigger.
- **SEO Requirements**: Meta title "Track Your Cake Delivery".
- **CMS Dependency**: None.
- **Status**: `PRODUCTION-READY`

### 11. Customer Account Overview
- **Route**: `/account`
- **File**: `frontend/src/app/account/page.tsx`
- **Category**: Customer account
- **Purpose**: Manage personal profile, phone, saved addresses, view recent orders, loyalty points.
- **Current UI**: Sidebar navigation, summary statistics cards, recent order list.
- **Data Source**: PostgreSQL `customer`, `order`.
- **API Endpoint**: `/api/v1/customer/profile`.
- **Service**: `CustomerService`.
- **Repository**: `CustomerRepository`.
- **Database Tables**: `customer`, `customer_address`, `order`.
- **Permissions**: Authenticated customer.
- **Loading State**: Account skeleton.
- **Empty State**: Welcome card for new accounts.
- **Error State**: Session expiry modal.
- **Mobile Behaviour**: Tabbed navigation drawer.
- **SEO Requirements**: `noindex, nofollow`.
- **CMS Dependency**: None.
- **Status**: `PRODUCTION-READY`

### 12. Customer Order History
- **Route**: `/account/orders`
- **File**: `frontend/src/app/account/orders/page.tsx`
- **Category**: Customer account
- **Purpose**: Complete list of past orders with filter by status (Delivered, In Transit, Cancelled) and one-click re-order.
- **Current UI**: Order cards with item thumbnails, grand total, delivery date, view detail button.
- **Data Source**: PostgreSQL `order`.
- **API Endpoint**: `/api/v1/orders?customer_id=[id]`.
- **Service**: `OrderService`.
- **Repository**: `OrderRepository`.
- **Database Tables**: `order`.
- **Permissions**: Authenticated customer.
- **Loading State**: List skeleton.
- **Empty State**: "No past orders. Time to celebrate something delicious!"
- **Error State**: Error alert.
- **Mobile Behaviour**: Compact card feed.
- **SEO Requirements**: `noindex, nofollow`.
- **CMS Dependency**: None.
- **Status**: `PRODUCTION-READY`

### 13. Customer Order Detail
- **Route**: `/account/orders/[id]`
- **File**: `frontend/src/app/account/orders/[id]/page.tsx`
- **Category**: Customer account
- **Purpose**: Deep-dive into specific historical order: item customization, cake message, GST breakdown, invoice PDF.
- **Current UI**: Order metadata, full item breakdown, tax details, tracking timeline.
- **Data Source**: PostgreSQL `order`, `payment_transaction`.
- **API Endpoint**: `/api/v1/orders/[id]`.
- **Service**: `OrderService`.
- **Repository**: `OrderRepository`.
- **Database Tables**: `order`, `payment_audit_trail`.
- **Permissions**: Owner customer or Admin.
- **Loading State**: Detail shimmer.
- **Empty State**: Order not found.
- **Error State**: Permission error or server error.
- **Mobile Behaviour**: Stacked details with download invoice CTA.
- **SEO Requirements**: `noindex, nofollow`.
- **CMS Dependency**: None.
- **Status**: `PRODUCTION-READY`

### 14. Customer Address Book
- **Route**: `/account/addresses`
- **File**: `frontend/src/app/account/addresses/page.tsx`
- **Category**: Customer account
- **Purpose**: Add, edit, delete delivery addresses with pincode serviceability validation.
- **Current UI**: Address card grid, "Add Address" modal.
- **Data Source**: PostgreSQL `customer_address`.
- **API Endpoint**: `/api/v1/customer/addresses`.
- **Service**: `CustomerService`.
- **Repository**: `CustomerRepository`.
- **Database Tables**: `customer_address`.
- **Permissions**: Authenticated customer.
- **Loading State**: Address skeletons.
- **Empty State**: "No saved addresses yet".
- **Error State**: Validation banner.
- **Mobile Behaviour**: Touch cards with edit/delete actions.
- **SEO Requirements**: `noindex, nofollow`.
- **CMS Dependency**: None.
- **Status**: `PRODUCTION-READY`

### 15. Saved Wishlist
- **Route**: `/account/wishlist`
- **File**: `frontend/src/app/account/wishlist/page.tsx`
- **Category**: Customer account
- **Purpose**: Saved favorite cakes for upcoming celebrations.
- **Current UI**: Grid of favorited product cards with quick "Move to Cart".
- **Data Source**: PostgreSQL `customer_favorite`, `product`.
- **API Endpoint**: `/api/v1/customer/favorites`.
- **Service**: `CustomerService`, `ProductService`.
- **Repository**: `FavoriteRepository`, `ProductRepository`.
- **Database Tables**: `customer_favorite`, `product`, `price`.
- **Permissions**: Authenticated customer.
- **Loading State**: Card skeletons.
- **Empty State**: "Your wishlist is empty".
- **Error State**: Error alert.
- **Mobile Behaviour**: 2-column card grid.
- **SEO Requirements**: `noindex, nofollow`.
- **CMS Dependency**: None.
- **Status**: `PRODUCTION-READY`

### 16. Customer Loyalty & Credit Wallet
- **Route**: `/account/wallet`
- **File**: `frontend/src/app/account/wallet/page.tsx`
- **Category**: Customer account / Credit accounts
- **Purpose**: View store credits, referral cashback, transaction ledger, and auto-applied checkout balance.
- **Current UI**: Digital wallet card with balance, transaction history table.
- **Data Source**: PostgreSQL `rewards_wallet`, `rewards_wallet_transaction`.
- **API Endpoint**: `/api/v1/customer/wallet`.
- **Service**: `CustomerService`.
- **Repository**: `CustomerRepository`.
- **Database Tables**: `rewards_wallet`.
- **Permissions**: Authenticated customer.
- **Loading State**: Balance shimmer.
- **Empty State**: Zero balance with referral invite trigger.
- **Error State**: Error banner.
- **Mobile Behaviour**: Card header with scrollable transaction list.
- **SEO Requirements**: `noindex, nofollow`.
- **CMS Dependency**: None.
- **Status**: `PRODUCTION-READY`

### 17. Subscriptions
- **Route**: `/account/subscriptions`
- **File**: `frontend/src/app/account/subscriptions/page.tsx`
- **Category**: Customer account
- **Purpose**: Recurring weekly/monthly bread, artisan pastry, or celebratory cake subscriptions.
- **Current UI**: Active subscriptions card, pause/resume controls, delivery frequency.
- **Data Source**: PostgreSQL `subscription`.
- **API Endpoint**: `/api/v1/customer/subscriptions`.
- **Service**: `CustomerService`.
- **Repository**: `CustomerRepository`.
- **Database Tables**: `subscription`.
- **Permissions**: Authenticated customer.
- **Loading State**: Shimmer.
- **Empty State**: "No active bakery subscriptions".
- **Error State**: Error alert.
- **Mobile Behaviour**: Mobile card list.
- **SEO Requirements**: `noindex, nofollow`.
- **CMS Dependency**: None.
- **Status**: `PRODUCTION-READY`

### 18. City Hub Storefront
- **Route**: `/city/[slug]`
- **File**: `frontend/src/app/(store)/city/[slug]/page.tsx`
- **Category**: Branch or store discovery / Delivery and pincode
- **Purpose**: Hyper-local city storefront (Bangalore, Mumbai, Delhi, Hyderabad) with localized branch delivery zones, local bestsellers, and serviceability.
- **Current UI**: City hero banner, serviceable pincode checker, city-specific product carousel, branch store locator.
- **Data Source**: PostgreSQL `city`, `branch`, `delivery_zone`, `product`.
- **API Endpoint**: `/api/v1/cities/[slug]`.
- **Service**: `DeliveryService`, `BranchRepository`.
- **Repository**: `CityRepository`, `BranchRepository`.
- **Database Tables**: `city`, `branch`, `delivery_zone`.
- **Permissions**: Public.
- **Loading State**: Shimmer hero and cards.
- **Empty State**: "Delivery expanding to this city soon".
- **Error State**: 404 city not found.
- **Mobile Behaviour**: Pincode search drawer.
- **SEO Requirements**: Local bakery SEO schema (LocalBusiness, GeoCoordinates).
- **CMS Dependency**: Local city banner configurable via CMS.
- **Status**: `PRODUCTION-READY`

### 19. Shop / Branch Specific Storefront
- **Route**: `/shop/[handle]`
- **File**: `frontend/src/app/(store)/shop/[handle]/page.tsx`
- **Category**: Branch or store discovery
- **Purpose**: Dedicated storefront for an individual bakery kitchen hub with live kitchen status.
- **Current UI**: Branch header (address, phone, kitchen timings), active menu, instant pickup or delivery selector.
- **Data Source**: PostgreSQL `branch`, `branch_inventory`, `product`.
- **API Endpoint**: `/api/v1/branches/[handle]`.
- **Service**: `DeliveryService`.
- **Repository**: `BranchRepository`, `ProductRepository`.
- **Database Tables**: `branch`, `branch_inventory`, `product`.
- **Permissions**: Public.
- **Loading State**: Shimmer cards.
- **Empty State**: Branch currently closed / menu unavailable.
- **Error State**: Branch not found.
- **Mobile Behaviour**: Mobile map view with "Order from this Hub".
- **SEO Requirements**: Bakery branch schema.
- **CMS Dependency**: None.
- **Status**: `PRODUCTION-READY`

### 20. Campaign Hub & Landing Page
- **Route**: `/campaigns`, `/campaigns/[id]`
- **File**: `frontend/src/app/(store)/campaigns/page.tsx`, `frontend/src/app/(store)/campaigns/[id]/page.tsx`
- **Category**: Offers and coupons / CMS preview
- **Purpose**: Seasonal and marketing campaigns (e.g. Valentine's Patisserie, Mother's Day, Christmas Plum Cake).
- **Current UI**: Immersive campaign hero, countdown timer if applicable, curated product collection, exclusive coupon code.
- **Data Source**: PostgreSQL `cms_page`, `marketing_campaign`, `offer`.
- **API Endpoint**: `/api/v1/cms/pages/[slug]`, `/api/v1/offers`.
- **Service**: `CmsService`.
- **Repository**: `CmsRepository`, `OfferRepository`.
- **Database Tables**: `cms_page`, `offer`.
- **Permissions**: Public.
- **Loading State**: Shimmer banner.
- **Empty State**: "Campaign has ended".
- **Error State**: Redirect to `/products`.
- **Mobile Behaviour**: Mobile full-bleed banner.
- **SEO Requirements**: Campaign landing page metadata.
- **CMS Dependency**: 100% CMS managed.
- **Status**: `PRODUCTION-READY`

### 21. Bakery Blog
- **Route**: `/blog`, `/blog/[slug]`
- **File**: `frontend/src/app/(store)/blog/page.tsx`, `frontend/src/app/(store)/blog/[slug]/page.tsx`
- **Category**: Customer storefront / Content
- **Purpose**: Editorial baking recipes, chef masterclasses, ingredient sourcing stories.
- **Current UI**: Article grid, rich text article body, chef bio, related cake products.
- **Data Source**: PostgreSQL `cms_page` (type: `blog`).
- **API Endpoint**: `/api/v1/cms/pages?type=blog`.
- **Service**: `CmsService`.
- **Repository**: `CmsRepository`.
- **Database Tables**: `cms_page`.
- **Permissions**: Public.
- **Loading State**: Article skeleton.
- **Empty State**: "More baking stories coming soon".
- **Error State**: 404 article not found.
- **Mobile Behaviour**: Readable editorial typography with responsive images.
- **SEO Requirements**: `Article` schema, author tag, publish date.
- **CMS Dependency**: 100% CMS managed.
- **Status**: `PRODUCTION-READY`

### 22. Dynamic CMS Landing Page
- **Route**: `/[slug]`
- **File**: `frontend/src/app/(store)/[slug]/page.tsx`
- **Category**: CMS preview / Customer storefront
- **Purpose**: Renders custom marketing pages, corporate bulk order inquiry, terms, privacy, FAQ, and custom landing pages.
- **Current UI**: Canonical `<PageRenderer>` component rendering database-configured sections.
- **Data Source**: PostgreSQL `cms_page`.
- **API Endpoint**: Server component `findPageBySlug(slug)`.
- **Service**: `CmsService`.
- **Repository**: `CmsRepository`.
- **Database Tables**: `cms_page`.
- **Permissions**: Public.
- **Loading State**: Next.js streaming shimmer.
- **Empty State**: Next.js `notFound()`.
- **Error State**: Root `error.tsx`.
- **Mobile Behaviour**: Fully responsive according to section config.
- **SEO Requirements**: Dynamic meta tags, OpenGraph images, and canonical URLs directly from `cms_page`.
- **CMS Dependency**: 100% CMS driven.
- **Status**: `PRODUCTION-READY`

### 23. Customer Authentication (Login & Signup)
- **Route**: `/login`, `/signup`
- **File**: `frontend/src/app/(store)/login/page.tsx`, `frontend/src/app/(store)/signup/page.tsx`
- **Category**: Authentication
- **Purpose**: Frictionless customer sign-in via phone OTP, WhatsApp magic link, or password.
- **Current UI**: Clean luxury card, phone input with country code, 6-digit OTP input, resend timer.
- **Data Source**: PostgreSQL `customer`, `customer_phone`, `auth_identity`.
- **API Endpoint**: `/api/auth/send-otp`, `/api/auth/verify-otp`, `/api/auth/login`.
- **Service**: `CustomerService`.
- **Repository**: `CustomerRepository`.
- **Database Tables**: `customer`, `auth_identity`.
- **Permissions**: Public.
- **Loading State**: Button spinner.
- **Empty State**: N/A.
- **Error State**: Invalid OTP / rate-limited error message.
- **Mobile Behaviour**: Auto-focus OTP fields, numeric keyboard.
- **SEO Requirements**: `noindex, nofollow`.
- **CMS Dependency**: None.
- **Status**: `PRODUCTION-READY`

### 24. SuperAdmin Dashboard & Command Center
- **Route**: `/dashboard`
- **File**: `frontend/src/app/dashboard/page.tsx`
- **Category**: Admin dashboard, Product/PIM, Inventory, Purchases, Parties, Billing, GST, Orders, Reports, Settings
- **Purpose**: Operational command center hosting 22 specialized administration panels.
- **Current UI**: Top header with user profile & role badge, horizontal tab navigation bar, dynamic resilient panel container with automatic chunk retry and skeleton fallback.
- **Data Source**: PostgreSQL (all administrative tables).
- **API Endpoint**: `/api/v1/[...path]` proxying to administrative repositories.
- **Service**: Full service suite (`OrderService`, `ProductService`, `DeliveryService`, `CmsService`, etc.).
- **Repository**: Full repository suite.
- **Database Tables**: `order`, `product`, `branch`, `customer`, `delivery_partner`, `setting`, `cms_page`, etc.
- **Permissions**: Role-governed via `StaffAccessControl` (SUPER_ADMIN, STORE_MANAGER, TELECALLER, STAFF).
- **Loading State**: `DashboardPanelSkeleton`.
- **Empty State**: Panel-specific empty states.
- **Error State**: `DashboardErrorBoundary` per active panel.
- **Mobile Behaviour**: Horizontal scrolling tab bar, responsive tablet data grids.
- **SEO Requirements**: `noindex, nofollow`.
- **CMS Dependency**: Embeds `CmsPanel` with `PageConfigurator`.
- **Status**: `PRODUCTION-READY`

### 25. Branch Kitchen Dashboard
- **Route**: `/dashboard/shop`
- **File**: `frontend/src/app/dashboard/shop/page.tsx`
- **Category**: KOT/kitchen, Branch operations
- **Purpose**: Live kitchen operations for branch managers (incoming orders, baking queue, dispatch prep, KOT print).
- **Current UI**: Kanban columns (New $\rightarrow$ In Oven $\rightarrow$ Ready for Delivery), sound alert for new orders.
- **Data Source**: PostgreSQL `order`, `branch`.
- **API Endpoint**: `/api/v1/orders?branch_id=[id]`.
- **Service**: `OrderService`.
- **Repository**: `OrderRepository`.
- **Database Tables**: `order`, `order_status_history`.
- **Permissions**: STORE_MANAGER, SUPER_ADMIN.
- **Loading State**: Card shimmer.
- **Empty State**: "All orders completed! Kitchen clear."
- **Error State**: Connection retry banner.
- **Mobile Behaviour**: Tablet-optimized card touch controls.
- **SEO Requirements**: `noindex, nofollow`.
- **CMS Dependency**: None.
- **Status**: `PRODUCTION-READY`

### 26. Branch Menu & Inventory Toggle
- **Route**: `/dashboard/shop/menu`
- **File**: `frontend/src/app/dashboard/shop/menu/page.tsx`
- **Category**: Inventory, Branch operations
- **Purpose**: Kitchen staff can toggle items out-of-stock instantly (86 list) or adjust daily baking quantity.
- **Current UI**: List of cakes with photo, variant selector, and instantaneous ON/OFF availability toggle.
- **Data Source**: PostgreSQL `branch_inventory`, `product`.
- **API Endpoint**: `/api/v1/branches/[id]/inventory`.
- **Service**: `InventoryService`.
- **Repository**: `BranchRepository`, `ProductRepository`.
- **Database Tables**: `branch_inventory`.
- **Permissions**: STORE_MANAGER, SUPER_ADMIN.
- **Loading State**: Toggle skeleton.
- **Empty State**: No items assigned to this branch.
- **Error State**: Inline error toast if update fails.
- **Mobile Behaviour**: Touch switches.
- **SEO Requirements**: `noindex, nofollow`.
- **CMS Dependency**: None.
- **Status**: `PRODUCTION-READY`

### 27. Delivery Driver Console
- **Route**: `/dashboard/delivery-partner`
- **File**: `frontend/src/app/dashboard/delivery-partner/page.tsx`
- **Category**: Delivery partners
- **Purpose**: Driver mobile console for accepting assigned orders, GPS navigation to customer, customer phone contact, and OTP verification on handoff.
- **Current UI**: Driver profile header, active deliveries card, "Call Customer", "Open Maps", OTP input sheet.
- **Data Source**: PostgreSQL `delivery`, `delivery_partner`, `order`.
- **API Endpoint**: `/api/v1/delivery/active`, `/api/v1/delivery/verify-otp`.
- **Service**: `DeliveryService`.
- **Repository**: `OrderRepository`, `BranchRepository`.
- **Database Tables**: `delivery`, `delivery_partner`, `order`.
- **Permissions**: DELIVERY_PARTNER role or assigned driver phone.
- **Loading State**: Mobile card shimmer.
- **Empty State**: "No active deliveries assigned. Stand by."
- **Error State**: OTP mismatch warning.
- **Mobile Behaviour**: Fully mobile-first design.
- **SEO Requirements**: `noindex, nofollow`.
- **CMS Dependency**: None.
- **Status**: `PRODUCTION-READY`

### 28. PWA Offline Fallback
- **Route**: `/offline`
- **File**: `frontend/src/app/offline/page.tsx`
- **Category**: PWA & Offline
- **Purpose**: Displayed by Service Worker when customer loses internet connection.
- **Current UI**: "You're currently offline" notice, cached order history link, contact telephone.
- **Data Source**: Local cached shell.
- **API Endpoint**: None.
- **Service**: N/A.
- **Repository**: N/A.
- **Database Tables**: None.
- **Permissions**: Public.
- **Loading State**: Instant render.
- **Empty State**: N/A.
- **Error State**: N/A.
- **Mobile Behaviour**: Touch reconnect button.
- **SEO Requirements**: `noindex, nofollow`.
- **CMS Dependency**: None.
- **Status**: `PRODUCTION-READY`
