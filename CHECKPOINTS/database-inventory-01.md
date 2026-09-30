# Database Inventory Audit Report — CakeToHome Platform
**Checkpoint ID:** `database-inventory-01`  
**Timestamp:** 2026-09-20T12:29:29.826Z  
**Target Database:** PostgreSQL 17.6 (Supabase Managed Pooler)  
**Schema Audited:** `public`  
**Total Base Tables:** 275  
**Total Views:** 0  
**Total Sequences:** 8  
**Total Triggers:** 0  
**Total Functions:** 0  
**Total Custom Enums:** 4  
**Recorded Migrations:** 215  

---

## 1. Executive Summary & Table Classification Breakdown

| Classification | Table Count | Active In Code | Zero Rows | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **CakeToHome Custom** | 28 | 28 | 21 | Custom bakery domain tables (branches, CMS, delivery slots, physical accessory inventory, outreach). |
| **Medusa Core** | 117 | 117 | 65 | Standard Medusa Framework v2 e-commerce schema. |
| **Test / Prototype / Legacy** | 0 | 0 | 0 | Backup/temp tables if any. |
| **Other / Candidate Orphaned** | 130 | 130 | 97 | Tables not explicitly tagged by prefix. |
| **TOTAL** | **275** | **275** | **183** | Complete public schema. |

---

## 2. Key Business Tables & Row Counts (High Signal)

| Table Name | Row Count | Primary Key | Used in Code | JSONB Columns | Classification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `analytics_event` | **18** | `id` | ✅ Yes (3) | `none` | OTHER |
| `api_key` | **2** | `id` | ✅ Yes (1) | `none` | MEDUSA_CORE |
| `audit_log` | **13** | `id` | ✅ Yes (5) | `none` | OTHER |
| `auth_identity` | **2** | `id` | ✅ Yes (1) | `app_metadata` | OTHER |
| `branch` | **57** | `id` | ✅ Yes (232) | `metadata` | CAKETOHOME_CUSTOM |
| `branch_capacity` | **0** | `id` | ✅ Yes (5) | `blackout_dates` | CAKETOHOME_CUSTOM |
| `branch_inventory` | **424** | `id` | ✅ Yes (11) | `none` | CAKETOHOME_CUSTOM |
| `branch_price` | **0** | `id` | ✅ Yes (4) | `none` | CAKETOHOME_CUSTOM |
| `branch_region` | **3** | `id` | ✅ Yes (4) | `none` | CAKETOHOME_CUSTOM |
| `branch_settings` | **0** | `id` | ✅ Yes (5) | `metadata` | CAKETOHOME_CUSTOM |
| `branch_staff` | **0** | `id` | ✅ Yes (4) | `metadata` | CAKETOHOME_CUSTOM |
| `cart` | **35** | `id` | ✅ Yes (117) | `metadata` | MEDUSA_CORE |
| `cart_address` | **1** | `id` | ✅ Yes (1) | `metadata` | MEDUSA_CORE |
| `cart_line_item` | **28** | `id` | ✅ Yes (2) | `variant_option_values, raw_compare_at_unit_price, raw_unit_price, metadata` | MEDUSA_CORE |
| `cart_line_item_tax_line` | **1** | `id` | ✅ Yes (1) | `metadata` | MEDUSA_CORE |
| `cart_payment_collection` | **1** | `cart_id, payment_collection_id` | ✅ Yes (1) | `none` | MEDUSA_CORE |
| `city` | **30** | `id` | ✅ Yes (171) | `none` | CAKETOHOME_CUSTOM |
| `cms_asset_reference` | **0** | `id` | ✅ Yes (3) | `none` | CAKETOHOME_CUSTOM |
| `cms_banner` | **0** | `id` | ✅ Yes (3) | `none` | CAKETOHOME_CUSTOM |
| `cms_block` | **0** | `id` | ✅ Yes (3) | `none` | CAKETOHOME_CUSTOM |
| `cms_category` | **0** | `id` | ✅ Yes (3) | `none` | CAKETOHOME_CUSTOM |
| `cms_homepage_section` | **32** | `id` | ✅ Yes (6) | `none` | CAKETOHOME_CUSTOM |
| `cms_navigation` | **0** | `id` | ✅ Yes (4) | `none` | CAKETOHOME_CUSTOM |
| `cms_page` | **22** | `id` | ✅ Yes (18) | `none` | CAKETOHOME_CUSTOM |
| `cms_redirect` | **0** | `id` | ✅ Yes (4) | `none` | CAKETOHOME_CUSTOM |
| `cms_revision` | **0** | `id` | ✅ Yes (3) | `none` | CAKETOHOME_CUSTOM |
| `cms_tag` | **0** | `id` | ✅ Yes (3) | `none` | CAKETOHOME_CUSTOM |
| `cms_template` | **0** | `id` | ✅ Yes (3) | `none` | CAKETOHOME_CUSTOM |
| `crm_campaign` | **0** | `id` | ✅ Yes (7) | `filters, audience, metadata` | CAKETOHOME_CUSTOM |
| `currency` | **126** | `code` | ✅ Yes (43) | `raw_rounding` | OTHER |
| `customer` | **57** | `id` | ✅ Yes (275) | `metadata` | MEDUSA_CORE |
| `customer_address` | **34** | `id` | ✅ Yes (5) | `metadata` | MEDUSA_CORE |
| `customer_favorite` | **1** | `id` | ✅ Yes (3) | `none` | MEDUSA_CORE |
| `customer_phone` | **2** | `id` | ✅ Yes (56) | `none` | MEDUSA_CORE |
| `delivery` | **55** | `id` | ✅ Yes (347) | `none` | OTHER |
| `delivery_delivery_partner` | **5** | `id` | ✅ Yes (5) | `none` | OTHER |
| `delivery_partner` | **30** | `id` | ✅ Yes (73) | `none` | OTHER |
| `delivery_slot` | **0** | `id` | ✅ Yes (29) | `none` | CAKETOHOME_CUSTOM |
| `delivery_zone` | **44** | `id` | ✅ Yes (17) | `polygon_coordinates` | OTHER |
| `fulfillment_provider` | **1** | `id` | ✅ Yes (1) | `none` | MEDUSA_CORE |
| `fulfillment_set` | **1** | `id` | ✅ Yes (1) | `metadata` | MEDUSA_CORE |
| `geo_zone` | **7** | `id` | ✅ Yes (1) | `postal_expression, metadata` | OTHER |
| `inventory_item` | **5** | `id` | ✅ Yes (1) | `metadata` | MEDUSA_CORE |
| `lead_enquiry` | **1** | `id` | ✅ Yes (2) | `none` | OTHER |
| `link_module_migrations` | **24** | `id` | ✅ Yes (1) | `link_descriptor` | OTHER |
| `location_fulfillment_provider` | **1** | `stock_location_id, fulfillment_provider_id` | ✅ Yes (1) | `none` | OTHER |
| `location_fulfillment_set` | **1** | `stock_location_id, fulfillment_set_id` | ✅ Yes (1) | `none` | OTHER |
| `login_event` | **10** | `id` | ✅ Yes (3) | `none` | OTHER |
| `marketing_campaign` | **0** | `id` | ✅ Yes (3) | `none` | CAKETOHOME_CUSTOM |
| `marketing_campaign_event` | **0** | `id` | ✅ Yes (3) | `none` | CAKETOHOME_CUSTOM |
| `marketing_campaign_metric` | **0** | `id` | ✅ Yes (3) | `none` | CAKETOHOME_CUSTOM |
| `media` | **142** | `id` | ✅ Yes (55) | `none` | OTHER |
| `mikro_orm_migrations` | **215** | `id` | ✅ Yes (1) | `none` | MEDUSA_CORE |
| `notification_provider` | **1** | `id` | ✅ Yes (1) | `none` | MEDUSA_CORE |
| `offer` | **24** | `id` | ✅ Yes (76) | `none` | OTHER |
| `order` | **173** | `id` | ✅ Yes (298) | `metadata` | MEDUSA_CORE |
| `order_event` | **13** | `id` | ✅ Yes (3) | `none` | MEDUSA_CORE |
| `order_status_history` | **82** | `id` | ✅ Yes (10) | `none` | MEDUSA_CORE |
| `payment_audit_trail` | **14** | `id` | ✅ Yes (4) | `none` | MEDUSA_CORE |
| `payment_collection` | **1** | `id` | ✅ Yes (1) | `raw_amount, raw_authorized_amount, raw_captured_amount, raw_refunded_amount, metadata` | MEDUSA_CORE |
| `payment_provider` | **1** | `id` | ✅ Yes (8) | `none` | MEDUSA_CORE |
| `payment_session` | **1** | `id` | ✅ Yes (1) | `raw_amount, data, context, metadata` | MEDUSA_CORE |
| `payment_transaction` | **51** | `id` | ✅ Yes (11) | `none` | MEDUSA_CORE |
| `popup_campaigns` | **5** | `id` | ✅ Yes (3) | `none` | CAKETOHOME_CUSTOM |
| `price` | **23** | `id` | ✅ Yes (119) | `raw_amount, raw_min_quantity, raw_max_quantity` | OTHER |
| `price_preference` | **3** | `id` | ✅ Yes (1) | `none` | OTHER |
| `price_rule` | **2** | `id` | ✅ Yes (1) | `none` | OTHER |
| `price_set` | **13** | `id` | ✅ Yes (4) | `none` | OTHER |
| `product` | **65** | `id` | ✅ Yes (198) | `metadata` | MEDUSA_CORE |
| `product_category` | **11** | `id` | ✅ Yes (5) | `metadata` | MEDUSA_CORE |
| `product_category_product` | **6** | `product_id, product_category_id` | ✅ Yes (2) | `none` | MEDUSA_CORE |
| `product_option` | **23** | `id` | ✅ Yes (1) | `metadata` | MEDUSA_CORE |
| `product_option_value` | **23** | `id` | ✅ Yes (1) | `metadata` | MEDUSA_CORE |
| `product_product_option` | **23** | `id` | ✅ Yes (1) | `none` | MEDUSA_CORE |
| `product_product_option_value` | **23** | `id` | ✅ Yes (1) | `none` | MEDUSA_CORE |
| `product_sales_channel` | **6** | `product_id, sales_channel_id` | ✅ Yes (1) | `none` | MEDUSA_CORE |
| `product_variant` | **27** | `id` | ✅ Yes (4) | `metadata` | MEDUSA_CORE |
| `product_variant_inventory_item` | **5** | `variant_id, inventory_item_id` | ✅ Yes (1) | `none` | MEDUSA_CORE |
| `product_variant_option` | **11** | `variant_id, option_value_id` | ✅ Yes (1) | `none` | MEDUSA_CORE |
| `product_variant_price_set` | **11** | `variant_id, price_set_id` | ✅ Yes (1) | `none` | MEDUSA_CORE |
| `promotion_campaign` | **0** | `id` | ✅ Yes (1) | `none` | CAKETOHOME_CUSTOM |
| `promotion_campaign_budget` | **0** | `id` | ✅ Yes (1) | `raw_limit, raw_used` | CAKETOHOME_CUSTOM |
| `promotion_campaign_budget_usage` | **0** | `id` | ✅ Yes (1) | `raw_used` | CAKETOHOME_CUSTOM |
| `provider_identity` | **2** | `id` | ✅ Yes (1) | `user_metadata, provider_metadata` | OTHER |
| `publishable_api_key_sales_channel` | **2** | `publishable_key_id, sales_channel_id` | ✅ Yes (1) | `none` | MEDUSA_CORE |
| `refund_reason` | **3** | `id` | ✅ Yes (4) | `metadata` | OTHER |
| `region` | **1** | `id` | ✅ Yes (16) | `metadata` | MEDUSA_CORE |
| `region_country` | **250** | `iso_2` | ✅ Yes (1) | `metadata` | MEDUSA_CORE |
| `region_payment_provider` | **1** | `region_id, payment_provider_id` | ✅ Yes (1) | `none` | MEDUSA_CORE |
| `sales_channel` | **1** | `id` | ✅ Yes (2) | `metadata` | MEDUSA_CORE |
| `sales_channel_stock_location` | **1** | `sales_channel_id, stock_location_id` | ✅ Yes (1) | `none` | MEDUSA_CORE |
| `script_migrations` | **5** | `id` | ✅ Yes (1) | `none` | OTHER |
| `security_event` | **63** | `id` | ✅ Yes (3) | `none` | OTHER |
| `security_ip_whitelist` | **8** | `id` | ✅ Yes (3) | `none` | OTHER |
| `service_zone` | **1** | `id` | ✅ Yes (1) | `metadata` | OTHER |
| `setting` | **16** | `id` | ✅ Yes (20) | `none` | OTHER |
| `shipping_option` | **2** | `id` | ✅ Yes (1) | `data, metadata` | MEDUSA_CORE |
| `shipping_option_price_set` | **2** | `shipping_option_id, price_set_id` | ✅ Yes (1) | `none` | MEDUSA_CORE |
| `shipping_option_rule` | **4** | `id` | ✅ Yes (1) | `value` | MEDUSA_CORE |
| `shipping_option_type` | **2** | `id` | ✅ Yes (1) | `none` | MEDUSA_CORE |
| `shipping_profile` | **2** | `id` | ✅ Yes (1) | `metadata` | MEDUSA_CORE |
| `shop` | **5** | `id` | ✅ Yes (125) | `none` | OTHER |
| `shopmodule_shop_product_product` | **6** | `shop_id, product_id` | ✅ Yes (1) | `none` | OTHER |
| `state` | **11** | `id` | ✅ Yes (174) | `none` | OTHER |
| `stock_location` | **1** | `id` | ✅ Yes (2) | `metadata` | MEDUSA_CORE |
| `stock_location_address` | **1** | `id` | ✅ Yes (1) | `metadata` | MEDUSA_CORE |
| `store` | **1** | `id` | ✅ Yes (209) | `metadata` | OTHER |
| `store_currency` | **2** | `id` | ✅ Yes (1) | `none` | OTHER |
| `tax_provider` | **1** | `id` | ✅ Yes (1) | `none` | MEDUSA_CORE |
| `tax_rate` | **1** | `id` | ✅ Yes (5) | `metadata` | MEDUSA_CORE |
| `tax_region` | **8** | `id` | ✅ Yes (2) | `metadata` | MEDUSA_CORE |
| `user` | **2** | `id` | ✅ Yes (104) | `metadata` | MEDUSA_CORE |
| `variant_option` | **33** | `id` | ✅ Yes (4) | `metadata` | OTHER |

---

## 3. Complete Base Table Inventory (All 275 Tables)

| # | Table Name | Rows | PK | FKs | Indexes | Created/Updated | Code Refs | Classification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `account_holder` | 0 | `id` | 0 | 3 | `C/U/D` | 1 | OTHER |
| 2 | `ai_circuit_breaker_state` | 0 | `id` | 0 | 3 | `C/U/D` | 1 | OTHER |
| 3 | `ai_knowledge_base` | 0 | `id` | 0 | 2 | `C/U/D` | 1 | OTHER |
| 4 | `ai_memory_state` | 0 | `id` | 0 | 2 | `C/U/D` | 1 | OTHER |
| 5 | `ai_model_config` | 0 | `id` | 0 | 3 | `C/U/D` | 1 | OTHER |
| 6 | `ai_prompt_registry` | 0 | `id` | 0 | 2 | `C/U/D` | 1 | OTHER |
| 7 | `ai_provider_config` | 0 | `id` | 0 | 3 | `C/U/D` | 1 | OTHER |
| 8 | `ai_request_log` | 0 | `id` | 0 | 2 | `C/U/D` | 1 | OTHER |
| 9 | `analytics_event` | 18 | `id` | 0 | 4 | `C/U/D` | 3 | OTHER |
| 10 | `analytics_expense` | 0 | `id` | 0 | 3 | `C/U/D` | 3 | OTHER |
| 11 | `analytics_franchise` | 0 | `id` | 0 | 2 | `C/U/D` | 3 | OTHER |
| 12 | `api_key` | 2 | `id` | 0 | 6 | `C/U/D` | 1 | MEDUSA_CORE |
| 13 | `application_method_buy_rules` | 0 | `application_method_id, promotion_rule_id` | 2 | 1 | `-/-` | 1 | OTHER |
| 14 | `application_method_target_rules` | 0 | `application_method_id, promotion_rule_id` | 2 | 1 | `-/-` | 1 | OTHER |
| 15 | `audit_log` | 13 | `id` | 0 | 4 | `C/U/D` | 5 | OTHER |
| 16 | `auth_identity` | 2 | `id` | 0 | 2 | `C/U/D` | 1 | OTHER |
| 17 | `auth_mfa_factor` | 0 | `id` | 1 | 4 | `C/U/D` | 1 | OTHER |
| 18 | `auth_mfa_recovery_code` | 0 | `id` | 1 | 4 | `C/U/D` | 1 | OTHER |
| 19 | `auth_password_reset_token` | 0 | `id` | 2 | 6 | `C/U/D` | 1 | OTHER |
| 20 | `auth_verification` | 0 | `id` | 1 | 4 | `C/U/D` | 1 | OTHER |
| 21 | `branch` | 57 | `id` | 3 | 5 | `C/U/D` | 232 | CAKETOHOME_CUSTOM |
| 22 | `branch_capacity` | 0 | `id` | 1 | 3 | `C/U/D` | 5 | CAKETOHOME_CUSTOM |
| 23 | `branch_inventory` | 424 | `id` | 1 | 4 | `C/U/D` | 11 | CAKETOHOME_CUSTOM |
| 24 | `branch_price` | 0 | `id` | 1 | 4 | `C/U/D` | 4 | CAKETOHOME_CUSTOM |
| 25 | `branch_region` | 3 | `id` | 0 | 2 | `C/U/D` | 4 | CAKETOHOME_CUSTOM |
| 26 | `branch_settings` | 0 | `id` | 1 | 2 | `C/U/D` | 5 | CAKETOHOME_CUSTOM |
| 27 | `branch_staff` | 0 | `id` | 1 | 3 | `C/U/D` | 4 | CAKETOHOME_CUSTOM |
| 28 | `cake_option` | 0 | `id` | 0 | 2 | `C/U/D` | 4 | OTHER |
| 29 | `capture` | 0 | `id` | 1 | 3 | `C/U/D` | 12 | OTHER |
| 30 | `cart` | 35 | `id` | 2 | 8 | `C/U/D` | 117 | MEDUSA_CORE |
| 31 | `cart_address` | 1 | `id` | 0 | 2 | `C/U/D` | 1 | MEDUSA_CORE |
| 32 | `cart_line_item` | 28 | `id` | 1 | 5 | `C/U/D` | 2 | MEDUSA_CORE |
| 33 | `cart_line_item_adjustment` | 0 | `id` | 1 | 4 | `C/U/D` | 1 | MEDUSA_CORE |
| 34 | `cart_line_item_tax_line` | 1 | `id` | 1 | 4 | `C/U/D` | 1 | MEDUSA_CORE |
| 35 | `cart_payment_collection` | 1 | `cart_id, payment_collection_id` | 0 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 36 | `cart_promotion` | 0 | `cart_id, promotion_id` | 0 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 37 | `cart_shipping_method` | 0 | `id` | 1 | 4 | `C/U/D` | 1 | MEDUSA_CORE |
| 38 | `cart_shipping_method_adjustment` | 0 | `id` | 1 | 4 | `C/U/D` | 1 | MEDUSA_CORE |
| 39 | `cart_shipping_method_tax_line` | 0 | `id` | 1 | 4 | `C/U/D` | 1 | MEDUSA_CORE |
| 40 | `chat_message` | 0 | `id` | 0 | 2 | `C/U/D` | 3 | OTHER |
| 41 | `chat_session` | 0 | `id` | 0 | 1 | `C/U/D` | 3 | OTHER |
| 42 | `city` | 30 | `id` | 0 | 2 | `C/U/D` | 171 | CAKETOHOME_CUSTOM |
| 43 | `cms_asset_reference` | 0 | `id` | 0 | 2 | `C/U/D` | 3 | CAKETOHOME_CUSTOM |
| 44 | `cms_banner` | 0 | `id` | 0 | 2 | `C/U/D` | 3 | CAKETOHOME_CUSTOM |
| 45 | `cms_block` | 0 | `id` | 0 | 2 | `C/U/D` | 3 | CAKETOHOME_CUSTOM |
| 46 | `cms_category` | 0 | `id` | 0 | 2 | `C/U/D` | 3 | CAKETOHOME_CUSTOM |
| 47 | `cms_homepage_section` | 32 | `id` | 0 | 3 | `C/U/D` | 6 | CAKETOHOME_CUSTOM |
| 48 | `cms_navigation` | 0 | `id` | 0 | 2 | `C/U/D` | 4 | CAKETOHOME_CUSTOM |
| 49 | `cms_page` | 22 | `id` | 0 | 4 | `C/U/D` | 18 | CAKETOHOME_CUSTOM |
| 50 | `cms_redirect` | 0 | `id` | 0 | 2 | `C/U/D` | 4 | CAKETOHOME_CUSTOM |
| 51 | `cms_revision` | 0 | `id` | 0 | 2 | `C/U/D` | 3 | CAKETOHOME_CUSTOM |
| 52 | `cms_tag` | 0 | `id` | 0 | 2 | `C/U/D` | 3 | CAKETOHOME_CUSTOM |
| 53 | `cms_template` | 0 | `id` | 0 | 1 | `C/U/D` | 3 | CAKETOHOME_CUSTOM |
| 54 | `config_audit_log` | 0 | `id` | 0 | 2 | `C/U/D` | 4 | OTHER |
| 55 | `connector_config` | 0 | `id` | 0 | 3 | `C/U/D` | 4 | OTHER |
| 56 | `contact_submission` | 0 | `id` | 0 | 1 | `C/U/D` | 3 | OTHER |
| 57 | `credit_line` | 0 | `id` | 1 | 4 | `C/U/D` | 1 | OTHER |
| 58 | `crm_ab_test` | 0 | `id` | 0 | 3 | `C/U/D` | 1 | OTHER |
| 59 | `crm_automation_execution` | 0 | `id` | 0 | 5 | `C/U/D` | 3 | OTHER |
| 60 | `crm_automation_flow` | 0 | `id` | 0 | 2 | `C/U/D` | 4 | OTHER |
| 61 | `crm_automation_log` | 0 | `id` | 0 | 3 | `C/U/D` | 3 | OTHER |
| 62 | `crm_campaign` | 0 | `id` | 0 | 2 | `C/U/D` | 7 | CAKETOHOME_CUSTOM |
| 63 | `crm_customer_blacklist` | 0 | `id` | 0 | 4 | `C/U/D` | 4 | OTHER |
| 64 | `crm_customer_note` | 0 | `id` | 0 | 3 | `C/U/D` | 4 | OTHER |
| 65 | `crm_customer_rfm` | 0 | `id` | 0 | 4 | `C/U/D` | 4 | OTHER |
| 66 | `crm_customer_segment` | 0 | `id` | 0 | 4 | `C/U/D` | 3 | OTHER |
| 67 | `crm_email_template` | 0 | `id` | 0 | 3 | `C/U/D` | 3 | OTHER |
| 68 | `crm_segment` | 0 | `id` | 0 | 3 | `C/U/D` | 3 | OTHER |
| 69 | `currency` | 126 | `code` | 0 | 1 | `C/U/D` | 43 | OTHER |
| 70 | `cust_address` | 0 | `id` | 0 | 2 | `C/U/D` | 3 | OTHER |
| 71 | `customer` | 57 | `id` | 0 | 4 | `C/U/D` | 275 | MEDUSA_CORE |
| 72 | `customer_account_holder` | 0 | `customer_id, account_holder_id` | 0 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 73 | `customer_address` | 34 | `id` | 1 | 5 | `C/U/D` | 5 | MEDUSA_CORE |
| 74 | `customer_favorite` | 1 | `id` | 0 | 1 | `C/-/D` | 3 | MEDUSA_CORE |
| 75 | `customer_group` | 0 | `id` | 0 | 3 | `C/U/D` | 1 | MEDUSA_CORE |
| 76 | `customer_group_customer` | 0 | `id` | 2 | 4 | `C/U/D` | 1 | MEDUSA_CORE |
| 77 | `customer_phone` | 2 | `id` | 0 | 2 | `C/U/D` | 56 | MEDUSA_CORE |
| 78 | `delivery` | 55 | `id` | 0 | 3 | `C/U/D` | 347 | OTHER |
| 79 | `delivery_delivery_partner` | 5 | `id` | 2 | 4 | `C/U/D` | 5 | OTHER |
| 80 | `delivery_partner` | 30 | `id` | 0 | 1 | `C/U/D` | 73 | OTHER |
| 81 | `delivery_proof` | 0 | `id` | 0 | 3 | `C/U/D` | 3 | OTHER |
| 82 | `delivery_slot` | 0 | `id` | 0 | 2 | `C/U/D` | 29 | CAKETOHOME_CUSTOM |
| 83 | `delivery_zone` | 44 | `id` | 0 | 3 | `C/U/D` | 17 | OTHER |
| 84 | `deliverymodule_delivery_cart_cart` | 0 | `delivery_id, cart_id` | 0 | 5 | `C/U/D` | 1 | OTHER |
| 85 | `deliverymodule_delivery_order_order` | 0 | `delivery_id, order_id` | 0 | 5 | `C/U/D` | 1 | OTHER |
| 86 | `driver_attendance` | 0 | `id` | 0 | 1 | `C/U/D` | 3 | OTHER |
| 87 | `driver_location` | 0 | `id` | 0 | 2 | `C/U/D` | 3 | OTHER |
| 88 | `driver_profile` | 0 | `id` | 0 | 2 | `C/U/D` | 3 | OTHER |
| 89 | `driver_transaction` | 0 | `id` | 0 | 2 | `C/U/D` | 3 | OTHER |
| 90 | `driver_wallet` | 0 | `id` | 0 | 2 | `C/U/D` | 3 | OTHER |
| 91 | `fulfillment` | 0 | `id` | 3 | 4 | `C/U/D` | 57 | MEDUSA_CORE |
| 92 | `fulfillment_address` | 0 | `id` | 0 | 2 | `C/U/D` | 1 | MEDUSA_CORE |
| 93 | `fulfillment_item` | 0 | `id` | 1 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 94 | `fulfillment_label` | 0 | `id` | 1 | 3 | `C/U/D` | 1 | MEDUSA_CORE |
| 95 | `fulfillment_provider` | 1 | `id` | 0 | 2 | `C/U/D` | 1 | MEDUSA_CORE |
| 96 | `fulfillment_set` | 1 | `id` | 0 | 3 | `C/U/D` | 1 | MEDUSA_CORE |
| 97 | `geo_zone` | 7 | `id` | 1 | 6 | `C/U/D` | 1 | OTHER |
| 98 | `image` | 0 | `id` | 1 | 7 | `C/U/D` | 99 | OTHER |
| 99 | `inventory_item` | 5 | `id` | 0 | 3 | `C/U/D` | 1 | MEDUSA_CORE |
| 100 | `inventory_level` | 0 | `id` | 1 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 101 | `inventory_transfer` | 0 | `id` | 2 | 3 | `C/U/D` | 4 | MEDUSA_CORE |
| 102 | `invite` | 0 | `id` | 0 | 4 | `C/U/D` | 1 | MEDUSA_CORE |
| 103 | `invite_rbac_role` | 0 | `invite_id, rbac_role_id` | 0 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 104 | `language` | 0 | `id` | 0 | 2 | `C/U/D` | 10 | OTHER |
| 105 | `layout_configuration` | 0 | `id` | 0 | 4 | `C/U/D` | 1 | OTHER |
| 106 | `lead_enquiry` | 1 | `id` | 0 | 1 | `C/-` | 2 | OTHER |
| 107 | `link_module_migrations` | 24 | `id` | 0 | 2 | `C/-` | 1 | OTHER |
| 108 | `loc_currency` | 0 | `id` | 0 | 2 | `C/U/D` | 3 | OTHER |
| 109 | `location_fulfillment_provider` | 1 | `stock_location_id, fulfillment_provider_id` | 0 | 5 | `C/U/D` | 1 | OTHER |
| 110 | `location_fulfillment_set` | 1 | `stock_location_id, fulfillment_set_id` | 0 | 5 | `C/U/D` | 1 | OTHER |
| 111 | `login_event` | 10 | `id` | 0 | 2 | `C/U/D` | 3 | OTHER |
| 112 | `marketing_campaign` | 0 | `id` | 0 | 6 | `C/U/D` | 3 | CAKETOHOME_CUSTOM |
| 113 | `marketing_campaign_event` | 0 | `id` | 0 | 4 | `C/U/D` | 3 | CAKETOHOME_CUSTOM |
| 114 | `marketing_campaign_metric` | 0 | `id` | 0 | 5 | `C/U/D` | 3 | CAKETOHOME_CUSTOM |
| 115 | `marketing_gamification_reward` | 0 | `id` | 0 | 5 | `C/U/D` | 3 | OTHER |
| 116 | `marketing_newsletter_subscriber` | 0 | `id` | 0 | 4 | `C/U/D` | 4 | OTHER |
| 117 | `marketing_popup` | 0 | `id` | 0 | 3 | `C/U/D` | 3 | OTHER |
| 118 | `marketing_qr_code` | 0 | `id` | 0 | 4 | `C/U/D` | 3 | OTHER |
| 119 | `marketing_recovery_job` | 0 | `id` | 0 | 6 | `C/U/D` | 3 | OTHER |
| 120 | `media` | 142 | `id` | 0 | 4 | `C/U/D` | 55 | OTHER |
| 121 | `mikro_orm_migrations` | 215 | `id` | 0 | 1 | `-/-` | 1 | MEDUSA_CORE |
| 122 | `notification` | 0 | `id` | 1 | 5 | `C/U/D` | 49 | MEDUSA_CORE |
| 123 | `notification_log` | 0 | `id` | 0 | 2 | `C/U/D` | 3 | MEDUSA_CORE |
| 124 | `notification_provider` | 1 | `id` | 0 | 2 | `C/U/D` | 1 | MEDUSA_CORE |
| 125 | `notification_template` | 0 | `id` | 0 | 2 | `C/U/D` | 3 | MEDUSA_CORE |
| 126 | `offer` | 24 | `id` | 0 | 5 | `C/U/D` | 76 | OTHER |
| 127 | `offer_redemption` | 0 | `id` | 0 | 4 | `C/U/D` | 5 | OTHER |
| 128 | `order` | 173 | `id` | 2 | 15 | `C/U/D` | 298 | MEDUSA_CORE |
| 129 | `order_address` | 0 | `id` | 0 | 3 | `C/U/D` | 1 | MEDUSA_CORE |
| 130 | `order_cart` | 0 | `order_id, cart_id` | 0 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 131 | `order_change` | 0 | `id` | 1 | 10 | `C/U/D` | 1 | MEDUSA_CORE |
| 132 | `order_change_action` | 0 | `id` | 1 | 8 | `C/U/D` | 1 | MEDUSA_CORE |
| 133 | `order_claim` | 0 | `id` | 0 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 134 | `order_claim_item` | 0 | `id` | 0 | 4 | `C/U/D` | 1 | MEDUSA_CORE |
| 135 | `order_claim_item_image` | 0 | `id` | 0 | 3 | `C/U/D` | 1 | MEDUSA_CORE |
| 136 | `order_credit_line` | 0 | `id` | 1 | 4 | `C/U/D` | 1 | MEDUSA_CORE |
| 137 | `order_event` | 13 | `id` | 0 | 3 | `C/U/D` | 3 | MEDUSA_CORE |
| 138 | `order_exchange` | 0 | `id` | 0 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 139 | `order_exchange_item` | 0 | `id` | 0 | 4 | `C/U/D` | 1 | MEDUSA_CORE |
| 140 | `order_fulfillment` | 0 | `order_id, fulfillment_id` | 0 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 141 | `order_item` | 0 | `id` | 2 | 5 | `C/U/D` | 2 | MEDUSA_CORE |
| 142 | `order_lifecycle_refund` | 0 | `id` | 0 | 3 | `C/U/D` | 3 | MEDUSA_CORE |
| 143 | `order_line_item` | 0 | `id` | 1 | 4 | `C/U/D` | 1 | MEDUSA_CORE |
| 144 | `order_line_item_adjustment` | 0 | `id` | 1 | 2 | `C/U/D` | 1 | MEDUSA_CORE |
| 145 | `order_line_item_tax_line` | 0 | `id` | 1 | 2 | `C/U/D` | 1 | MEDUSA_CORE |
| 146 | `order_note` | 0 | `id` | 0 | 3 | `C/U/D` | 4 | MEDUSA_CORE |
| 147 | `order_payment_collection` | 0 | `order_id, payment_collection_id` | 0 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 148 | `order_promotion` | 0 | `order_id, promotion_id` | 0 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 149 | `order_shipping` | 0 | `id` | 1 | 9 | `C/U/D` | 1 | MEDUSA_CORE |
| 150 | `order_shipping_method` | 0 | `id` | 0 | 2 | `C/U/D` | 1 | MEDUSA_CORE |
| 151 | `order_shipping_method_adjustment` | 0 | `id` | 1 | 3 | `C/U/D` | 1 | MEDUSA_CORE |
| 152 | `order_shipping_method_tax_line` | 0 | `id` | 1 | 2 | `C/U/D` | 1 | MEDUSA_CORE |
| 153 | `order_staff_assignment` | 0 | `id` | 0 | 3 | `C/U/D` | 3 | MEDUSA_CORE |
| 154 | `order_status_history` | 82 | `id` | 0 | 4 | `C/U/D` | 10 | MEDUSA_CORE |
| 155 | `order_summary` | 0 | `id` | 1 | 3 | `C/U/D` | 1 | MEDUSA_CORE |
| 156 | `order_transaction` | 0 | `id` | 1 | 8 | `C/U/D` | 1 | MEDUSA_CORE |
| 157 | `payment` | 0 | `id` | 1 | 6 | `C/U/D` | 65 | MEDUSA_CORE |
| 158 | `payment_audit_trail` | 14 | `id` | 0 | 2 | `C/U/D` | 4 | MEDUSA_CORE |
| 159 | `payment_collection` | 1 | `id` | 0 | 2 | `C/U/D` | 1 | MEDUSA_CORE |
| 160 | `payment_collection_payment_providers` | 0 | `payment_collection_id, payment_provider_id` | 2 | 1 | `-/-` | 1 | MEDUSA_CORE |
| 161 | `payment_provider` | 1 | `id` | 0 | 2 | `C/U/D` | 8 | MEDUSA_CORE |
| 162 | `payment_session` | 1 | `id` | 1 | 3 | `C/U/D` | 1 | MEDUSA_CORE |
| 163 | `payment_transaction` | 51 | `id` | 0 | 4 | `C/U/D` | 11 | MEDUSA_CORE |
| 164 | `popup_audience_rules` | 0 | `id` | 0 | 2 | `C/-` | 1 | OTHER |
| 165 | `popup_campaigns` | 5 | `id` | 0 | 6 | `C/U/D` | 3 | CAKETOHOME_CUSTOM |
| 166 | `popup_conversions` | 0 | `id` | 0 | 4 | `C/-` | 2 | OTHER |
| 167 | `popup_frequency_rules` | 0 | `id` | 0 | 2 | `C/-` | 1 | OTHER |
| 168 | `popup_impressions` | 0 | `id` | 0 | 5 | `C/-` | 3 | OTHER |
| 169 | `popup_rules` | 0 | `id` | 0 | 2 | `C/-` | 1 | OTHER |
| 170 | `popup_versions` | 0 | `id` | 0 | 2 | `C/-` | 2 | OTHER |
| 171 | `price` | 23 | `id` | 2 | 5 | `C/U/D` | 119 | OTHER |
| 172 | `price_list` | 0 | `id` | 0 | 3 | `C/U/D` | 1 | MEDUSA_CORE |
| 173 | `price_list_rule` | 0 | `id` | 1 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 174 | `price_preference` | 3 | `id` | 0 | 3 | `C/U/D` | 1 | OTHER |
| 175 | `price_rule` | 2 | `id` | 1 | 9 | `C/U/D` | 1 | OTHER |
| 176 | `price_set` | 13 | `id` | 0 | 2 | `C/U/D` | 4 | OTHER |
| 177 | `product` | 65 | `id` | 2 | 6 | `C/U/D` | 198 | MEDUSA_CORE |
| 178 | `product_category` | 11 | `id` | 1 | 4 | `C/U/D` | 5 | MEDUSA_CORE |
| 179 | `product_category_product` | 6 | `product_id, product_category_id` | 2 | 1 | `-/-` | 2 | MEDUSA_CORE |
| 180 | `product_collection` | 0 | `id` | 0 | 3 | `C/U/D` | 1 | MEDUSA_CORE |
| 181 | `product_meta` | 0 | `id` | 0 | 2 | `C/U/D` | 7 | MEDUSA_CORE |
| 182 | `product_option` | 23 | `id` | 0 | 2 | `C/U/D` | 1 | MEDUSA_CORE |
| 183 | `product_option_value` | 23 | `id` | 1 | 4 | `C/U/D` | 1 | MEDUSA_CORE |
| 184 | `product_product_option` | 23 | `id` | 2 | 4 | `C/U/D` | 1 | MEDUSA_CORE |
| 185 | `product_product_option_value` | 23 | `id` | 2 | 4 | `C/U/D` | 1 | MEDUSA_CORE |
| 186 | `product_review` | 0 | `id` | 0 | 4 | `C/U/D` | 6 | MEDUSA_CORE |
| 187 | `product_reviews` | 0 | `id` | 0 | 2 | `C/U/D` | 4 | MEDUSA_CORE |
| 188 | `product_sales_channel` | 6 | `product_id, sales_channel_id` | 0 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 189 | `product_shipping_profile` | 0 | `product_id, shipping_profile_id` | 0 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 190 | `product_tag` | 0 | `id` | 0 | 3 | `C/U/D` | 1 | MEDUSA_CORE |
| 191 | `product_tags` | 0 | `product_id, product_tag_id` | 2 | 1 | `-/-` | 1 | MEDUSA_CORE |
| 192 | `product_type` | 0 | `id` | 0 | 3 | `C/U/D` | 1 | MEDUSA_CORE |
| 193 | `product_variant` | 27 | `id` | 1 | 8 | `C/U/D` | 4 | MEDUSA_CORE |
| 194 | `product_variant_inventory_item` | 5 | `variant_id, inventory_item_id` | 0 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 195 | `product_variant_option` | 11 | `variant_id, option_value_id` | 2 | 1 | `-/-` | 1 | MEDUSA_CORE |
| 196 | `product_variant_price_set` | 11 | `variant_id, price_set_id` | 0 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 197 | `product_variant_product_image` | 0 | `id` | 1 | 4 | `C/U/D` | 1 | MEDUSA_CORE |
| 198 | `promotion` | 0 | `id` | 1 | 7 | `C/U/D` | 31 | OTHER |
| 199 | `promotion_application_method` | 0 | `id` | 1 | 7 | `C/U/D` | 1 | OTHER |
| 200 | `promotion_campaign` | 0 | `id` | 0 | 3 | `C/U/D` | 1 | CAKETOHOME_CUSTOM |
| 201 | `promotion_campaign_budget` | 0 | `id` | 1 | 4 | `C/U/D` | 1 | CAKETOHOME_CUSTOM |
| 202 | `promotion_campaign_budget_usage` | 0 | `id` | 1 | 4 | `C/U/D` | 1 | CAKETOHOME_CUSTOM |
| 203 | `promotion_promotion_rule` | 0 | `promotion_id, promotion_rule_id` | 2 | 1 | `-/-` | 1 | OTHER |
| 204 | `promotion_rule` | 0 | `id` | 0 | 6 | `C/U/D` | 1 | OTHER |
| 205 | `promotion_rule_value` | 0 | `id` | 1 | 5 | `C/U/D` | 1 | OTHER |
| 206 | `property_label` | 0 | `id` | 0 | 4 | `C/U/D` | 1 | OTHER |
| 207 | `provider_identity` | 2 | `id` | 1 | 4 | `C/U/D` | 1 | OTHER |
| 208 | `publishable_api_key_sales_channel` | 2 | `publishable_key_id, sales_channel_id` | 0 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 209 | `refund` | 0 | `id` | 1 | 4 | `C/U/D` | 33 | OTHER |
| 210 | `refund_reason` | 3 | `id` | 0 | 2 | `C/U/D` | 4 | OTHER |
| 211 | `region` | 1 | `id` | 0 | 2 | `C/U/D` | 16 | MEDUSA_CORE |
| 212 | `region_country` | 250 | `iso_2` | 1 | 4 | `C/U/D` | 1 | MEDUSA_CORE |
| 213 | `region_payment_provider` | 1 | `region_id, payment_provider_id` | 0 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 214 | `report_schedule` | 0 | `id` | 0 | 2 | `C/U/D` | 2 | OTHER |
| 215 | `reschedule_request` | 0 | `id` | 0 | 3 | `C/U/D` | 6 | OTHER |
| 216 | `reservation_item` | 0 | `id` | 1 | 5 | `C/U/D` | 1 | OTHER |
| 217 | `return` | 0 | `id` | 0 | 5 | `C/U/D` | 794 | MEDUSA_CORE |
| 218 | `return_fulfillment` | 0 | `return_id, fulfillment_id` | 0 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 219 | `return_item` | 0 | `id` | 0 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 220 | `return_reason` | 0 | `id` | 1 | 3 | `C/U/D` | 1 | MEDUSA_CORE |
| 221 | `rewards_fraud_review` | 0 | `id` | 0 | 2 | `C/U/D` | 1 | OTHER |
| 222 | `rewards_gift_card` | 0 | `id` | 0 | 2 | `C/U/D` | 1 | OTHER |
| 223 | `rewards_gift_card_transaction` | 0 | `id` | 0 | 3 | `C/U/D` | 1 | OTHER |
| 224 | `rewards_loyalty_ledger` | 0 | `id` | 0 | 2 | `C/U/D` | 1 | OTHER |
| 225 | `rewards_loyalty_rule` | 0 | `id` | 0 | 1 | `C/U/D` | 1 | OTHER |
| 226 | `rewards_loyalty_transaction` | 0 | `id` | 0 | 2 | `C/U/D` | 1 | OTHER |
| 227 | `rewards_referral_code` | 0 | `id` | 0 | 3 | `C/U/D` | 1 | OTHER |
| 228 | `rewards_referral_event` | 0 | `id` | 0 | 5 | `C/U/D` | 1 | OTHER |
| 229 | `rewards_referral_program` | 0 | `id` | 0 | 1 | `C/U/D` | 1 | OTHER |
| 230 | `rewards_referral_qualification` | 0 | `id` | 0 | 2 | `C/U/D` | 1 | OTHER |
| 231 | `rewards_wallet` | 0 | `id` | 0 | 2 | `C/U/D` | 1 | OTHER |
| 232 | `rewards_wallet_transaction` | 0 | `id` | 0 | 2 | `C/U/D` | 1 | OTHER |
| 233 | `sales_channel` | 1 | `id` | 0 | 2 | `C/U/D` | 2 | MEDUSA_CORE |
| 234 | `sales_channel_stock_location` | 1 | `sales_channel_id, stock_location_id` | 0 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 235 | `script_migrations` | 5 | `id` | 0 | 2 | `C/-` | 1 | OTHER |
| 236 | `security_blocked_ip` | 0 | `id` | 0 | 2 | `C/U/D` | 3 | OTHER |
| 237 | `security_event` | 63 | `id` | 0 | 3 | `C/U/D` | 3 | OTHER |
| 238 | `security_ip_whitelist` | 8 | `id` | 0 | 1 | `C/U/D` | 3 | OTHER |
| 239 | `security_user_two_factor` | 0 | `id` | 0 | 2 | `C/U/D` | 3 | OTHER |
| 240 | `service_zone` | 1 | `id` | 1 | 4 | `C/U/D` | 1 | OTHER |
| 241 | `setting` | 16 | `id` | 0 | 2 | `C/U/D` | 20 | OTHER |
| 242 | `shipping_option` | 2 | `id` | 4 | 6 | `C/U/D` | 1 | MEDUSA_CORE |
| 243 | `shipping_option_price_set` | 2 | `shipping_option_id, price_set_id` | 0 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 244 | `shipping_option_rule` | 4 | `id` | 1 | 3 | `C/U/D` | 1 | MEDUSA_CORE |
| 245 | `shipping_option_type` | 2 | `id` | 0 | 2 | `C/U/D` | 1 | MEDUSA_CORE |
| 246 | `shipping_profile` | 2 | `id` | 0 | 3 | `C/U/D` | 1 | MEDUSA_CORE |
| 247 | `shop` | 5 | `id` | 0 | 1 | `C/U/D` | 125 | OTHER |
| 248 | `shop_manager` | 0 | `id` | 1 | 2 | `C/U/D` | 14 | OTHER |
| 249 | `shopmodule_shop_deliverymodule_delivery` | 0 | `shop_id, delivery_id` | 0 | 5 | `C/U/D` | 1 | OTHER |
| 250 | `shopmodule_shop_product_product` | 6 | `shop_id, product_id` | 0 | 5 | `C/U/D` | 1 | OTHER |
| 251 | `slot_reservation` | 0 | `id` | 1 | 3 | `C/U/D` | 4 | OTHER |
| 252 | `state` | 11 | `id` | 0 | 2 | `C/U/D` | 174 | OTHER |
| 253 | `stock_location` | 1 | `id` | 1 | 3 | `C/U/D` | 2 | MEDUSA_CORE |
| 254 | `stock_location_address` | 1 | `id` | 0 | 2 | `C/U/D` | 1 | MEDUSA_CORE |
| 255 | `stock_notification` | 0 | `id` | 0 | 3 | `C/U/D` | 4 | OTHER |
| 256 | `store` | 1 | `id` | 0 | 2 | `C/U/D` | 209 | OTHER |
| 257 | `store_currency` | 2 | `id` | 1 | 3 | `C/U/D` | 1 | OTHER |
| 258 | `store_locale` | 0 | `id` | 1 | 3 | `C/U/D` | 1 | OTHER |
| 259 | `subscription` | 0 | `id` | 0 | 4 | `C/U/D` | 18 | OTHER |
| 260 | `support_ticket` | 0 | `id` | 0 | 3 | `C/U/D` | 3 | OTHER |
| 261 | `tax_provider` | 1 | `id` | 0 | 2 | `C/U/D` | 1 | MEDUSA_CORE |
| 262 | `tax_rate` | 1 | `id` | 1 | 4 | `C/U/D` | 5 | MEDUSA_CORE |
| 263 | `tax_rate_rule` | 0 | `id` | 1 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 264 | `tax_region` | 8 | `id` | 2 | 6 | `C/U/D` | 2 | MEDUSA_CORE |
| 265 | `ticket_message` | 0 | `id` | 0 | 2 | `C/U/D` | 3 | OTHER |
| 266 | `translation` | 0 | `id` | 0 | 2 | `C/U/D` | 7 | OTHER |
| 267 | `user` | 2 | `id` | 0 | 3 | `C/U/D` | 104 | MEDUSA_CORE |
| 268 | `user_preference` | 0 | `id` | 0 | 4 | `C/U/D` | 1 | MEDUSA_CORE |
| 269 | `user_rbac_role` | 0 | `user_id, rbac_role_id` | 0 | 5 | `C/U/D` | 1 | MEDUSA_CORE |
| 270 | `variant_option` | 33 | `id` | 0 | 1 | `C/U/D` | 4 | OTHER |
| 271 | `view_configuration` | 0 | `id` | 0 | 5 | `C/U/D` | 1 | OTHER |
| 272 | `webhook_delivery` | 0 | `id` | 0 | 2 | `C/U/D` | 3 | OTHER |
| 273 | `webhook_endpoint` | 0 | `id` | 0 | 2 | `C/U/D` | 3 | OTHER |
| 274 | `wishlist_item` | 0 | `id` | 0 | 3 | `C/U/D` | 3 | OTHER |
| 275 | `workflow_execution` | 0 | `workflow_id, transaction_id, run_id` | 0 | 12 | `C/U/D` | 1 | OTHER |

---

## 4. Views Inventory (0)

| View Name | Definition Summary |
| :--- | :--- |
*(No custom views defined in public schema)*

---

## 5. Sequences (8)

| Sequence Name | Data Type | Start | Increment |
| :--- | :--- | :--- | :--- |
| `link_module_migrations_id_seq` | integer | 1 | 1 |
| `script_migrations_id_seq` | integer | 1 | 1 |
| `mikro_orm_migrations_id_seq` | integer | 1 | 1 |
| `order_display_id_seq` | integer | 1 | 1 |
| `order_change_action_ordering_seq` | bigint | 1 | 1 |
| `return_display_id_seq` | integer | 1 | 1 |
| `order_exchange_display_id_seq` | integer | 1 | 1 |
| `order_claim_display_id_seq` | integer | 1 | 1 |

---

## 6. Triggers (0)

| Table | Trigger Name | Manipulation | Timing |
| :--- | :--- | :--- | :--- |
*(No explicit public triggers defined)*

---

## 7. Custom Enums (4)

| Enum Name | Allowed Values |
| :--- | :--- |
| `claim_reason_enum` | `missing_item, wrong_item, production_failure, other` |
| `order_claim_type_enum` | `refund, replace` |
| `order_status_enum` | `pending, completed, draft, archived, canceled, requires_action` |
| `return_status_enum` | `open, requested, received, partially_received, canceled` |

---

## 8. Migration History (215)

- **Migration20240307161216** (Sun Jul 19 2026 23:28:48 GMT+0530 (India Standard Time))
- **Migration20241210073813** (Sun Jul 19 2026 23:28:48 GMT+0530 (India Standard Time))
- **Migration20250106142624** (Sun Jul 19 2026 23:28:48 GMT+0530 (India Standard Time))
- **Migration20250120110820** (Sun Jul 19 2026 23:28:48 GMT+0530 (India Standard Time))
- **Migration20240307132720** (Sun Jul 19 2026 23:28:52 GMT+0530 (India Standard Time))
- **Migration20240719123015** (Sun Jul 19 2026 23:28:52 GMT+0530 (India Standard Time))
- **Migration20241213063611** (Sun Jul 19 2026 23:28:52 GMT+0530 (India Standard Time))
- **Migration20251010131115** (Sun Jul 19 2026 23:28:52 GMT+0530 (India Standard Time))
- **InitialSetup20240401153642** (Sun Jul 19 2026 23:28:58 GMT+0530 (India Standard Time))
- **Migration20240601111544** (Sun Jul 19 2026 23:28:58 GMT+0530 (India Standard Time))
- **Migration202408271511** (Sun Jul 19 2026 23:28:58 GMT+0530 (India Standard Time))
- **Migration20241122120331** (Sun Jul 19 2026 23:28:58 GMT+0530 (India Standard Time))
- **Migration20241125090957** (Sun Jul 19 2026 23:28:58 GMT+0530 (India Standard Time))
- **Migration20250411073236** (Sun Jul 19 2026 23:28:58 GMT+0530 (India Standard Time))
- **Migration20250516081326** (Sun Jul 19 2026 23:28:58 GMT+0530 (India Standard Time))
- **Migration20250910154539** (Sun Jul 19 2026 23:28:58 GMT+0530 (India Standard Time))
- **Migration20250911092221** (Sun Jul 19 2026 23:28:58 GMT+0530 (India Standard Time))
- **Migration20250929204438** (Sun Jul 19 2026 23:28:58 GMT+0530 (India Standard Time))
- **Migration20251008132218** (Sun Jul 19 2026 23:28:58 GMT+0530 (India Standard Time))
- **Migration20251011090511** (Sun Jul 19 2026 23:28:58 GMT+0530 (India Standard Time))
- **Migration20251022153442** (Sun Jul 19 2026 23:28:58 GMT+0530 (India Standard Time))
- **Migration20251029150809** (Sun Jul 19 2026 23:28:58 GMT+0530 (India Standard Time))
- **Migration20251110180907** (Sun Jul 19 2026 23:28:58 GMT+0530 (India Standard Time))
- **Migration20251113183352** (Sun Jul 19 2026 23:28:58 GMT+0530 (India Standard Time))
- **Migration20260224120000** (Sun Jul 19 2026 23:28:58 GMT+0530 (India Standard Time))
- **Migration20260301002050** (Sun Jul 19 2026 23:28:58 GMT+0530 (India Standard Time))
- **Migration20260306120000** (Sun Jul 19 2026 23:28:58 GMT+0530 (India Standard Time))
- **Migration20230929122253** (Sun Jul 19 2026 23:29:19 GMT+0530 (India Standard Time))
- **Migration20240322094407** (Sun Jul 19 2026 23:29:19 GMT+0530 (India Standard Time))
- **Migration20240322113359** (Sun Jul 19 2026 23:29:19 GMT+0530 (India Standard Time))
- **Migration20240322120125** (Sun Jul 19 2026 23:29:19 GMT+0530 (India Standard Time))
- **Migration20240626133555** (Sun Jul 19 2026 23:29:19 GMT+0530 (India Standard Time))
- **Migration20240704094505** (Sun Jul 19 2026 23:29:19 GMT+0530 (India Standard Time))
- **Migration20241127114534** (Sun Jul 19 2026 23:29:19 GMT+0530 (India Standard Time))
- **Migration20241127223829** (Sun Jul 19 2026 23:29:19 GMT+0530 (India Standard Time))
- **Migration20241128055359** (Sun Jul 19 2026 23:29:19 GMT+0530 (India Standard Time))
- **Migration20241212190401** (Sun Jul 19 2026 23:29:19 GMT+0530 (India Standard Time))
- **Migration20250408145122** (Sun Jul 19 2026 23:29:19 GMT+0530 (India Standard Time))
- **Migration20250409122219** (Sun Jul 19 2026 23:29:19 GMT+0530 (India Standard Time))
- **Migration20251009110625** (Sun Jul 19 2026 23:29:19 GMT+0530 (India Standard Time))
- **Migration20251112192723** (Sun Jul 19 2026 23:29:19 GMT+0530 (India Standard Time))
- **Migration20260429163502** (Sun Jul 19 2026 23:29:19 GMT+0530 (India Standard Time))
- **Migration20240227120221** (Sun Jul 19 2026 23:29:36 GMT+0530 (India Standard Time))
- **Migration20240617102917** (Sun Jul 19 2026 23:29:36 GMT+0530 (India Standard Time))
- **Migration20240624153824** (Sun Jul 19 2026 23:29:36 GMT+0530 (India Standard Time))
- **Migration20241211061114** (Sun Jul 19 2026 23:29:36 GMT+0530 (India Standard Time))
- **Migration20250113094144** (Sun Jul 19 2026 23:29:36 GMT+0530 (India Standard Time))
- **Migration20250120110700** (Sun Jul 19 2026 23:29:36 GMT+0530 (India Standard Time))
- **Migration20250226130616** (Sun Jul 19 2026 23:29:36 GMT+0530 (India Standard Time))
- **Migration20250508081510** (Sun Jul 19 2026 23:29:36 GMT+0530 (India Standard Time))
- **Migration20250828075407** (Sun Jul 19 2026 23:29:36 GMT+0530 (India Standard Time))
- **Migration20250909083125** (Sun Jul 19 2026 23:29:36 GMT+0530 (India Standard Time))
- **Migration20250916120552** (Sun Jul 19 2026 23:29:36 GMT+0530 (India Standard Time))
- **Migration20250917143818** (Sun Jul 19 2026 23:29:36 GMT+0530 (India Standard Time))
- **Migration20250919122137** (Sun Jul 19 2026 23:29:36 GMT+0530 (India Standard Time))
- **Migration20251006000000** (Sun Jul 19 2026 23:29:36 GMT+0530 (India Standard Time))
- **Migration20251015113934** (Sun Jul 19 2026 23:29:36 GMT+0530 (India Standard Time))
- **Migration20251107050148** (Sun Jul 19 2026 23:29:36 GMT+0530 (India Standard Time))
- **Migration20240124154000** (Sun Jul 19 2026 23:29:54 GMT+0530 (India Standard Time))
- **Migration20240524123112** (Sun Jul 19 2026 23:29:54 GMT+0530 (India Standard Time))
- **Migration20240602110946** (Sun Jul 19 2026 23:29:54 GMT+0530 (India Standard Time))
- **Migration20241211074630** (Sun Jul 19 2026 23:29:54 GMT+0530 (India Standard Time))
- **Migration20251010130829** (Sun Jul 19 2026 23:29:54 GMT+0530 (India Standard Time))
- **Migration20240115152146** (Sun Jul 19 2026 23:30:01 GMT+0530 (India Standard Time))
- **Migration20240222170223** (Sun Jul 19 2026 23:30:03 GMT+0530 (India Standard Time))
- **Migration20240831125857** (Sun Jul 19 2026 23:30:03 GMT+0530 (India Standard Time))
- **Migration20241106085918** (Sun Jul 19 2026 23:30:03 GMT+0530 (India Standard Time))
- **Migration20241205095237** (Sun Jul 19 2026 23:30:03 GMT+0530 (India Standard Time))
- **Migration20241216183049** (Sun Jul 19 2026 23:30:03 GMT+0530 (India Standard Time))
- **Migration20241218091938** (Sun Jul 19 2026 23:30:03 GMT+0530 (India Standard Time))
- **Migration20250120115059** (Sun Jul 19 2026 23:30:03 GMT+0530 (India Standard Time))
- **Migration20250212131240** (Sun Jul 19 2026 23:30:03 GMT+0530 (India Standard Time))
- **Migration20250326151602** (Sun Jul 19 2026 23:30:03 GMT+0530 (India Standard Time))
- **Migration20250508081553** (Sun Jul 19 2026 23:30:03 GMT+0530 (India Standard Time))
- **Migration20251017153909** (Sun Jul 19 2026 23:30:03 GMT+0530 (India Standard Time))
- **Migration20251208130704** (Sun Jul 19 2026 23:30:03 GMT+0530 (India Standard Time))
- **Migration20240205173216** (Sun Jul 19 2026 23:30:12 GMT+0530 (India Standard Time))
- **Migration20240624200006** (Sun Jul 19 2026 23:30:12 GMT+0530 (India Standard Time))
- **Migration20250120110744** (Sun Jul 19 2026 23:30:12 GMT+0530 (India Standard Time))
- **InitialSetup20240221144943** (Sun Jul 19 2026 23:30:15 GMT+0530 (India Standard Time))
- **Migration20240604080145** (Sun Jul 19 2026 23:30:15 GMT+0530 (India Standard Time))
- **Migration20241205122700** (Sun Jul 19 2026 23:30:15 GMT+0530 (India Standard Time))
- **Migration20251015123842** (Sun Jul 19 2026 23:30:15 GMT+0530 (India Standard Time))
- **InitialSetup20240227075933** (Sun Jul 19 2026 23:30:19 GMT+0530 (India Standard Time))
- **Migration20240621145944** (Sun Jul 19 2026 23:30:19 GMT+0530 (India Standard Time))
- **Migration20241206083313** (Sun Jul 19 2026 23:30:19 GMT+0530 (India Standard Time))
- **Migration20251202184737** (Sun Jul 19 2026 23:30:19 GMT+0530 (India Standard Time))
- **Migration20251212161429** (Sun Jul 19 2026 23:30:19 GMT+0530 (India Standard Time))
- **Migration20240227090331** (Sun Jul 19 2026 23:30:25 GMT+0530 (India Standard Time))
- **Migration20240710135844** (Sun Jul 19 2026 23:30:25 GMT+0530 (India Standard Time))
- **Migration20240924114005** (Sun Jul 19 2026 23:30:25 GMT+0530 (India Standard Time))
- **Migration20241212052837** (Sun Jul 19 2026 23:30:25 GMT+0530 (India Standard Time))
- **InitialSetup20240228133303** (Sun Jul 19 2026 23:30:30 GMT+0530 (India Standard Time))
- **Migration20240624082354** (Sun Jul 19 2026 23:30:30 GMT+0530 (India Standard Time))
- **Migration20240225134525** (Sun Jul 19 2026 23:30:33 GMT+0530 (India Standard Time))
- **Migration20240806072619** (Sun Jul 19 2026 23:30:33 GMT+0530 (India Standard Time))
- **Migration20241211151053** (Sun Jul 19 2026 23:30:33 GMT+0530 (India Standard Time))
- **Migration20250115160517** (Sun Jul 19 2026 23:30:33 GMT+0530 (India Standard Time))
- **Migration20250120110552** (Sun Jul 19 2026 23:30:33 GMT+0530 (India Standard Time))
- **Migration20250123122334** (Sun Jul 19 2026 23:30:33 GMT+0530 (India Standard Time))
- **Migration20250206105639** (Sun Jul 19 2026 23:30:33 GMT+0530 (India Standard Time))
- **Migration20250207132723** (Sun Jul 19 2026 23:30:33 GMT+0530 (India Standard Time))
- **Migration20250625084134** (Sun Jul 19 2026 23:30:33 GMT+0530 (India Standard Time))
- **Migration20250924135437** (Sun Jul 19 2026 23:30:33 GMT+0530 (India Standard Time))
- **Migration20250929124701** (Sun Jul 19 2026 23:30:33 GMT+0530 (India Standard Time))
- **Migration20260411223700** (Sun Jul 19 2026 23:30:33 GMT+0530 (India Standard Time))
- **Migration20240219102530** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20240604100512** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20240715102100** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20240715174100** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20240716081800** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20240801085921** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20240821164505** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20240821170920** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20240827133639** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20240902195921** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20240913092514** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20240930122627** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20241014142943** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20241106085223** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20241129124827** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20241217162224** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20250326151554** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20250522181137** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20250702095353** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20250704120229** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20250910130000** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20251016160403** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20251016182939** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20251017155709** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20251114100559** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20251125164002** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20251210112909** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20251210112924** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20251225120947** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20260106185528** (Sun Jul 19 2026 23:30:44 GMT+0530 (India Standard Time))
- **Migration20250717162007** (Sun Jul 19 2026 23:31:11 GMT+0530 (India Standard Time))
- **Migration20260127081758** (Sun Jul 19 2026 23:31:11 GMT+0530 (India Standard Time))
- **Migration20260615151246** (Sun Jul 19 2026 23:31:11 GMT+0530 (India Standard Time))
- **Migration20240205025928** (Sun Jul 19 2026 23:31:16 GMT+0530 (India Standard Time))
- **Migration20240529080336** (Sun Jul 19 2026 23:31:16 GMT+0530 (India Standard Time))
- **Migration20241202100304** (Sun Jul 19 2026 23:31:16 GMT+0530 (India Standard Time))
- **Migration20260514083900** (Sun Jul 19 2026 23:31:16 GMT+0530 (India Standard Time))
- **Migration20260525090000** (Sun Jul 19 2026 23:31:16 GMT+0530 (India Standard Time))
- **Migration20260604120000** (Sun Jul 19 2026 23:31:16 GMT+0530 (India Standard Time))
- **Migration20260616075929** (Sun Jul 19 2026 23:31:16 GMT+0530 (India Standard Time))
- **Migration20240214033943** (Sun Jul 19 2026 23:31:26 GMT+0530 (India Standard Time))
- **Migration20240703095850** (Sun Jul 19 2026 23:31:26 GMT+0530 (India Standard Time))
- **Migration20241202103352** (Sun Jul 19 2026 23:31:26 GMT+0530 (India Standard Time))
- **Migration20240311145700_InitialSetupMigration** (Sun Jul 19 2026 23:31:30 GMT+0530 (India Standard Time))
- **Migration20240821170957** (Sun Jul 19 2026 23:31:30 GMT+0530 (India Standard Time))
- **Migration20240917161003** (Sun Jul 19 2026 23:31:30 GMT+0530 (India Standard Time))
- **Migration20241217110416** (Sun Jul 19 2026 23:31:30 GMT+0530 (India Standard Time))
- **Migration20250113122235** (Sun Jul 19 2026 23:31:30 GMT+0530 (India Standard Time))
- **Migration20250120115002** (Sun Jul 19 2026 23:31:30 GMT+0530 (India Standard Time))
- **Migration20250822130931** (Sun Jul 19 2026 23:31:30 GMT+0530 (India Standard Time))
- **Migration20250825132614** (Sun Jul 19 2026 23:31:30 GMT+0530 (India Standard Time))
- **Migration20251114133146** (Sun Jul 19 2026 23:31:30 GMT+0530 (India Standard Time))
- **Migration20240509083918_InitialSetupMigration** (Sun Jul 19 2026 23:31:42 GMT+0530 (India Standard Time))
- **Migration20240628075401** (Sun Jul 19 2026 23:31:42 GMT+0530 (India Standard Time))
- **Migration20240830094712** (Sun Jul 19 2026 23:31:42 GMT+0530 (India Standard Time))
- **Migration20250120110514** (Sun Jul 19 2026 23:31:42 GMT+0530 (India Standard Time))
- **Migration20251028172715** (Sun Jul 19 2026 23:31:42 GMT+0530 (India Standard Time))
- **Migration20251121123942** (Sun Jul 19 2026 23:31:42 GMT+0530 (India Standard Time))
- **Migration20251121150408** (Sun Jul 19 2026 23:31:42 GMT+0530 (India Standard Time))
- **Migration20231228143900** (Sun Jul 19 2026 23:31:53 GMT+0530 (India Standard Time))
- **Migration20241206101446** (Sun Jul 19 2026 23:31:53 GMT+0530 (India Standard Time))
- **Migration20250128174331** (Sun Jul 19 2026 23:31:53 GMT+0530 (India Standard Time))
- **Migration20250505092459** (Sun Jul 19 2026 23:31:53 GMT+0530 (India Standard Time))
- **Migration20250819104213** (Sun Jul 19 2026 23:31:53 GMT+0530 (India Standard Time))
- **Migration20250819110924** (Sun Jul 19 2026 23:31:53 GMT+0530 (India Standard Time))
- **Migration20250908080305** (Sun Jul 19 2026 23:31:53 GMT+0530 (India Standard Time))
- **Migration20240925143313** (Sun Jul 19 2026 23:32:04 GMT+0530 (India Standard Time))
- **Migration20260717060000** (Sun Jul 19 2026 23:32:04 GMT+0530 (India Standard Time))
- **Migration20260719083142** (Sun Jul 19 2026 23:32:04 GMT+0530 (India Standard Time))
- **Migration20240822141125** (Sun Jul 19 2026 23:32:11 GMT+0530 (India Standard Time))
- **Migration20260717043000** (Sun Jul 19 2026 23:32:11 GMT+0530 (India Standard Time))
- **Migration20260717044000** (Sun Jul 19 2026 23:32:11 GMT+0530 (India Standard Time))
- **Migration20260717045000** (Sun Jul 19 2026 23:32:11 GMT+0530 (India Standard Time))
- **Migration20260720000000** (Sun Jul 19 2026 23:32:11 GMT+0530 (India Standard Time))
- **Migration20260714193700** (Sun Jul 19 2026 23:32:16 GMT+0530 (India Standard Time))
- **Migration20260714195800** (Sun Jul 19 2026 23:32:19 GMT+0530 (India Standard Time))
- **Migration20260714202500** (Sun Jul 19 2026 23:32:21 GMT+0530 (India Standard Time))
- **Migration20260715130000** (Sun Jul 19 2026 23:32:21 GMT+0530 (India Standard Time))
- **Migration20260714203600** (Sun Jul 19 2026 23:32:26 GMT+0530 (India Standard Time))
- **Migration20260718130000** (Sun Jul 19 2026 23:32:26 GMT+0530 (India Standard Time))
- **Migration20260718200000** (Sun Jul 19 2026 23:32:26 GMT+0530 (India Standard Time))
- **Migration20260719104309** (Sun Jul 19 2026 23:32:29 GMT+0530 (India Standard Time))
- **Migration20260719113415** (Sun Jul 19 2026 23:32:29 GMT+0530 (India Standard Time))
- **Migration20260719123908** (Sun Jul 19 2026 23:32:29 GMT+0530 (India Standard Time))
- **Migration20260719130705** (Sun Jul 19 2026 23:32:29 GMT+0530 (India Standard Time))
- **Migration20260714205700** (Sun Jul 19 2026 23:32:36 GMT+0530 (India Standard Time))
- **Migration20260715211000** (Sun Jul 19 2026 23:32:36 GMT+0530 (India Standard Time))
- **Migration20260714212800** (Sun Jul 19 2026 23:32:40 GMT+0530 (India Standard Time))
- **Migration20260714213700** (Sun Jul 19 2026 23:32:44 GMT+0530 (India Standard Time))
- **Migration20260719083140** (Sun Jul 19 2026 23:32:44 GMT+0530 (India Standard Time))
- **Migration20260714214600** (Sun Jul 19 2026 23:32:49 GMT+0530 (India Standard Time))
- **Migration20260715160000** (Sun Jul 19 2026 23:32:52 GMT+0530 (India Standard Time))
- **Migration20260715210000** (Sun Jul 19 2026 23:32:55 GMT+0530 (India Standard Time))
- **Migration20260717030000** (Sun Jul 19 2026 23:32:58 GMT+0530 (India Standard Time))
- **Migration20260717042000** (Sun Jul 19 2026 23:32:58 GMT+0530 (India Standard Time))
- **Migration20260717090000** (Sun Jul 19 2026 23:33:02 GMT+0530 (India Standard Time))
- **Migration20260717100000** (Sun Jul 19 2026 23:33:06 GMT+0530 (India Standard Time))
- **Migration20260717110000** (Sun Jul 19 2026 23:33:06 GMT+0530 (India Standard Time))
- **Migration20260717120000** (Sun Jul 19 2026 23:33:06 GMT+0530 (India Standard Time))
- **Migration20260717130000** (Sun Jul 19 2026 23:33:06 GMT+0530 (India Standard Time))
- **Migration20260717181016** (Sun Jul 19 2026 23:33:12 GMT+0530 (India Standard Time))
- **Migration20260718123000** (Sun Jul 19 2026 23:33:12 GMT+0530 (India Standard Time))
- **Migration20260718170000** (Sun Jul 19 2026 23:33:12 GMT+0530 (India Standard Time))
- **Migration20260718180000** (Sun Jul 19 2026 23:33:12 GMT+0530 (India Standard Time))
- **Migration20260717180000** (Sun Jul 19 2026 23:33:19 GMT+0530 (India Standard Time))
- **Migration20260718060000** (Sun Jul 19 2026 23:33:19 GMT+0530 (India Standard Time))
- **Migration20260719000000** (Sun Jul 19 2026 23:33:24 GMT+0530 (India Standard Time))
- **Migration20260721000000** (Sun Jul 19 2026 23:33:28 GMT+0530 (India Standard Time))
- **Migration20260719104558** (Sun Jul 19 2026 23:33:30 GMT+0530 (India Standard Time))

---

## 9. Safety & Cleanup Guidelines
- **Zero Destructive Actions Taken:** This audit is strictly read-only.
- **RLS Status:** All 275 tables have Row Level Security enabled.
- **Enterprise JSONB Pattern:** As established, core entities such as `order` use `order.metadata` to store line items, delivery details, compliance snapshots, and OTPs. Empty relational tables (e.g. `order_item` = 0 rows) are part of the Medusa schema and MUST NOT be dropped without safety verification.
