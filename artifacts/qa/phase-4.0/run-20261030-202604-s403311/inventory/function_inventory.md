# CakeToHome Application Function Inventory (Phase 4.0)

**Run ID:** `run-20261030-202604-s403311`  
**Total Modules Analyzed:** 74 (66 Baseline Checklist Modules + 8 Discovered Extensions)  

| ID | Module Name | Category | Status | Primary Routes | Key Database Tables | Elements & Scope |
|---|---|---|---|---|---|---|
| **MOD-01** | Storefront | Storefront & Catalog | `PRESENT` | `/`<br>`/shop` | `product`, `city` | Verify page load, header, footer, product cards, category navigation, city selection modal. |
| **MOD-02** | Navigation and routing | Storefront & Catalog | `PRESENT` | `/categories`<br>`/occasions`<br>`/category/[slug]`<br>`/occasions/[slug]` | `product` | Verify client-side navigation between categories, occasions, and landing pages without hydration mismatch. |
| **MOD-03** | Authentication | Auth & Identity | `PRESENT` | `/login`<br>`/signup`<br>`/api/auth/session`<br>`/api/auth/me`<br>`/api/auth/logout` | `customer` | Verify phone OTP dispatch, session token cookie issuance, authenticated state in header, and logout. |
| **MOD-04** | User management | Auth & Identity | `PRESENT` | `/account`<br>`/account/addresses`<br>`/account/orders` | `customer`, `customer_address` | Verify profile update, address creation, default address selection, and session persistence. |
| **MOD-05** | Roles and permissions | Auth & Identity | `PRESENT` | `/dashboard`<br>`/dashboard/shop`<br>`/api/v1/admin/[...path]` | `setting` | Verify RBAC enforcement, unauthorized route redirection, and branch-scoped actions. |
| **MOD-06** | Customer management | Customers | `PRESENT` | `/dashboard/shop`<br>`/api/v1/admin/customers` | `customer`, `customer_address` | Verify customer profile queries, order aggregation, and address resolution. |
| **MOD-07** | Product catalog | Storefront & Catalog | `PRESENT` | `/products`<br>`/products/[id]` | `product`, `product_variant` | Verify catalog listing, product detail rendering, pricing logic, and active product filtering. |
| **MOD-08** | Product categories | Storefront & Catalog | `PRESENT` | `/category/[slug]`<br>`/categories` | `product` | Verify category filtering, placeholder fallback rendering via getCategoryPlaceholder(). |
| **MOD-09** | Product variants | Storefront & Catalog | `PRESENT` | `/products/[id]` | `product_variant`, `variant_option` | Verify dynamic price updates upon selecting variant options and weight multipliers. |
| **MOD-10** | Cake customization | Storefront & Catalog | `PRESENT` | `/products/[id]` | N/A | Verify eggless surcharge (+₹50/₹100), custom message persistence in cart line item metadata. |
| **MOD-11** | Accessories and merchandise | Storefront & Catalog | `PRESENT` | `/products/[id]`<br>`/cart` | `product` | Verify accessory rendering uses /images/placeholder-accessory.svg or designated topper asset with ZERO cake image leaks. |
| **MOD-12** | Search | Discovery | `PRESENT` | `/search` | `product` | Verify query execution, typo tolerance, keyword matching on title and description. |
| **MOD-13** | Filters and sorting | Discovery | `PRESENT` | `/shop`<br>`/category/[slug]` | `product` | Verify facet selection updates URL query params and filters product grid correctly. |
| **MOD-14** | Pagination | Discovery | `PRESENT` | `/shop` | `product` | Verify page navigation, boundary conditions (first/last page), and limit parameters. |
| **MOD-15** | CMS | Content | `PRESENT` | `/[slug]`<br>`/blog`<br>`/blog/[slug]` | `cms_page`, `cms_homepage_section` | Verify CMS page retrieval, slug resolution, page_type property handling, and fallback behavior. |
| **MOD-16** | Cart | Commerce | `PRESENT` | `/cart` | N/A | Verify item addition, quantity updates, item removal, cart persistence in localStorage/session. |
| **MOD-17** | Checkout | Commerce | `PRESENT` | `/checkout`<br>`/your-order` | `order`, `order_item`, `order_line_item` | Verify delivery address validation, slot selection, and checkout submission. |
| **MOD-18** | Discounts and coupons | Commerce | `PRESENT` | `/cart`<br>`/checkout` | `offer` | Verify coupon code validation, percentage/fixed discount deduction, and invalid code rejection. |
| **MOD-19** | Tax calculation | Commerce & GST | `PRESENT` | `/checkout`<br>`/your-order` | `gst_registration` | Verify 18% GST calculation (9% CGST + 9% SGST for intra-state KA; 18% IGST for inter-state). |
| **MOD-20** | Delivery and pickup | Fulfillment | `PRESENT` | `/checkout`<br>`/dashboard/delivery-partner` | `delivery_partner`, `delivery_zone` | Verify delivery method selection, delivery fees addition, and delivery coverage checks. |
| **MOD-21** | Branch management | Fulfillment | `PRESENT` | `/api/v1/branches`<br>`/api/v1/admin/branches`<br>`/dashboard/shop` | `branch`, `city` | Verify branch listing across Koramangala, Indiranagar, Whitefield, Jayanagar, HSR, Malleshwaram. |
| **MOD-22** | Delivery slot management | Fulfillment | `PRESENT` | `/checkout` | N/A | Verify slot generation logic (morning, afternoon, evening, midnight) and cutoff times. |
| **MOD-23** | Order creation | Orders | `PRESENT` | `/checkout`<br>`/api/v1/orders/checkout` | `order`, `order_item`, `order_line_item` | Verify display ID generation from order_display_id_seq (e.g. 98588) and metadata preservation. |
| **MOD-24** | Order management | Orders | `PRESENT` | `/dashboard/shop`<br>`/account/orders` | `order`, `order_item` | Verify order retrieval, search by order ID, filtering by date and branch. |
| **MOD-25** | Order status transitions | Orders | `PRESENT` | `/dashboard/shop` | `order`, `order_status_history` | Verify lifecycle progression (pending -> confirmed -> baking -> dispatched -> delivered). |
| **MOD-26** | Payment initiation | Payments | `PRESENT` | `/checkout` | `payment_transaction` | Verify payment transaction record creation in PENDING state with unique gateway reference. |
| **MOD-27** | Payment confirmation | Payments | `PRESENT` | `/your-order` | `payment_transaction`, `order` | Verify transaction state update to SUCCESS, order payment_status updated to PAID. |
| **MOD-28** | Payment webhooks | Payments | `PRESENT` | `/api/v1/[...path]` | `payment_transaction` | Verify signature verification, idempotency key checking, and asynchronous status update. |
| **MOD-29** | Refunds | Payments | `PRESENT` | `/dashboard/shop`<br>`/api/v1/[...path]` | `payment_transaction`, `accounting_voucher` | Verify refund record creation and accounting voucher posting. |
| **MOD-30** | Inventory | Inventory | `PRESENT` | `/dashboard/shop` | `branch_inventory` | Verify branch stock level queries across 156 branch inventory records. |
| **MOD-31** | Stock movements | Inventory | `PRESENT` | `/api/v1/[...path]` | `inventory_movement`, `branch_inventory` | Verify stock movement audit logging upon order dispatch or manual adjustment. |
| **MOD-32** | Inventory transfers | Inventory | `PRESENT` | `/api/v1/[...path]` | `inventory_movement`, `branch_inventory` | Verify inter-branch stock reallocation and inventory balance updates. |
| **MOD-33** | Low-stock alerts | Inventory | `PRESENT` | `/dashboard/shop` | `branch_inventory` | Verify threshold triggers when available_quantity drops below reorder_level. |
| **MOD-34** | Invoicing | Invoicing & GST | `PRESENT` | `/dashboard/shop`<br>`/account/orders/[id]` | `invoice`, `invoice_allocation_log` | Verify tax invoice issuance, line items, CGST/SGST amounts, and total reconciliation. |
| **MOD-35** | Invoice numbering | Invoicing & GST | `PRESENT` | `/api/v1/[...path]` | `invoice_sequence` | Verify sequential numbering under Rule 46; verify fail-closed protection on entity mismatch. |
| **MOD-36** | GST registration and tax configuration | Invoicing & GST | `PRESENT` | `/dashboard/page.tsx`<br>`/api/v1/[...path]` | `gst_registration`, `company` | Verify GSTIN 29AABCC1234F1Z5 configuration for CakeToHome India Private Limited. |
| **MOD-37** | Invoice PDF or print | Invoicing & GST | `PRESENT` | `/dashboard/shop`<br>`/account/orders/[id]` | `invoice` | Verify formatted invoice preview dialog and print stylesheet. |
| **MOD-38** | Vouchers | Accounting | `PRESENT` | `/dashboard/page.tsx`<br>`/api/v1/[...path]` | `accounting_voucher` | Verify double-entry voucher creation, posting guards, and cancellation lifecycle. |
| **MOD-39** | Accounting or ledger integration | Accounting | `PRESENT` | `/dashboard/page.tsx`<br>`/api/v1/[...path]` | `accounting_account`, `accounting_journal_entry`, `accounting_journal_line` | Verify 98 standard accounts, journal lines balancing (Debit = Credit). |
| **MOD-40** | Financial reconciliation | Accounting | `PRESENT` | `/dashboard/page.tsx`<br>`/api/v1/[...path]` | `accounting_account` | Verify Trial Balance net difference = 0, BRS bank ledger vs statement reconciliation. |
| **MOD-41** | Reports | Analytics & Reports | `PRESENT` | `/dashboard/page.tsx`<br>`/api/v1/[...path]` | `order`, `invoice` | Verify GSTR-1, GSTR-3B, Sales Summary, and AR Aging report generation. |
| **MOD-42** | Dashboard KPIs | Analytics & Reports | `PRESENT` | `/dashboard`<br>`/dashboard/shop` | `order` | Verify real-time calculation of key executive and branch operational metrics. |
| **MOD-43** | Data exports | Analytics & Reports | `PRESENT` | `/dashboard/page.tsx`<br>`/api/v1/[...path]` | N/A | Verify ExcelExportService generates valid XLSX / CSV streams without crashing. |
| **MOD-44** | Notifications | Communications | `PRESENT` | `/api/v1/[...path]` | N/A | Verify client-side toast triggers on order creation, cart updates, and errors. |
| **MOD-45** | Email integration | Communications | `PARTIAL` | `/api/v1/[...path]` | N/A | Verify email template compilation and mock dispatch logging in test mode. |
| **MOD-46** | SMS integration | Communications | `PARTIAL` | `/api/v1/[...path]` | N/A | Verify SMS gateway adapter logs OTP dispatch in test/dev environment. |
| **MOD-47** | WhatsApp integration | Communications | `PARTIAL` | `/api/v1/[...path]` | N/A | Verify WhatsApp message payload composition and simulated webhook response. |
| **MOD-48** | File uploads | Media | `PRESENT` | `/api/v1/[...path]`<br>`/products/[id]` | N/A | Verify file type validation (image/jpeg, image/png), size limits, and storage. |
| **MOD-49** | Image processing and fallback | Media | `PRESENT` | `/products/[id]`<br>`/categories` | N/A | Verify getCategoryPlaceholder() returns placeholder-accessory.svg for accessories and placeholder-cake.jpg for cakes. |
| **MOD-50** | Document generation | Invoicing & GST | `PRESENT` | `/dashboard/shop`<br>`/account/orders/[id]` | `invoice` | Verify GST tax invoice document rendering with legal entity details, HSN, and breakdown. |
| **MOD-51** | Settings | Admin | `PRESENT` | `/dashboard`<br>`/dashboard/page.tsx` | `setting` | Verify setting persistence via persistSettingToDb() without affecting master tables. |
| **MOD-52** | Audit logs | Admin | `PRESENT` | `/dashboard/shop`<br>`/api/v1/[...path]` | `order_status_history` | Verify audit log entries created on every status transition with user and timestamp. |
| **MOD-53** | Background workers | Operations | `PRESENT` | `/api/v1/[...path]` | N/A | Verify background reconciliation task handles scheduled triggers idempotently. |
| **MOD-54** | Scheduled jobs | Operations | `PRESENT` | `/api/v1/[...path]` | N/A | Verify end-of-day operational closure service aggregates shift balances correctly. |
| **MOD-55** | Webhook management | Operations | `PRESENT` | `/api/v1/[...path]` | N/A | Verify signature validation, replay attack prevention, and error logging. |
| **MOD-56** | API security | Security | `PRESENT` | `/api/v1/[...path]`<br>`/api/auth/[...path]` | N/A | Verify unauthenticated requests to protected endpoints return 401/403. |
| **MOD-57** | Database migrations | Database | `PRESENT` | N/A | `accounting_account`, `invoice`, `order`, `branch_inventory` | Verify schema definitions, foreign key constraints, and index preservation. |
| **MOD-58** | Multi-branch isolation | Fulfillment | `PRESENT` | `/dashboard/shop` | `branch`, `branch_inventory`, `order` | Verify store managers cannot view or fulfill orders allocated to other branches. |
| **MOD-59** | Tenant isolation if multi-tenancy exists | Architecture | `PRESENT` | `/api/v1/[...path]` | `company`, `gst_registration` | Verify single-tenant retail architecture with strict entity-level GSTIN isolation. |
| **MOD-60** | Accessibility | Quality | `PRESENT` | `/`<br>`/products/[id]`<br>`/cart`<br>`/checkout` | N/A | Verify image alt tags, button aria-labels, and modal keyboard focus management. |
| **MOD-61** | Responsive UI | Quality | `PRESENT` | `/`<br>`/shop`<br>`/products/[id]`<br>`/checkout` | N/A | Verify mobile (375x667), tablet (768x1024), and desktop (1280x800) viewport rendering. |
| **MOD-62** | Performance | Quality | `PRESENT` | `/`<br>`/shop`<br>`/products/[id]` | N/A | Verify initial DOM load times, TTFB, and zero blocking script execution. |
| **MOD-63** | Error recovery | Resilience | `PRESENT` | `/offline`<br>`/checkout` | N/A | Verify graceful handling of network disconnections, API timeouts, and client recovery. |
| **MOD-64** | Monitoring and diagnostics | Operations | `PRESENT` | `/api/v1/admin/ai/analytics` | N/A | Verify diagnostic API responses, error reporting counters, and system health status. |
| **MOD-65** | Deployment configuration | DevOps | `PRESENT` | N/A | N/A | Verify environment variables resolution, asset prefixing, and build scripts. |
| **MOD-66** | Backup and recovery | DevOps | `PRESENT` | N/A | N/A | Verify database template cloning and point-in-time recovery to cth_disposable_phase4_0. |
| **MOD-67** | Corporate Gifting & Bulk Orders | Discovered Extension | `PRESENT` | `/dashboard/page.tsx` | `order`, `customer` | Verify multi-recipient bulk order upload, roster validation, and batch execution. |
| **MOD-68** | Teller Custody & Cash Management | Discovered Extension | `PRESENT` | `/dashboard/page.tsx` | `accounting_voucher`, `branch` | Verify cash drawer lifecycle: opening float, shift sales tracking, adjustments, closing count. |
| **MOD-69** | Bank Reconciliation Statement (BRS) | Discovered Extension | `PRESENT` | `/dashboard/page.tsx` | `accounting_account`, `accounting_voucher` | Verify matching of cleared bank transactions against GL cash-at-bank ledger. |
| **MOD-70** | Enterprise Financial Reports Engine | Discovered Extension | `PRESENT` | `/dashboard/page.tsx` | `accounting_account`, `accounting_journal_line` | Verify automated generation of financial statements from double-entry general ledger lines. |
| **MOD-71** | PIM Editor & Product Management | Discovered Extension | `PRESENT` | `/dashboard/shop/menu` | `product`, `product_variant` | Verify catalog manager editing of product descriptions, SKUs, and pricing in disposable database. |
| **MOD-72** | SEO Audit Engine & Local SEO | Discovered Extension | `PRESENT` | `/api/v1/[...path]`<br>`/city/[slug]` | `city` | Verify city landing page SEO metadata injection (Bangalore, Mysore) and sitemap URLs. |
| **MOD-73** | Telemarketing & CRM Segments | Discovered Extension | `PRESENT` | `/api/v1/[...path]` | `customer`, `order` | Verify segmentation of high-value and lapsed customers for targeted marketing calls. |
| **MOD-74** | Marketplace Partner Reconciliation | Discovered Extension | `PRESENT` | `/api/v1/[...path]` | `order`, `invoice` | Verify channel commission deductions and marketplace payout reconciliation. |
