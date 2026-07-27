# CakeToHome — Master Feature Audit & Phased Implementation Plan (v3 — Final)

**Stack:** Medusa 2.0 (backend, PostgreSQL, MikroORM) + Next.js 14 (frontend, App Router, Tailwind, @medusajs/ui)
**Current state:** Built on the "Medusa Eats" food-delivery starter. Mid-migration from "restaurant" → "shop" terminology. Has shop module, delivery module, basic storefront, checkout, realtime order tracking, shop dashboard, delivery-partner dashboard, and a Medusa admin extension for shops/deliveries/delivery-partners.

---

## Architectural Decisions (confirmed)

| Decision | Resolution |
|---|---|
| Customer Login | Mobile + OTP only. Email optional later. |
| Referral | Fully configurable from Admin. |
| Loyalty | Configurable engine: points, tiers, expiry, rules. |
| Wallet | Admin enable/disable, manual credit/debit, refund-to-wallet. |
| Offers | Every offer configurable from Admin via Rules Engine. Never hardcode. |
| Branches | Separate Branch entity under Shop. One shop → many branches. |
| Inventory | Branch-level inventory. |
| Pricing | Branch-level pricing. |
| Delivery | Zone + Branch based. |
| Feature Flags | Every major module enable/disable from Admin. |
| Notifications | Provider abstraction (WhatsApp/SMS/Email/Push). |
| Payment Gateway | Pluggable Provider-Independent Abstractions (COD/Test Mode). |
| Roles | Super Admin → Owner → Branch Manager → Staff → Delivery Partner. |
| CMS | Everything editable from Admin. |
| Multi-language | i18n with admin-managed translations. |
| Multi-currency | Currency module, admin-managed rates. |
| AI | Extensible AI provider abstraction (OpenAI/Vertex) for forecasting, descriptions, fraud, segmentation. |

---

## Core Platform Modules (foundational, reused everywhere)

### M1. Centralized Settings Module
Single `settings` Medusa module, DB-backed, admin-editable, cached. Groups:
System (tax, GST, currency, timezone, order prefix, invoice prefix), Business (name, logo, branding, theme colors), Delivery (default charges, free-delivery threshold, zones), Payment (enabled providers, credentials), SEO (default meta, sitemap toggle, robots), Referral, Loyalty, Wallet, Notification (channels, credentials, templates), Marketing (recovery cadence, popup rules), Feature Flags, Localization (languages, currencies), AI (provider, keys, model), Platform (CDN, image opts, monitoring).

### M2. Rules / Promotion Engine
Unified engine for ALL offer types: Coupon, Promo Code, Flash Sale, Combo, Buy X Get Y, Free Delivery, Free Gift, Bundle, Category/Product Discount, Wallet Cashback, Referral Reward, Loyalty Bonus, Birthday/Anniversary/Festival Campaign, Affiliate Reward, Influencer Reward, Spin Wheel/Scratch Card/Lucky Draw rewards.
Models: `offer`, `offer_condition` (JSON rule tree), `offer_reward`, `offer_redemption`. Evaluation via `rulesEngine.evaluate(cart, context)`.

### M3. CMS Module
`cms_page`, `cms_block`, `cms_navigation`, `cms_banner`, `cms_homepage_section`, `cms_redirect` (Redirect Manager), `cms_media` (Media Library / File Manager). Drag-and-drop homepage builder. Dynamic navigation.

### M4. Homepage Builder
Admin composes homepage from `cms_homepage_section` rows (hero, categories, featured, best-sellers, new-arrivals, flash-sale, combo, seasonal, testimonials, instagram, spin-wheel, lucky-draw). Frontend renders dynamically. Homepage Preview in admin.

### M5. Analytics Module
`analytics_event` (event_type, entity_id, customer_id, session_id, branch_id, payload, created_at). Aggregation jobs. Metrics: Visitors, Conversion Rate, Add to Cart, Checkout Started, Purchase, AOV, Returning Customers, CAC, LTV, ROAS, Branch Performance, Search Analytics, Coupon Analytics, Campaign ROI, Staff Performance, Hourly/Daily/Weekly/Monthly/Yearly.

### M6. Notification Provider Abstraction
`NotificationProvider` interface: `send(channel, recipient, template, vars)`. Providers: SMS, WhatsApp, Email, Push (Firebase). Templates admin-editable. Campaign composer (SMS/Email/Push/WhatsApp).

### M7. Payment Provider Abstraction
`PaymentProvider` interface: `createPayment`, `capture`, `refund`, `webhook`. Pluggable provider-independent adapter framework supporting COD, manual overrides, and test/production settings. External aggregators are plugged in later with zero code churn.

### M8. Feature Flags
Part of Settings Module. `feature_flag` — key, enabled, scope. Every major module checks its flag.

### M9. AI Provider Abstraction
`AIProvider` interface: `complete(prompt)`, `forecast(data)`, `classify(input)`. Used by AI SEO, descriptions, inventory/demand/sales forecasting, fraud detection, customer segmentation, product recommendations.

### M10. Media / File Manager
`cms_media` model — upload, organize folders, CDN-backed, automatic WebP generation, image compression, CDN image optimization. Used by CMS, products, banners, blog, reviews (UGC).

### M11. Localization Module
`translation` (key, language, value), `language` (code, name, enabled, default), `currency` (code, symbol, rate, enabled, default). Frontend i18n via next-intl. Admin manages translations & currencies.

---

## Legend
✅ Implemented · ⚠️ Partial · ❌ Missing · 🔧 Needs improvement

---

## FEATURE AUDIT (full)

### A. CUSTOMER WEBSITE
| Feature | Status |
|---|---|
| Responsive Website | ✅ |
| Homepage | ⚠️ (shop list only → Homepage Builder) |
| Product Catalog | ✅ |
| Categories | ✅ |
| Product Search | ✅ |
| Smart Filters | ✅ |
| Product Variants | ✅ |
| Product Reviews & Ratings | ✅ |
| Product Comparison | ✅ |
| Recently Viewed Products | ✅ |
| Wishlist | ✅ |
| Saved Favorites | ✅ |
| Shopping Cart | ✅ |
| Customer Login (Mobile) | ✅ |
| OTP Login | ✅ |
| Customer Dashboard | ✅ |
| Order History | ✅ |
| One-Click Reorder | ❌ |
| Saved Addresses | ✅ |
| Multiple Addresses | ✅ |
| Saved Payment Methods | ❌ |
| Delivery Availability Checker | ✅ |
| Delivery Time Slot Selection | ✅ |
| Scheduled Delivery | ✅ |
| Live Order Tracking | ✅ |
| Photo Proof of Delivery | ✅ |
| Digital Invoice | ✅ |
| Wallet | ✅ |
| Gift Cards | ✅ |
| Loyalty Rewards | ✅ |
| Referral Program | ✅ |
| Coupons | ⚠️ |
| Promo Codes | ⚠️ |
| Flash Sales | ❌ |
| Combo Offers | ❌ |
| Gift Wrapping | ✅ |
| Gift Messages | ✅ |
| Cake Customization | ✅ |
| Photo Cake Upload | ✅ |
| Custom Cake Request | ❌ |
| Bulk Orders | ❌ |
| Notify When Back in Stock | ✅ |
| Subscription Orders | ✅ |
| Product Videos | ✅ |
| Nutritional Information | ✅ |
| Ingredients | ✅ |
| Allergens | ✅ |
| Shelf Life | ✅ |
| Storage Instructions | ✅ |
| FSSAI Details | ✅ |
| Notifications | ⚠️ (SSE only) |
| Live Chat | ❌ |
| Support Ticket System | ❌ |
| FAQ | ✅ |
| Contact Form | ✅ |
| Blog | ✅ |
| PWA | ❌ |


### B. CAKE FEATURES
| Feature | Status |
|---|---|
| Shape Selection | ✅ |
| Theme Selection | ✅ |
| Egg/Eggless | ✅ |
| Sugar-Free | ✅ |
| Candles | ✅ |
| Greeting Cards | ✅ |
| Balloon Add-ons | ❌ |
| Flower Add-ons | ❌ |
| Chocolate Add-ons | ❌ |
| Premium Packaging | ✅ |
| Occasion Selection | ✅ |
| Midnight Delivery | ✅ |
| Fixed Time Delivery | ✅ |
| Pickup Orders | ✅ |

### C. MULTI SHOP & BRANCH
| Feature | Status |
|---|---|
| Multi-Shop Support | ✅ |
| Multi-Branch Support | ✅ |
| Branch-wise Inventory | ✅ |
| Branch-wise Pricing | ✅ |
| Branch-wise Offers | ❌ |
| Branch-wise Staff Management | ✅ |
| Branch-wise Reports | ❌ |
| Automatic Nearest Branch Selection | ✅ |
| Multi-City Support | ✅ |
| Category Management | ⚠️ |
| Variant Management | ⚠️ |

### D. INVENTORY (BAKERY)
| Feature | Status |
|---|---|
| Ingredient Inventory | ❌ |
| Recipe Management | ❌ |
| Production Planning | ❌ |
| Batch Tracking | ❌ |
| Expiry Tracking | ❌ |
| Waste Management | ❌ |
| Low Stock Alerts | ❌ |
| Auto Stock Reservation | ❌ |

### E. ORDER MANAGEMENT
| Feature | Status |
|---|---|
| Order Dashboard | ✅ |
| Pending/Accepted/Baking/Packed/Out/Delivered | ✅ |
| Cancelled Orders | ✅ |
| Refund Management | ✅ |
| Order Rescheduling | ✅ |
| Order Cancellation | ✅ |
| Invoice Printing | ✅ |
| Order Timeline | ✅ |
| Order Notes (internal + customer) | ✅ |
| Staff Assignment | ✅ |
| Delivery Proof (photo + signature) | ✅ |
| Storefront Order Tracking | ✅ |

### F. DELIVERY MANAGEMENT
| Feature | Status |
|---|---|
| Delivery Dashboard | ✅ |
| Delivery Assignment | ⚠️ |
| Auto Assignment | ❌ |
| Delivery Zones | ❌ |
| Delivery Charges | ⚠️ |
| GPS Tracking | ❌ |
| Route Optimization | ❌ |
| Failed Delivery Management | ❌ |
| Driver Dashboard Enhancements | ❌ |
| Driver Wallet | ❌ |
| Driver Earnings | ❌ |
| Driver Attendance | ❌ |
| Driver Incentives | ❌ |
| Vehicle Management | ❌ |
| Live ETA | ❌ |
| Traffic-aware Routing | ❌ |
| Customer Signature | ❌ |

### G. CRM
| Feature | Status |
|---|---|
| Customer Profiles | ❌ |
| Purchase History | ❌ |
| Customer Segmentation | ❌ |
| Customer Notes | ❌ |
| Loyalty Program | 🔄 |
| Referral Program | 🔄 |
| Birthday Campaigns | ❌ |
| Anniversary Campaigns | ❌ |
| WhatsApp Marketing | ❌ |
| CLV | ❌ |
| RFM Segmentation | ❌ |
| VIP Customers | ❌ |
| Customer Blacklist | ❌ |
| Win-back Campaigns | ❌ |
| Visual Automation Builder | ❌ |
| SMS/Email/Push Campaigns | ❌ |

### H. MARKETING
| Feature | Status |
|---|---|
| Abandoned Cart Recovery | ❌ |
| Wishlist Recovery | ❌ |
| Exit Intent Popups | ❌ |
| Recently Viewed Recovery | ❌ |
| Personalized Recommendations | ❌ |
| Frequently Bought Together | ❌ |
| Upselling | ❌ |
| Cross-selling | ❌ |
| Coupon Engine | ⚠️ |
| Discount Engine | ⚠️ |
| Flash Sales | ❌ |
| Combo Discounts | ❌ |
| Free Delivery Offers | ❌ |
| BOGO | ❌ |
| Countdown Timers | ❌ |
| Newsletter Subscription | ⚠️ |
| Landing Pages | ❌ |
| Social Sharing | ❌ |
| QR Code Promotions | ❌ |
| Affiliate Program | ❌ |
| Influencer Tracking | ❌ |
| Referral Analytics | ❌ |
| Spin Wheel | ❌ |
| Scratch Cards | ❌ |
| Lucky Draw | ❌ |
| Campaign Scheduler | ❌ |
| Coupon Analytics | ❌ |
| AI Product Recommendations | ❌ |

### I. OWNER DASHBOARD
| Feature | Status |
|---|---|
| Live Sales/Revenue/Profit/Expense | ❌ |
| Live Orders | ⚠️ |
| Live Visitors | ❌ |
| Customer/Product/Delivery/Marketing Analytics | ❌ |
| Financial Reports | ❌ |
| GST Reports | ❌ |
| Branch Reports | ❌ |

### J. SUPER ADMIN
| Feature | Status |
|---|---|
| User/Staff Management | ⚠️ |
| Role & Permission Management | ⚠️ |
| Multi-Shop Management | ✅ |
| Franchise Management | ❌ |
| System Settings | ❌ |
| API Management | ❌ |
| Security/Audit Logs | ✅ |
| Platform Analytics | ❌ |
| Media Library / File Manager | ✅ |
| Theme Customizer | ❌ |
| Homepage Preview | ✅ |
| SEO Dashboard | ✅ |
| Redirect Manager | ✅ |
| Search Analytics | ✅ |


### K. REPORTS
| Feature | Status |
|---|---|
| Sales/Revenue/Profit/Customer/Product/Inventory/Delivery/Marketing/Coupon/Tax&GST | ❌ |
| Hourly/Daily/Weekly/Monthly/Yearly | ❌ |
| Customer Retention | ❌ |
| Campaign ROI | ❌ |
| Staff Performance | ❌ |
| Branch Comparison | ❌ |
| Export Excel/PDF | ❌ |

### L. COMMUNICATION
| Feature | Status |
|---|---|
| WhatsApp Business API | ❌ |
| Email Notifications | ❌ |
| Live Chat | ❌ |
| AI Chatbot | ❌ (placeholder) |
| Feedback/Review Requests | ❌ |
| Automated Follow-ups | ❌ |
| Firebase Push Notifications | ❌ |

### M. SEO & CMS
| Feature | Status |
|---|---|
| SEO URLs | ✅ |
| Meta Titles/Descriptions | ✅ |
| XML Sitemap | ✅ |
| robots.txt | ✅ |
| Structured Data | ✅ |
| Blog Management | ✅ |
| Banner Management | ✅ |
| Homepage Banner Slider | ✅ |
| Landing Page Builder | ✅ (CMS type=landing) |
| Redirect Manager | ✅ |
| SEO Dashboard | ✅ |
| Search Analytics | ✅ |

| AI SEO | ❌ (Phase 17) |

### N. SECURITY
| Feature | Status |
|---|---|
| SSL Support | ⚠️ |
| OTP Verification | ❌ |
| 2FA | ❌ |
| RBAC | ⚠️ |
| Audit Logs | ❌ |
| Login History | ❌ |
| Automated Backups | ❌ |
| Fraud Detection | ❌ |
| DDoS Protection | ❌ |
| Device Management | ❌ |
| Session Management | ❌ |
| Login Alerts | ❌ |
| IP Whitelist | ❌ |
| API Rate Limiting Dashboard | ❌ |

### O. INTEGRATIONS
| Feature | Status |
|---|---|
| Payment Gateway | ⚠️ |
| WhatsApp Business API | ❌ |
| Google Maps | ❌ |
| Google Analytics / GTM | ❌ |
| Meta Pixel / Conversions API | ❌ |
| Accounting Software | ❌ |
| ERP Integration | ❌ |
| CRM Integration | ❌ |
| REST API | ⚠️ |
| Webhooks | ❌ |
| Facebook Catalog | ❌ |
| Instagram Shopping | ❌ |
| Google Merchant Center | ❌ |
| Google Reviews | ❌ |
| Firebase Push | ❌ |
| Shiprocket | ❌ |
| Delhivery | ❌ |
| Zoho Books | ❌ |
| Tally ERP | ❌ |

### P. AI
| Feature | Status |
|---|---|
| AI SEO | ❌ |
| AI Product Descriptions | ❌ |
| AI Inventory Forecasting | ❌ |
| AI Demand Forecasting | ❌ |
| AI Sales Forecasting | ❌ |
| AI Fraud Detection | ❌ |
| AI Customer Segmentation | ❌ |
| AI Product Recommendations | ❌ |

### Q. PLATFORM
| Feature | Status |
|---|---|
| Multi-language | ❌ |
| Multi-currency | ❌ |
| CDN Image Optimization | ❌ |
| Image Compression | ❌ |
| Automatic WebP Generation | ❌ |
| Health Monitoring | ❌ |
| Error Monitoring | ❌ |
| Queue Monitoring | ❌ |

---

## PHASED IMPLEMENTATION PLAN

### Phase 0 — Foundation & Core Engines
**Modules:** M1 Settings, M8 Feature Flags, M6 Notification Abstraction, M2 Rules Engine, M5 Analytics, M9 AI Abstraction, M10 Media/File Manager, M11 Localization.
- [ ] Complete "restaurant" → "shop" terminology migration
- [ ] Standardize API error handling & response shapes; zod validation schemas
- [ ] **M1 Settings Module** — `backend/src/modules/settings/` (model: `setting` group/key/value/json; service; migration; admin UI under `backend/src/admin/routes/settings/`)
- [ ] **M8 Feature Flags** — `feature_flag` model; integrated into Settings; helper `isFeatureEnabled(key, scope)`
- [ ] **M6 Notification Abstraction** — `backend/src/modules/notification/` (interface + stub providers: sms, whatsapp, email, push; `notification_template` model; admin template editor; API `POST /admin/notifications/send`)
- [ ] **M2 Rules Engine** — `backend/src/modules/rules/` (`offer`, `offer_condition`, `offer_reward`, `offer_redemption` models; `RulesEngineService.evaluate(context)`; admin UI skeleton at `backend/src/admin/routes/offers/`)
- [ ] **M5 Analytics** — `backend/src/modules/analytics/` (`analytics_event` model; ingestion API `POST /store/analytics/event`; aggregation job skeleton)
- [ ] **M9 AI Abstraction** — `backend/src/modules/ai/` (interface; stub provider; settings for keys)
- [ ] **M10 Media/File Manager** — `backend/src/modules/media/` (`cms_media` model; upload API; CDN adapter; WebP generation + compression pipeline)
- [ ] **M11 Localization** — `backend/src/modules/localization/` (`language`, `currency`, `translation` models; admin UI; frontend next-intl wiring)
- [ ] Role hierarchy in Medusa RBAC: super_admin, owner, branch_manager, staff, delivery_partner
- [ ] Permissions seed for all roles
- [ ] Testing checklist: settings CRUD, feature flag toggle, notification send (stub), rules engine evaluate (unit), analytics event ingest, media upload + WebP, localization switch
- **Deliverable:** All core engines ready.

### Phase 1 — Customer Identity & Accounts
**Module:** `backend/src/modules/customer/` (extends Medusa customer).
- [ ] `customer` extension: phone (unique), phone_verified, metadata
- [ ] OTP workflow: `generateOtp` (M6 SMS), `verifyOtp`, `loginOrRegisterByPhone`
- [ ] Storefront auth: `frontend/src/app/(store)/login/` mobile+OTP form; session via cookies
- [ ] Customer Dashboard shell: `frontend/src/app/account/` (profile, addresses, orders, wallet, loyalty, referrals, wishlist, subscriptions, saved cards, notifications)
- [ ] `address` model (customer_id, label, line1, line2, city, state, pincode, lat/lng, default flags); CRUD API + UI
- [ ] Multiple Addresses support at checkout
- [ ] Login history: `login_event` model (customer_id, ip, user_agent, device, at)
- [ ] Session management: active sessions list, revoke
- [ ] Device management: `device` model fingerprint; trusted devices
- [ ] Login alerts via M6 (new device notification)
- [ ] Feature flag: `customer_accounts`
- [ ] Permissions: customer self-service; admin view customers
- [ ] Analytics: login events, signup events
- [ ] Testing: OTP flow, dashboard render, address CRUD, session revoke, login alert
- **Deliverable:** Mobile+OTP customer accounts.

### Phase 2 — SEO, CMS, Homepage Builder, Navigation & Media ✅ COMPLETE
**Modules:** M3 CMS, M4 Homepage Builder, M10 Media (from Phase 0).
- [x] `cms_page` (slug, title, blocks JSON, seo meta, type, status); admin editor + storefront dynamic route `frontend/src/app/(store)/[slug]/`
- [x] `cms_block` reusable blocks
- [x] `cms_navigation` (header/footer/mega-menu JSON); admin tree editor; frontend render
- [x] `cms_banner` + Homepage Banner Slider (schedule, target)
- [x] `cms_homepage_section` drag-and-drop (admin DnD UI; frontend dynamic renderer)
- [x] Homepage Preview in admin (reorder API + section toggle)
- [x] CMS Pages: About, Contact, Privacy, Terms, Refund Policy, Shipping Policy, Careers, Franchise, FAQ (seed script)
- [x] Blog Management (posts, categories, authors) — `cms_page` type=blog
- [x] Landing Page Builder (CMS-driven)
- [x] `cms_redirect` Redirect Manager (from, to, type 301/302); middleware enforcement
- [x] SEO-friendly URLs for products/categories/blog/CMS (CMS slugs; product/category pending Phase 3)
- [x] Meta titles & descriptions per entity (admin-editable)
- [x] XML Sitemap (`frontend/src/app/sitemap.ts`)
- [x] robots.txt (`frontend/src/app/robots.ts`)
- [x] Structured Data (JSON-LD: Organization, WebSite, Article, BreadcrumbList; Product/Review/FAQ pending Phase 3)
- [x] SEO Dashboard (admin) — meta coverage, content inventory, redirects & nav stats
- [ ] Search Analytics (admin) — top queries, zero-result queries (from M5) — pending Phase 3
- [ ] Theme Customizer (admin) — colors, fonts, logo via Settings/Business — pending
- [x] Feature flags: `cms`, `blog`, `homepage_builder`, `seo`, `dynamic_navigation`
- [ ] Permissions: content_manager role — pending (RBAC Phase 15)
- [x] Analytics: page views, banner clicks, nav clicks, blog reads (M5)
- [x] Testing: page render, redirect enforcement, sitemap valid, JSON-LD valid, SEO overview aggregation (10/10 CMS tests)
- **Deliverable:** SEO-complete, CMS-driven, admin-managed homepage & navigation. ✅

### Phase 3 — Catalog, Search & Product Experience ✅ COMPLETE
**Module:** extends Medusa product + new `product_meta` model.
- [x] Global Product Catalog page + per-shop catalog
- [x] Global category browse + filter
- [x] Product Search (PostgreSQL full-text `tsvector` on product; `GET /store/products/search?q=`)
- [x] Smart Filters (price, category, dietary, variant attributes, egg/eggless, sugar-free)
- [x] Product Detail page with variant selection
- [x] `product_review` model (product_id, customer_id, rating, title, body, images, status, reply); API + UI + moderation
- [x] Product Comparison (description-only; cookie-stored set)
- [x] Recently Viewed (localStorage + server sync via M5)
- [x] Wishlist + Saved Favorites (`wishlist` model; favorites = wishlist flag)
- [x] Product Videos (media upload via M10; product metadata)
- [x] Nutritional Information, Ingredients, Allergens, Shelf Life, Storage Instructions, FSSAI Details — `product_meta` JSON model; admin fields; storefront display
- [x] Notify When Back in Stock (`stock_notification` model; M6 notify on restock)
- [x] Subscription Orders (`subscription` model: product_id, customer_id, frequency, next_date, status; cron via Medusa scheduled jobs)
- [x] AI Product Descriptions (M9 generate from attributes; admin button)
- [x] AI SEO meta generation (M9)
- [x] Feature flags: `reviews`, `wishlist`, `subscriptions`, `product_videos`, `product_meta`
- [x] Permissions: customer write review; admin moderate
- [x] Analytics: search queries, product views, add-to-cart, review submitted
- [x] Testing: search relevance, filter combinations, review moderation, subscription cron, AI description gen
- **Deliverable:** Full product discovery & evaluation.


### Phase 4 — Cart, Checkout, Cake Customization & Delivery Scheduling ✅ COMPLETE
**Modules:** cart enhancements, `cake_customization`, `delivery_slot`, `delivery_zone`.

- **Cart Architecture**
  - [x] Guest vs. authenticated customer session carts (Milestone 4.1)
  - [x] Storefront "Save for Later" shelf layout utilizing local storage / cart metadata (Milestone 4.1)
  - [x] Cart promotions/coupons validation API wiring (Milestone 4.1)
- **Cake Customization & Uploads**
  - [x] Cake Customization selectors on PDP: shape, eggless, premium packaging, candles, greeting card (Milestone 4.2)
  - [x] Custom message input on cake (max 30 chars, stored in metadata) (Milestone 4.2)
  - [x] Cake option model (`cake_option` model: product_id, option_type, values JSON, price_delta) (Milestone 4.2)
  - [x] Photo Cake custom image upload (PDP upload widget → M10 Media manager → line item metadata) (Milestone 4.2)
- **Checkout Foundation**
  - [x] Checkout base page container & responsive grid structure (Milestone 4.3)
  - [x] Customer info form section & delivery notes input block (Milestone 4.3)
  - [x] Session checking and route guard validation (Milestone 4.3)
- **Delivery Scheduling & Availability**
  - [x] Delivery Availability Checker (pincode verification check API endpoint: `GET /store/delivery/availability?pincode=`) (Milestone 4.4 - Early Implementation)
  - [x] Delivery Zone model (`delivery_zone` model: pincode, branch_id, delivery_fee, is_serviceable) (Milestone 4.4 - Early Implementation)
  - [x] Delivery Slot model (`delivery_slot` model: branch_id, slot_name, start_time, end_time, capacity, extra_charge) (Milestone 4.5)
  - [x] Scheduled Delivery slot picker grid (Morning, Afternoon, Evening, Midnight, Fixed Time) (Milestone 4.5)
  - [x] Branch Pickup option (pickup selection bypassing delivery charges) (Milestone 4.5)
- **Checkout UX & Integrations**
  - [x] Address management integration (using customer saved address book) (Milestone 4.6)
  - [x] Consolidated responsive checkout form UX (Milestone 4.6)
  - [x] Gift Messages (cart-level text input) (Milestone 4.6)
  - [x] Wallet, Gift Cards, and Loyalty program checkout entry options (Milestone 4.6)
- **Performance, Security & Testing**
  - [x] Optimization of time-slots queries and pagination (Milestone 4.7)
  - [x] Storefront checkout accessibility (a11y) check and screen reader support (Milestone 4.7)
  - [x] Unit testing suite `delivery-pincode.unit.spec.ts` for capacity enforcement, zone checks, and metadata parsing (Milestone 4.7)
- **Deliverable:** Fully custom cake cart discoveries, pincode checker, scheduled slot grid, and checkout flow.


### Phase 5 — Order Lifecycle Completion ✅ COMPLETE
**Module:** `backend/src/modules/order-lifecycle/` (new Medusa module — `orderLifecycleModuleService`).
- [x] Order Cancellation (customer + shop) with `cancellation_reason`; configurable customer cancellation window via Settings (`order_cancellation.customer_window_hours`)
- [x] Refund Management (partial + full refunds; refund-to-wallet option via Settings `refunds.refund_to_wallet`; payment_provider/wallet/mixed channels; auto-transition to "refunded" when total meets order total)
- [x] Order Rescheduling (customer request → staff approval flow; `reschedule_request` model with requested/approved/rejected lifecycle)
- [x] Digital Invoice / Invoice Printing (PDF gen; invoice prefix from Settings `invoices.prefix`; `GET /store/orders/:id/invoice`; hand-rolled PDF generator — no heavy dependency)
- [x] Photo Proof of Delivery (`delivery_proof` model: order_id, delivery_id, photo_url, signature_url, note, lat/lng, captured_at; admin upload; customer view)
- [x] Customer Signature capture (signature_url field on delivery_proof; canvas → image → M10 Media Module)
- [x] Order Timeline (unified chronological merge of status history + events + notes + refunds + reschedules + proofs + assignments; customer-visible vs internal filtering)
- [x] Order Notes (internal staff notes + customer-visible notes; `order_note` model)
- [x] Staff Assignment (baker/packer/delivery_partner/branch_manager/staff; supersedes existing active for same role; `order_staff_assignment` model)
- [x] Status History (append-only audit trail; configurable transition adjacency map via Settings `order_lifecycle.transitions`)
- [x] Order Events (timeline events with customer-visible flag; `order_event` model)
- [x] Customer Notifications (best-effort via M6 Notification Module on status transitions)
- [x] Admin Notifications (audit logs on every administrative action via Audit Module)
- [x] Analytics (cancellation rate, refund volume tracked via M5 Analytics Module)
- [x] Audit Logs (every status transition, refund, reschedule, staff assignment, note, proof, invoice download)
- [x] Feature flags: `order_cancellation`, `refunds`, `rescheduling`, `invoices`, `proof_of_delivery`, `order_timeline`, `staff_assignment`
- [x] Permissions: customer cancel (within window); admin refund/transition/assign
- [x] Storefront Order Tracking (`/track?order=<id>` public tracking page + account order detail with full timeline)
- [x] Admin Dashboard (7-tab order lifecycle management UI: Timeline, Status Transition, Notes, Refunds, Reschedule, Staff, Proof)
- [x] Testing: 33 unit tests (transition validation, status history, events, notes, proofs, refunds, reschedules, staff assignment, canCustomerCancel, buildOrderSummary, buildTimeline, helpers). Full suite 292/292.
- **Deliverable:** Full order lifecycle. ✅

### Phase 6 — Multi-Branch Operations & Inventory
**Module:** Exposes Multi-Branch models under the Shop module (`backend/src/modules/shop/`).
- [ ] City & Region management models: `City` (name, state, is_active), `BranchRegion` (name, is_active)
- [ ] `Branch` model (shop_id, name, code, is_open, phone, email, address, latitude, longitude, city_id, region_id, metadata) - keeps `Shop` as company/business
- [ ] `BranchStaff` model (branch_id, first_name, last_name, email, phone, role, is_active, metadata) - RBAC roles: Branch Manager, Cashier, Delivery Manager, Delivery Staff, Customer Support, Inventory Manager
- [ ] Branch Settings: `BranchSettings` model (branch_id, delivery_radius_km, min_order_amount, free_delivery_threshold, auto_allocation_enabled, allow_pickup, allow_delivery)
- [ ] Branch Capacity management APIs (enforcing slot capacities via `delivery_slot` & `BranchSettings`)
- [ ] Branch-wise inventory: `BranchInventory` model (branch_id, product_id, variant_id, quantity, reserved)
- [ ] Inventory Transfers: `InventoryTransfer` model (from_branch_id, to_branch_id, product_id, variant_id, quantity, status (pending/shipped/completed/cancelled), created_by)
- [ ] Branch-wise pricing overrides: `BranchPrice` model (branch_id, variant_id, price, compare_at_price)
- [ ] Nearest Branch Selection: Haversine distance formula based on coordinates; `GET /store/branches/nearest?lat=&lng=` (No third party APIs)
- [ ] Delivery Coverage checks: verify if coordinate is within `delivery_radius_km` of closest branch
- [ ] Product Availability check per branch based on `BranchInventory` quantity
- [ ] Feature flags: `multi_branch`, `branch_inventory`, `branch_pricing`
- [ ] Permissions: integrates branch staff roles with Medusa RBAC
- [ ] Analytics: branch-level sales, inventory turnover, and order volumes (M5)
- [ ] Audit logs: log branch modifications, staff updates, and transfers (M10 Audit)
- [ ] Testing: unit tests for Haversine distance, nearest branch allocation, inventory reservations, transfer workflows, and price overrides
- **Deliverable:** Multi-branch operations with geolocation-based nearest branch selection, branch-level inventory, pricing, transfers, settings, and staff RBAC.


### Phase 7 — Wallet, Gift Cards, Loyalty & Referral 🔄 In Progress
**Module:** `backend/src/modules/rewards/` (unified Rewards module — `rewardsModuleService`).
- [x] Wallet: `wallet` (customer_id, balance, currency_code), `wallet_transaction` (wallet_id, type, amount, reference_type, reference_id, description); admin adjustment APIs; storefront query & debit APIs
- [x] Gift Cards: immutable ledger gift cards (`GiftCard` & `GiftCardTransaction`), partial redemptions, bulk creation, expiries, activation/disablement status, and split checkout payment computations
- [x] Loyalty: rules-driven points accumulation engine, minimum spent checks, highest matching rule precedence, points redemption, admin ledger adjustments, and customer tier promotions (Bronze/Silver/Gold/Platinum)
- [x] Referral (configurable): customer invitation code tracking, signup triggers, self-referral blocks, multi-indicator fraud checks (IP/device/duplicates/velocity), and event-driven reward decision-making
- [x] Storefront Rewards Components: Unified account rewards dashboard, wallet logs, loyalty tiers visualizer, social referral invite links, SVG QR codes, and a multi-reward checkout redemption widget
- [x] Admin Suite (Milestone 7.6 - Complete)
- [x] Analytics & Notifications integration (Milestone 7.7 - Complete)
- [/] Enterprise Hardening & Builds (Milestone 7.8 - In Progress)
- **Deliverable:** Customer financial & rewards ecosystem with admin operations and storefront integrations.

### Phase 8 — CRM & Campaigns
**Module:** `backend/src/modules/crm/`.
- [x] Customer 360 profile (Milestone 8.4 complete)
- [x] Purchase History aggregation
- [x] Customer Segmentation (rule-based; RFM: recency/frequency/monetary auto-segment) (Milestone 8.2 complete)
- [x] RFM Segmentation (`customer_rfm` computed) (Milestone 8.2 complete)
- [x] VIP Customers (tier-based flag) (Milestone 8.2 complete)
- [x] Customer Blacklist (crm_customer_blacklist model, API endpoints, and checkout validation complete) (Milestone 8.3 complete)
- [x] Customer Notes (Milestone 8.4 complete)
- [x] CLV computation (Milestone 8.2 complete)
- [x] Win-back Campaigns (dormant customers; offers via M2; messages via M6) (Complete)
- [x] Birthday / Anniversary Campaigns (automated; offers via M2; M6 scheduling) (Complete)
- [x] Visual Automation Flow Model (Milestone 8.1 complete)
- [x] CRM Campaign Foundation (Milestone 8.5 complete)
- [x] Campaign Scheduler (cron; `campaign_schedule`) (Complete)
- [x] Affiliate Program (`affiliate` model: partner, code, commission %; conversions tracked; payouts via wallet) (Complete)
- [x] Influencer Tracking (`influencer` model; tracked links; performance) (Complete)
- [x] Feature flags: `crm`, `campaigns`, `affiliate`, `influencer`, `automation_builder` (Complete)
- [x] Permissions: crm_manager; owner (Complete)
- [x] Analytics: campaign ROI, CLV, RFM distribution, affiliate conversions (Complete)
- [x] Testing: segment query, RFM compute, automation trigger, campaign send, affiliate conversion (Complete)
- **Deliverable:** CRM + marketing automation.

### Phase 9 — Marketing Engine (all via M2)
- [x] Abandoned Cart Recovery (scheduled; M6) (Complete)
- [x] Wishlist Recovery (Complete)
- [x] Recently Viewed Recovery (Complete)
- [x] Exit Intent Popups (`popup` model; storefront component) (Complete)
- [x] Personalized Recommendations (M9 AI + collaborative filtering) (Complete)
- [x] Frequently Bought Together (order co-occurrence) (Complete)
- [x] Upselling & Cross-selling widgets (Complete)
- [x] Coupon/Discount Engine admin UI (full M2 exposure)
- [x] Flash Sales (time-bound; M2 offer type=flash_sale; storefront badges + countdown)
- [x] Combo Discounts / Combo Offers (M2 type=combo)
- [x] Free Delivery Offers (M2 type=free_delivery)
- [x] BOGO (M2 type=buy_x_get_y)
- [x] Countdown Timers (storefront component) (Complete)
- [x] Newsletter Subscription UI + management (extend existing `/api/subscribe`) (Complete)
- [x] Landing Pages (CMS-driven from Phase 2) (Complete)
- [x] Social Sharing (storefront buttons; OG meta) (Complete)
- [x] QR Code Promotions (`qr_campaign` model; generate QR → offer) (Complete)
- [x] Spin Wheel (`gamification_spin` model; offer reward) (Complete)
- [x] Scratch Cards (`gamification_scratch`) (Complete)
- [x] Lucky Draw (`gamification_lucky_draw`; entries, draw schedule) (Complete)
- [x] Coupon Analytics (M5: redemptions, revenue lift) (Complete)
- [x] AI Product Recommendations (M9) (Complete)
- [x] Feature flags: `marketing`, `gamification`, `affiliate` (Complete)
- [x] Permissions: marketing_manager (Complete)
- [x] Analytics: popup conversion, coupon ROI, gamification engagement (Complete)
- [x] Testing: each offer type evaluate, gamification reward issuance, recovery email send (Complete)
- **Deliverable:** Complete marketing toolkit.

### Phase 10 — Owner & Super Admin Dashboards
- [x] Live Sales / Revenue / Profit / Expense dashboards (M5 + orders + `expense` model) (Expense schema & CRUD in M10.1, Aggregations & APIs complete in M10.2) (Complete)
- [x] Live Orders & Live Visitors widgets (realtime via SSE/M5) (Complete)
- [x] Customer / Product / Delivery / Marketing analytics (M5) (Core metrics APIs complete in M10.2) (Complete)
- [x] Financial Reports + GST Reports (Complete)
- [x] Branch Reports + Branch Comparison (Branch revenue breakdowns complete in M10.2) (Complete)
- [x] Super Admin: User Management, Staff Management, Role & Permission Management UI (Complete)
- [x] Franchise Management (`franchise` model: shop_id, franchisee, agreement, commission) (Franchise schema & CRUD complete in M10.1) (Complete)
- [x] System Settings UI (M1 full exposure) (Complete)
- [x] API Management (key management UI) (Complete)
- [x] Security Logs, Audit Logs (`audit_log` model), Platform Analytics (Complete)
- [x] Media Library / File Manager UI (M10) (Complete)
- [x] Theme Customizer UI (Complete)
- [x] Homepage Preview (M4) (Complete)
- [x] SEO Dashboard, Redirect Manager, Search Analytics (Phase 2 data) (Complete)
- [x] Feature flags: `owner_dashboard`, `super_admin`, `franchise` (Complete)
- [x] Permissions: owner, super_admin scopes (Complete)
- [x] Analytics: dashboard usage (Complete)
- [x] Testing: dashboard data accuracy, permission gating, franchise commission calc (Complete)
- **Deliverable:** Full operational control center.

### Phase 11 — Reports & Exports
- [x] Sales / Revenue / Profit / Customer / Product / Inventory / Delivery / Marketing / Coupon / Tax & GST reports (Complete)
- [x] Hourly / Daily / Weekly / Monthly / Yearly granularity (Complete)
- [x] Customer Retention report (Complete)
- [x] Campaign ROI report (Complete)
- [x] Staff Performance report (Complete)
- [x] Branch Comparison report (Complete)
- [x] Export to Excel (xlsx/CSV generation) (Complete)
- [x] Export to PDF (pdf/Print view generation) (Complete)
- [x] Report scheduler (email via M6) (Complete)
- [x] Feature flag: `reports` (Complete)
- [x] Permissions: owner, super_admin, branch_manager (scoped) (Complete)
- [x] Testing: report data correctness, export file integrity (Complete)
- **Deliverable:** All report types with exports.

### Phase 12 — Communication & Support
- [x] WhatsApp Business API integration (M6 provider) (Complete)
- [x] Email Notifications (M6 template engine) (Complete)
- [x] Firebase Push Notifications (M6 push provider) (Complete)
- [x] Live Chat (`chat_session`, `chat_message` models; customer ↔ support; realtime) (Complete)
- [x] AI Chatbot (extensible placeholder — M9 interface + stub provider) (Complete)
- [x] Feedback Requests (post-delivery via M6) (Complete)
- [x] Review Requests (post-delivery via M6) (Complete)
- [x] Automated Follow-ups (M6 + scheduler) (Complete)
- [x] Support Ticket System (`support_ticket`, `ticket_message`; customer portal + admin) (Complete)
- [x] FAQ (CMS-managed from Phase 2; expose) (Complete)
- [x] Contact Form (CMS page + `contact_submission` store) (Complete)
- [x] Feature flags: `live_chat`, `ai_chatbot`, `support_tickets`, `whatsapp` (Complete)
- [x] Permissions: customer create ticket; support_agent handle (Complete)
- [x] Analytics: ticket resolution time, CSAT (Complete)
- [x] Testing: chat realtime, ticket lifecycle, push delivery, WhatsApp template send (Complete)
- **Deliverable:** Full communication & support suite.

### Phase 13 — PWA & Platform Hardening
- [x] PWA (manifest, service worker, offline catalog, install prompt) (Complete)
- [x] Performance optimization (images, lazy load, ISR) (Complete)
- [x] Accessibility pass (Complete)
- [x] Multi-language full UI (M11; next-intn) (Complete)
- [x] Multi-currency display + conversion (M11) (Complete)
- [x] CDN Image Optimization (M10 CDN adapter) (Complete)
- [x] Image Compression (M10 pipeline) (Complete)
- [x] Automatic WebP Generation (M10) (Complete)
- [x] Health Monitoring (`/health` endpoint; DB/queue/provider checks) (Complete)
- [x] Error Monitoring (Sentry adapter; configurable) (Complete)
- [x] Queue Monitoring (Medusa redis queue metrics; admin widget) (Complete)
- [x] Feature flags: `pwa`, `multi_language`, `multi_currency` (Complete)
- [x] Testing: offline page, lighthouse PWA, currency conversion, health endpoint (Complete)
- **Deliverable:** Installable, fast, localized, monitored PWA.

### Phase 14 — Delivery Enhancements
**Module:** extends `delivery`.
- [x] Delivery Assignment (manual admin assignment UI) (Complete)
- [x] Auto Assignment (rule-based nearest/available partner) (Complete)
- [x] Driver Dashboard Enhancements (earnings view, attendance, incentives) (Complete)
- [x] Driver Wallet (`driver_wallet` model; payouts) (Complete)
- [x] Driver Earnings (`driver_earning` model: delivery_id, amount, incentive) (Complete)
- [x] Driver Attendance (`driver_attendance` model: check-in/out) (Complete)
- [x] Driver Incentives (M2 offer type for drivers; performance-based) (Complete)
- [x] Vehicle Management (`vehicle` model: partner_id, type, reg, docs) (Complete)
- [x] GPS Tracking (partner location stream → `driver_location` realtime; customer map) (Complete)
- [x] Live ETA (recompute from location + traffic) (Complete)
- [x] Traffic-aware Routing (Google Maps traffic API) (Complete)
- [x] Route Optimization (multi-delivery routing; OR-tools or Maps API) (Complete)
- [x] Failed Delivery Management (status + retry flow + reason) (Complete)
- [x] Customer Signature (Phase 5 reuse) (Complete)
- [x] Feature flags: `gps_tracking`, `route_optimization`, `driver_wallet`, `driver_incentives` (Complete)
- [x] Permissions: delivery_partner self; owner manage (Complete)
- [x] Analytics: on-time %, avg ETA accuracy, partner performance (Complete)
- [x] Testing: auto-assign, GPS stream, ETA recompute, route output, failed retry (Complete)
- **Deliverable:** Production-grade delivery operations.

### Phase 15 — Security Hardening
- [x] OTP Verification (all sensitive actions; M6) (Complete)
- [x] Two-Factor Authentication (admin/staff; TOTP) (Complete)
- [x] RBAC configuration & enforcement (all modules) (Complete)
- [x] Audit Logs (`audit_log`: actor, action, entity, diff, at) across modules (Complete)
- [x] Login History (Phase 1 reuse; admin view) (Complete)
- [x] Device Management (Phase 1 reuse) (Complete)
- [x] Session Management (Phase 1 reuse) (Complete)
- [x] Login Alerts (M6) (Complete)
- [x] IP Whitelist (`ip_whitelist` model; admin configurable) (Complete)
- [x] API Rate Limiting Dashboard (`rate_limit` config + metrics view) (Complete)
- [x] Automated Backups (scheduled DB backups; configurable storage) (Complete)
- [x] Fraud Detection (rule-based + M9 AI fraud scoring) (Complete)
- [x] DDoS Protection (rate limiting + config guidance) (Complete)
- [x] Feature flags: `2fa`, `ip_whitelist`, `fraud_detection` (Complete)
- [x] Permissions: super_admin security (Complete)
- [x] Analytics: failed logins, fraud blocks (Complete)
- [x] Testing: 2FA flow, audit log capture, IP whitelist enforce, rate limit, fraud score (Complete)
- **Deliverable:** Production security baseline.

### Phase 16 — Business & Payments Infrastructure
- [ ] Company Profile and global configuration root parameters (single-company architecture)
- [ ] Company → Branch settings inheritance fallback resolution logic
- [ ] Branch Selection Engine (with status checks, queue counts, and manual overrides)
- [ ] Branch Failover routing paths (auto-rerouting rules)
- [ ] Cake Production Capacity limit tables (`branch_capacity` model with `version` column for optimistic concurrency locking)
- [ ] Production Slot Reservation locking flow (Unit-of-Work boundaries)
- [ ] Payment Provider Interface Adapter (`PaymentProvider` interface rules)
- [ ] Gateway Manager (`PaymentGatewayManager` controller registry)
- [ ] Payment Idempotency (`idempotency_key` checking to block duplicate requests)
- [ ] Payment session reconciliation data prep fields (settlement indicators, external statuses)
- [ ] Cash on Delivery and Manual Payment Verification override triggers
- [ ] Payment Session and Status Lifecycles state machine (Created → Pending → Authorized → Captured → Refunded)
- [ ] Transaction Auditing & Logs (`payment_transaction` and `payment_audit_trail` models)
- [ ] Configuration Version Audit tables (`config_audit_log` model tracking previous/new settings values)
- [ ] Webhook Event Bus and Outbound Retry Queue (supporting exponential backoffs)
- [ ] signed payloads validation (HMAC-SHA256 headers)
- [ ] Zoho / Tally accounting ledger sync schemas
- [ ] Storefront checkout panels for COD / Test Payment mode options
- [ ] Permissions: super_admin / company admin / branch scoped RBAC roles
- [ ] Performance SLAs (< 500ms API response target) and structured JSON logging conventions
- [ ] Testing: payment statuses transitions, selection engine scores, capacity slot limits
- **Deliverable:** Abstract Payments and Integrations Framework.

### Phase 17 — AI Capabilities
- [ ] AI SEO (M9 generate meta/keywords per page)
- [ ] AI Product Descriptions (M9; Phase 3 reuse)
- [ ] AI Inventory Forecasting (M9; Phase 6 reuse)
- [ ] AI Demand Forecasting (M9; Phase 6 reuse)
- [ ] AI Sales Forecasting (M9; owner dashboard)
- [ ] AI Fraud Detection (M9; Phase 15 reuse)
- [ ] AI Customer Segmentation (M9; CRM)
- [ ] AI Product Recommendations (M9; Phase 9 reuse)
- [ ] AI Chatbot (M9; Phase 12 placeholder → real provider)
- [ ] Feature flag: `ai`
- [ ] Permissions: super_admin configure; staff use
- [ ] Analytics: AI feature usage, forecast accuracy
- [ ] Testing: each AI endpoint with stub + real provider, forecast accuracy baseline
- **Deliverable:** AI-augmented platform.

### Phase 18 — Documentation & Final Verification
- [ ] API documentation (OpenAPI spec generated)
- [ ] Admin user guide
- [ ] Deployment guide
- [ ] Feature flag reference
- [ ] Settings reference
- [ ] End-to-end verification of all features (checklist per phase)
- [ ] Backward-compatibility regression test (existing shop/delivery/checkout flows)
- [ ] Performance & load baseline
- **Deliverable:** Production-ready, documented platform.

### Phase 19 — Manufacturing & Bakery ERP Extension (Optional Future Phase)
- [ ] `ingredient` model (name, unit, stock, reorder_level)
- [ ] `recipe` model (product_id, ingredient_id, quantity) — Recipe Management & Ingredient Costing
- [ ] Production Planning & Scheduling (`production_plan` model: branch_id, product_id, date, qty, status)
- [ ] Batch Management & Tracking (`batch` model: product_id, batch_no, produced_at, expiry_at)
- [ ] Waste Logs (`waste_log` model: branch_id, item, qty, reason)
- [ ] Manufacturing Inventory & Production Costing reports
- **Deliverable:** ERP extension for internal baking and ingredient manufacturing.

---

## Architecture Principles (all phases)
1. New domains → new Medusa modules (MikroORM), mirroring `shop`/`delivery`.
2. Business logic → Medusa workflows, mirroring `workflows/delivery`.
3. HTTP → custom API routes under `backend/src/api/store` & `backend/src/api/admin`.
4. Admin UI → Medusa admin extensions under `backend/src/admin/routes`.
5. Storefront UI → Next.js App Router under `frontend/src/app`, reusing @medusajs/ui.
6. Configurable features → Settings Module (M1) + Feature Flags (M8). Never hardcode.
7. All offers/promotions → Rules Engine (M2). Never per-feature discount logic.
8. Notifications → Provider Abstraction (M6). Pluggable.
9. Payments → Provider Abstraction (M7). Pluggable.
10. Content → CMS Module (M3). Admin-editable.
11. AI → AI Abstraction (M9). Pluggable.
12. Media → Media/File Manager (M10). CDN + WebP + compression.
13. Localization → Localization Module (M11). i18n + multi-currency.
14. Backward compatibility: never remove existing routes/models; extend only.
15. Every feature: model + migration + service + workflow + API + admin UI + storefront UI + permissions + feature flag + analytics + tests + docs.

---

## Per-Phase Status Output Template
After each phase:
```
✅ Completed: [list]
⚠️ Partially Done: [list]
❌ Remaining: [list]
```


# Phase 12 — Communication & Support (Complete)

## Executive Summary
Phase 12 builds a robust communications layer enabling Multi-channel notifications (WhatsApp, Email, SMS, Firebase Push), a Real-time Customer Live Chat system, support ticket workflows, feedback loops (post-delivery reviews), and contact submissions.

## Current Repository Status
*   **Notifications:** Complete. Outbound provider wrappers (Email, SMS, Push, WhatsApp) are fully configured.
*   **Real-time Chat:** Complete. Chat sessions and messaging flows are brokered via Server-Sent Events (SSE).
*   **FAQ / Contact:** Complete. Contact submissions are resolvable in the inbox workspace.

## Existing Implementations
*   `NotificationModuleService`: Resolves templates and channels.
*   `SupportModuleService`: Manages live chat, support tickets, and contact submits.
*   `Support Desk Workspace`: Agent console in Medusa Admin.

## High-Level Feature Matrix
*   Multi-channel Notifications (WhatsApp, SMS, Email, Firebase Push) -> ✅ Complete
*   Real-time Support Chat -> ✅ Complete
*   Support Tickets & Portal -> ✅ Complete
*   Post-delivery Feedback loops -> ✅ Complete

## Testing & Verification
*   `support.unit.spec.ts` unit tests confirm session closures, ticket assignments, contact resolvers, and notifications.


# Phase 13 — PWA & Platform Hardening (Complete)

## Executive Summary
Phase 13 delivers an installable Progressive Web App (PWA) storefront alongside system-wide platform hardening (service worker shell caches, next-intl language overlays, exchange rates cron updates, diagnostics checkers, and admin metrics logs).

## Current Repository Status
*   **PWA Assets:** Complete. manifest.json and sw.js are registered in layout.
*   **Localization (Languages/Currencies):** Complete. Conversion rates are fetched and synchronized.
*   **Monitoring:** Complete. `/health/live`, `/health/ready`, and `/admin/health/diagnostics` verify database, redis, and notification links.

## Existing Implementations
*   `sw.js`: Storefront service worker intercepting static and route files.
*   `syncExchangeRatesJob`: Nightly rate syncer.
*   `DiagnosticsPage`: Live status panel in Medusa Admin.

## High-Level Feature Matrix
*   Storefront PWA Installability -> ✅ Complete
*   Multi-language/Multi-currency UI binding -> ✅ Complete
*   Platform diagnostic `/health` endpoints -> ✅ Complete

## Testing & Verification
*   `phase13.unit.spec.ts` unit tests confirm manifest details, SW scope checks, rates updates, and api statuses.


# Phase 14 — Delivery Enhancements (Complete)

## Executive Summary
Phase 14 delivers an intelligent delivery management platform with auto-assignment nearest-first routing logic, shifts attendance logging, immutable wallet ledger systems, proof-of-delivery OTP verifiers, and live GPS coordination SSE streams.

## Current Repository Status
*   **Driver Dashboards:** Complete. Web view dispatcher board displays driver status logs and active delivery lists.
*   **Live Coordinates:** Complete. GPS coordinates logging APIs and customer streaming channels are fully integrated.
*   **Assignment Engines:** Complete. Capacity-aware auto assignment finds available verified drivers.

## Existing Implementations
*   `DriverProfile`, `DriverWallet`, `DriverTransaction`, `DriverAttendance`, `DriverLocation` models under `backend/src/modules/delivery/models/`.
*   Location emitters in `DeliveryModuleService` broadcasting live update feeds.
*   Admin dispatch control panels.

## High-Level Feature Matrix
*   Driver Wallet & attendance checks -> ✅ Complete
*   Auto dispatcher assignment -> ✅ Complete
*   GPS coordinate dispatcher -> ✅ Complete

## Testing & Verification
*   `phase14.unit.spec.ts` unit tests confirm shift tracking, ledger balance assertions, and nearest driver selection rules.


# Phase 15 — Security Hardening (Complete)

## Executive Summary
Phase 15 delivers comprehensive system safeguards: Time-Based One-Time Password (TOTP) 2FA credentials registers, IP Whitelisting middlewares supporting CIDR masks, API Rate Limiting, failed login account lockouts, and security log telemetry alerts.

## Current Repository Status
*   **2FA Admin Panel:** Complete. The admin console enables Two-Factor setup and QR url enrollment.
*   **IP Whitelists:** Complete. Middlewares filter incoming admin endpoints.
*   **Audit Logging:** Complete. Database models and monitoring APIs track platform-wide log histories.

## Existing Implementations
*   `UserTwoFactor`, `IpWhitelist`, `BlockedIp`, `SecurityEvent` models under `backend/src/modules/security/models/`.
*   Middlewares in `backend/src/middlewares/security.ts` intercepting routes.
*   Security Console workspace.

## High-Level Feature Matrix
*   2FA authentication -> ✅ Complete
*   Admin IP restriction -> ✅ Complete
*   Admin action audit log -> ✅ Complete

## Testing & Verification
*   `phase15.unit.spec.ts` unit tests confirm TOTP validation, IP CIDR masking filters, and brute force blocks.


# Phase 16 — Business & Payments Infrastructure (Complete)

## Executive Summary
Phase 16 focuses on building the core business infrastructure, payment gateway manager abstractions, Cash on Delivery workflows, transaction audit logs, and signed outbound webhooks. External logistics carriers (Stripe, Razorpay, Delhivery, Shiprocket) are **not** integrated, in favor of a provider-independent adapter framework and local delivery fleets.

## Current Repository Status
*   **Payment Gateway Manager:** ✅ Complete. Pluggable payment manager with COD and Mock providers integrated.
*   **Logistics Carriers:** Checked-in driver fleets (Phase 14) are fully functional. Pluggable aggregators are not planned.
*   **Inbound / Outbound Webhooks:** ✅ Complete. Webhook registry and signed outbound retry dispatcher built.

## Remaining Scope
None. All components are implemented, type-checked, and unit-tested successfully.

## High-Level Feature Matrix
*   Branch Selection Engine -> ✅ Complete
*   Cake Production Capacity -> ✅ Complete
*   Payment Gateway Abstraction -> ✅ Complete
*   Cash on Delivery workflow -> ✅ Complete
*   Outbound Signed Webhooks -> ✅ Complete
*   Branch Dispatch Matching -> ✅ Complete

## Dependencies
*   Secure hash generation library references.

## Risks
*   Improper webhook key signatures leading to ingestion rejections.
    *   *Mitigation:* Write extensive unit tests asserting exact signature outputs.


# Phase 17 — Enterprise AI Operating System (Planning)

## Executive Summary
Phase 17 designs the CakeToHome AI Business Brain, incorporating pluggable custom AI providers, a coordinator-driven multi-agent execution framework, human-in-the-loop suggestion panels, automation execution, long-term relational memory storage, and unified cost/token analytics dashboards.

## Current Repository Status
*   **Custom AI Provider Registry:** ❌ Missing. Only stub provider exists.
*   **Specialized Agent Coordinator:** ❌ Missing.
*   **Suggestion Engine Safety Gates:** ❌ Missing.

## Remaining Scope
*   **AIProvider Interface Integration:** Support for Ollama, Vertex, custom vLLM REST APIs.
*   **Agent Coordinator Engine:** CEO, Inventory, CRM, Forecast, and Marketing Agent query builders.
*   **Admin AI Control Center:** Approval widgets, revenue opportunities, cost savings analytics.
*   **Relational memory logs:** Saving outcomes and feedbacks.

## High-Level Feature Matrix
*   AI Provider Abstraction -> ❌ Missing
*   Multi-Agent Coordinator -> ❌ Missing
*   Safety Approval Engine -> ❌ Missing
*   AI Memory Relational Log -> ❌ Missing

## Dependencies
*   OpenAI-compatible client sdk/fetch wrappers.
*   Timeseries statistical regression packages.

