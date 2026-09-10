# CAKETOHOME DATABASE & API PERFORMANCE AUDIT (PHASES 9 — 12)
**Generated**: 2026-09-05T16:06:16.532Z  
**Target**: PostgreSQL 16 Authority & Next.js BFF API Layer  

---

## 1. PostgreSQL Schema & Table Inventory

| Table Name | Active Row Count | Primary Authority | Notes |
| :--- | :--- | :--- | :--- |
| `account_holder` | **0** | PostgreSQL | Core Entity |
| `ai_circuit_breaker_state` | **0** | PostgreSQL | Core Entity |
| `ai_knowledge_base` | **0** | PostgreSQL | Core Entity |
| `ai_memory_state` | **0** | PostgreSQL | Core Entity |
| `ai_model_config` | **0** | PostgreSQL | Core Entity |
| `ai_prompt_registry` | **0** | PostgreSQL | Core Entity |
| `ai_provider_config` | **0** | PostgreSQL | Core Entity |
| `ai_request_log` | **0** | PostgreSQL | Core Entity |
| `analytics_event` | **18** | PostgreSQL | Core Entity |
| `analytics_expense` | **0** | PostgreSQL | Core Entity |
| `analytics_franchise` | **0** | PostgreSQL | Core Entity |
| `api_key` | **2** | PostgreSQL | Core Entity |
| `application_method_buy_rules` | **0** | PostgreSQL | Core Entity |
| `application_method_target_rules` | **0** | PostgreSQL | Core Entity |
| `audit_log` | **13** | PostgreSQL | Core Entity |
| `auth_identity` | **2** | PostgreSQL | Core Entity |
| `auth_mfa_factor` | **0** | PostgreSQL | Core Entity |
| `auth_mfa_recovery_code` | **0** | PostgreSQL | Core Entity |
| `auth_password_reset_token` | **0** | PostgreSQL | Core Entity |
| `auth_verification` | **0** | PostgreSQL | Core Entity |
| `branch` | **54** | PostgreSQL | Core Entity |
| `branch_capacity` | **0** | PostgreSQL | Core Entity |
| `branch_inventory` | **0** | PostgreSQL | Core Entity |
| `branch_price` | **0** | PostgreSQL | Core Entity |
| `branch_region` | **3** | PostgreSQL | Core Entity |
| `branch_settings` | **0** | PostgreSQL | Core Entity |
| `branch_staff` | **0** | PostgreSQL | Core Entity |
| `cake_option` | **0** | PostgreSQL | Core Entity |
| `capture` | **0** | PostgreSQL | Core Entity |
| `cart` | **15** | PostgreSQL | Core Entity |
| `cart_address` | **1** | PostgreSQL | Core Entity |
| `cart_line_item` | **13** | PostgreSQL | Core Entity |
| `cart_line_item_adjustment` | **0** | PostgreSQL | Core Entity |
| `cart_line_item_tax_line` | **1** | PostgreSQL | Core Entity |
| `cart_payment_collection` | **1** | PostgreSQL | Core Entity |
| `cart_promotion` | **0** | PostgreSQL | Core Entity |
| `cart_shipping_method` | **0** | PostgreSQL | Core Entity |
| `cart_shipping_method_adjustment` | **0** | PostgreSQL | Core Entity |
| `cart_shipping_method_tax_line` | **0** | PostgreSQL | Core Entity |
| `chat_message` | **0** | PostgreSQL | Core Entity |
| `chat_session` | **0** | PostgreSQL | Core Entity |
| `city` | **29** | PostgreSQL | Core Entity |
| `cms_asset_reference` | **0** | PostgreSQL | Core Entity |
| `cms_banner` | **0** | PostgreSQL | Core Entity |
| `cms_block` | **0** | PostgreSQL | Core Entity |
| `cms_category` | **0** | PostgreSQL | Core Entity |
| `cms_homepage_section` | **32** | PostgreSQL | Core Entity |
| `cms_navigation` | **0** | PostgreSQL | Core Entity |
| `cms_page` | **19** | PostgreSQL | Core Entity |
| `cms_redirect` | **0** | PostgreSQL | Core Entity |
| `cms_revision` | **0** | PostgreSQL | Core Entity |
| `cms_tag` | **0** | PostgreSQL | Core Entity |
| `cms_template` | **0** | PostgreSQL | Core Entity |
| `config_audit_log` | **0** | PostgreSQL | Core Entity |
| `connector_config` | **0** | PostgreSQL | Core Entity |
| `contact_submission` | **0** | PostgreSQL | Core Entity |
| `credit_line` | **0** | PostgreSQL | Core Entity |
| `crm_ab_test` | **0** | PostgreSQL | Core Entity |
| `crm_automation_execution` | **0** | PostgreSQL | Core Entity |
| `crm_automation_flow` | **0** | PostgreSQL | Core Entity |
| `crm_automation_log` | **0** | PostgreSQL | Core Entity |
| `crm_campaign` | **0** | PostgreSQL | Core Entity |
| `crm_customer_blacklist` | **0** | PostgreSQL | Core Entity |
| `crm_customer_note` | **0** | PostgreSQL | Core Entity |
| `crm_customer_rfm` | **0** | PostgreSQL | Core Entity |
| `crm_customer_segment` | **0** | PostgreSQL | Core Entity |
| `crm_email_template` | **0** | PostgreSQL | Core Entity |
| `crm_segment` | **0** | PostgreSQL | Core Entity |
| `currency` | **126** | PostgreSQL | Core Entity |
| `cust_address` | **0** | PostgreSQL | Core Entity |
| `customer` | **57** | PostgreSQL | Core Entity |
| `customer_account_holder` | **0** | PostgreSQL | Core Entity |
| `customer_address` | **34** | PostgreSQL | Core Entity |
| `customer_favorite` | **1** | PostgreSQL | Core Entity |
| `customer_group` | **0** | PostgreSQL | Core Entity |
| `customer_group_customer` | **0** | PostgreSQL | Core Entity |
| `customer_phone` | **2** | PostgreSQL | Core Entity |
| `delivery` | **7** | PostgreSQL | Core Entity |
| `delivery_delivery_partner` | **5** | PostgreSQL | Core Entity |
| `delivery_partner` | **30** | PostgreSQL | Core Entity |
| `delivery_proof` | **0** | PostgreSQL | Core Entity |
| `delivery_slot` | **0** | PostgreSQL | Core Entity |
| `delivery_zone` | **43** | PostgreSQL | Core Entity |
| `deliverymodule_delivery_cart_cart` | **0** | PostgreSQL | Core Entity |
| `deliverymodule_delivery_order_order` | **0** | PostgreSQL | Core Entity |
| `driver_attendance` | **0** | PostgreSQL | Core Entity |
| `driver_location` | **0** | PostgreSQL | Core Entity |
| `driver_profile` | **0** | PostgreSQL | Core Entity |
| `driver_transaction` | **0** | PostgreSQL | Core Entity |
| `driver_wallet` | **0** | PostgreSQL | Core Entity |
| `fulfillment` | **0** | PostgreSQL | Core Entity |
| `fulfillment_address` | **0** | PostgreSQL | Core Entity |
| `fulfillment_item` | **0** | PostgreSQL | Core Entity |
| `fulfillment_label` | **0** | PostgreSQL | Core Entity |
| `fulfillment_provider` | **1** | PostgreSQL | Core Entity |
| `fulfillment_set` | **1** | PostgreSQL | Core Entity |
| `geo_zone` | **7** | PostgreSQL | Core Entity |
| `image` | **0** | PostgreSQL | Core Entity |
| `inventory_item` | **5** | PostgreSQL | Core Entity |
| `inventory_level` | **0** | PostgreSQL | Core Entity |
| `inventory_transfer` | **0** | PostgreSQL | Core Entity |
| `invite` | **0** | PostgreSQL | Core Entity |
| `invite_rbac_role` | **0** | PostgreSQL | Core Entity |
| `language` | **0** | PostgreSQL | Core Entity |
| `layout_configuration` | **0** | PostgreSQL | Core Entity |
| `lead_enquiry` | **1** | PostgreSQL | Core Entity |
| `link_module_migrations` | **24** | PostgreSQL | Core Entity |
| `loc_currency` | **0** | PostgreSQL | Core Entity |
| `location_fulfillment_provider` | **1** | PostgreSQL | Core Entity |
| `location_fulfillment_set` | **1** | PostgreSQL | Core Entity |
| `login_event` | **10** | PostgreSQL | Core Entity |
| `marketing_campaign` | **0** | PostgreSQL | Core Entity |
| `marketing_campaign_event` | **0** | PostgreSQL | Core Entity |
| `marketing_campaign_metric` | **0** | PostgreSQL | Core Entity |
| `marketing_gamification_reward` | **0** | PostgreSQL | Core Entity |
| `marketing_newsletter_subscriber` | **0** | PostgreSQL | Core Entity |
| `marketing_popup` | **0** | PostgreSQL | Core Entity |
| `marketing_qr_code` | **0** | PostgreSQL | Core Entity |
| `marketing_recovery_job` | **0** | PostgreSQL | Core Entity |
| `media` | **142** | PostgreSQL | Core Entity |
| `mikro_orm_migrations` | **215** | PostgreSQL | Core Entity |
| `notification` | **0** | PostgreSQL | Core Entity |
| `notification_log` | **0** | PostgreSQL | Core Entity |
| `notification_provider` | **1** | PostgreSQL | Core Entity |
| `notification_template` | **0** | PostgreSQL | Core Entity |
| `offer` | **24** | PostgreSQL | Core Entity |
| `offer_redemption` | **0** | PostgreSQL | Core Entity |
| `order` | **125** | PostgreSQL | Core Entity |
| `order_address` | **0** | PostgreSQL | Core Entity |
| `order_cart` | **0** | PostgreSQL | Core Entity |
| `order_change` | **0** | PostgreSQL | Core Entity |
| `order_change_action` | **0** | PostgreSQL | Core Entity |
| `order_claim` | **0** | PostgreSQL | Core Entity |
| `order_claim_item` | **0** | PostgreSQL | Core Entity |
| `order_claim_item_image` | **0** | PostgreSQL | Core Entity |
| `order_credit_line` | **0** | PostgreSQL | Core Entity |
| `order_event` | **13** | PostgreSQL | Core Entity |
| `order_exchange` | **0** | PostgreSQL | Core Entity |
| `order_exchange_item` | **0** | PostgreSQL | Core Entity |
| `order_fulfillment` | **0** | PostgreSQL | Core Entity |
| `order_item` | **0** | PostgreSQL | Core Entity |
| `order_lifecycle_refund` | **0** | PostgreSQL | Core Entity |
| `order_line_item` | **0** | PostgreSQL | Core Entity |
| `order_line_item_adjustment` | **0** | PostgreSQL | Core Entity |
| `order_line_item_tax_line` | **0** | PostgreSQL | Core Entity |
| `order_note` | **0** | PostgreSQL | Core Entity |
| `order_payment_collection` | **0** | PostgreSQL | Core Entity |
| `order_promotion` | **0** | PostgreSQL | Core Entity |
| `order_shipping` | **0** | PostgreSQL | Core Entity |
| `order_shipping_method` | **0** | PostgreSQL | Core Entity |
| `order_shipping_method_adjustment` | **0** | PostgreSQL | Core Entity |
| `order_shipping_method_tax_line` | **0** | PostgreSQL | Core Entity |
| `order_staff_assignment` | **0** | PostgreSQL | Core Entity |
| `order_status_history` | **13** | PostgreSQL | Core Entity |
| `order_summary` | **0** | PostgreSQL | Core Entity |
| `order_transaction` | **0** | PostgreSQL | Core Entity |
| `payment` | **0** | PostgreSQL | Core Entity |
| `payment_audit_trail` | **14** | PostgreSQL | Core Entity |
| `payment_collection` | **1** | PostgreSQL | Core Entity |
| `payment_collection_payment_providers` | **0** | PostgreSQL | Core Entity |
| `payment_provider` | **1** | PostgreSQL | Core Entity |
| `payment_session` | **1** | PostgreSQL | Core Entity |
| `payment_transaction` | **5** | PostgreSQL | Core Entity |
| `popup_audience_rules` | **0** | PostgreSQL | Core Entity |
| `popup_campaigns` | **5** | PostgreSQL | Core Entity |
| `popup_conversions` | **0** | PostgreSQL | Core Entity |
| `popup_frequency_rules` | **0** | PostgreSQL | Core Entity |
| `popup_impressions` | **0** | PostgreSQL | Core Entity |
| `popup_rules` | **0** | PostgreSQL | Core Entity |
| `popup_versions` | **0** | PostgreSQL | Core Entity |
| `price` | **23** | PostgreSQL | Core Entity |
| `price_list` | **0** | PostgreSQL | Core Entity |
| `price_list_rule` | **0** | PostgreSQL | Core Entity |
| `price_preference` | **3** | PostgreSQL | Core Entity |
| `price_rule` | **2** | PostgreSQL | Core Entity |
| `price_set` | **13** | PostgreSQL | Core Entity |
| `product` | **52** | PostgreSQL | Core Entity |
| `product_category` | **10** | PostgreSQL | Core Entity |
| `product_category_product` | **6** | PostgreSQL | Core Entity |
| `product_collection` | **0** | PostgreSQL | Core Entity |
| `product_meta` | **0** | PostgreSQL | Core Entity |
| `product_option` | **23** | PostgreSQL | Core Entity |
| `product_option_value` | **23** | PostgreSQL | Core Entity |
| `product_product_option` | **23** | PostgreSQL | Core Entity |
| `product_product_option_value` | **23** | PostgreSQL | Core Entity |
| `product_review` | **0** | PostgreSQL | Core Entity |
| `product_reviews` | **0** | PostgreSQL | Core Entity |
| `product_sales_channel` | **6** | PostgreSQL | Core Entity |
| `product_shipping_profile` | **0** | PostgreSQL | Core Entity |
| `product_tag` | **0** | PostgreSQL | Core Entity |
| `product_tags` | **0** | PostgreSQL | Core Entity |
| `product_type` | **0** | PostgreSQL | Core Entity |
| `product_variant` | **11** | PostgreSQL | Core Entity |
| `product_variant_inventory_item` | **5** | PostgreSQL | Core Entity |
| `product_variant_option` | **11** | PostgreSQL | Core Entity |
| `product_variant_price_set` | **11** | PostgreSQL | Core Entity |
| `product_variant_product_image` | **0** | PostgreSQL | Core Entity |
| `promotion` | **0** | PostgreSQL | Core Entity |
| `promotion_application_method` | **0** | PostgreSQL | Core Entity |
| `promotion_campaign` | **0** | PostgreSQL | Core Entity |
| `promotion_campaign_budget` | **0** | PostgreSQL | Core Entity |
| `promotion_campaign_budget_usage` | **0** | PostgreSQL | Core Entity |
| `promotion_promotion_rule` | **0** | PostgreSQL | Core Entity |
| `promotion_rule` | **0** | PostgreSQL | Core Entity |
| `promotion_rule_value` | **0** | PostgreSQL | Core Entity |
| `property_label` | **0** | PostgreSQL | Core Entity |
| `provider_identity` | **2** | PostgreSQL | Core Entity |
| `publishable_api_key_sales_channel` | **2** | PostgreSQL | Core Entity |
| `refund` | **0** | PostgreSQL | Core Entity |
| `refund_reason` | **3** | PostgreSQL | Core Entity |
| `region` | **1** | PostgreSQL | Core Entity |
| `region_country` | **250** | PostgreSQL | Core Entity |
| `region_payment_provider` | **1** | PostgreSQL | Core Entity |
| `report_schedule` | **0** | PostgreSQL | Core Entity |
| `reschedule_request` | **0** | PostgreSQL | Core Entity |
| `reservation_item` | **0** | PostgreSQL | Core Entity |
| `return` | **0** | PostgreSQL | Core Entity |
| `return_fulfillment` | **0** | PostgreSQL | Core Entity |
| `return_item` | **0** | PostgreSQL | Core Entity |
| `return_reason` | **0** | PostgreSQL | Core Entity |
| `rewards_fraud_review` | **0** | PostgreSQL | Core Entity |
| `rewards_gift_card` | **0** | PostgreSQL | Core Entity |
| `rewards_gift_card_transaction` | **0** | PostgreSQL | Core Entity |
| `rewards_loyalty_ledger` | **0** | PostgreSQL | Core Entity |
| `rewards_loyalty_rule` | **0** | PostgreSQL | Core Entity |
| `rewards_loyalty_transaction` | **0** | PostgreSQL | Core Entity |
| `rewards_referral_code` | **0** | PostgreSQL | Core Entity |
| `rewards_referral_event` | **0** | PostgreSQL | Core Entity |
| `rewards_referral_program` | **0** | PostgreSQL | Core Entity |
| `rewards_referral_qualification` | **0** | PostgreSQL | Core Entity |
| `rewards_wallet` | **0** | PostgreSQL | Core Entity |
| `rewards_wallet_transaction` | **0** | PostgreSQL | Core Entity |
| `sales_channel` | **1** | PostgreSQL | Core Entity |
| `sales_channel_stock_location` | **1** | PostgreSQL | Core Entity |
| `script_migrations` | **5** | PostgreSQL | Core Entity |
| `security_blocked_ip` | **0** | PostgreSQL | Core Entity |
| `security_event` | **63** | PostgreSQL | Core Entity |
| `security_ip_whitelist` | **8** | PostgreSQL | Core Entity |
| `security_user_two_factor` | **0** | PostgreSQL | Core Entity |
| `service_zone` | **1** | PostgreSQL | Core Entity |
| `setting` | **15** | PostgreSQL | Core Entity |
| `shipping_option` | **2** | PostgreSQL | Core Entity |
| `shipping_option_price_set` | **2** | PostgreSQL | Core Entity |
| `shipping_option_rule` | **4** | PostgreSQL | Core Entity |
| `shipping_option_type` | **2** | PostgreSQL | Core Entity |
| `shipping_profile` | **2** | PostgreSQL | Core Entity |
| `shop` | **5** | PostgreSQL | Core Entity |
| `shop_manager` | **0** | PostgreSQL | Core Entity |
| `shopmodule_shop_deliverymodule_delivery` | **0** | PostgreSQL | Core Entity |
| `shopmodule_shop_product_product` | **6** | PostgreSQL | Core Entity |
| `slot_reservation` | **0** | PostgreSQL | Core Entity |
| `stock_location` | **1** | PostgreSQL | Core Entity |
| `stock_location_address` | **1** | PostgreSQL | Core Entity |
| `stock_notification` | **0** | PostgreSQL | Core Entity |
| `store` | **1** | PostgreSQL | Core Entity |
| `store_currency` | **2** | PostgreSQL | Core Entity |
| `store_locale` | **0** | PostgreSQL | Core Entity |
| `subscription` | **0** | PostgreSQL | Core Entity |
| `support_ticket` | **0** | PostgreSQL | Core Entity |
| `tax_provider` | **1** | PostgreSQL | Core Entity |
| `tax_rate` | **1** | PostgreSQL | Core Entity |
| `tax_rate_rule` | **0** | PostgreSQL | Core Entity |
| `tax_region` | **8** | PostgreSQL | Core Entity |
| `ticket_message` | **0** | PostgreSQL | Core Entity |
| `translation` | **0** | PostgreSQL | Core Entity |
| `user` | **2** | PostgreSQL | Core Entity |
| `user_preference` | **0** | PostgreSQL | Core Entity |
| `user_rbac_role` | **0** | PostgreSQL | Core Entity |
| `variant_option` | **33** | PostgreSQL | Core Entity |
| `view_configuration` | **0** | PostgreSQL | Core Entity |
| `webhook_delivery` | **0** | PostgreSQL | Core Entity |
| `webhook_endpoint` | **0** | PostgreSQL | Core Entity |
| `wishlist_item` | **0** | PostgreSQL | Core Entity |
| `workflow_execution` | **0** | PostgreSQL | Core Entity |

---

## 2. PostgreSQL Index Audit & Coverage Analysis

Total Active Indexes: **939**

| Table | Index Name | Index Definition |
| :--- | :--- | :--- |
| `account_holder` | `IDX_account_holder_deleted_at` | `CREATE INDEX "IDX_account_holder_deleted_at" ON public.account_holder USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `account_holder` | `IDX_account_holder_provider_id_external_id_unique` | `CREATE UNIQUE INDEX "IDX_account_holder_provider_id_external_id_unique" ON public.account_holder USING btree (provider_id, external_id) WHERE (deleted_at IS NULL)` |
| `account_holder` | `account_holder_pkey` | `CREATE UNIQUE INDEX account_holder_pkey ON public.account_holder USING btree (id)` |
| `ai_circuit_breaker_state` | `IDX_ai_circuit_breaker_state_deleted_at` | `CREATE INDEX "IDX_ai_circuit_breaker_state_deleted_at" ON public.ai_circuit_breaker_state USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `ai_circuit_breaker_state` | `IDX_ai_circuit_breaker_state_provider_name_unique` | `CREATE UNIQUE INDEX "IDX_ai_circuit_breaker_state_provider_name_unique" ON public.ai_circuit_breaker_state USING btree (provider_name) WHERE (deleted_at IS NULL)` |
| `ai_circuit_breaker_state` | `ai_circuit_breaker_state_pkey` | `CREATE UNIQUE INDEX ai_circuit_breaker_state_pkey ON public.ai_circuit_breaker_state USING btree (id)` |
| `ai_knowledge_base` | `IDX_ai_knowledge_base_deleted_at` | `CREATE INDEX "IDX_ai_knowledge_base_deleted_at" ON public.ai_knowledge_base USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `ai_knowledge_base` | `ai_knowledge_base_pkey` | `CREATE UNIQUE INDEX ai_knowledge_base_pkey ON public.ai_knowledge_base USING btree (id)` |
| `ai_memory_state` | `IDX_ai_memory_state_deleted_at` | `CREATE INDEX "IDX_ai_memory_state_deleted_at" ON public.ai_memory_state USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `ai_memory_state` | `ai_memory_state_pkey` | `CREATE UNIQUE INDEX ai_memory_state_pkey ON public.ai_memory_state USING btree (id)` |
| `ai_model_config` | `IDX_ai_model_config_deleted_at` | `CREATE INDEX "IDX_ai_model_config_deleted_at" ON public.ai_model_config USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `ai_model_config` | `IDX_ai_model_config_model_name_unique` | `CREATE UNIQUE INDEX "IDX_ai_model_config_model_name_unique" ON public.ai_model_config USING btree (model_name) WHERE (deleted_at IS NULL)` |
| `ai_model_config` | `ai_model_config_pkey` | `CREATE UNIQUE INDEX ai_model_config_pkey ON public.ai_model_config USING btree (id)` |
| `ai_prompt_registry` | `IDX_ai_prompt_registry_deleted_at` | `CREATE INDEX "IDX_ai_prompt_registry_deleted_at" ON public.ai_prompt_registry USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `ai_prompt_registry` | `ai_prompt_registry_pkey` | `CREATE UNIQUE INDEX ai_prompt_registry_pkey ON public.ai_prompt_registry USING btree (id)` |
| `ai_provider_config` | `IDX_ai_provider_config_deleted_at` | `CREATE INDEX "IDX_ai_provider_config_deleted_at" ON public.ai_provider_config USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `ai_provider_config` | `IDX_ai_provider_config_provider_name_unique` | `CREATE UNIQUE INDEX "IDX_ai_provider_config_provider_name_unique" ON public.ai_provider_config USING btree (provider_name) WHERE (deleted_at IS NULL)` |
| `ai_provider_config` | `ai_provider_config_pkey` | `CREATE UNIQUE INDEX ai_provider_config_pkey ON public.ai_provider_config USING btree (id)` |
| `ai_request_log` | `IDX_ai_request_log_deleted_at` | `CREATE INDEX "IDX_ai_request_log_deleted_at" ON public.ai_request_log USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `ai_request_log` | `ai_request_log_pkey` | `CREATE UNIQUE INDEX ai_request_log_pkey ON public.ai_request_log USING btree (id)` |
| `analytics_event` | `IDX_analytics_event_branch_id` | `CREATE INDEX "IDX_analytics_event_branch_id" ON public.analytics_event USING btree (branch_id) WHERE (deleted_at IS NULL)` |
| `analytics_event` | `IDX_analytics_event_event_type` | `CREATE INDEX "IDX_analytics_event_event_type" ON public.analytics_event USING btree (event_type) WHERE (deleted_at IS NULL)` |
| `analytics_event` | `IDX_analytics_event_session_id` | `CREATE INDEX "IDX_analytics_event_session_id" ON public.analytics_event USING btree (session_id) WHERE (deleted_at IS NULL)` |
| `analytics_event` | `analytics_event_pkey` | `CREATE UNIQUE INDEX analytics_event_pkey ON public.analytics_event USING btree (id)` |
| `analytics_expense` | `IDX_analytics_expense_branch_id` | `CREATE INDEX "IDX_analytics_expense_branch_id" ON public.analytics_expense USING btree (branch_id) WHERE (deleted_at IS NULL)` |
| `analytics_expense` | `IDX_analytics_expense_expense_date` | `CREATE INDEX "IDX_analytics_expense_expense_date" ON public.analytics_expense USING btree (expense_date) WHERE (deleted_at IS NULL)` |
| `analytics_expense` | `analytics_expense_pkey` | `CREATE UNIQUE INDEX analytics_expense_pkey ON public.analytics_expense USING btree (id)` |
| `analytics_franchise` | `UQ_analytics_franchise_shop_id` | `CREATE UNIQUE INDEX "UQ_analytics_franchise_shop_id" ON public.analytics_franchise USING btree (shop_id) WHERE (deleted_at IS NULL)` |
| `analytics_franchise` | `analytics_franchise_pkey` | `CREATE UNIQUE INDEX analytics_franchise_pkey ON public.analytics_franchise USING btree (id)` |
| `api_key` | `IDX_api_key_deleted_at` | `CREATE INDEX "IDX_api_key_deleted_at" ON public.api_key USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `api_key` | `IDX_api_key_redacted` | `CREATE INDEX "IDX_api_key_redacted" ON public.api_key USING btree (redacted) WHERE (deleted_at IS NULL)` |
| `api_key` | `IDX_api_key_revoked_at` | `CREATE INDEX "IDX_api_key_revoked_at" ON public.api_key USING btree (revoked_at) WHERE (deleted_at IS NULL)` |
| `api_key` | `IDX_api_key_token_unique` | `CREATE UNIQUE INDEX "IDX_api_key_token_unique" ON public.api_key USING btree (token)` |
| `api_key` | `IDX_api_key_type` | `CREATE INDEX "IDX_api_key_type" ON public.api_key USING btree (type)` |
| `api_key` | `api_key_pkey` | `CREATE UNIQUE INDEX api_key_pkey ON public.api_key USING btree (id)` |
| `application_method_buy_rules` | `application_method_buy_rules_pkey` | `CREATE UNIQUE INDEX application_method_buy_rules_pkey ON public.application_method_buy_rules USING btree (application_method_id, promotion_rule_id)` |
| `application_method_target_rules` | `application_method_target_rules_pkey` | `CREATE UNIQUE INDEX application_method_target_rules_pkey ON public.application_method_target_rules USING btree (application_method_id, promotion_rule_id)` |
| `audit_log` | `IDX_audit_log_action` | `CREATE INDEX "IDX_audit_log_action" ON public.audit_log USING btree (action) WHERE (deleted_at IS NULL)` |
| `audit_log` | `IDX_audit_log_actor_id` | `CREATE INDEX "IDX_audit_log_actor_id" ON public.audit_log USING btree (actor_id) WHERE (deleted_at IS NULL)` |
| `audit_log` | `IDX_audit_log_entity` | `CREATE INDEX "IDX_audit_log_entity" ON public.audit_log USING btree (entity, entity_id) WHERE (deleted_at IS NULL)` |
| `audit_log` | `audit_log_pkey` | `CREATE UNIQUE INDEX audit_log_pkey ON public.audit_log USING btree (id)` |
| `auth_identity` | `IDX_auth_identity_deleted_at` | `CREATE INDEX "IDX_auth_identity_deleted_at" ON public.auth_identity USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `auth_identity` | `auth_identity_pkey` | `CREATE UNIQUE INDEX auth_identity_pkey ON public.auth_identity USING btree (id)` |
| `auth_mfa_factor` | `IDX_auth_mfa_factor_auth_identity_id` | `CREATE INDEX "IDX_auth_mfa_factor_auth_identity_id" ON public.auth_mfa_factor USING btree (auth_identity_id) WHERE (deleted_at IS NULL)` |
| `auth_mfa_factor` | `IDX_auth_mfa_factor_auth_identity_provider_active` | `CREATE UNIQUE INDEX "IDX_auth_mfa_factor_auth_identity_provider_active" ON public.auth_mfa_factor USING btree (auth_identity_id, provider) WHERE ((deleted_at IS NULL) AND (status = ANY (ARRAY['pending'::text, 'enabled'::text])))` |
| `auth_mfa_factor` | `IDX_auth_mfa_factor_deleted_at` | `CREATE INDEX "IDX_auth_mfa_factor_deleted_at" ON public.auth_mfa_factor USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `auth_mfa_factor` | `auth_mfa_factor_pkey` | `CREATE UNIQUE INDEX auth_mfa_factor_pkey ON public.auth_mfa_factor USING btree (id)` |
| `auth_mfa_recovery_code` | `IDX_auth_mfa_recovery_code_auth_identity_code_hash` | `CREATE UNIQUE INDEX "IDX_auth_mfa_recovery_code_auth_identity_code_hash" ON public.auth_mfa_recovery_code USING btree (auth_identity_id, code_hash) WHERE (deleted_at IS NULL)` |
| `auth_mfa_recovery_code` | `IDX_auth_mfa_recovery_code_auth_identity_id` | `CREATE INDEX "IDX_auth_mfa_recovery_code_auth_identity_id" ON public.auth_mfa_recovery_code USING btree (auth_identity_id) WHERE (deleted_at IS NULL)` |
| `auth_mfa_recovery_code` | `IDX_auth_mfa_recovery_code_deleted_at` | `CREATE INDEX "IDX_auth_mfa_recovery_code_deleted_at" ON public.auth_mfa_recovery_code USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `auth_mfa_recovery_code` | `auth_mfa_recovery_code_pkey` | `CREATE UNIQUE INDEX auth_mfa_recovery_code_pkey ON public.auth_mfa_recovery_code USING btree (id)` |
| `auth_password_reset_token` | `IDX_auth_password_reset_token_auth_identity_id` | `CREATE INDEX "IDX_auth_password_reset_token_auth_identity_id" ON public.auth_password_reset_token USING btree (auth_identity_id) WHERE (deleted_at IS NULL)` |
| `auth_password_reset_token` | `IDX_auth_password_reset_token_deleted_at` | `CREATE INDEX "IDX_auth_password_reset_token_deleted_at" ON public.auth_password_reset_token USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `auth_password_reset_token` | `IDX_auth_password_reset_token_expires_at` | `CREATE INDEX "IDX_auth_password_reset_token_expires_at" ON public.auth_password_reset_token USING btree (expires_at) WHERE (deleted_at IS NULL)` |
| `auth_password_reset_token` | `IDX_auth_password_reset_token_provider_identity_id` | `CREATE INDEX "IDX_auth_password_reset_token_provider_identity_id" ON public.auth_password_reset_token USING btree (provider_identity_id) WHERE (deleted_at IS NULL)` |
| `auth_password_reset_token` | `IDX_auth_password_reset_token_token_hash` | `CREATE INDEX "IDX_auth_password_reset_token_token_hash" ON public.auth_password_reset_token USING btree (token_hash) WHERE (deleted_at IS NULL)` |
| `auth_password_reset_token` | `auth_password_reset_token_pkey` | `CREATE UNIQUE INDEX auth_password_reset_token_pkey ON public.auth_password_reset_token USING btree (id)` |
| `auth_verification` | `IDX_auth_verification_auth_identity_id` | `CREATE INDEX "IDX_auth_verification_auth_identity_id" ON public.auth_verification USING btree (auth_identity_id) WHERE (deleted_at IS NULL)` |
| `auth_verification` | `IDX_auth_verification_deleted_at` | `CREATE INDEX "IDX_auth_verification_deleted_at" ON public.auth_verification USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `auth_verification` | `IDX_auth_verification_unique_auth_identity_entity_id_entity_typ` | `CREATE UNIQUE INDEX "IDX_auth_verification_unique_auth_identity_entity_id_entity_typ" ON public.auth_verification USING btree (auth_identity_id, entity_id, entity_type) WHERE (deleted_at IS NULL)` |
| `auth_verification` | `auth_verification_pkey` | `CREATE UNIQUE INDEX auth_verification_pkey ON public.auth_verification USING btree (id)` |
| `branch` | `IDX_branch_city_id` | `CREATE INDEX "IDX_branch_city_id" ON public.branch USING btree (city_id) WHERE (deleted_at IS NULL)` |
| `branch` | `IDX_branch_code` | `CREATE UNIQUE INDEX "IDX_branch_code" ON public.branch USING btree (code) WHERE (deleted_at IS NULL)` |
| `branch` | `IDX_branch_region_id` | `CREATE INDEX "IDX_branch_region_id" ON public.branch USING btree (region_id) WHERE (deleted_at IS NULL)` |
| `branch` | `IDX_branch_shop_id` | `CREATE INDEX "IDX_branch_shop_id" ON public.branch USING btree (shop_id) WHERE (deleted_at IS NULL)` |
| `branch` | `branch_pkey` | `CREATE UNIQUE INDEX branch_pkey ON public.branch USING btree (id)` |
| `branch_capacity` | `IDX_branch_capacity_branch_id_unique` | `CREATE UNIQUE INDEX "IDX_branch_capacity_branch_id_unique" ON public.branch_capacity USING btree (branch_id) WHERE (deleted_at IS NULL)` |
| `branch_capacity` | `IDX_branch_capacity_deleted_at` | `CREATE INDEX "IDX_branch_capacity_deleted_at" ON public.branch_capacity USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `branch_capacity` | `branch_capacity_pkey` | `CREATE UNIQUE INDEX branch_capacity_pkey ON public.branch_capacity USING btree (id)` |
| `branch_inventory` | `IDX_branch_inventory_branch_id` | `CREATE INDEX "IDX_branch_inventory_branch_id" ON public.branch_inventory USING btree (branch_id) WHERE (deleted_at IS NULL)` |
| `branch_inventory` | `IDX_branch_inventory_branch_variant` | `CREATE UNIQUE INDEX "IDX_branch_inventory_branch_variant" ON public.branch_inventory USING btree (branch_id, variant_id) WHERE (deleted_at IS NULL)` |
| `branch_inventory` | `IDX_branch_inventory_variant_id` | `CREATE INDEX "IDX_branch_inventory_variant_id" ON public.branch_inventory USING btree (variant_id) WHERE (deleted_at IS NULL)` |
| `branch_inventory` | `branch_inventory_pkey` | `CREATE UNIQUE INDEX branch_inventory_pkey ON public.branch_inventory USING btree (id)` |
| `branch_price` | `IDX_branch_price_branch_id` | `CREATE INDEX "IDX_branch_price_branch_id" ON public.branch_price USING btree (branch_id) WHERE (deleted_at IS NULL)` |
| `branch_price` | `IDX_branch_price_branch_variant` | `CREATE UNIQUE INDEX "IDX_branch_price_branch_variant" ON public.branch_price USING btree (branch_id, variant_id) WHERE (deleted_at IS NULL)` |
| `branch_price` | `IDX_branch_price_variant_id` | `CREATE INDEX "IDX_branch_price_variant_id" ON public.branch_price USING btree (variant_id) WHERE (deleted_at IS NULL)` |
| `branch_price` | `branch_price_pkey` | `CREATE UNIQUE INDEX branch_price_pkey ON public.branch_price USING btree (id)` |
| `branch_region` | `IDX_branch_region_name` | `CREATE INDEX "IDX_branch_region_name" ON public.branch_region USING btree (name) WHERE (deleted_at IS NULL)` |
| `branch_region` | `branch_region_pkey` | `CREATE UNIQUE INDEX branch_region_pkey ON public.branch_region USING btree (id)` |
| `branch_settings` | `IDX_branch_settings_branch_id` | `CREATE UNIQUE INDEX "IDX_branch_settings_branch_id" ON public.branch_settings USING btree (branch_id) WHERE (deleted_at IS NULL)` |
| `branch_settings` | `branch_settings_pkey` | `CREATE UNIQUE INDEX branch_settings_pkey ON public.branch_settings USING btree (id)` |
| `branch_staff` | `IDX_branch_staff_branch_id` | `CREATE INDEX "IDX_branch_staff_branch_id" ON public.branch_staff USING btree (branch_id) WHERE (deleted_at IS NULL)` |
| `branch_staff` | `IDX_branch_staff_email` | `CREATE UNIQUE INDEX "IDX_branch_staff_email" ON public.branch_staff USING btree (email) WHERE (deleted_at IS NULL)` |
| `branch_staff` | `branch_staff_pkey` | `CREATE UNIQUE INDEX branch_staff_pkey ON public.branch_staff USING btree (id)` |
| `cake_option` | `IDX_cake_option_product_id` | `CREATE INDEX "IDX_cake_option_product_id" ON public.cake_option USING btree (product_id) WHERE (deleted_at IS NULL)` |
| `cake_option` | `cake_option_pkey` | `CREATE UNIQUE INDEX cake_option_pkey ON public.cake_option USING btree (id)` |
| `capture` | `IDX_capture_deleted_at` | `CREATE INDEX "IDX_capture_deleted_at" ON public.capture USING btree (deleted_at)` |
| `capture` | `IDX_capture_payment_id` | `CREATE INDEX "IDX_capture_payment_id" ON public.capture USING btree (payment_id) WHERE (deleted_at IS NULL)` |
| `capture` | `capture_pkey` | `CREATE UNIQUE INDEX capture_pkey ON public.capture USING btree (id)` |
| `cart` | `IDX_cart_billing_address_id` | `CREATE INDEX "IDX_cart_billing_address_id" ON public.cart USING btree (billing_address_id) WHERE ((deleted_at IS NULL) AND (billing_address_id IS NOT NULL))` |
| `cart` | `IDX_cart_currency_code` | `CREATE INDEX "IDX_cart_currency_code" ON public.cart USING btree (currency_code)` |
| `cart` | `IDX_cart_customer_id` | `CREATE INDEX "IDX_cart_customer_id" ON public.cart USING btree (customer_id) WHERE ((deleted_at IS NULL) AND (customer_id IS NOT NULL))` |
| `cart` | `IDX_cart_deleted_at` | `CREATE INDEX "IDX_cart_deleted_at" ON public.cart USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `cart` | `IDX_cart_region_id` | `CREATE INDEX "IDX_cart_region_id" ON public.cart USING btree (region_id) WHERE ((deleted_at IS NULL) AND (region_id IS NOT NULL))` |
| `cart` | `IDX_cart_sales_channel_id` | `CREATE INDEX "IDX_cart_sales_channel_id" ON public.cart USING btree (sales_channel_id) WHERE ((deleted_at IS NULL) AND (sales_channel_id IS NOT NULL))` |
| `cart` | `IDX_cart_shipping_address_id` | `CREATE INDEX "IDX_cart_shipping_address_id" ON public.cart USING btree (shipping_address_id) WHERE ((deleted_at IS NULL) AND (shipping_address_id IS NOT NULL))` |
| `cart` | `cart_pkey` | `CREATE UNIQUE INDEX cart_pkey ON public.cart USING btree (id)` |
| `cart_address` | `IDX_cart_address_deleted_at` | `CREATE INDEX "IDX_cart_address_deleted_at" ON public.cart_address USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `cart_address` | `cart_address_pkey` | `CREATE UNIQUE INDEX cart_address_pkey ON public.cart_address USING btree (id)` |
| `cart_line_item` | `IDX_cart_line_item_cart_id` | `CREATE INDEX "IDX_cart_line_item_cart_id" ON public.cart_line_item USING btree (cart_id) WHERE (deleted_at IS NULL)` |
| `cart_line_item` | `IDX_cart_line_item_deleted_at` | `CREATE INDEX "IDX_cart_line_item_deleted_at" ON public.cart_line_item USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `cart_line_item` | `IDX_line_item_product_id` | `CREATE INDEX "IDX_line_item_product_id" ON public.cart_line_item USING btree (product_id) WHERE ((deleted_at IS NULL) AND (product_id IS NOT NULL))` |
| `cart_line_item` | `IDX_line_item_variant_id` | `CREATE INDEX "IDX_line_item_variant_id" ON public.cart_line_item USING btree (variant_id) WHERE ((deleted_at IS NULL) AND (variant_id IS NOT NULL))` |
| `cart_line_item` | `cart_line_item_pkey` | `CREATE UNIQUE INDEX cart_line_item_pkey ON public.cart_line_item USING btree (id)` |
| `cart_line_item_adjustment` | `IDX_cart_line_item_adjustment_deleted_at` | `CREATE INDEX "IDX_cart_line_item_adjustment_deleted_at" ON public.cart_line_item_adjustment USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `cart_line_item_adjustment` | `IDX_cart_line_item_adjustment_item_id` | `CREATE INDEX "IDX_cart_line_item_adjustment_item_id" ON public.cart_line_item_adjustment USING btree (item_id) WHERE (deleted_at IS NULL)` |
| `cart_line_item_adjustment` | `IDX_line_item_adjustment_promotion_id` | `CREATE INDEX "IDX_line_item_adjustment_promotion_id" ON public.cart_line_item_adjustment USING btree (promotion_id) WHERE ((deleted_at IS NULL) AND (promotion_id IS NOT NULL))` |
| `cart_line_item_adjustment` | `cart_line_item_adjustment_pkey` | `CREATE UNIQUE INDEX cart_line_item_adjustment_pkey ON public.cart_line_item_adjustment USING btree (id)` |
| `cart_line_item_tax_line` | `IDX_cart_line_item_tax_line_deleted_at` | `CREATE INDEX "IDX_cart_line_item_tax_line_deleted_at" ON public.cart_line_item_tax_line USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `cart_line_item_tax_line` | `IDX_cart_line_item_tax_line_item_id` | `CREATE INDEX "IDX_cart_line_item_tax_line_item_id" ON public.cart_line_item_tax_line USING btree (item_id) WHERE (deleted_at IS NULL)` |
| `cart_line_item_tax_line` | `IDX_line_item_tax_line_tax_rate_id` | `CREATE INDEX "IDX_line_item_tax_line_tax_rate_id" ON public.cart_line_item_tax_line USING btree (tax_rate_id) WHERE ((deleted_at IS NULL) AND (tax_rate_id IS NOT NULL))` |
| `cart_line_item_tax_line` | `cart_line_item_tax_line_pkey` | `CREATE UNIQUE INDEX cart_line_item_tax_line_pkey ON public.cart_line_item_tax_line USING btree (id)` |
| `cart_payment_collection` | `IDX_cart_id_-4a39f6c9` | `CREATE INDEX "IDX_cart_id_-4a39f6c9" ON public.cart_payment_collection USING btree (cart_id) WHERE (deleted_at IS NULL)` |
| `cart_payment_collection` | `IDX_deleted_at_-4a39f6c9` | `CREATE INDEX "IDX_deleted_at_-4a39f6c9" ON public.cart_payment_collection USING btree (deleted_at)` |
| `cart_payment_collection` | `IDX_id_-4a39f6c9` | `CREATE INDEX "IDX_id_-4a39f6c9" ON public.cart_payment_collection USING btree (id)` |
| `cart_payment_collection` | `IDX_payment_collection_id_-4a39f6c9` | `CREATE INDEX "IDX_payment_collection_id_-4a39f6c9" ON public.cart_payment_collection USING btree (payment_collection_id) WHERE (deleted_at IS NULL)` |
| `cart_payment_collection` | `cart_payment_collection_pkey` | `CREATE UNIQUE INDEX cart_payment_collection_pkey ON public.cart_payment_collection USING btree (cart_id, payment_collection_id)` |
| `cart_promotion` | `IDX_cart_id_-a9d4a70b` | `CREATE INDEX "IDX_cart_id_-a9d4a70b" ON public.cart_promotion USING btree (cart_id) WHERE (deleted_at IS NULL)` |
| `cart_promotion` | `IDX_deleted_at_-a9d4a70b` | `CREATE INDEX "IDX_deleted_at_-a9d4a70b" ON public.cart_promotion USING btree (deleted_at)` |
| `cart_promotion` | `IDX_id_-a9d4a70b` | `CREATE INDEX "IDX_id_-a9d4a70b" ON public.cart_promotion USING btree (id)` |
| `cart_promotion` | `IDX_promotion_id_-a9d4a70b` | `CREATE INDEX "IDX_promotion_id_-a9d4a70b" ON public.cart_promotion USING btree (promotion_id) WHERE (deleted_at IS NULL)` |
| `cart_promotion` | `cart_promotion_pkey` | `CREATE UNIQUE INDEX cart_promotion_pkey ON public.cart_promotion USING btree (cart_id, promotion_id)` |
| `cart_shipping_method` | `IDX_cart_shipping_method_cart_id` | `CREATE INDEX "IDX_cart_shipping_method_cart_id" ON public.cart_shipping_method USING btree (cart_id) WHERE (deleted_at IS NULL)` |
| `cart_shipping_method` | `IDX_cart_shipping_method_deleted_at` | `CREATE INDEX "IDX_cart_shipping_method_deleted_at" ON public.cart_shipping_method USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `cart_shipping_method` | `IDX_shipping_method_option_id` | `CREATE INDEX "IDX_shipping_method_option_id" ON public.cart_shipping_method USING btree (shipping_option_id) WHERE ((deleted_at IS NULL) AND (shipping_option_id IS NOT NULL))` |
| `cart_shipping_method` | `cart_shipping_method_pkey` | `CREATE UNIQUE INDEX cart_shipping_method_pkey ON public.cart_shipping_method USING btree (id)` |
| `cart_shipping_method_adjustment` | `IDX_cart_shipping_method_adjustment_deleted_at` | `CREATE INDEX "IDX_cart_shipping_method_adjustment_deleted_at" ON public.cart_shipping_method_adjustment USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `cart_shipping_method_adjustment` | `IDX_cart_shipping_method_adjustment_shipping_method_id` | `CREATE INDEX "IDX_cart_shipping_method_adjustment_shipping_method_id" ON public.cart_shipping_method_adjustment USING btree (shipping_method_id) WHERE (deleted_at IS NULL)` |
| `cart_shipping_method_adjustment` | `IDX_shipping_method_adjustment_promotion_id` | `CREATE INDEX "IDX_shipping_method_adjustment_promotion_id" ON public.cart_shipping_method_adjustment USING btree (promotion_id) WHERE ((deleted_at IS NULL) AND (promotion_id IS NOT NULL))` |
| `cart_shipping_method_adjustment` | `cart_shipping_method_adjustment_pkey` | `CREATE UNIQUE INDEX cart_shipping_method_adjustment_pkey ON public.cart_shipping_method_adjustment USING btree (id)` |
| `cart_shipping_method_tax_line` | `IDX_cart_shipping_method_tax_line_deleted_at` | `CREATE INDEX "IDX_cart_shipping_method_tax_line_deleted_at" ON public.cart_shipping_method_tax_line USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `cart_shipping_method_tax_line` | `IDX_cart_shipping_method_tax_line_shipping_method_id` | `CREATE INDEX "IDX_cart_shipping_method_tax_line_shipping_method_id" ON public.cart_shipping_method_tax_line USING btree (shipping_method_id) WHERE (deleted_at IS NULL)` |
| `cart_shipping_method_tax_line` | `IDX_shipping_method_tax_line_tax_rate_id` | `CREATE INDEX "IDX_shipping_method_tax_line_tax_rate_id" ON public.cart_shipping_method_tax_line USING btree (tax_rate_id) WHERE ((deleted_at IS NULL) AND (tax_rate_id IS NOT NULL))` |
| `cart_shipping_method_tax_line` | `cart_shipping_method_tax_line_pkey` | `CREATE UNIQUE INDEX cart_shipping_method_tax_line_pkey ON public.cart_shipping_method_tax_line USING btree (id)` |
| `chat_message` | `IDX_chat_message_session_id` | `CREATE INDEX "IDX_chat_message_session_id" ON public.chat_message USING btree (session_id) WHERE (deleted_at IS NULL)` |
| `chat_message` | `chat_message_pkey` | `CREATE UNIQUE INDEX chat_message_pkey ON public.chat_message USING btree (id)` |
| `chat_session` | `chat_session_pkey` | `CREATE UNIQUE INDEX chat_session_pkey ON public.chat_session USING btree (id)` |
| `city` | `IDX_city_name` | `CREATE INDEX "IDX_city_name" ON public.city USING btree (name) WHERE (deleted_at IS NULL)` |
| `city` | `city_pkey` | `CREATE UNIQUE INDEX city_pkey ON public.city USING btree (id)` |
| `cms_asset_reference` | `IDX_cms_asset_ref_entity` | `CREATE INDEX "IDX_cms_asset_ref_entity" ON public.cms_asset_reference USING btree (entity_type, entity_id) WHERE (deleted_at IS NULL)` |
| `cms_asset_reference` | `cms_asset_reference_pkey` | `CREATE UNIQUE INDEX cms_asset_reference_pkey ON public.cms_asset_reference USING btree (id)` |
| `cms_banner` | `IDX_cms_banner_active` | `CREATE INDEX "IDX_cms_banner_active" ON public.cms_banner USING btree (is_active, language_code) WHERE (deleted_at IS NULL)` |
| `cms_banner` | `cms_banner_pkey` | `CREATE UNIQUE INDEX cms_banner_pkey ON public.cms_banner USING btree (id)` |
| `cms_block` | `IDX_cms_block_identifier` | `CREATE INDEX "IDX_cms_block_identifier" ON public.cms_block USING btree (identifier, language_code) WHERE (deleted_at IS NULL)` |
| `cms_block` | `cms_block_pkey` | `CREATE UNIQUE INDEX cms_block_pkey ON public.cms_block USING btree (id)` |
| `cms_category` | `IDX_cms_category_slug` | `CREATE UNIQUE INDEX "IDX_cms_category_slug" ON public.cms_category USING btree (slug) WHERE (deleted_at IS NULL)` |
| `cms_category` | `cms_category_pkey` | `CREATE UNIQUE INDEX cms_category_pkey ON public.cms_category USING btree (id)` |
| `cms_homepage_section` | `IDX_cms_homepage_section_active` | `CREATE INDEX "IDX_cms_homepage_section_active" ON public.cms_homepage_section USING btree (is_active, language_code) WHERE (deleted_at IS NULL)` |
| `cms_homepage_section` | `cms_homepage_section_pkey` | `CREATE UNIQUE INDEX cms_homepage_section_pkey ON public.cms_homepage_section USING btree (id)` |
| `cms_navigation` | `IDX_cms_navigation_location` | `CREATE INDEX "IDX_cms_navigation_location" ON public.cms_navigation USING btree (location, is_active, language_code) WHERE (deleted_at IS NULL)` |
| `cms_navigation` | `cms_navigation_pkey` | `CREATE UNIQUE INDEX cms_navigation_pkey ON public.cms_navigation USING btree (id)` |
| `cms_page` | `IDX_cms_page_slug_lang` | `CREATE UNIQUE INDEX "IDX_cms_page_slug_lang" ON public.cms_page USING btree (slug, language_code) WHERE (deleted_at IS NULL)` |
| `cms_page` | `IDX_cms_page_type_status` | `CREATE INDEX "IDX_cms_page_type_status" ON public.cms_page USING btree (type, status) WHERE (deleted_at IS NULL)` |
| `cms_page` | `cms_page_pkey` | `CREATE UNIQUE INDEX cms_page_pkey ON public.cms_page USING btree (id)` |
| `cms_redirect` | `IDX_cms_redirect_from` | `CREATE UNIQUE INDEX "IDX_cms_redirect_from" ON public.cms_redirect USING btree (from_path) WHERE (deleted_at IS NULL)` |
| `cms_redirect` | `cms_redirect_pkey` | `CREATE UNIQUE INDEX cms_redirect_pkey ON public.cms_redirect USING btree (id)` |
| `cms_revision` | `IDX_cms_revision_page` | `CREATE INDEX "IDX_cms_revision_page" ON public.cms_revision USING btree (page_id) WHERE (deleted_at IS NULL)` |
| `cms_revision` | `cms_revision_pkey` | `CREATE UNIQUE INDEX cms_revision_pkey ON public.cms_revision USING btree (id)` |
| `cms_tag` | `IDX_cms_tag_slug` | `CREATE UNIQUE INDEX "IDX_cms_tag_slug" ON public.cms_tag USING btree (slug) WHERE (deleted_at IS NULL)` |
| `cms_tag` | `cms_tag_pkey` | `CREATE UNIQUE INDEX cms_tag_pkey ON public.cms_tag USING btree (id)` |
| `cms_template` | `cms_template_pkey` | `CREATE UNIQUE INDEX cms_template_pkey ON public.cms_template USING btree (id)` |
| `config_audit_log` | `IDX_config_audit_log_deleted_at` | `CREATE INDEX "IDX_config_audit_log_deleted_at" ON public.config_audit_log USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `config_audit_log` | `config_audit_log_pkey` | `CREATE UNIQUE INDEX config_audit_log_pkey ON public.config_audit_log USING btree (id)` |
| `connector_config` | `IDX_connector_config_deleted_at` | `CREATE INDEX "IDX_connector_config_deleted_at" ON public.connector_config USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `connector_config` | `IDX_connector_config_name_unique` | `CREATE UNIQUE INDEX "IDX_connector_config_name_unique" ON public.connector_config USING btree (name) WHERE (deleted_at IS NULL)` |
| `connector_config` | `connector_config_pkey` | `CREATE UNIQUE INDEX connector_config_pkey ON public.connector_config USING btree (id)` |
| `contact_submission` | `contact_submission_pkey` | `CREATE UNIQUE INDEX contact_submission_pkey ON public.contact_submission USING btree (id)` |
| `credit_line` | `IDX_cart_credit_line_reference_reference_id` | `CREATE INDEX "IDX_cart_credit_line_reference_reference_id" ON public.credit_line USING btree (reference, reference_id) WHERE (deleted_at IS NOT NULL)` |
| `credit_line` | `IDX_credit_line_cart_id` | `CREATE INDEX "IDX_credit_line_cart_id" ON public.credit_line USING btree (cart_id) WHERE (deleted_at IS NULL)` |
| `credit_line` | `IDX_credit_line_deleted_at` | `CREATE INDEX "IDX_credit_line_deleted_at" ON public.credit_line USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `credit_line` | `credit_line_pkey` | `CREATE UNIQUE INDEX credit_line_pkey ON public.credit_line USING btree (id)` |
| `crm_ab_test` | `IDX_crm_ab_test_deleted_at` | `CREATE INDEX "IDX_crm_ab_test_deleted_at" ON public.crm_ab_test USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `crm_ab_test` | `IDX_crm_ab_test_target_id` | `CREATE INDEX "IDX_crm_ab_test_target_id" ON public.crm_ab_test USING btree (target_id) WHERE (deleted_at IS NULL)` |
| `crm_ab_test` | `crm_ab_test_pkey` | `CREATE UNIQUE INDEX crm_ab_test_pkey ON public.crm_ab_test USING btree (id)` |
| `crm_automation_execution` | `IDX_crm_automation_execution_customer_id` | `CREATE INDEX "IDX_crm_automation_execution_customer_id" ON public.crm_automation_execution USING btree (customer_id) WHERE (deleted_at IS NULL)` |
| `crm_automation_execution` | `IDX_crm_automation_execution_deleted_at` | `CREATE INDEX "IDX_crm_automation_execution_deleted_at" ON public.crm_automation_execution USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `crm_automation_execution` | `IDX_crm_automation_execution_flow_id` | `CREATE INDEX "IDX_crm_automation_execution_flow_id" ON public.crm_automation_execution USING btree (flow_id) WHERE (deleted_at IS NULL)` |
| `crm_automation_execution` | `IDX_crm_automation_execution_next_execution_at` | `CREATE INDEX "IDX_crm_automation_execution_next_execution_at" ON public.crm_automation_execution USING btree (next_execution_at) WHERE (deleted_at IS NULL)` |
| `crm_automation_execution` | `crm_automation_execution_pkey` | `CREATE UNIQUE INDEX crm_automation_execution_pkey ON public.crm_automation_execution USING btree (id)` |
| `crm_automation_flow` | `IDX_crm_automation_flow_deleted_at` | `CREATE INDEX "IDX_crm_automation_flow_deleted_at" ON public.crm_automation_flow USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `crm_automation_flow` | `crm_automation_flow_pkey` | `CREATE UNIQUE INDEX crm_automation_flow_pkey ON public.crm_automation_flow USING btree (id)` |
| `crm_automation_log` | `IDX_crm_automation_log_deleted_at` | `CREATE INDEX "IDX_crm_automation_log_deleted_at" ON public.crm_automation_log USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `crm_automation_log` | `IDX_crm_automation_log_execution_id` | `CREATE INDEX "IDX_crm_automation_log_execution_id" ON public.crm_automation_log USING btree (execution_id) WHERE (deleted_at IS NULL)` |
| `crm_automation_log` | `crm_automation_log_pkey` | `CREATE UNIQUE INDEX crm_automation_log_pkey ON public.crm_automation_log USING btree (id)` |
| `crm_campaign` | `IDX_crm_campaign_deleted_at` | `CREATE INDEX "IDX_crm_campaign_deleted_at" ON public.crm_campaign USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `crm_campaign` | `crm_campaign_pkey` | `CREATE UNIQUE INDEX crm_campaign_pkey ON public.crm_campaign USING btree (id)` |
| `crm_customer_blacklist` | `IDX_crm_customer_blacklist_customer_id` | `CREATE INDEX "IDX_crm_customer_blacklist_customer_id" ON public.crm_customer_blacklist USING btree (customer_id) WHERE (deleted_at IS NULL)` |
| `crm_customer_blacklist` | `IDX_crm_customer_blacklist_customer_id_unique` | `CREATE UNIQUE INDEX "IDX_crm_customer_blacklist_customer_id_unique" ON public.crm_customer_blacklist USING btree (customer_id) WHERE (deleted_at IS NULL)` |
| `crm_customer_blacklist` | `IDX_crm_customer_blacklist_deleted_at` | `CREATE INDEX "IDX_crm_customer_blacklist_deleted_at" ON public.crm_customer_blacklist USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `crm_customer_blacklist` | `crm_customer_blacklist_pkey` | `CREATE UNIQUE INDEX crm_customer_blacklist_pkey ON public.crm_customer_blacklist USING btree (id)` |
| `crm_customer_note` | `IDX_crm_customer_note_customer_id` | `CREATE INDEX "IDX_crm_customer_note_customer_id" ON public.crm_customer_note USING btree (customer_id) WHERE (deleted_at IS NULL)` |
| `crm_customer_note` | `IDX_crm_customer_note_deleted_at` | `CREATE INDEX "IDX_crm_customer_note_deleted_at" ON public.crm_customer_note USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `crm_customer_note` | `crm_customer_note_pkey` | `CREATE UNIQUE INDEX crm_customer_note_pkey ON public.crm_customer_note USING btree (id)` |
| `crm_customer_rfm` | `IDX_crm_customer_rfm_customer_id` | `CREATE INDEX "IDX_crm_customer_rfm_customer_id" ON public.crm_customer_rfm USING btree (customer_id) WHERE (deleted_at IS NULL)` |
| `crm_customer_rfm` | `IDX_crm_customer_rfm_customer_id_unique` | `CREATE UNIQUE INDEX "IDX_crm_customer_rfm_customer_id_unique" ON public.crm_customer_rfm USING btree (customer_id) WHERE (deleted_at IS NULL)` |
| `crm_customer_rfm` | `IDX_crm_customer_rfm_deleted_at` | `CREATE INDEX "IDX_crm_customer_rfm_deleted_at" ON public.crm_customer_rfm USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `crm_customer_rfm` | `crm_customer_rfm_pkey` | `CREATE UNIQUE INDEX crm_customer_rfm_pkey ON public.crm_customer_rfm USING btree (id)` |
| `crm_customer_segment` | `IDX_crm_customer_segment_customer_id` | `CREATE INDEX "IDX_crm_customer_segment_customer_id" ON public.crm_customer_segment USING btree (customer_id) WHERE (deleted_at IS NULL)` |
| `crm_customer_segment` | `IDX_crm_customer_segment_deleted_at` | `CREATE INDEX "IDX_crm_customer_segment_deleted_at" ON public.crm_customer_segment USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `crm_customer_segment` | `IDX_crm_customer_segment_segment_id` | `CREATE INDEX "IDX_crm_customer_segment_segment_id" ON public.crm_customer_segment USING btree (segment_id) WHERE (deleted_at IS NULL)` |
| `crm_customer_segment` | `crm_customer_segment_pkey` | `CREATE UNIQUE INDEX crm_customer_segment_pkey ON public.crm_customer_segment USING btree (id)` |
| `crm_email_template` | `IDX_crm_email_template_deleted_at` | `CREATE INDEX "IDX_crm_email_template_deleted_at" ON public.crm_email_template USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `crm_email_template` | `IDX_crm_email_template_name_unique` | `CREATE UNIQUE INDEX "IDX_crm_email_template_name_unique" ON public.crm_email_template USING btree (name) WHERE (deleted_at IS NULL)` |
| `crm_email_template` | `crm_email_template_pkey` | `CREATE UNIQUE INDEX crm_email_template_pkey ON public.crm_email_template USING btree (id)` |
| `crm_segment` | `IDX_crm_segment_deleted_at` | `CREATE INDEX "IDX_crm_segment_deleted_at" ON public.crm_segment USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `crm_segment` | `IDX_crm_segment_name_unique` | `CREATE UNIQUE INDEX "IDX_crm_segment_name_unique" ON public.crm_segment USING btree (name) WHERE (deleted_at IS NULL)` |
| `crm_segment` | `crm_segment_pkey` | `CREATE UNIQUE INDEX crm_segment_pkey ON public.crm_segment USING btree (id)` |
| `currency` | `currency_pkey` | `CREATE UNIQUE INDEX currency_pkey ON public.currency USING btree (code)` |
| `cust_address` | `IDX_cust_address_customer_id` | `CREATE INDEX "IDX_cust_address_customer_id" ON public.cust_address USING btree (customer_id) WHERE (deleted_at IS NULL)` |
| `cust_address` | `cust_address_pkey` | `CREATE UNIQUE INDEX cust_address_pkey ON public.cust_address USING btree (id)` |
| `customer` | `IDX_customer_deleted_at` | `CREATE INDEX "IDX_customer_deleted_at" ON public.customer USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `customer` | `IDX_customer_email_has_account_unique` | `CREATE UNIQUE INDEX "IDX_customer_email_has_account_unique" ON public.customer USING btree (email, has_account) WHERE (deleted_at IS NULL)` |
| `customer` | `customer_pkey` | `CREATE UNIQUE INDEX customer_pkey ON public.customer USING btree (id)` |
| `customer_account_holder` | `IDX_account_holder_id_5cb3a0c0` | `CREATE INDEX "IDX_account_holder_id_5cb3a0c0" ON public.customer_account_holder USING btree (account_holder_id) WHERE (deleted_at IS NULL)` |
| `customer_account_holder` | `IDX_customer_id_5cb3a0c0` | `CREATE INDEX "IDX_customer_id_5cb3a0c0" ON public.customer_account_holder USING btree (customer_id) WHERE (deleted_at IS NULL)` |
| `customer_account_holder` | `IDX_deleted_at_5cb3a0c0` | `CREATE INDEX "IDX_deleted_at_5cb3a0c0" ON public.customer_account_holder USING btree (deleted_at)` |
| `customer_account_holder` | `IDX_id_5cb3a0c0` | `CREATE INDEX "IDX_id_5cb3a0c0" ON public.customer_account_holder USING btree (id)` |
| `customer_account_holder` | `customer_account_holder_pkey` | `CREATE UNIQUE INDEX customer_account_holder_pkey ON public.customer_account_holder USING btree (customer_id, account_holder_id)` |
| `customer_address` | `IDX_customer_address_customer_id` | `CREATE INDEX "IDX_customer_address_customer_id" ON public.customer_address USING btree (customer_id)` |
| `customer_address` | `IDX_customer_address_deleted_at` | `CREATE INDEX "IDX_customer_address_deleted_at" ON public.customer_address USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `customer_address` | `IDX_customer_address_unique_customer_billing` | `CREATE UNIQUE INDEX "IDX_customer_address_unique_customer_billing" ON public.customer_address USING btree (customer_id) WHERE (is_default_billing = true)` |
| `customer_address` | `IDX_customer_address_unique_customer_shipping` | `CREATE UNIQUE INDEX "IDX_customer_address_unique_customer_shipping" ON public.customer_address USING btree (customer_id) WHERE (is_default_shipping = true)` |
| `customer_address` | `customer_address_pkey` | `CREATE UNIQUE INDEX customer_address_pkey ON public.customer_address USING btree (id)` |
| `customer_favorite` | `customer_favorite_pkey` | `CREATE UNIQUE INDEX customer_favorite_pkey ON public.customer_favorite USING btree (id)` |
| `customer_group` | `IDX_customer_group_deleted_at` | `CREATE INDEX "IDX_customer_group_deleted_at" ON public.customer_group USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `customer_group` | `IDX_customer_group_name_unique` | `CREATE UNIQUE INDEX "IDX_customer_group_name_unique" ON public.customer_group USING btree (name) WHERE (deleted_at IS NULL)` |
| `customer_group` | `customer_group_pkey` | `CREATE UNIQUE INDEX customer_group_pkey ON public.customer_group USING btree (id)` |
| `customer_group_customer` | `IDX_customer_group_customer_customer_group_id` | `CREATE INDEX "IDX_customer_group_customer_customer_group_id" ON public.customer_group_customer USING btree (customer_group_id) WHERE (deleted_at IS NULL)` |
| `customer_group_customer` | `IDX_customer_group_customer_customer_id` | `CREATE INDEX "IDX_customer_group_customer_customer_id" ON public.customer_group_customer USING btree (customer_id)` |
| `customer_group_customer` | `IDX_customer_group_customer_deleted_at` | `CREATE INDEX "IDX_customer_group_customer_deleted_at" ON public.customer_group_customer USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `customer_group_customer` | `customer_group_customer_pkey` | `CREATE UNIQUE INDEX customer_group_customer_pkey ON public.customer_group_customer USING btree (id)` |
| `customer_phone` | `IDX_customer_phone_phone` | `CREATE UNIQUE INDEX "IDX_customer_phone_phone" ON public.customer_phone USING btree (phone) WHERE (deleted_at IS NULL)` |
| `customer_phone` | `customer_phone_pkey` | `CREATE UNIQUE INDEX customer_phone_pkey ON public.customer_phone USING btree (id)` |
| `delivery` | `delivery_pkey` | `CREATE UNIQUE INDEX delivery_pkey ON public.delivery USING btree (id)` |
| `delivery_delivery_partner` | `IDX_delivery_delivery_partner_deleted_at` | `CREATE INDEX "IDX_delivery_delivery_partner_deleted_at" ON public.delivery_delivery_partner USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `delivery_delivery_partner` | `IDX_delivery_delivery_partner_delivery_id` | `CREATE INDEX "IDX_delivery_delivery_partner_delivery_id" ON public.delivery_delivery_partner USING btree (delivery_id) WHERE (deleted_at IS NULL)` |
| `delivery_delivery_partner` | `IDX_delivery_delivery_partner_delivery_partner_id` | `CREATE INDEX "IDX_delivery_delivery_partner_delivery_partner_id" ON public.delivery_delivery_partner USING btree (delivery_partner_id) WHERE (deleted_at IS NULL)` |
| `delivery_delivery_partner` | `delivery_delivery_partner_pkey` | `CREATE UNIQUE INDEX delivery_delivery_partner_pkey ON public.delivery_delivery_partner USING btree (id)` |
| `delivery_partner` | `delivery_partner_pkey` | `CREATE UNIQUE INDEX delivery_partner_pkey ON public.delivery_partner USING btree (id)` |
| `delivery_proof` | `IDX_delivery_proof_delivery_id` | `CREATE INDEX "IDX_delivery_proof_delivery_id" ON public.delivery_proof USING btree (delivery_id) WHERE (deleted_at IS NULL)` |
| `delivery_proof` | `IDX_delivery_proof_order_id` | `CREATE INDEX "IDX_delivery_proof_order_id" ON public.delivery_proof USING btree (order_id) WHERE (deleted_at IS NULL)` |
| `delivery_proof` | `delivery_proof_pkey` | `CREATE UNIQUE INDEX delivery_proof_pkey ON public.delivery_proof USING btree (id)` |
| `delivery_slot` | `IDX_delivery_slot_branch_id` | `CREATE INDEX "IDX_delivery_slot_branch_id" ON public.delivery_slot USING btree (branch_id) WHERE (deleted_at IS NULL)` |
| `delivery_slot` | `delivery_slot_pkey` | `CREATE UNIQUE INDEX delivery_slot_pkey ON public.delivery_slot USING btree (id)` |
| `delivery_zone` | `IDX_delivery_zone_pincode` | `CREATE INDEX "IDX_delivery_zone_pincode" ON public.delivery_zone USING btree (pincode) WHERE (deleted_at IS NULL)` |
| `delivery_zone` | `delivery_zone_pkey` | `CREATE UNIQUE INDEX delivery_zone_pkey ON public.delivery_zone USING btree (id)` |
| `deliverymodule_delivery_cart_cart` | `IDX_cart_id_24131bea4` | `CREATE INDEX "IDX_cart_id_24131bea4" ON public.deliverymodule_delivery_cart_cart USING btree (cart_id) WHERE (deleted_at IS NULL)` |
| `deliverymodule_delivery_cart_cart` | `IDX_deleted_at_24131bea4` | `CREATE INDEX "IDX_deleted_at_24131bea4" ON public.deliverymodule_delivery_cart_cart USING btree (deleted_at)` |
| `deliverymodule_delivery_cart_cart` | `IDX_delivery_id_24131bea4` | `CREATE INDEX "IDX_delivery_id_24131bea4" ON public.deliverymodule_delivery_cart_cart USING btree (delivery_id) WHERE (deleted_at IS NULL)` |
| `deliverymodule_delivery_cart_cart` | `IDX_id_24131bea4` | `CREATE INDEX "IDX_id_24131bea4" ON public.deliverymodule_delivery_cart_cart USING btree (id)` |
| `deliverymodule_delivery_cart_cart` | `deliverymodule_delivery_cart_cart_pkey` | `CREATE UNIQUE INDEX deliverymodule_delivery_cart_cart_pkey ON public.deliverymodule_delivery_cart_cart USING btree (delivery_id, cart_id)` |
| `deliverymodule_delivery_order_order` | `IDX_deleted_at_3513972e8` | `CREATE INDEX "IDX_deleted_at_3513972e8" ON public.deliverymodule_delivery_order_order USING btree (deleted_at)` |
| `deliverymodule_delivery_order_order` | `IDX_delivery_id_3513972e8` | `CREATE INDEX "IDX_delivery_id_3513972e8" ON public.deliverymodule_delivery_order_order USING btree (delivery_id) WHERE (deleted_at IS NULL)` |
| `deliverymodule_delivery_order_order` | `IDX_id_3513972e8` | `CREATE INDEX "IDX_id_3513972e8" ON public.deliverymodule_delivery_order_order USING btree (id)` |
| `deliverymodule_delivery_order_order` | `IDX_order_id_3513972e8` | `CREATE INDEX "IDX_order_id_3513972e8" ON public.deliverymodule_delivery_order_order USING btree (order_id) WHERE (deleted_at IS NULL)` |
| `deliverymodule_delivery_order_order` | `deliverymodule_delivery_order_order_pkey` | `CREATE UNIQUE INDEX deliverymodule_delivery_order_order_pkey ON public.deliverymodule_delivery_order_order USING btree (delivery_id, order_id)` |
| `driver_attendance` | `driver_attendance_pkey` | `CREATE UNIQUE INDEX driver_attendance_pkey ON public.driver_attendance USING btree (id)` |
| `driver_location` | `IDX_driver_location_partner_id` | `CREATE INDEX "IDX_driver_location_partner_id" ON public.driver_location USING btree (partner_id) WHERE (deleted_at IS NULL)` |
| `driver_location` | `driver_location_pkey` | `CREATE UNIQUE INDEX driver_location_pkey ON public.driver_location USING btree (id)` |
| `driver_profile` | `IDX_driver_profile_partner_id` | `CREATE INDEX "IDX_driver_profile_partner_id" ON public.driver_profile USING btree (partner_id) WHERE (deleted_at IS NULL)` |
| `driver_profile` | `driver_profile_pkey` | `CREATE UNIQUE INDEX driver_profile_pkey ON public.driver_profile USING btree (id)` |
| `driver_transaction` | `IDX_driver_transaction_wallet_id` | `CREATE INDEX "IDX_driver_transaction_wallet_id" ON public.driver_transaction USING btree (wallet_id) WHERE (deleted_at IS NULL)` |
| `driver_transaction` | `driver_transaction_pkey` | `CREATE UNIQUE INDEX driver_transaction_pkey ON public.driver_transaction USING btree (id)` |
| `driver_wallet` | `UQ_driver_wallet_partner_id` | `CREATE UNIQUE INDEX "UQ_driver_wallet_partner_id" ON public.driver_wallet USING btree (partner_id) WHERE (deleted_at IS NULL)` |
| `driver_wallet` | `driver_wallet_pkey` | `CREATE UNIQUE INDEX driver_wallet_pkey ON public.driver_wallet USING btree (id)` |
| `fulfillment` | `IDX_fulfillment_deleted_at` | `CREATE INDEX "IDX_fulfillment_deleted_at" ON public.fulfillment USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `fulfillment` | `IDX_fulfillment_location_id` | `CREATE INDEX "IDX_fulfillment_location_id" ON public.fulfillment USING btree (location_id) WHERE (deleted_at IS NULL)` |
| `fulfillment` | `IDX_fulfillment_shipping_option_id` | `CREATE INDEX "IDX_fulfillment_shipping_option_id" ON public.fulfillment USING btree (shipping_option_id) WHERE (deleted_at IS NULL)` |
| `fulfillment` | `fulfillment_pkey` | `CREATE UNIQUE INDEX fulfillment_pkey ON public.fulfillment USING btree (id)` |
| `fulfillment_address` | `IDX_fulfillment_address_deleted_at` | `CREATE INDEX "IDX_fulfillment_address_deleted_at" ON public.fulfillment_address USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `fulfillment_address` | `fulfillment_address_pkey` | `CREATE UNIQUE INDEX fulfillment_address_pkey ON public.fulfillment_address USING btree (id)` |
| `fulfillment_item` | `IDX_fulfillment_item_deleted_at` | `CREATE INDEX "IDX_fulfillment_item_deleted_at" ON public.fulfillment_item USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `fulfillment_item` | `IDX_fulfillment_item_fulfillment_id` | `CREATE INDEX "IDX_fulfillment_item_fulfillment_id" ON public.fulfillment_item USING btree (fulfillment_id) WHERE (deleted_at IS NULL)` |
| `fulfillment_item` | `IDX_fulfillment_item_inventory_item_id` | `CREATE INDEX "IDX_fulfillment_item_inventory_item_id" ON public.fulfillment_item USING btree (inventory_item_id) WHERE (deleted_at IS NULL)` |
| `fulfillment_item` | `IDX_fulfillment_item_line_item_id` | `CREATE INDEX "IDX_fulfillment_item_line_item_id" ON public.fulfillment_item USING btree (line_item_id) WHERE (deleted_at IS NULL)` |
| `fulfillment_item` | `fulfillment_item_pkey` | `CREATE UNIQUE INDEX fulfillment_item_pkey ON public.fulfillment_item USING btree (id)` |
| `fulfillment_label` | `IDX_fulfillment_label_deleted_at` | `CREATE INDEX "IDX_fulfillment_label_deleted_at" ON public.fulfillment_label USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `fulfillment_label` | `IDX_fulfillment_label_fulfillment_id` | `CREATE INDEX "IDX_fulfillment_label_fulfillment_id" ON public.fulfillment_label USING btree (fulfillment_id) WHERE (deleted_at IS NULL)` |
| `fulfillment_label` | `fulfillment_label_pkey` | `CREATE UNIQUE INDEX fulfillment_label_pkey ON public.fulfillment_label USING btree (id)` |
| `fulfillment_provider` | `IDX_fulfillment_provider_deleted_at` | `CREATE INDEX "IDX_fulfillment_provider_deleted_at" ON public.fulfillment_provider USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `fulfillment_provider` | `fulfillment_provider_pkey` | `CREATE UNIQUE INDEX fulfillment_provider_pkey ON public.fulfillment_provider USING btree (id)` |
| `fulfillment_set` | `IDX_fulfillment_set_deleted_at` | `CREATE INDEX "IDX_fulfillment_set_deleted_at" ON public.fulfillment_set USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `fulfillment_set` | `IDX_fulfillment_set_name_unique` | `CREATE UNIQUE INDEX "IDX_fulfillment_set_name_unique" ON public.fulfillment_set USING btree (name) WHERE (deleted_at IS NULL)` |
| `fulfillment_set` | `fulfillment_set_pkey` | `CREATE UNIQUE INDEX fulfillment_set_pkey ON public.fulfillment_set USING btree (id)` |
| `geo_zone` | `IDX_geo_zone_city` | `CREATE INDEX "IDX_geo_zone_city" ON public.geo_zone USING btree (city) WHERE ((deleted_at IS NULL) AND (city IS NOT NULL))` |
| `geo_zone` | `IDX_geo_zone_country_code` | `CREATE INDEX "IDX_geo_zone_country_code" ON public.geo_zone USING btree (country_code) WHERE (deleted_at IS NULL)` |
| `geo_zone` | `IDX_geo_zone_deleted_at` | `CREATE INDEX "IDX_geo_zone_deleted_at" ON public.geo_zone USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `geo_zone` | `IDX_geo_zone_province_code` | `CREATE INDEX "IDX_geo_zone_province_code" ON public.geo_zone USING btree (province_code) WHERE ((deleted_at IS NULL) AND (province_code IS NOT NULL))` |
| `geo_zone` | `IDX_geo_zone_service_zone_id` | `CREATE INDEX "IDX_geo_zone_service_zone_id" ON public.geo_zone USING btree (service_zone_id) WHERE (deleted_at IS NULL)` |
| `geo_zone` | `geo_zone_pkey` | `CREATE UNIQUE INDEX geo_zone_pkey ON public.geo_zone USING btree (id)` |
| `image` | `IDX_image_deleted_at` | `CREATE INDEX "IDX_image_deleted_at" ON public.image USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `image` | `IDX_image_product_id` | `CREATE INDEX "IDX_image_product_id" ON public.image USING btree (product_id) WHERE (deleted_at IS NULL)` |
| `image` | `IDX_product_image_rank` | `CREATE INDEX "IDX_product_image_rank" ON public.image USING btree (rank) WHERE (deleted_at IS NULL)` |
| `image` | `IDX_product_image_rank_product_id` | `CREATE INDEX "IDX_product_image_rank_product_id" ON public.image USING btree (rank, product_id) WHERE (deleted_at IS NULL)` |
| `image` | `IDX_product_image_url` | `CREATE INDEX "IDX_product_image_url" ON public.image USING btree (url) WHERE (deleted_at IS NULL)` |
| `image` | `IDX_product_image_url_rank_product_id` | `CREATE INDEX "IDX_product_image_url_rank_product_id" ON public.image USING btree (url, rank, product_id) WHERE (deleted_at IS NULL)` |
| `image` | `image_pkey` | `CREATE UNIQUE INDEX image_pkey ON public.image USING btree (id)` |
| `inventory_item` | `IDX_inventory_item_deleted_at` | `CREATE INDEX "IDX_inventory_item_deleted_at" ON public.inventory_item USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `inventory_item` | `IDX_inventory_item_sku` | `CREATE UNIQUE INDEX "IDX_inventory_item_sku" ON public.inventory_item USING btree (sku) WHERE (deleted_at IS NULL)` |
| `inventory_item` | `inventory_item_pkey` | `CREATE UNIQUE INDEX inventory_item_pkey ON public.inventory_item USING btree (id)` |
| `inventory_level` | `IDX_inventory_level_deleted_at` | `CREATE INDEX "IDX_inventory_level_deleted_at" ON public.inventory_level USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `inventory_level` | `IDX_inventory_level_inventory_item_id` | `CREATE INDEX "IDX_inventory_level_inventory_item_id" ON public.inventory_level USING btree (inventory_item_id) WHERE (deleted_at IS NULL)` |
| `inventory_level` | `IDX_inventory_level_location_id` | `CREATE INDEX "IDX_inventory_level_location_id" ON public.inventory_level USING btree (location_id) WHERE (deleted_at IS NULL)` |
| `inventory_level` | `IDX_inventory_level_location_id_inventory_item_id` | `CREATE UNIQUE INDEX "IDX_inventory_level_location_id_inventory_item_id" ON public.inventory_level USING btree (inventory_item_id, location_id) WHERE (deleted_at IS NULL)` |
| `inventory_level` | `inventory_level_pkey` | `CREATE UNIQUE INDEX inventory_level_pkey ON public.inventory_level USING btree (id)` |
| `inventory_transfer` | `IDX_inventory_transfer_from_branch` | `CREATE INDEX "IDX_inventory_transfer_from_branch" ON public.inventory_transfer USING btree (from_branch_id) WHERE (deleted_at IS NULL)` |
| `inventory_transfer` | `IDX_inventory_transfer_to_branch` | `CREATE INDEX "IDX_inventory_transfer_to_branch" ON public.inventory_transfer USING btree (to_branch_id) WHERE (deleted_at IS NULL)` |
| `inventory_transfer` | `inventory_transfer_pkey` | `CREATE UNIQUE INDEX inventory_transfer_pkey ON public.inventory_transfer USING btree (id)` |
| `invite` | `IDX_invite_deleted_at` | `CREATE INDEX "IDX_invite_deleted_at" ON public.invite USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `invite` | `IDX_invite_email_unique` | `CREATE UNIQUE INDEX "IDX_invite_email_unique" ON public.invite USING btree (email) WHERE (deleted_at IS NULL)` |
| `invite` | `IDX_invite_token` | `CREATE INDEX "IDX_invite_token" ON public.invite USING btree (token) WHERE (deleted_at IS NULL)` |
| `invite` | `invite_pkey` | `CREATE UNIQUE INDEX invite_pkey ON public.invite USING btree (id)` |
| `invite_rbac_role` | `IDX_deleted_at_-85069d44` | `CREATE INDEX "IDX_deleted_at_-85069d44" ON public.invite_rbac_role USING btree (deleted_at)` |
| `invite_rbac_role` | `IDX_id_-85069d44` | `CREATE INDEX "IDX_id_-85069d44" ON public.invite_rbac_role USING btree (id)` |
| `invite_rbac_role` | `IDX_invite_id_-85069d44` | `CREATE INDEX "IDX_invite_id_-85069d44" ON public.invite_rbac_role USING btree (invite_id) WHERE (deleted_at IS NULL)` |
| `invite_rbac_role` | `IDX_rbac_role_id_-85069d44` | `CREATE INDEX "IDX_rbac_role_id_-85069d44" ON public.invite_rbac_role USING btree (rbac_role_id) WHERE (deleted_at IS NULL)` |
| `invite_rbac_role` | `invite_rbac_role_pkey` | `CREATE UNIQUE INDEX invite_rbac_role_pkey ON public.invite_rbac_role USING btree (invite_id, rbac_role_id)` |
| `language` | `IDX_language_code` | `CREATE UNIQUE INDEX "IDX_language_code" ON public.language USING btree (code) WHERE (deleted_at IS NULL)` |
| `language` | `language_pkey` | `CREATE UNIQUE INDEX language_pkey ON public.language USING btree (id)` |
| `layout_configuration` | `IDX_layout_configuration_deleted_at` | `CREATE INDEX "IDX_layout_configuration_deleted_at" ON public.layout_configuration USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `layout_configuration` | `IDX_layout_configuration_zone_unique` | `CREATE UNIQUE INDEX "IDX_layout_configuration_zone_unique" ON public.layout_configuration USING btree (zone) WHERE ((is_system_default = true) AND (deleted_at IS NULL))` |
| `layout_configuration` | `IDX_layout_configuration_zone_user_id_unique` | `CREATE UNIQUE INDEX "IDX_layout_configuration_zone_user_id_unique" ON public.layout_configuration USING btree (zone, user_id) WHERE (deleted_at IS NULL)` |
| `layout_configuration` | `layout_configuration_pkey` | `CREATE UNIQUE INDEX layout_configuration_pkey ON public.layout_configuration USING btree (id)` |
| `lead_enquiry` | `lead_enquiry_pkey` | `CREATE UNIQUE INDEX lead_enquiry_pkey ON public.lead_enquiry USING btree (id)` |
| `link_module_migrations` | `link_module_migrations_pkey` | `CREATE UNIQUE INDEX link_module_migrations_pkey ON public.link_module_migrations USING btree (id)` |
| `link_module_migrations` | `link_module_migrations_table_name_key` | `CREATE UNIQUE INDEX link_module_migrations_table_name_key ON public.link_module_migrations USING btree (table_name)` |
| `loc_currency` | `IDX_loc_currency_code` | `CREATE UNIQUE INDEX "IDX_loc_currency_code" ON public.loc_currency USING btree (code) WHERE (deleted_at IS NULL)` |
| `loc_currency` | `loc_currency_pkey` | `CREATE UNIQUE INDEX loc_currency_pkey ON public.loc_currency USING btree (id)` |
| `location_fulfillment_provider` | `IDX_deleted_at_-1e5992737` | `CREATE INDEX "IDX_deleted_at_-1e5992737" ON public.location_fulfillment_provider USING btree (deleted_at)` |
| `location_fulfillment_provider` | `IDX_fulfillment_provider_id_-1e5992737` | `CREATE INDEX "IDX_fulfillment_provider_id_-1e5992737" ON public.location_fulfillment_provider USING btree (fulfillment_provider_id) WHERE (deleted_at IS NULL)` |
| `location_fulfillment_provider` | `IDX_id_-1e5992737` | `CREATE INDEX "IDX_id_-1e5992737" ON public.location_fulfillment_provider USING btree (id)` |
| `location_fulfillment_provider` | `IDX_stock_location_id_-1e5992737` | `CREATE INDEX "IDX_stock_location_id_-1e5992737" ON public.location_fulfillment_provider USING btree (stock_location_id) WHERE (deleted_at IS NULL)` |
| `location_fulfillment_provider` | `location_fulfillment_provider_pkey` | `CREATE UNIQUE INDEX location_fulfillment_provider_pkey ON public.location_fulfillment_provider USING btree (stock_location_id, fulfillment_provider_id)` |
| `location_fulfillment_set` | `IDX_deleted_at_-e88adb96` | `CREATE INDEX "IDX_deleted_at_-e88adb96" ON public.location_fulfillment_set USING btree (deleted_at)` |
| `location_fulfillment_set` | `IDX_fulfillment_set_id_-e88adb96` | `CREATE INDEX "IDX_fulfillment_set_id_-e88adb96" ON public.location_fulfillment_set USING btree (fulfillment_set_id) WHERE (deleted_at IS NULL)` |
| `location_fulfillment_set` | `IDX_id_-e88adb96` | `CREATE INDEX "IDX_id_-e88adb96" ON public.location_fulfillment_set USING btree (id)` |
| `location_fulfillment_set` | `IDX_stock_location_id_-e88adb96` | `CREATE INDEX "IDX_stock_location_id_-e88adb96" ON public.location_fulfillment_set USING btree (stock_location_id) WHERE (deleted_at IS NULL)` |
| `location_fulfillment_set` | `location_fulfillment_set_pkey` | `CREATE UNIQUE INDEX location_fulfillment_set_pkey ON public.location_fulfillment_set USING btree (stock_location_id, fulfillment_set_id)` |
| `login_event` | `IDX_login_event_customer_id` | `CREATE INDEX "IDX_login_event_customer_id" ON public.login_event USING btree (customer_id) WHERE (deleted_at IS NULL)` |
| `login_event` | `login_event_pkey` | `CREATE UNIQUE INDEX login_event_pkey ON public.login_event USING btree (id)` |
| `marketing_campaign` | `IDX_marketing_campaign_ends_at` | `CREATE INDEX "IDX_marketing_campaign_ends_at" ON public.marketing_campaign USING btree (ends_at) WHERE (deleted_at IS NULL)` |
| `marketing_campaign` | `IDX_marketing_campaign_is_featured` | `CREATE INDEX "IDX_marketing_campaign_is_featured" ON public.marketing_campaign USING btree (is_featured) WHERE (deleted_at IS NULL)` |
| `marketing_campaign` | `IDX_marketing_campaign_starts_at` | `CREATE INDEX "IDX_marketing_campaign_starts_at" ON public.marketing_campaign USING btree (starts_at) WHERE (deleted_at IS NULL)` |
| `marketing_campaign` | `IDX_marketing_campaign_status` | `CREATE INDEX "IDX_marketing_campaign_status" ON public.marketing_campaign USING btree (status) WHERE (deleted_at IS NULL)` |
| `marketing_campaign` | `IDX_marketing_campaign_type` | `CREATE INDEX "IDX_marketing_campaign_type" ON public.marketing_campaign USING btree (type) WHERE (deleted_at IS NULL)` |
| `marketing_campaign` | `marketing_campaign_pkey` | `CREATE UNIQUE INDEX marketing_campaign_pkey ON public.marketing_campaign USING btree (id)` |
| `marketing_campaign_event` | `IDX_marketing_campaign_event_campaign_id` | `CREATE INDEX "IDX_marketing_campaign_event_campaign_id" ON public.marketing_campaign_event USING btree (campaign_id) WHERE (deleted_at IS NULL)` |
| `marketing_campaign_event` | `IDX_marketing_campaign_event_created_at` | `CREATE INDEX "IDX_marketing_campaign_event_created_at" ON public.marketing_campaign_event USING btree (created_at) WHERE (deleted_at IS NULL)` |
| `marketing_campaign_event` | `IDX_marketing_campaign_event_event_type` | `CREATE INDEX "IDX_marketing_campaign_event_event_type" ON public.marketing_campaign_event USING btree (event_type) WHERE (deleted_at IS NULL)` |
| `marketing_campaign_event` | `marketing_campaign_event_pkey` | `CREATE UNIQUE INDEX marketing_campaign_event_pkey ON public.marketing_campaign_event USING btree (id)` |
| `marketing_campaign_metric` | `IDX_marketing_campaign_metric_campaign_id` | `CREATE INDEX "IDX_marketing_campaign_metric_campaign_id" ON public.marketing_campaign_metric USING btree (campaign_id) WHERE (deleted_at IS NULL)` |
| `marketing_campaign_metric` | `IDX_marketing_campaign_metric_metric` | `CREATE INDEX "IDX_marketing_campaign_metric_metric" ON public.marketing_campaign_metric USING btree (metric) WHERE (deleted_at IS NULL)` |
| `marketing_campaign_metric` | `IDX_marketing_campaign_metric_period` | `CREATE INDEX "IDX_marketing_campaign_metric_period" ON public.marketing_campaign_metric USING btree (period) WHERE (deleted_at IS NULL)` |
| `marketing_campaign_metric` | `UQ_marketing_campaign_metric_rollup` | `CREATE UNIQUE INDEX "UQ_marketing_campaign_metric_rollup" ON public.marketing_campaign_metric USING btree (campaign_id, metric, period, granularity) WHERE (deleted_at IS NULL)` |
| `marketing_campaign_metric` | `marketing_campaign_metric_pkey` | `CREATE UNIQUE INDEX marketing_campaign_metric_pkey ON public.marketing_campaign_metric USING btree (id)` |
| `marketing_gamification_reward` | `IDX_marketing_gamification_customer_id` | `CREATE INDEX "IDX_marketing_gamification_customer_id" ON public.marketing_gamification_reward USING btree (customer_id) WHERE (deleted_at IS NULL)` |
| `marketing_gamification_reward` | `IDX_marketing_gamification_offer_id` | `CREATE INDEX "IDX_marketing_gamification_offer_id" ON public.marketing_gamification_reward USING btree (offer_id) WHERE (deleted_at IS NULL)` |
| `marketing_gamification_reward` | `IDX_marketing_gamification_session_id` | `CREATE INDEX "IDX_marketing_gamification_session_id" ON public.marketing_gamification_reward USING btree (session_id) WHERE (deleted_at IS NULL)` |
| `marketing_gamification_reward` | `IDX_marketing_gamification_widget_type` | `CREATE INDEX "IDX_marketing_gamification_widget_type" ON public.marketing_gamification_reward USING btree (widget_type) WHERE (deleted_at IS NULL)` |
| `marketing_gamification_reward` | `marketing_gamification_reward_pkey` | `CREATE UNIQUE INDEX marketing_gamification_reward_pkey ON public.marketing_gamification_reward USING btree (id)` |
| `marketing_newsletter_subscriber` | `IDX_marketing_newsletter_subscriber_customer_id` | `CREATE INDEX "IDX_marketing_newsletter_subscriber_customer_id" ON public.marketing_newsletter_subscriber USING btree (customer_id) WHERE (deleted_at IS NULL)` |
| `marketing_newsletter_subscriber` | `IDX_marketing_newsletter_subscriber_status` | `CREATE INDEX "IDX_marketing_newsletter_subscriber_status" ON public.marketing_newsletter_subscriber USING btree (status) WHERE (deleted_at IS NULL)` |
| `marketing_newsletter_subscriber` | `UQ_marketing_newsletter_subscriber_email` | `CREATE UNIQUE INDEX "UQ_marketing_newsletter_subscriber_email" ON public.marketing_newsletter_subscriber USING btree (email) WHERE (deleted_at IS NULL)` |
| `marketing_newsletter_subscriber` | `marketing_newsletter_subscriber_pkey` | `CREATE UNIQUE INDEX marketing_newsletter_subscriber_pkey ON public.marketing_newsletter_subscriber USING btree (id)` |
| `marketing_popup` | `IDX_marketing_popup_status` | `CREATE INDEX "IDX_marketing_popup_status" ON public.marketing_popup USING btree (status) WHERE (deleted_at IS NULL)` |
| `marketing_popup` | `IDX_marketing_popup_trigger` | `CREATE INDEX "IDX_marketing_popup_trigger" ON public.marketing_popup USING btree (trigger) WHERE (deleted_at IS NULL)` |
| `marketing_popup` | `marketing_popup_pkey` | `CREATE UNIQUE INDEX marketing_popup_pkey ON public.marketing_popup USING btree (id)` |
| `marketing_qr_code` | `IDX_marketing_qr_code_campaign_id` | `CREATE INDEX "IDX_marketing_qr_code_campaign_id" ON public.marketing_qr_code USING btree (campaign_id) WHERE (deleted_at IS NULL)` |
| `marketing_qr_code` | `IDX_marketing_qr_code_status` | `CREATE INDEX "IDX_marketing_qr_code_status" ON public.marketing_qr_code USING btree (status) WHERE (deleted_at IS NULL)` |
| `marketing_qr_code` | `UQ_marketing_qr_code_code` | `CREATE UNIQUE INDEX "UQ_marketing_qr_code_code" ON public.marketing_qr_code USING btree (code) WHERE (deleted_at IS NULL)` |
| `marketing_qr_code` | `marketing_qr_code_pkey` | `CREATE UNIQUE INDEX marketing_qr_code_pkey ON public.marketing_qr_code USING btree (id)` |
| `marketing_recovery_job` | `IDX_marketing_recovery_job_cart_id` | `CREATE INDEX "IDX_marketing_recovery_job_cart_id" ON public.marketing_recovery_job USING btree (cart_id) WHERE (deleted_at IS NULL)` |
| `marketing_recovery_job` | `IDX_marketing_recovery_job_customer_id` | `CREATE INDEX "IDX_marketing_recovery_job_customer_id" ON public.marketing_recovery_job USING btree (customer_id) WHERE (deleted_at IS NULL)` |
| `marketing_recovery_job` | `IDX_marketing_recovery_job_scheduled_at` | `CREATE INDEX "IDX_marketing_recovery_job_scheduled_at" ON public.marketing_recovery_job USING btree (scheduled_at) WHERE (deleted_at IS NULL)` |
| `marketing_recovery_job` | `IDX_marketing_recovery_job_stage` | `CREATE INDEX "IDX_marketing_recovery_job_stage" ON public.marketing_recovery_job USING btree (stage) WHERE (deleted_at IS NULL)` |
| `marketing_recovery_job` | `IDX_marketing_recovery_job_type` | `CREATE INDEX "IDX_marketing_recovery_job_type" ON public.marketing_recovery_job USING btree (type) WHERE (deleted_at IS NULL)` |
| `marketing_recovery_job` | `marketing_recovery_job_pkey` | `CREATE UNIQUE INDEX marketing_recovery_job_pkey ON public.marketing_recovery_job USING btree (id)` |
| `media` | `IDX_media_content_hash` | `CREATE INDEX "IDX_media_content_hash" ON public.media USING btree (content_hash) WHERE (deleted_at IS NULL)` |
| `media` | `IDX_media_folder` | `CREATE INDEX "IDX_media_folder" ON public.media USING btree (folder) WHERE (deleted_at IS NULL)` |
| `media` | `IDX_media_parent_id` | `CREATE INDEX "IDX_media_parent_id" ON public.media USING btree (parent_id) WHERE (deleted_at IS NULL)` |
| `media` | `media_pkey` | `CREATE UNIQUE INDEX media_pkey ON public.media USING btree (id)` |
| `mikro_orm_migrations` | `mikro_orm_migrations_pkey` | `CREATE UNIQUE INDEX mikro_orm_migrations_pkey ON public.mikro_orm_migrations USING btree (id)` |
| `notification` | `IDX_notification_deleted_at` | `CREATE INDEX "IDX_notification_deleted_at" ON public.notification USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `notification` | `IDX_notification_idempotency_key_unique` | `CREATE UNIQUE INDEX "IDX_notification_idempotency_key_unique" ON public.notification USING btree (idempotency_key) WHERE (deleted_at IS NULL)` |
| `notification` | `IDX_notification_provider_id` | `CREATE INDEX "IDX_notification_provider_id" ON public.notification USING btree (provider_id)` |
| `notification` | `IDX_notification_receiver_id` | `CREATE INDEX "IDX_notification_receiver_id" ON public.notification USING btree (receiver_id)` |
| `notification` | `notification_pkey` | `CREATE UNIQUE INDEX notification_pkey ON public.notification USING btree (id)` |
| `notification_log` | `IDX_notification_log_recipient` | `CREATE INDEX "IDX_notification_log_recipient" ON public.notification_log USING btree (recipient) WHERE (deleted_at IS NULL)` |
| `notification_log` | `notification_log_pkey` | `CREATE UNIQUE INDEX notification_log_pkey ON public.notification_log USING btree (id)` |
| `notification_provider` | `IDX_notification_provider_deleted_at` | `CREATE INDEX "IDX_notification_provider_deleted_at" ON public.notification_provider USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `notification_provider` | `notification_provider_pkey` | `CREATE UNIQUE INDEX notification_provider_pkey ON public.notification_provider USING btree (id)` |
| `notification_template` | `IDX_notification_template_event_channel` | `CREATE INDEX "IDX_notification_template_event_channel" ON public.notification_template USING btree (event, channel) WHERE (deleted_at IS NULL)` |
| `notification_template` | `notification_template_pkey` | `CREATE UNIQUE INDEX notification_template_pkey ON public.notification_template USING btree (id)` |
| `offer` | `IDX_offer_code` | `CREATE UNIQUE INDEX "IDX_offer_code" ON public.offer USING btree (code) WHERE ((deleted_at IS NULL) AND (code IS NOT NULL))` |
| `offer` | `IDX_offer_is_public` | `CREATE INDEX "IDX_offer_is_public" ON public.offer USING btree (is_public) WHERE (deleted_at IS NULL)` |
| `offer` | `IDX_offer_status` | `CREATE INDEX "IDX_offer_status" ON public.offer USING btree (status) WHERE (deleted_at IS NULL)` |
| `offer` | `IDX_offer_type` | `CREATE INDEX "IDX_offer_type" ON public.offer USING btree (type) WHERE (deleted_at IS NULL)` |
| `offer` | `offer_pkey` | `CREATE UNIQUE INDEX offer_pkey ON public.offer USING btree (id)` |
| `offer_redemption` | `IDX_offer_redemption_created_at` | `CREATE INDEX "IDX_offer_redemption_created_at" ON public.offer_redemption USING btree (created_at) WHERE (deleted_at IS NULL)` |
| `offer_redemption` | `IDX_offer_redemption_customer_id` | `CREATE INDEX "IDX_offer_redemption_customer_id" ON public.offer_redemption USING btree (customer_id) WHERE (deleted_at IS NULL)` |
| `offer_redemption` | `IDX_offer_redemption_offer_id` | `CREATE INDEX "IDX_offer_redemption_offer_id" ON public.offer_redemption USING btree (offer_id) WHERE (deleted_at IS NULL)` |
| `offer_redemption` | `offer_redemption_pkey` | `CREATE UNIQUE INDEX offer_redemption_pkey ON public.offer_redemption USING btree (id)` |
| `order` | `IDX_order_billing_address_id` | `CREATE INDEX "IDX_order_billing_address_id" ON public."order" USING btree (billing_address_id) WHERE (deleted_at IS NULL)` |
| `order` | `IDX_order_currency_code` | `CREATE INDEX "IDX_order_currency_code" ON public."order" USING btree (currency_code) WHERE (deleted_at IS NULL)` |
| `order` | `IDX_order_custom_display_id` | `CREATE UNIQUE INDEX "IDX_order_custom_display_id" ON public."order" USING btree (custom_display_id) WHERE (deleted_at IS NULL)` |
| `order` | `IDX_order_customer_id` | `CREATE INDEX "IDX_order_customer_id" ON public."order" USING btree (customer_id) WHERE (deleted_at IS NULL)` |
| `order` | `IDX_order_deleted_at` | `CREATE INDEX "IDX_order_deleted_at" ON public."order" USING btree (deleted_at)` |
| `order` | `IDX_order_display_id` | `CREATE INDEX "IDX_order_display_id" ON public."order" USING btree (display_id) WHERE (deleted_at IS NULL)` |
| `order` | `IDX_order_is_draft_order` | `CREATE INDEX "IDX_order_is_draft_order" ON public."order" USING btree (is_draft_order) WHERE (deleted_at IS NULL)` |
| `order` | `IDX_order_region_id` | `CREATE INDEX "IDX_order_region_id" ON public."order" USING btree (region_id) WHERE (deleted_at IS NULL)` |
| `order` | `IDX_order_sales_channel_id` | `CREATE INDEX "IDX_order_sales_channel_id" ON public."order" USING btree (sales_channel_id) WHERE (deleted_at IS NULL)` |
| `order` | `IDX_order_shipping_address_id` | `CREATE INDEX "IDX_order_shipping_address_id" ON public."order" USING btree (shipping_address_id) WHERE (deleted_at IS NULL)` |
| `order` | `order_pkey` | `CREATE UNIQUE INDEX order_pkey ON public."order" USING btree (id)` |
| `order_address` | `IDX_order_address_customer_id` | `CREATE INDEX "IDX_order_address_customer_id" ON public.order_address USING btree (customer_id)` |
| `order_address` | `IDX_order_address_deleted_at` | `CREATE INDEX "IDX_order_address_deleted_at" ON public.order_address USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `order_address` | `order_address_pkey` | `CREATE UNIQUE INDEX order_address_pkey ON public.order_address USING btree (id)` |
| `order_cart` | `IDX_cart_id_-71069c16` | `CREATE INDEX "IDX_cart_id_-71069c16" ON public.order_cart USING btree (cart_id) WHERE (deleted_at IS NULL)` |
| `order_cart` | `IDX_deleted_at_-71069c16` | `CREATE INDEX "IDX_deleted_at_-71069c16" ON public.order_cart USING btree (deleted_at)` |
| `order_cart` | `IDX_id_-71069c16` | `CREATE INDEX "IDX_id_-71069c16" ON public.order_cart USING btree (id)` |
| `order_cart` | `IDX_order_id_-71069c16` | `CREATE INDEX "IDX_order_id_-71069c16" ON public.order_cart USING btree (order_id) WHERE (deleted_at IS NULL)` |
| `order_cart` | `order_cart_pkey` | `CREATE UNIQUE INDEX order_cart_pkey ON public.order_cart USING btree (order_id, cart_id)` |
| `order_change` | `IDX_order_change_change_type` | `CREATE INDEX "IDX_order_change_change_type" ON public.order_change USING btree (change_type)` |
| `order_change` | `IDX_order_change_claim_id` | `CREATE INDEX "IDX_order_change_claim_id" ON public.order_change USING btree (claim_id) WHERE ((claim_id IS NOT NULL) AND (deleted_at IS NULL))` |
| `order_change` | `IDX_order_change_deleted_at` | `CREATE INDEX "IDX_order_change_deleted_at" ON public.order_change USING btree (deleted_at)` |
| `order_change` | `IDX_order_change_exchange_id` | `CREATE INDEX "IDX_order_change_exchange_id" ON public.order_change USING btree (exchange_id) WHERE ((exchange_id IS NOT NULL) AND (deleted_at IS NULL))` |
| `order_change` | `IDX_order_change_order_id` | `CREATE INDEX "IDX_order_change_order_id" ON public.order_change USING btree (order_id) WHERE (deleted_at IS NULL)` |
| `order_change` | `IDX_order_change_order_id_version` | `CREATE INDEX "IDX_order_change_order_id_version" ON public.order_change USING btree (order_id, version)` |
| `order_change` | `IDX_order_change_return_id` | `CREATE INDEX "IDX_order_change_return_id" ON public.order_change USING btree (return_id) WHERE ((return_id IS NOT NULL) AND (deleted_at IS NULL))` |
| `order_change` | `IDX_order_change_status` | `CREATE INDEX "IDX_order_change_status" ON public.order_change USING btree (status) WHERE (deleted_at IS NULL)` |
| `order_change` | `IDX_order_change_version` | `CREATE INDEX "IDX_order_change_version" ON public.order_change USING btree (order_id, version) WHERE (deleted_at IS NULL)` |
| `order_change` | `order_change_pkey` | `CREATE UNIQUE INDEX order_change_pkey ON public.order_change USING btree (id)` |
| `order_change_action` | `IDX_order_change_action_claim_id` | `CREATE INDEX "IDX_order_change_action_claim_id" ON public.order_change_action USING btree (claim_id) WHERE ((claim_id IS NOT NULL) AND (deleted_at IS NULL))` |
| `order_change_action` | `IDX_order_change_action_deleted_at` | `CREATE INDEX "IDX_order_change_action_deleted_at" ON public.order_change_action USING btree (deleted_at)` |
| `order_change_action` | `IDX_order_change_action_exchange_id` | `CREATE INDEX "IDX_order_change_action_exchange_id" ON public.order_change_action USING btree (exchange_id) WHERE ((exchange_id IS NOT NULL) AND (deleted_at IS NULL))` |
| `order_change_action` | `IDX_order_change_action_order_change_id` | `CREATE INDEX "IDX_order_change_action_order_change_id" ON public.order_change_action USING btree (order_change_id) WHERE (deleted_at IS NULL)` |
| `order_change_action` | `IDX_order_change_action_order_id` | `CREATE INDEX "IDX_order_change_action_order_id" ON public.order_change_action USING btree (order_id) WHERE (deleted_at IS NULL)` |
| `order_change_action` | `IDX_order_change_action_ordering` | `CREATE INDEX "IDX_order_change_action_ordering" ON public.order_change_action USING btree (ordering) WHERE (deleted_at IS NULL)` |
| `order_change_action` | `IDX_order_change_action_return_id` | `CREATE INDEX "IDX_order_change_action_return_id" ON public.order_change_action USING btree (return_id) WHERE ((return_id IS NOT NULL) AND (deleted_at IS NULL))` |
| `order_change_action` | `order_change_action_pkey` | `CREATE UNIQUE INDEX order_change_action_pkey ON public.order_change_action USING btree (id)` |
| `order_claim` | `IDX_order_claim_deleted_at` | `CREATE INDEX "IDX_order_claim_deleted_at" ON public.order_claim USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `order_claim` | `IDX_order_claim_display_id` | `CREATE INDEX "IDX_order_claim_display_id" ON public.order_claim USING btree (display_id) WHERE (deleted_at IS NULL)` |
| `order_claim` | `IDX_order_claim_order_id` | `CREATE INDEX "IDX_order_claim_order_id" ON public.order_claim USING btree (order_id) WHERE (deleted_at IS NULL)` |
| `order_claim` | `IDX_order_claim_return_id` | `CREATE INDEX "IDX_order_claim_return_id" ON public.order_claim USING btree (return_id) WHERE ((return_id IS NOT NULL) AND (deleted_at IS NULL))` |
| `order_claim` | `order_claim_pkey` | `CREATE UNIQUE INDEX order_claim_pkey ON public.order_claim USING btree (id)` |
| `order_claim_item` | `IDX_order_claim_item_claim_id` | `CREATE INDEX "IDX_order_claim_item_claim_id" ON public.order_claim_item USING btree (claim_id) WHERE (deleted_at IS NULL)` |
| `order_claim_item` | `IDX_order_claim_item_deleted_at` | `CREATE INDEX "IDX_order_claim_item_deleted_at" ON public.order_claim_item USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `order_claim_item` | `IDX_order_claim_item_item_id` | `CREATE INDEX "IDX_order_claim_item_item_id" ON public.order_claim_item USING btree (item_id) WHERE (deleted_at IS NULL)` |
| `order_claim_item` | `order_claim_item_pkey` | `CREATE UNIQUE INDEX order_claim_item_pkey ON public.order_claim_item USING btree (id)` |
| `order_claim_item_image` | `IDX_order_claim_item_image_claim_item_id` | `CREATE INDEX "IDX_order_claim_item_image_claim_item_id" ON public.order_claim_item_image USING btree (claim_item_id) WHERE (deleted_at IS NULL)` |
| `order_claim_item_image` | `IDX_order_claim_item_image_deleted_at` | `CREATE INDEX "IDX_order_claim_item_image_deleted_at" ON public.order_claim_item_image USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `order_claim_item_image` | `order_claim_item_image_pkey` | `CREATE UNIQUE INDEX order_claim_item_image_pkey ON public.order_claim_item_image USING btree (id)` |
| `order_credit_line` | `IDX_order_credit_line_deleted_at` | `CREATE INDEX "IDX_order_credit_line_deleted_at" ON public.order_credit_line USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `order_credit_line` | `IDX_order_credit_line_order_id` | `CREATE INDEX "IDX_order_credit_line_order_id" ON public.order_credit_line USING btree (order_id) WHERE (deleted_at IS NULL)` |
| `order_credit_line` | `IDX_order_credit_line_order_id_version` | `CREATE INDEX "IDX_order_credit_line_order_id_version" ON public.order_credit_line USING btree (order_id, version) WHERE (deleted_at IS NULL)` |
| `order_credit_line` | `order_credit_line_pkey` | `CREATE UNIQUE INDEX order_credit_line_pkey ON public.order_credit_line USING btree (id)` |
| `order_event` | `IDX_order_event_event_type` | `CREATE INDEX "IDX_order_event_event_type" ON public.order_event USING btree (event_type) WHERE (deleted_at IS NULL)` |
| `order_event` | `IDX_order_event_order_id` | `CREATE INDEX "IDX_order_event_order_id" ON public.order_event USING btree (order_id) WHERE (deleted_at IS NULL)` |
| `order_event` | `order_event_pkey` | `CREATE UNIQUE INDEX order_event_pkey ON public.order_event USING btree (id)` |
| `order_exchange` | `IDX_order_exchange_deleted_at` | `CREATE INDEX "IDX_order_exchange_deleted_at" ON public.order_exchange USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `order_exchange` | `IDX_order_exchange_display_id` | `CREATE INDEX "IDX_order_exchange_display_id" ON public.order_exchange USING btree (display_id) WHERE (deleted_at IS NULL)` |
| `order_exchange` | `IDX_order_exchange_order_id` | `CREATE INDEX "IDX_order_exchange_order_id" ON public.order_exchange USING btree (order_id) WHERE (deleted_at IS NULL)` |
| `order_exchange` | `IDX_order_exchange_return_id` | `CREATE INDEX "IDX_order_exchange_return_id" ON public.order_exchange USING btree (return_id) WHERE ((return_id IS NOT NULL) AND (deleted_at IS NULL))` |
| `order_exchange` | `order_exchange_pkey` | `CREATE UNIQUE INDEX order_exchange_pkey ON public.order_exchange USING btree (id)` |
| `order_exchange_item` | `IDX_order_exchange_item_deleted_at` | `CREATE INDEX "IDX_order_exchange_item_deleted_at" ON public.order_exchange_item USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `order_exchange_item` | `IDX_order_exchange_item_exchange_id` | `CREATE INDEX "IDX_order_exchange_item_exchange_id" ON public.order_exchange_item USING btree (exchange_id) WHERE (deleted_at IS NULL)` |
| `order_exchange_item` | `IDX_order_exchange_item_item_id` | `CREATE INDEX "IDX_order_exchange_item_item_id" ON public.order_exchange_item USING btree (item_id) WHERE (deleted_at IS NULL)` |
| `order_exchange_item` | `order_exchange_item_pkey` | `CREATE UNIQUE INDEX order_exchange_item_pkey ON public.order_exchange_item USING btree (id)` |
| `order_fulfillment` | `IDX_deleted_at_-e8d2543e` | `CREATE INDEX "IDX_deleted_at_-e8d2543e" ON public.order_fulfillment USING btree (deleted_at)` |
| `order_fulfillment` | `IDX_fulfillment_id_-e8d2543e` | `CREATE INDEX "IDX_fulfillment_id_-e8d2543e" ON public.order_fulfillment USING btree (fulfillment_id) WHERE (deleted_at IS NULL)` |
| `order_fulfillment` | `IDX_id_-e8d2543e` | `CREATE INDEX "IDX_id_-e8d2543e" ON public.order_fulfillment USING btree (id)` |
| `order_fulfillment` | `IDX_order_id_-e8d2543e` | `CREATE INDEX "IDX_order_id_-e8d2543e" ON public.order_fulfillment USING btree (order_id) WHERE (deleted_at IS NULL)` |
| `order_fulfillment` | `order_fulfillment_pkey` | `CREATE UNIQUE INDEX order_fulfillment_pkey ON public.order_fulfillment USING btree (order_id, fulfillment_id)` |
| `order_item` | `IDX_order_item_deleted_at` | `CREATE INDEX "IDX_order_item_deleted_at" ON public.order_item USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `order_item` | `IDX_order_item_item_id` | `CREATE INDEX "IDX_order_item_item_id" ON public.order_item USING btree (item_id) WHERE (deleted_at IS NULL)` |
| `order_item` | `IDX_order_item_order_id` | `CREATE INDEX "IDX_order_item_order_id" ON public.order_item USING btree (order_id) WHERE (deleted_at IS NULL)` |
| `order_item` | `IDX_order_item_order_id_version` | `CREATE INDEX "IDX_order_item_order_id_version" ON public.order_item USING btree (order_id, version) WHERE (deleted_at IS NULL)` |
| `order_item` | `order_item_pkey` | `CREATE UNIQUE INDEX order_item_pkey ON public.order_item USING btree (id)` |
| `order_lifecycle_refund` | `IDX_order_lifecycle_refund_order_id` | `CREATE INDEX "IDX_order_lifecycle_refund_order_id" ON public.order_lifecycle_refund USING btree (order_id) WHERE (deleted_at IS NULL)` |
| `order_lifecycle_refund` | `IDX_order_lifecycle_refund_status` | `CREATE INDEX "IDX_order_lifecycle_refund_status" ON public.order_lifecycle_refund USING btree (status) WHERE (deleted_at IS NULL)` |
| `order_lifecycle_refund` | `order_lifecycle_refund_pkey` | `CREATE UNIQUE INDEX order_lifecycle_refund_pkey ON public.order_lifecycle_refund USING btree (id)` |
| `order_line_item` | `IDX_line_item_product_type_id` | `CREATE INDEX "IDX_line_item_product_type_id" ON public.order_line_item USING btree (product_type_id) WHERE ((deleted_at IS NULL) AND (product_type_id IS NOT NULL))` |
| `order_line_item` | `IDX_order_line_item_product_id` | `CREATE INDEX "IDX_order_line_item_product_id" ON public.order_line_item USING btree (product_id) WHERE (deleted_at IS NULL)` |
| `order_line_item` | `IDX_order_line_item_variant_id` | `CREATE INDEX "IDX_order_line_item_variant_id" ON public.order_line_item USING btree (variant_id) WHERE (deleted_at IS NULL)` |
| `order_line_item` | `order_line_item_pkey` | `CREATE UNIQUE INDEX order_line_item_pkey ON public.order_line_item USING btree (id)` |
| `order_line_item_adjustment` | `IDX_order_line_item_adjustment_item_id` | `CREATE INDEX "IDX_order_line_item_adjustment_item_id" ON public.order_line_item_adjustment USING btree (item_id) WHERE (deleted_at IS NULL)` |
| `order_line_item_adjustment` | `order_line_item_adjustment_pkey` | `CREATE UNIQUE INDEX order_line_item_adjustment_pkey ON public.order_line_item_adjustment USING btree (id)` |
| `order_line_item_tax_line` | `IDX_order_line_item_tax_line_item_id` | `CREATE INDEX "IDX_order_line_item_tax_line_item_id" ON public.order_line_item_tax_line USING btree (item_id) WHERE (deleted_at IS NULL)` |
| `order_line_item_tax_line` | `order_line_item_tax_line_pkey` | `CREATE UNIQUE INDEX order_line_item_tax_line_pkey ON public.order_line_item_tax_line USING btree (id)` |
| `order_note` | `IDX_order_note_note_type` | `CREATE INDEX "IDX_order_note_note_type" ON public.order_note USING btree (note_type) WHERE (deleted_at IS NULL)` |
| `order_note` | `IDX_order_note_order_id` | `CREATE INDEX "IDX_order_note_order_id" ON public.order_note USING btree (order_id) WHERE (deleted_at IS NULL)` |
| `order_note` | `order_note_pkey` | `CREATE UNIQUE INDEX order_note_pkey ON public.order_note USING btree (id)` |
| `order_payment_collection` | `IDX_deleted_at_f42b9949` | `CREATE INDEX "IDX_deleted_at_f42b9949" ON public.order_payment_collection USING btree (deleted_at)` |
| `order_payment_collection` | `IDX_id_f42b9949` | `CREATE INDEX "IDX_id_f42b9949" ON public.order_payment_collection USING btree (id)` |
| `order_payment_collection` | `IDX_order_id_f42b9949` | `CREATE INDEX "IDX_order_id_f42b9949" ON public.order_payment_collection USING btree (order_id) WHERE (deleted_at IS NULL)` |
| `order_payment_collection` | `IDX_payment_collection_id_f42b9949` | `CREATE INDEX "IDX_payment_collection_id_f42b9949" ON public.order_payment_collection USING btree (payment_collection_id) WHERE (deleted_at IS NULL)` |
| `order_payment_collection` | `order_payment_collection_pkey` | `CREATE UNIQUE INDEX order_payment_collection_pkey ON public.order_payment_collection USING btree (order_id, payment_collection_id)` |
| `order_promotion` | `IDX_deleted_at_-71518339` | `CREATE INDEX "IDX_deleted_at_-71518339" ON public.order_promotion USING btree (deleted_at)` |
| `order_promotion` | `IDX_id_-71518339` | `CREATE INDEX "IDX_id_-71518339" ON public.order_promotion USING btree (id)` |
| `order_promotion` | `IDX_order_id_-71518339` | `CREATE INDEX "IDX_order_id_-71518339" ON public.order_promotion USING btree (order_id) WHERE (deleted_at IS NULL)` |
| `order_promotion` | `IDX_promotion_id_-71518339` | `CREATE INDEX "IDX_promotion_id_-71518339" ON public.order_promotion USING btree (promotion_id) WHERE (deleted_at IS NULL)` |
| `order_promotion` | `order_promotion_pkey` | `CREATE UNIQUE INDEX order_promotion_pkey ON public.order_promotion USING btree (order_id, promotion_id)` |
| `order_shipping` | `IDX_order_shipping_claim_id` | `CREATE INDEX "IDX_order_shipping_claim_id" ON public.order_shipping USING btree (claim_id) WHERE ((claim_id IS NOT NULL) AND (deleted_at IS NULL))` |
| `order_shipping` | `IDX_order_shipping_deleted_at` | `CREATE INDEX "IDX_order_shipping_deleted_at" ON public.order_shipping USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `order_shipping` | `IDX_order_shipping_exchange_id` | `CREATE INDEX "IDX_order_shipping_exchange_id" ON public.order_shipping USING btree (exchange_id) WHERE ((exchange_id IS NOT NULL) AND (deleted_at IS NULL))` |
| `order_shipping` | `IDX_order_shipping_item_id` | `CREATE INDEX "IDX_order_shipping_item_id" ON public.order_shipping USING btree (shipping_method_id) WHERE (deleted_at IS NULL)` |
| `order_shipping` | `IDX_order_shipping_order_id` | `CREATE INDEX "IDX_order_shipping_order_id" ON public.order_shipping USING btree (order_id) WHERE (deleted_at IS NULL)` |
| `order_shipping` | `IDX_order_shipping_order_id_version` | `CREATE INDEX "IDX_order_shipping_order_id_version" ON public.order_shipping USING btree (order_id, version) WHERE (deleted_at IS NULL)` |
| `order_shipping` | `IDX_order_shipping_return_id` | `CREATE INDEX "IDX_order_shipping_return_id" ON public.order_shipping USING btree (return_id) WHERE ((return_id IS NOT NULL) AND (deleted_at IS NULL))` |
| `order_shipping` | `IDX_order_shipping_shipping_method_id` | `CREATE INDEX "IDX_order_shipping_shipping_method_id" ON public.order_shipping USING btree (shipping_method_id) WHERE (deleted_at IS NULL)` |
| `order_shipping` | `order_shipping_pkey` | `CREATE UNIQUE INDEX order_shipping_pkey ON public.order_shipping USING btree (id)` |
| `order_shipping_method` | `IDX_order_shipping_method_shipping_option_id` | `CREATE INDEX "IDX_order_shipping_method_shipping_option_id" ON public.order_shipping_method USING btree (shipping_option_id) WHERE (deleted_at IS NULL)` |
| `order_shipping_method` | `order_shipping_method_pkey` | `CREATE UNIQUE INDEX order_shipping_method_pkey ON public.order_shipping_method USING btree (id)` |
| `order_shipping_method_adjustment` | `IDX_order_shipping_method_adjustment_shipping_method_id` | `CREATE INDEX "IDX_order_shipping_method_adjustment_shipping_method_id" ON public.order_shipping_method_adjustment USING btree (shipping_method_id) WHERE (deleted_at IS NULL)` |
| `order_shipping_method_adjustment` | `IDX_order_shipping_method_adjustment_version_shipping_method` | `CREATE UNIQUE INDEX "IDX_order_shipping_method_adjustment_version_shipping_method" ON public.order_shipping_method_adjustment USING btree (version, shipping_method_id) WHERE (deleted_at IS NULL)` |
| `order_shipping_method_adjustment` | `order_shipping_method_adjustment_pkey` | `CREATE UNIQUE INDEX order_shipping_method_adjustment_pkey ON public.order_shipping_method_adjustment USING btree (id)` |
| `order_shipping_method_tax_line` | `IDX_order_shipping_method_tax_line_shipping_method_id` | `CREATE INDEX "IDX_order_shipping_method_tax_line_shipping_method_id" ON public.order_shipping_method_tax_line USING btree (shipping_method_id) WHERE (deleted_at IS NULL)` |
| `order_shipping_method_tax_line` | `order_shipping_method_tax_line_pkey` | `CREATE UNIQUE INDEX order_shipping_method_tax_line_pkey ON public.order_shipping_method_tax_line USING btree (id)` |
| `order_staff_assignment` | `IDX_order_staff_assignment_order_id` | `CREATE INDEX "IDX_order_staff_assignment_order_id" ON public.order_staff_assignment USING btree (order_id) WHERE (deleted_at IS NULL)` |
| `order_staff_assignment` | `IDX_order_staff_assignment_staff_id` | `CREATE INDEX "IDX_order_staff_assignment_staff_id" ON public.order_staff_assignment USING btree (staff_id) WHERE (deleted_at IS NULL)` |
| `order_staff_assignment` | `order_staff_assignment_pkey` | `CREATE UNIQUE INDEX order_staff_assignment_pkey ON public.order_staff_assignment USING btree (id)` |
| `order_status_history` | `IDX_order_status_history_order_id` | `CREATE INDEX "IDX_order_status_history_order_id" ON public.order_status_history USING btree (order_id) WHERE (deleted_at IS NULL)` |
| `order_status_history` | `IDX_order_status_history_to_status` | `CREATE INDEX "IDX_order_status_history_to_status" ON public.order_status_history USING btree (to_status) WHERE (deleted_at IS NULL)` |
| `order_status_history` | `order_status_history_pkey` | `CREATE UNIQUE INDEX order_status_history_pkey ON public.order_status_history USING btree (id)` |
| `order_summary` | `IDX_order_summary_deleted_at` | `CREATE INDEX "IDX_order_summary_deleted_at" ON public.order_summary USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `order_summary` | `IDX_order_summary_order_id_version` | `CREATE INDEX "IDX_order_summary_order_id_version" ON public.order_summary USING btree (order_id, version) WHERE (deleted_at IS NULL)` |
| `order_summary` | `order_summary_pkey` | `CREATE UNIQUE INDEX order_summary_pkey ON public.order_summary USING btree (id)` |
| `order_transaction` | `IDX_order_transaction_claim_id` | `CREATE INDEX "IDX_order_transaction_claim_id" ON public.order_transaction USING btree (claim_id) WHERE ((claim_id IS NOT NULL) AND (deleted_at IS NULL))` |
| `order_transaction` | `IDX_order_transaction_currency_code` | `CREATE INDEX "IDX_order_transaction_currency_code" ON public.order_transaction USING btree (currency_code) WHERE (deleted_at IS NULL)` |
| `order_transaction` | `IDX_order_transaction_exchange_id` | `CREATE INDEX "IDX_order_transaction_exchange_id" ON public.order_transaction USING btree (exchange_id) WHERE ((exchange_id IS NOT NULL) AND (deleted_at IS NULL))` |
| `order_transaction` | `IDX_order_transaction_order_id` | `CREATE INDEX "IDX_order_transaction_order_id" ON public.order_transaction USING btree (order_id) WHERE (deleted_at IS NULL)` |
| `order_transaction` | `IDX_order_transaction_order_id_version` | `CREATE INDEX "IDX_order_transaction_order_id_version" ON public.order_transaction USING btree (order_id, version) WHERE (deleted_at IS NULL)` |
| `order_transaction` | `IDX_order_transaction_reference_id` | `CREATE INDEX "IDX_order_transaction_reference_id" ON public.order_transaction USING btree (reference_id) WHERE (deleted_at IS NULL)` |
| `order_transaction` | `IDX_order_transaction_return_id` | `CREATE INDEX "IDX_order_transaction_return_id" ON public.order_transaction USING btree (return_id) WHERE ((return_id IS NOT NULL) AND (deleted_at IS NULL))` |
| `order_transaction` | `order_transaction_pkey` | `CREATE UNIQUE INDEX order_transaction_pkey ON public.order_transaction USING btree (id)` |
| `payment` | `IDX_payment_deleted_at` | `CREATE INDEX "IDX_payment_deleted_at" ON public.payment USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `payment` | `IDX_payment_payment_collection_id` | `CREATE INDEX "IDX_payment_payment_collection_id" ON public.payment USING btree (payment_collection_id) WHERE (deleted_at IS NULL)` |
| `payment` | `IDX_payment_payment_session_id` | `CREATE INDEX "IDX_payment_payment_session_id" ON public.payment USING btree (payment_session_id)` |
| `payment` | `IDX_payment_payment_session_id_unique` | `CREATE UNIQUE INDEX "IDX_payment_payment_session_id_unique" ON public.payment USING btree (payment_session_id) WHERE (deleted_at IS NULL)` |
| `payment` | `IDX_payment_provider_id` | `CREATE INDEX "IDX_payment_provider_id" ON public.payment USING btree (provider_id) WHERE (deleted_at IS NULL)` |
| `payment` | `payment_pkey` | `CREATE UNIQUE INDEX payment_pkey ON public.payment USING btree (id)` |
| `payment_audit_trail` | `IDX_payment_audit_trail_deleted_at` | `CREATE INDEX "IDX_payment_audit_trail_deleted_at" ON public.payment_audit_trail USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `payment_audit_trail` | `payment_audit_trail_pkey` | `CREATE UNIQUE INDEX payment_audit_trail_pkey ON public.payment_audit_trail USING btree (id)` |
| `payment_collection` | `IDX_payment_collection_deleted_at` | `CREATE INDEX "IDX_payment_collection_deleted_at" ON public.payment_collection USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `payment_collection` | `payment_collection_pkey` | `CREATE UNIQUE INDEX payment_collection_pkey ON public.payment_collection USING btree (id)` |
| `payment_collection_payment_providers` | `payment_collection_payment_providers_pkey` | `CREATE UNIQUE INDEX payment_collection_payment_providers_pkey ON public.payment_collection_payment_providers USING btree (payment_collection_id, payment_provider_id)` |
| `payment_provider` | `IDX_payment_provider_deleted_at` | `CREATE INDEX "IDX_payment_provider_deleted_at" ON public.payment_provider USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `payment_provider` | `payment_provider_pkey` | `CREATE UNIQUE INDEX payment_provider_pkey ON public.payment_provider USING btree (id)` |
| `payment_session` | `IDX_payment_session_deleted_at` | `CREATE INDEX "IDX_payment_session_deleted_at" ON public.payment_session USING btree (deleted_at)` |
| `payment_session` | `IDX_payment_session_payment_collection_id` | `CREATE INDEX "IDX_payment_session_payment_collection_id" ON public.payment_session USING btree (payment_collection_id) WHERE (deleted_at IS NULL)` |
| `payment_session` | `payment_session_pkey` | `CREATE UNIQUE INDEX payment_session_pkey ON public.payment_session USING btree (id)` |
| `payment_transaction` | `IDX_payment_transaction_deleted_at` | `CREATE INDEX "IDX_payment_transaction_deleted_at" ON public.payment_transaction USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `payment_transaction` | `payment_transaction_pkey` | `CREATE UNIQUE INDEX payment_transaction_pkey ON public.payment_transaction USING btree (id)` |
| `popup_audience_rules` | `IDX_popup_audience_campaign_id` | `CREATE INDEX "IDX_popup_audience_campaign_id" ON public.popup_audience_rules USING btree (popup_campaign_id)` |
| `popup_audience_rules` | `popup_audience_rules_pkey` | `CREATE UNIQUE INDEX popup_audience_rules_pkey ON public.popup_audience_rules USING btree (id)` |
| `popup_campaigns` | `IDX_popup_campaigns_enabled` | `CREATE INDEX "IDX_popup_campaigns_enabled" ON public.popup_campaigns USING btree (enabled)` |
| `popup_campaigns` | `IDX_popup_campaigns_popup_type` | `CREATE INDEX "IDX_popup_campaigns_popup_type" ON public.popup_campaigns USING btree (popup_type)` |
| `popup_campaigns` | `IDX_popup_campaigns_priority` | `CREATE INDEX "IDX_popup_campaigns_priority" ON public.popup_campaigns USING btree (priority)` |
| `popup_campaigns` | `IDX_popup_campaigns_status` | `CREATE INDEX "IDX_popup_campaigns_status" ON public.popup_campaigns USING btree (status)` |
| `popup_campaigns` | `popup_campaigns_pkey` | `CREATE UNIQUE INDEX popup_campaigns_pkey ON public.popup_campaigns USING btree (id)` |
| `popup_campaigns` | `popup_campaigns_slug_key` | `CREATE UNIQUE INDEX popup_campaigns_slug_key ON public.popup_campaigns USING btree (slug)` |
| `popup_conversions` | `IDX_popup_conversions_campaign_id` | `CREATE INDEX "IDX_popup_conversions_campaign_id" ON public.popup_conversions USING btree (popup_campaign_id)` |
| `popup_conversions` | `IDX_popup_conversions_created_at` | `CREATE INDEX "IDX_popup_conversions_created_at" ON public.popup_conversions USING btree (created_at)` |
| `popup_conversions` | `IDX_popup_conversions_order_id` | `CREATE INDEX "IDX_popup_conversions_order_id" ON public.popup_conversions USING btree (order_id)` |
| `popup_conversions` | `popup_conversions_pkey` | `CREATE UNIQUE INDEX popup_conversions_pkey ON public.popup_conversions USING btree (id)` |
| `popup_frequency_rules` | `IDX_popup_frequency_campaign_id` | `CREATE INDEX "IDX_popup_frequency_campaign_id" ON public.popup_frequency_rules USING btree (popup_campaign_id)` |
| `popup_frequency_rules` | `popup_frequency_rules_pkey` | `CREATE UNIQUE INDEX popup_frequency_rules_pkey ON public.popup_frequency_rules USING btree (id)` |
| `popup_impressions` | `IDX_popup_impressions_campaign_id` | `CREATE INDEX "IDX_popup_impressions_campaign_id" ON public.popup_impressions USING btree (popup_campaign_id)` |
| `popup_impressions` | `IDX_popup_impressions_created_at` | `CREATE INDEX "IDX_popup_impressions_created_at" ON public.popup_impressions USING btree (created_at)` |
| `popup_impressions` | `IDX_popup_impressions_event_type` | `CREATE INDEX "IDX_popup_impressions_event_type" ON public.popup_impressions USING btree (event_type)` |
| `popup_impressions` | `IDX_popup_impressions_session_id` | `CREATE INDEX "IDX_popup_impressions_session_id" ON public.popup_impressions USING btree (session_id)` |
| `popup_impressions` | `popup_impressions_pkey` | `CREATE UNIQUE INDEX popup_impressions_pkey ON public.popup_impressions USING btree (id)` |
| `popup_rules` | `IDX_popup_rules_campaign_id` | `CREATE INDEX "IDX_popup_rules_campaign_id" ON public.popup_rules USING btree (popup_campaign_id)` |
| `popup_rules` | `popup_rules_pkey` | `CREATE UNIQUE INDEX popup_rules_pkey ON public.popup_rules USING btree (id)` |
| `popup_versions` | `IDX_popup_versions_campaign_id` | `CREATE INDEX "IDX_popup_versions_campaign_id" ON public.popup_versions USING btree (popup_campaign_id)` |
| `popup_versions` | `popup_versions_pkey` | `CREATE UNIQUE INDEX popup_versions_pkey ON public.popup_versions USING btree (id)` |
| `price` | `IDX_price_currency_code` | `CREATE INDEX "IDX_price_currency_code" ON public.price USING btree (currency_code) WHERE (deleted_at IS NULL)` |
| `price` | `IDX_price_deleted_at` | `CREATE INDEX "IDX_price_deleted_at" ON public.price USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `price` | `IDX_price_price_list_id` | `CREATE INDEX "IDX_price_price_list_id" ON public.price USING btree (price_list_id) WHERE (deleted_at IS NULL)` |
| `price` | `IDX_price_price_set_id` | `CREATE INDEX "IDX_price_price_set_id" ON public.price USING btree (price_set_id) WHERE (deleted_at IS NULL)` |
| `price` | `price_pkey` | `CREATE UNIQUE INDEX price_pkey ON public.price USING btree (id)` |
| `price_list` | `IDX_price_list_deleted_at` | `CREATE INDEX "IDX_price_list_deleted_at" ON public.price_list USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `price_list` | `IDX_price_list_id_status_starts_at_ends_at` | `CREATE INDEX "IDX_price_list_id_status_starts_at_ends_at" ON public.price_list USING btree (id, status, starts_at, ends_at) WHERE ((deleted_at IS NULL) AND (status = 'active'::text))` |
| `price_list` | `price_list_pkey` | `CREATE UNIQUE INDEX price_list_pkey ON public.price_list USING btree (id)` |
| `price_list_rule` | `IDX_price_list_rule_attribute` | `CREATE INDEX "IDX_price_list_rule_attribute" ON public.price_list_rule USING btree (attribute) WHERE (deleted_at IS NULL)` |
| `price_list_rule` | `IDX_price_list_rule_deleted_at` | `CREATE INDEX "IDX_price_list_rule_deleted_at" ON public.price_list_rule USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `price_list_rule` | `IDX_price_list_rule_price_list_id` | `CREATE INDEX "IDX_price_list_rule_price_list_id" ON public.price_list_rule USING btree (price_list_id) WHERE (deleted_at IS NOT NULL)` |
| `price_list_rule` | `IDX_price_list_rule_value` | `CREATE INDEX "IDX_price_list_rule_value" ON public.price_list_rule USING gin (value) WHERE (deleted_at IS NULL)` |
| `price_list_rule` | `price_list_rule_pkey` | `CREATE UNIQUE INDEX price_list_rule_pkey ON public.price_list_rule USING btree (id)` |
| `price_preference` | `IDX_price_preference_attribute_value` | `CREATE UNIQUE INDEX "IDX_price_preference_attribute_value" ON public.price_preference USING btree (attribute, value) WHERE (deleted_at IS NULL)` |
| `price_preference` | `IDX_price_preference_deleted_at` | `CREATE INDEX "IDX_price_preference_deleted_at" ON public.price_preference USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `price_preference` | `price_preference_pkey` | `CREATE UNIQUE INDEX price_preference_pkey ON public.price_preference USING btree (id)` |
| `price_rule` | `IDX_price_rule_attribute` | `CREATE INDEX "IDX_price_rule_attribute" ON public.price_rule USING btree (attribute) WHERE (deleted_at IS NULL)` |
| `price_rule` | `IDX_price_rule_attribute_value` | `CREATE INDEX "IDX_price_rule_attribute_value" ON public.price_rule USING btree (attribute, value) WHERE (deleted_at IS NULL)` |
| `price_rule` | `IDX_price_rule_attribute_value_price_id` | `CREATE INDEX "IDX_price_rule_attribute_value_price_id" ON public.price_rule USING btree (attribute, value, price_id) WHERE (deleted_at IS NULL)` |
| `price_rule` | `IDX_price_rule_deleted_at` | `CREATE INDEX "IDX_price_rule_deleted_at" ON public.price_rule USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `price_rule` | `IDX_price_rule_operator` | `CREATE INDEX "IDX_price_rule_operator" ON public.price_rule USING btree (operator)` |
| `price_rule` | `IDX_price_rule_operator_value` | `CREATE INDEX "IDX_price_rule_operator_value" ON public.price_rule USING btree (operator, value) WHERE (deleted_at IS NULL)` |
| `price_rule` | `IDX_price_rule_price_id` | `CREATE INDEX "IDX_price_rule_price_id" ON public.price_rule USING btree (price_id) WHERE (deleted_at IS NULL)` |
| `price_rule` | `IDX_price_rule_price_id_attribute_operator_unique` | `CREATE UNIQUE INDEX "IDX_price_rule_price_id_attribute_operator_unique" ON public.price_rule USING btree (price_id, attribute, operator) WHERE (deleted_at IS NULL)` |
| `price_rule` | `price_rule_pkey` | `CREATE UNIQUE INDEX price_rule_pkey ON public.price_rule USING btree (id)` |
| `price_set` | `IDX_price_set_deleted_at` | `CREATE INDEX "IDX_price_set_deleted_at" ON public.price_set USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `price_set` | `price_set_pkey` | `CREATE UNIQUE INDEX price_set_pkey ON public.price_set USING btree (id)` |
| `product` | `IDX_product_collection_id` | `CREATE INDEX "IDX_product_collection_id" ON public.product USING btree (collection_id) WHERE (deleted_at IS NULL)` |
| `product` | `IDX_product_deleted_at` | `CREATE INDEX "IDX_product_deleted_at" ON public.product USING btree (deleted_at)` |
| `product` | `IDX_product_handle_unique` | `CREATE UNIQUE INDEX "IDX_product_handle_unique" ON public.product USING btree (handle) WHERE (deleted_at IS NULL)` |
| `product` | `IDX_product_status` | `CREATE INDEX "IDX_product_status" ON public.product USING btree (status) WHERE (deleted_at IS NULL)` |
| `product` | `IDX_product_type_id` | `CREATE INDEX "IDX_product_type_id" ON public.product USING btree (type_id) WHERE (deleted_at IS NULL)` |
| `product` | `product_pkey` | `CREATE UNIQUE INDEX product_pkey ON public.product USING btree (id)` |
| `product_category` | `IDX_category_handle_unique` | `CREATE UNIQUE INDEX "IDX_category_handle_unique" ON public.product_category USING btree (handle) WHERE (deleted_at IS NULL)` |
| `product_category` | `IDX_product_category_parent_category_id` | `CREATE INDEX "IDX_product_category_parent_category_id" ON public.product_category USING btree (parent_category_id) WHERE (deleted_at IS NULL)` |
| `product_category` | `IDX_product_category_path` | `CREATE INDEX "IDX_product_category_path" ON public.product_category USING btree (mpath) WHERE (deleted_at IS NULL)` |
| `product_category` | `product_category_pkey` | `CREATE UNIQUE INDEX product_category_pkey ON public.product_category USING btree (id)` |
| `product_category_product` | `product_category_product_pkey` | `CREATE UNIQUE INDEX product_category_product_pkey ON public.product_category_product USING btree (product_id, product_category_id)` |
| `product_collection` | `IDX_collection_handle_unique` | `CREATE UNIQUE INDEX "IDX_collection_handle_unique" ON public.product_collection USING btree (handle) WHERE (deleted_at IS NULL)` |
| `product_collection` | `IDX_product_collection_deleted_at` | `CREATE INDEX "IDX_product_collection_deleted_at" ON public.product_collection USING btree (deleted_at)` |
| `product_collection` | `product_collection_pkey` | `CREATE UNIQUE INDEX product_collection_pkey ON public.product_collection USING btree (id)` |
| `product_meta` | `IDX_product_meta_product_id` | `CREATE UNIQUE INDEX "IDX_product_meta_product_id" ON public.product_meta USING btree (product_id) WHERE (deleted_at IS NULL)` |
| `product_meta` | `product_meta_pkey` | `CREATE UNIQUE INDEX product_meta_pkey ON public.product_meta USING btree (id)` |
| `product_option` | `IDX_product_option_deleted_at` | `CREATE INDEX "IDX_product_option_deleted_at" ON public.product_option USING btree (deleted_at)` |
| `product_option` | `product_option_pkey` | `CREATE UNIQUE INDEX product_option_pkey ON public.product_option USING btree (id)` |
| `product_option_value` | `IDX_option_value_option_id_unique` | `CREATE UNIQUE INDEX "IDX_option_value_option_id_unique" ON public.product_option_value USING btree (option_id, value) WHERE (deleted_at IS NULL)` |
| `product_option_value` | `IDX_product_option_value_deleted_at` | `CREATE INDEX "IDX_product_option_value_deleted_at" ON public.product_option_value USING btree (deleted_at)` |
| `product_option_value` | `IDX_product_option_value_option_id` | `CREATE INDEX "IDX_product_option_value_option_id" ON public.product_option_value USING btree (option_id) WHERE (deleted_at IS NULL)` |
| `product_option_value` | `product_option_value_pkey` | `CREATE UNIQUE INDEX product_option_value_pkey ON public.product_option_value USING btree (id)` |
| `product_product_option` | `IDX_product_product_option_deleted_at` | `CREATE INDEX "IDX_product_product_option_deleted_at" ON public.product_product_option USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `product_product_option` | `IDX_product_product_option_product_id` | `CREATE INDEX "IDX_product_product_option_product_id" ON public.product_product_option USING btree (product_id) WHERE (deleted_at IS NULL)` |
| `product_product_option` | `IDX_product_product_option_product_option_id` | `CREATE INDEX "IDX_product_product_option_product_option_id" ON public.product_product_option USING btree (product_option_id) WHERE (deleted_at IS NULL)` |
| `product_product_option` | `product_product_option_pkey` | `CREATE UNIQUE INDEX product_product_option_pkey ON public.product_product_option USING btree (id)` |
| `product_product_option_value` | `IDX_product_product_option_value_deleted_at` | `CREATE INDEX "IDX_product_product_option_value_deleted_at" ON public.product_product_option_value USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `product_product_option_value` | `IDX_product_product_option_value_product_option_value_id` | `CREATE INDEX "IDX_product_product_option_value_product_option_value_id" ON public.product_product_option_value USING btree (product_option_value_id) WHERE (deleted_at IS NULL)` |
| `product_product_option_value` | `IDX_product_product_option_value_product_product_option_id` | `CREATE INDEX "IDX_product_product_option_value_product_product_option_id" ON public.product_product_option_value USING btree (product_product_option_id) WHERE (deleted_at IS NULL)` |
| `product_product_option_value` | `product_product_option_value_pkey` | `CREATE UNIQUE INDEX product_product_option_value_pkey ON public.product_product_option_value USING btree (id)` |
| `product_review` | `IDX_product_review_customer_id` | `CREATE INDEX "IDX_product_review_customer_id" ON public.product_review USING btree (customer_id) WHERE (deleted_at IS NULL)` |
| `product_review` | `IDX_product_review_product_id` | `CREATE INDEX "IDX_product_review_product_id" ON public.product_review USING btree (product_id) WHERE (deleted_at IS NULL)` |
| `product_review` | `IDX_product_review_status` | `CREATE INDEX "IDX_product_review_status" ON public.product_review USING btree (status) WHERE (deleted_at IS NULL)` |
| `product_review` | `product_review_pkey` | `CREATE UNIQUE INDEX product_review_pkey ON public.product_review USING btree (id)` |
| `product_reviews` | `product_reviews_pkey` | `CREATE UNIQUE INDEX product_reviews_pkey ON public.product_reviews USING btree (id)` |
| `product_reviews` | `uq_product_reviews_customer_order_product` | `CREATE UNIQUE INDEX uq_product_reviews_customer_order_product ON public.product_reviews USING btree (customer_uid, order_id, product_id) WHERE (deleted_at IS NULL)` |
| `product_sales_channel` | `IDX_deleted_at_20b454295` | `CREATE INDEX "IDX_deleted_at_20b454295" ON public.product_sales_channel USING btree (deleted_at)` |
| `product_sales_channel` | `IDX_id_20b454295` | `CREATE INDEX "IDX_id_20b454295" ON public.product_sales_channel USING btree (id)` |
| `product_sales_channel` | `IDX_product_id_20b454295` | `CREATE INDEX "IDX_product_id_20b454295" ON public.product_sales_channel USING btree (product_id) WHERE (deleted_at IS NULL)` |
| `product_sales_channel` | `IDX_sales_channel_id_20b454295` | `CREATE INDEX "IDX_sales_channel_id_20b454295" ON public.product_sales_channel USING btree (sales_channel_id) WHERE (deleted_at IS NULL)` |
| `product_sales_channel` | `product_sales_channel_pkey` | `CREATE UNIQUE INDEX product_sales_channel_pkey ON public.product_sales_channel USING btree (product_id, sales_channel_id)` |
| `product_shipping_profile` | `IDX_deleted_at_17a262437` | `CREATE INDEX "IDX_deleted_at_17a262437" ON public.product_shipping_profile USING btree (deleted_at)` |
| `product_shipping_profile` | `IDX_id_17a262437` | `CREATE INDEX "IDX_id_17a262437" ON public.product_shipping_profile USING btree (id)` |
| `product_shipping_profile` | `IDX_product_id_17a262437` | `CREATE INDEX "IDX_product_id_17a262437" ON public.product_shipping_profile USING btree (product_id) WHERE (deleted_at IS NULL)` |
| `product_shipping_profile` | `IDX_shipping_profile_id_17a262437` | `CREATE INDEX "IDX_shipping_profile_id_17a262437" ON public.product_shipping_profile USING btree (shipping_profile_id) WHERE (deleted_at IS NULL)` |
| `product_shipping_profile` | `product_shipping_profile_pkey` | `CREATE UNIQUE INDEX product_shipping_profile_pkey ON public.product_shipping_profile USING btree (product_id, shipping_profile_id)` |
| `product_tag` | `IDX_product_tag_deleted_at` | `CREATE INDEX "IDX_product_tag_deleted_at" ON public.product_tag USING btree (deleted_at)` |
| `product_tag` | `IDX_tag_value_unique` | `CREATE UNIQUE INDEX "IDX_tag_value_unique" ON public.product_tag USING btree (value) WHERE (deleted_at IS NULL)` |
| `product_tag` | `product_tag_pkey` | `CREATE UNIQUE INDEX product_tag_pkey ON public.product_tag USING btree (id)` |
| `product_tags` | `product_tags_pkey` | `CREATE UNIQUE INDEX product_tags_pkey ON public.product_tags USING btree (product_id, product_tag_id)` |
| `product_type` | `IDX_product_type_deleted_at` | `CREATE INDEX "IDX_product_type_deleted_at" ON public.product_type USING btree (deleted_at)` |
| `product_type` | `IDX_type_value_unique` | `CREATE UNIQUE INDEX "IDX_type_value_unique" ON public.product_type USING btree (value) WHERE (deleted_at IS NULL)` |
| `product_type` | `product_type_pkey` | `CREATE UNIQUE INDEX product_type_pkey ON public.product_type USING btree (id)` |
| `product_variant` | `IDX_product_variant_barcode_unique` | `CREATE UNIQUE INDEX "IDX_product_variant_barcode_unique" ON public.product_variant USING btree (barcode) WHERE (deleted_at IS NULL)` |
| `product_variant` | `IDX_product_variant_deleted_at` | `CREATE INDEX "IDX_product_variant_deleted_at" ON public.product_variant USING btree (deleted_at)` |
| `product_variant` | `IDX_product_variant_ean_unique` | `CREATE UNIQUE INDEX "IDX_product_variant_ean_unique" ON public.product_variant USING btree (ean) WHERE (deleted_at IS NULL)` |
| `product_variant` | `IDX_product_variant_id_product_id` | `CREATE INDEX "IDX_product_variant_id_product_id" ON public.product_variant USING btree (id, product_id) WHERE (deleted_at IS NULL)` |
| `product_variant` | `IDX_product_variant_product_id` | `CREATE INDEX "IDX_product_variant_product_id" ON public.product_variant USING btree (product_id) WHERE (deleted_at IS NULL)` |
| `product_variant` | `IDX_product_variant_sku_unique` | `CREATE UNIQUE INDEX "IDX_product_variant_sku_unique" ON public.product_variant USING btree (sku) WHERE (deleted_at IS NULL)` |
| `product_variant` | `IDX_product_variant_upc_unique` | `CREATE UNIQUE INDEX "IDX_product_variant_upc_unique" ON public.product_variant USING btree (upc) WHERE (deleted_at IS NULL)` |
| `product_variant` | `product_variant_pkey` | `CREATE UNIQUE INDEX product_variant_pkey ON public.product_variant USING btree (id)` |
| `product_variant_inventory_item` | `IDX_deleted_at_17b4c4e35` | `CREATE INDEX "IDX_deleted_at_17b4c4e35" ON public.product_variant_inventory_item USING btree (deleted_at)` |
| `product_variant_inventory_item` | `IDX_id_17b4c4e35` | `CREATE INDEX "IDX_id_17b4c4e35" ON public.product_variant_inventory_item USING btree (id)` |
| `product_variant_inventory_item` | `IDX_inventory_item_id_17b4c4e35` | `CREATE INDEX "IDX_inventory_item_id_17b4c4e35" ON public.product_variant_inventory_item USING btree (inventory_item_id) WHERE (deleted_at IS NULL)` |
| `product_variant_inventory_item` | `IDX_variant_id_17b4c4e35` | `CREATE INDEX "IDX_variant_id_17b4c4e35" ON public.product_variant_inventory_item USING btree (variant_id) WHERE (deleted_at IS NULL)` |
| `product_variant_inventory_item` | `product_variant_inventory_item_pkey` | `CREATE UNIQUE INDEX product_variant_inventory_item_pkey ON public.product_variant_inventory_item USING btree (variant_id, inventory_item_id)` |
| `product_variant_option` | `product_variant_option_pkey` | `CREATE UNIQUE INDEX product_variant_option_pkey ON public.product_variant_option USING btree (variant_id, option_value_id)` |
| `product_variant_price_set` | `IDX_deleted_at_52b23597` | `CREATE INDEX "IDX_deleted_at_52b23597" ON public.product_variant_price_set USING btree (deleted_at)` |
| `product_variant_price_set` | `IDX_id_52b23597` | `CREATE INDEX "IDX_id_52b23597" ON public.product_variant_price_set USING btree (id)` |
| `product_variant_price_set` | `IDX_price_set_id_52b23597` | `CREATE INDEX "IDX_price_set_id_52b23597" ON public.product_variant_price_set USING btree (price_set_id) WHERE (deleted_at IS NULL)` |
| `product_variant_price_set` | `IDX_variant_id_52b23597` | `CREATE INDEX "IDX_variant_id_52b23597" ON public.product_variant_price_set USING btree (variant_id) WHERE (deleted_at IS NULL)` |
| `product_variant_price_set` | `product_variant_price_set_pkey` | `CREATE UNIQUE INDEX product_variant_price_set_pkey ON public.product_variant_price_set USING btree (variant_id, price_set_id)` |
| `product_variant_product_image` | `IDX_product_variant_product_image_deleted_at` | `CREATE INDEX "IDX_product_variant_product_image_deleted_at" ON public.product_variant_product_image USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `product_variant_product_image` | `IDX_product_variant_product_image_image_id` | `CREATE INDEX "IDX_product_variant_product_image_image_id" ON public.product_variant_product_image USING btree (image_id) WHERE (deleted_at IS NULL)` |
| `product_variant_product_image` | `IDX_product_variant_product_image_variant_id` | `CREATE INDEX "IDX_product_variant_product_image_variant_id" ON public.product_variant_product_image USING btree (variant_id) WHERE (deleted_at IS NULL)` |
| `product_variant_product_image` | `product_variant_product_image_pkey` | `CREATE UNIQUE INDEX product_variant_product_image_pkey ON public.product_variant_product_image USING btree (id)` |
| `promotion` | `IDX_promotion_campaign_id` | `CREATE INDEX "IDX_promotion_campaign_id" ON public.promotion USING btree (campaign_id) WHERE (deleted_at IS NULL)` |
| `promotion` | `IDX_promotion_deleted_at` | `CREATE INDEX "IDX_promotion_deleted_at" ON public.promotion USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `promotion` | `IDX_promotion_is_automatic` | `CREATE INDEX "IDX_promotion_is_automatic" ON public.promotion USING btree (is_automatic) WHERE (deleted_at IS NULL)` |
| `promotion` | `IDX_promotion_status` | `CREATE INDEX "IDX_promotion_status" ON public.promotion USING btree (status) WHERE (deleted_at IS NULL)` |
| `promotion` | `IDX_promotion_type` | `CREATE INDEX "IDX_promotion_type" ON public.promotion USING btree (type)` |
| `promotion` | `IDX_unique_promotion_code` | `CREATE UNIQUE INDEX "IDX_unique_promotion_code" ON public.promotion USING btree (code) WHERE (deleted_at IS NULL)` |
| `promotion` | `promotion_pkey` | `CREATE UNIQUE INDEX promotion_pkey ON public.promotion USING btree (id)` |
| `promotion_application_method` | `IDX_application_method_allocation` | `CREATE INDEX "IDX_application_method_allocation" ON public.promotion_application_method USING btree (allocation)` |
| `promotion_application_method` | `IDX_application_method_target_type` | `CREATE INDEX "IDX_application_method_target_type" ON public.promotion_application_method USING btree (target_type)` |
| `promotion_application_method` | `IDX_application_method_type` | `CREATE INDEX "IDX_application_method_type" ON public.promotion_application_method USING btree (type)` |
| `promotion_application_method` | `IDX_promotion_application_method_currency_code` | `CREATE INDEX "IDX_promotion_application_method_currency_code" ON public.promotion_application_method USING btree (currency_code) WHERE (deleted_at IS NOT NULL)` |
| `promotion_application_method` | `IDX_promotion_application_method_deleted_at` | `CREATE INDEX "IDX_promotion_application_method_deleted_at" ON public.promotion_application_method USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `promotion_application_method` | `IDX_promotion_application_method_promotion_id_unique` | `CREATE UNIQUE INDEX "IDX_promotion_application_method_promotion_id_unique" ON public.promotion_application_method USING btree (promotion_id) WHERE (deleted_at IS NULL)` |
| `promotion_application_method` | `promotion_application_method_pkey` | `CREATE UNIQUE INDEX promotion_application_method_pkey ON public.promotion_application_method USING btree (id)` |
| `promotion_campaign` | `IDX_promotion_campaign_campaign_identifier_unique` | `CREATE UNIQUE INDEX "IDX_promotion_campaign_campaign_identifier_unique" ON public.promotion_campaign USING btree (campaign_identifier) WHERE (deleted_at IS NULL)` |
| `promotion_campaign` | `IDX_promotion_campaign_deleted_at` | `CREATE INDEX "IDX_promotion_campaign_deleted_at" ON public.promotion_campaign USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `promotion_campaign` | `promotion_campaign_pkey` | `CREATE UNIQUE INDEX promotion_campaign_pkey ON public.promotion_campaign USING btree (id)` |
| `promotion_campaign_budget` | `IDX_campaign_budget_type` | `CREATE INDEX "IDX_campaign_budget_type" ON public.promotion_campaign_budget USING btree (type)` |
| `promotion_campaign_budget` | `IDX_promotion_campaign_budget_campaign_id_unique` | `CREATE UNIQUE INDEX "IDX_promotion_campaign_budget_campaign_id_unique" ON public.promotion_campaign_budget USING btree (campaign_id) WHERE (deleted_at IS NULL)` |
| `promotion_campaign_budget` | `IDX_promotion_campaign_budget_deleted_at` | `CREATE INDEX "IDX_promotion_campaign_budget_deleted_at" ON public.promotion_campaign_budget USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `promotion_campaign_budget` | `promotion_campaign_budget_pkey` | `CREATE UNIQUE INDEX promotion_campaign_budget_pkey ON public.promotion_campaign_budget USING btree (id)` |
| `promotion_campaign_budget_usage` | `IDX_promotion_campaign_budget_usage_attribute_value_budget_id_u` | `CREATE UNIQUE INDEX "IDX_promotion_campaign_budget_usage_attribute_value_budget_id_u" ON public.promotion_campaign_budget_usage USING btree (attribute_value, budget_id) WHERE (deleted_at IS NULL)` |
| `promotion_campaign_budget_usage` | `IDX_promotion_campaign_budget_usage_budget_id` | `CREATE INDEX "IDX_promotion_campaign_budget_usage_budget_id" ON public.promotion_campaign_budget_usage USING btree (budget_id) WHERE (deleted_at IS NULL)` |
| `promotion_campaign_budget_usage` | `IDX_promotion_campaign_budget_usage_deleted_at` | `CREATE INDEX "IDX_promotion_campaign_budget_usage_deleted_at" ON public.promotion_campaign_budget_usage USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `promotion_campaign_budget_usage` | `promotion_campaign_budget_usage_pkey` | `CREATE UNIQUE INDEX promotion_campaign_budget_usage_pkey ON public.promotion_campaign_budget_usage USING btree (id)` |
| `promotion_promotion_rule` | `promotion_promotion_rule_pkey` | `CREATE UNIQUE INDEX promotion_promotion_rule_pkey ON public.promotion_promotion_rule USING btree (promotion_id, promotion_rule_id)` |
| `promotion_rule` | `IDX_promotion_rule_attribute` | `CREATE INDEX "IDX_promotion_rule_attribute" ON public.promotion_rule USING btree (attribute)` |
| `promotion_rule` | `IDX_promotion_rule_attribute_operator` | `CREATE INDEX "IDX_promotion_rule_attribute_operator" ON public.promotion_rule USING btree (attribute, operator) WHERE (deleted_at IS NULL)` |
| `promotion_rule` | `IDX_promotion_rule_attribute_operator_id` | `CREATE INDEX "IDX_promotion_rule_attribute_operator_id" ON public.promotion_rule USING btree (operator, attribute, id) WHERE (deleted_at IS NULL)` |
| `promotion_rule` | `IDX_promotion_rule_deleted_at` | `CREATE INDEX "IDX_promotion_rule_deleted_at" ON public.promotion_rule USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `promotion_rule` | `IDX_promotion_rule_operator` | `CREATE INDEX "IDX_promotion_rule_operator" ON public.promotion_rule USING btree (operator)` |
| `promotion_rule` | `promotion_rule_pkey` | `CREATE UNIQUE INDEX promotion_rule_pkey ON public.promotion_rule USING btree (id)` |
| `promotion_rule_value` | `IDX_promotion_rule_value_deleted_at` | `CREATE INDEX "IDX_promotion_rule_value_deleted_at" ON public.promotion_rule_value USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `promotion_rule_value` | `IDX_promotion_rule_value_promotion_rule_id` | `CREATE INDEX "IDX_promotion_rule_value_promotion_rule_id" ON public.promotion_rule_value USING btree (promotion_rule_id) WHERE (deleted_at IS NULL)` |
| `promotion_rule_value` | `IDX_promotion_rule_value_rule_id_value` | `CREATE INDEX "IDX_promotion_rule_value_rule_id_value" ON public.promotion_rule_value USING btree (promotion_rule_id, value) WHERE (deleted_at IS NULL)` |
| `promotion_rule_value` | `IDX_promotion_rule_value_value` | `CREATE INDEX "IDX_promotion_rule_value_value" ON public.promotion_rule_value USING btree (value) WHERE (deleted_at IS NULL)` |
| `promotion_rule_value` | `promotion_rule_value_pkey` | `CREATE UNIQUE INDEX promotion_rule_value_pkey ON public.promotion_rule_value USING btree (id)` |
| `property_label` | `IDX_property_label_deleted_at` | `CREATE INDEX "IDX_property_label_deleted_at" ON public.property_label USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `property_label` | `IDX_property_label_entity` | `CREATE INDEX "IDX_property_label_entity" ON public.property_label USING btree (entity) WHERE (deleted_at IS NULL)` |
| `property_label` | `IDX_property_label_entity_property_unique` | `CREATE UNIQUE INDEX "IDX_property_label_entity_property_unique" ON public.property_label USING btree (entity, property) WHERE (deleted_at IS NULL)` |
| `property_label` | `property_label_pkey` | `CREATE UNIQUE INDEX property_label_pkey ON public.property_label USING btree (id)` |
| `provider_identity` | `IDX_provider_identity_auth_identity_id` | `CREATE INDEX "IDX_provider_identity_auth_identity_id" ON public.provider_identity USING btree (auth_identity_id)` |
| `provider_identity` | `IDX_provider_identity_deleted_at` | `CREATE INDEX "IDX_provider_identity_deleted_at" ON public.provider_identity USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `provider_identity` | `IDX_provider_identity_provider_entity_id` | `CREATE UNIQUE INDEX "IDX_provider_identity_provider_entity_id" ON public.provider_identity USING btree (entity_id, provider)` |
| `provider_identity` | `provider_identity_pkey` | `CREATE UNIQUE INDEX provider_identity_pkey ON public.provider_identity USING btree (id)` |
| `publishable_api_key_sales_channel` | `IDX_deleted_at_-1d67bae40` | `CREATE INDEX "IDX_deleted_at_-1d67bae40" ON public.publishable_api_key_sales_channel USING btree (deleted_at)` |
| `publishable_api_key_sales_channel` | `IDX_id_-1d67bae40` | `CREATE INDEX "IDX_id_-1d67bae40" ON public.publishable_api_key_sales_channel USING btree (id)` |
| `publishable_api_key_sales_channel` | `IDX_publishable_key_id_-1d67bae40` | `CREATE INDEX "IDX_publishable_key_id_-1d67bae40" ON public.publishable_api_key_sales_channel USING btree (publishable_key_id) WHERE (deleted_at IS NULL)` |
| `publishable_api_key_sales_channel` | `IDX_sales_channel_id_-1d67bae40` | `CREATE INDEX "IDX_sales_channel_id_-1d67bae40" ON public.publishable_api_key_sales_channel USING btree (sales_channel_id) WHERE (deleted_at IS NULL)` |
| `publishable_api_key_sales_channel` | `publishable_api_key_sales_channel_pkey` | `CREATE UNIQUE INDEX publishable_api_key_sales_channel_pkey ON public.publishable_api_key_sales_channel USING btree (publishable_key_id, sales_channel_id)` |
| `refund` | `IDX_refund_deleted_at` | `CREATE INDEX "IDX_refund_deleted_at" ON public.refund USING btree (deleted_at)` |
| `refund` | `IDX_refund_payment_id` | `CREATE INDEX "IDX_refund_payment_id" ON public.refund USING btree (payment_id) WHERE (deleted_at IS NULL)` |
| `refund` | `IDX_refund_refund_reason_id` | `CREATE INDEX "IDX_refund_refund_reason_id" ON public.refund USING btree (refund_reason_id) WHERE (deleted_at IS NULL)` |
| `refund` | `refund_pkey` | `CREATE UNIQUE INDEX refund_pkey ON public.refund USING btree (id)` |
| `refund_reason` | `IDX_refund_reason_deleted_at` | `CREATE INDEX "IDX_refund_reason_deleted_at" ON public.refund_reason USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `refund_reason` | `refund_reason_pkey` | `CREATE UNIQUE INDEX refund_reason_pkey ON public.refund_reason USING btree (id)` |
| `region` | `IDX_region_deleted_at` | `CREATE INDEX "IDX_region_deleted_at" ON public.region USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `region` | `region_pkey` | `CREATE UNIQUE INDEX region_pkey ON public.region USING btree (id)` |
| `region_country` | `IDX_region_country_deleted_at` | `CREATE INDEX "IDX_region_country_deleted_at" ON public.region_country USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `region_country` | `IDX_region_country_region_id` | `CREATE INDEX "IDX_region_country_region_id" ON public.region_country USING btree (region_id) WHERE (deleted_at IS NULL)` |
| `region_country` | `IDX_region_country_region_id_iso_2_unique` | `CREATE UNIQUE INDEX "IDX_region_country_region_id_iso_2_unique" ON public.region_country USING btree (region_id, iso_2)` |
| `region_country` | `region_country_pkey` | `CREATE UNIQUE INDEX region_country_pkey ON public.region_country USING btree (iso_2)` |
| `region_payment_provider` | `IDX_deleted_at_1c934dab0` | `CREATE INDEX "IDX_deleted_at_1c934dab0" ON public.region_payment_provider USING btree (deleted_at)` |
| `region_payment_provider` | `IDX_id_1c934dab0` | `CREATE INDEX "IDX_id_1c934dab0" ON public.region_payment_provider USING btree (id)` |
| `region_payment_provider` | `IDX_payment_provider_id_1c934dab0` | `CREATE INDEX "IDX_payment_provider_id_1c934dab0" ON public.region_payment_provider USING btree (payment_provider_id) WHERE (deleted_at IS NULL)` |
| `region_payment_provider` | `IDX_region_id_1c934dab0` | `CREATE INDEX "IDX_region_id_1c934dab0" ON public.region_payment_provider USING btree (region_id) WHERE (deleted_at IS NULL)` |
| `region_payment_provider` | `region_payment_provider_pkey` | `CREATE UNIQUE INDEX region_payment_provider_pkey ON public.region_payment_provider USING btree (region_id, payment_provider_id)` |
| `report_schedule` | `IDX_report_schedule_recipient_email` | `CREATE INDEX "IDX_report_schedule_recipient_email" ON public.report_schedule USING btree (recipient_email) WHERE (deleted_at IS NULL)` |
| `report_schedule` | `report_schedule_pkey` | `CREATE UNIQUE INDEX report_schedule_pkey ON public.report_schedule USING btree (id)` |
| `reschedule_request` | `IDX_reschedule_request_order_id` | `CREATE INDEX "IDX_reschedule_request_order_id" ON public.reschedule_request USING btree (order_id) WHERE (deleted_at IS NULL)` |
| `reschedule_request` | `IDX_reschedule_request_status` | `CREATE INDEX "IDX_reschedule_request_status" ON public.reschedule_request USING btree (status) WHERE (deleted_at IS NULL)` |
| `reschedule_request` | `reschedule_request_pkey` | `CREATE UNIQUE INDEX reschedule_request_pkey ON public.reschedule_request USING btree (id)` |
| `reservation_item` | `IDX_reservation_item_deleted_at` | `CREATE INDEX "IDX_reservation_item_deleted_at" ON public.reservation_item USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `reservation_item` | `IDX_reservation_item_inventory_item_id` | `CREATE INDEX "IDX_reservation_item_inventory_item_id" ON public.reservation_item USING btree (inventory_item_id) WHERE (deleted_at IS NULL)` |
| `reservation_item` | `IDX_reservation_item_line_item_id` | `CREATE INDEX "IDX_reservation_item_line_item_id" ON public.reservation_item USING btree (line_item_id) WHERE (deleted_at IS NULL)` |
| `reservation_item` | `IDX_reservation_item_location_id` | `CREATE INDEX "IDX_reservation_item_location_id" ON public.reservation_item USING btree (location_id) WHERE (deleted_at IS NULL)` |
| `reservation_item` | `reservation_item_pkey` | `CREATE UNIQUE INDEX reservation_item_pkey ON public.reservation_item USING btree (id)` |
| `return` | `IDX_return_claim_id` | `CREATE INDEX "IDX_return_claim_id" ON public.return USING btree (claim_id) WHERE ((claim_id IS NOT NULL) AND (deleted_at IS NULL))` |
| `return` | `IDX_return_display_id` | `CREATE INDEX "IDX_return_display_id" ON public.return USING btree (display_id) WHERE (deleted_at IS NULL)` |
| `return` | `IDX_return_exchange_id` | `CREATE INDEX "IDX_return_exchange_id" ON public.return USING btree (exchange_id) WHERE ((exchange_id IS NOT NULL) AND (deleted_at IS NULL))` |
| `return` | `IDX_return_order_id` | `CREATE INDEX "IDX_return_order_id" ON public.return USING btree (order_id) WHERE (deleted_at IS NULL)` |
| `return` | `return_pkey` | `CREATE UNIQUE INDEX return_pkey ON public.return USING btree (id)` |
| `return_fulfillment` | `IDX_deleted_at_-31ea43a` | `CREATE INDEX "IDX_deleted_at_-31ea43a" ON public.return_fulfillment USING btree (deleted_at)` |
| `return_fulfillment` | `IDX_fulfillment_id_-31ea43a` | `CREATE INDEX "IDX_fulfillment_id_-31ea43a" ON public.return_fulfillment USING btree (fulfillment_id) WHERE (deleted_at IS NULL)` |
| `return_fulfillment` | `IDX_id_-31ea43a` | `CREATE INDEX "IDX_id_-31ea43a" ON public.return_fulfillment USING btree (id)` |
| `return_fulfillment` | `IDX_return_id_-31ea43a` | `CREATE INDEX "IDX_return_id_-31ea43a" ON public.return_fulfillment USING btree (return_id) WHERE (deleted_at IS NULL)` |
| `return_fulfillment` | `return_fulfillment_pkey` | `CREATE UNIQUE INDEX return_fulfillment_pkey ON public.return_fulfillment USING btree (return_id, fulfillment_id)` |
| `return_item` | `IDX_return_item_deleted_at` | `CREATE INDEX "IDX_return_item_deleted_at" ON public.return_item USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `return_item` | `IDX_return_item_item_id` | `CREATE INDEX "IDX_return_item_item_id" ON public.return_item USING btree (item_id) WHERE (deleted_at IS NULL)` |
| `return_item` | `IDX_return_item_reason_id` | `CREATE INDEX "IDX_return_item_reason_id" ON public.return_item USING btree (reason_id) WHERE (deleted_at IS NULL)` |
| `return_item` | `IDX_return_item_return_id` | `CREATE INDEX "IDX_return_item_return_id" ON public.return_item USING btree (return_id) WHERE (deleted_at IS NULL)` |
| `return_item` | `return_item_pkey` | `CREATE UNIQUE INDEX return_item_pkey ON public.return_item USING btree (id)` |
| `return_reason` | `IDX_return_reason_parent_return_reason_id` | `CREATE INDEX "IDX_return_reason_parent_return_reason_id" ON public.return_reason USING btree (parent_return_reason_id) WHERE (deleted_at IS NULL)` |
| `return_reason` | `IDX_return_reason_value` | `CREATE INDEX "IDX_return_reason_value" ON public.return_reason USING btree (value) WHERE (deleted_at IS NULL)` |
| `return_reason` | `return_reason_pkey` | `CREATE UNIQUE INDEX return_reason_pkey ON public.return_reason USING btree (id)` |
| `rewards_fraud_review` | `IDX_rewards_fraud_review_event_id` | `CREATE INDEX "IDX_rewards_fraud_review_event_id" ON public.rewards_fraud_review USING btree (referral_event_id) WHERE (deleted_at IS NULL)` |
| `rewards_fraud_review` | `rewards_fraud_review_pkey` | `CREATE UNIQUE INDEX rewards_fraud_review_pkey ON public.rewards_fraud_review USING btree (id)` |
| `rewards_gift_card` | `IDX_rewards_gift_card_code` | `CREATE UNIQUE INDEX "IDX_rewards_gift_card_code" ON public.rewards_gift_card USING btree (code) WHERE (deleted_at IS NULL)` |
| `rewards_gift_card` | `rewards_gift_card_pkey` | `CREATE UNIQUE INDEX rewards_gift_card_pkey ON public.rewards_gift_card USING btree (id)` |
| `rewards_gift_card_transaction` | `IDX_rewards_gift_card_transaction_gift_card_id` | `CREATE INDEX "IDX_rewards_gift_card_transaction_gift_card_id" ON public.rewards_gift_card_transaction USING btree (gift_card_id) WHERE (deleted_at IS NULL)` |
| `rewards_gift_card_transaction` | `IDX_rewards_gift_card_transaction_idempotency_key` | `CREATE INDEX "IDX_rewards_gift_card_transaction_idempotency_key" ON public.rewards_gift_card_transaction USING btree (idempotency_key) WHERE (deleted_at IS NULL)` |
| `rewards_gift_card_transaction` | `rewards_gift_card_transaction_pkey` | `CREATE UNIQUE INDEX rewards_gift_card_transaction_pkey ON public.rewards_gift_card_transaction USING btree (id)` |
| `rewards_loyalty_ledger` | `IDX_rewards_loyalty_ledger_customer_id` | `CREATE UNIQUE INDEX "IDX_rewards_loyalty_ledger_customer_id" ON public.rewards_loyalty_ledger USING btree (customer_id) WHERE (deleted_at IS NULL)` |
| `rewards_loyalty_ledger` | `rewards_loyalty_ledger_pkey` | `CREATE UNIQUE INDEX rewards_loyalty_ledger_pkey ON public.rewards_loyalty_ledger USING btree (id)` |
| `rewards_loyalty_rule` | `rewards_loyalty_rule_pkey` | `CREATE UNIQUE INDEX rewards_loyalty_rule_pkey ON public.rewards_loyalty_rule USING btree (id)` |
| `rewards_loyalty_transaction` | `IDX_rewards_loyalty_transaction_ledger_id` | `CREATE INDEX "IDX_rewards_loyalty_transaction_ledger_id" ON public.rewards_loyalty_transaction USING btree (loyalty_ledger_id) WHERE (deleted_at IS NULL)` |
| `rewards_loyalty_transaction` | `rewards_loyalty_transaction_pkey` | `CREATE UNIQUE INDEX rewards_loyalty_transaction_pkey ON public.rewards_loyalty_transaction USING btree (id)` |
| `rewards_referral_code` | `IDX_rewards_referral_code_code` | `CREATE UNIQUE INDEX "IDX_rewards_referral_code_code" ON public.rewards_referral_code USING btree (code) WHERE (deleted_at IS NULL)` |
| `rewards_referral_code` | `IDX_rewards_referral_code_customer_id` | `CREATE UNIQUE INDEX "IDX_rewards_referral_code_customer_id" ON public.rewards_referral_code USING btree (customer_id) WHERE (deleted_at IS NULL)` |
| `rewards_referral_code` | `rewards_referral_code_pkey` | `CREATE UNIQUE INDEX rewards_referral_code_pkey ON public.rewards_referral_code USING btree (id)` |
| `rewards_referral_event` | `IDX_rewards_referral_event_code_id` | `CREATE INDEX "IDX_rewards_referral_event_code_id" ON public.rewards_referral_event USING btree (referral_code_id) WHERE (deleted_at IS NULL)` |
| `rewards_referral_event` | `IDX_rewards_referral_event_order_id` | `CREATE INDEX "IDX_rewards_referral_event_order_id" ON public.rewards_referral_event USING btree (order_id) WHERE (deleted_at IS NULL)` |
| `rewards_referral_event` | `IDX_rewards_referral_event_referee_id` | `CREATE INDEX "IDX_rewards_referral_event_referee_id" ON public.rewards_referral_event USING btree (referee_id) WHERE (deleted_at IS NULL)` |
| `rewards_referral_event` | `IDX_rewards_referral_event_referrer_id` | `CREATE INDEX "IDX_rewards_referral_event_referrer_id" ON public.rewards_referral_event USING btree (referrer_id) WHERE (deleted_at IS NULL)` |
| `rewards_referral_event` | `rewards_referral_event_pkey` | `CREATE UNIQUE INDEX rewards_referral_event_pkey ON public.rewards_referral_event USING btree (id)` |
| `rewards_referral_program` | `rewards_referral_program_pkey` | `CREATE UNIQUE INDEX rewards_referral_program_pkey ON public.rewards_referral_program USING btree (id)` |
| `rewards_referral_qualification` | `IDX_rewards_referral_qualification_event_id` | `CREATE UNIQUE INDEX "IDX_rewards_referral_qualification_event_id" ON public.rewards_referral_qualification USING btree (referral_event_id) WHERE (deleted_at IS NULL)` |
| `rewards_referral_qualification` | `rewards_referral_qualification_pkey` | `CREATE UNIQUE INDEX rewards_referral_qualification_pkey ON public.rewards_referral_qualification USING btree (id)` |
| `rewards_wallet` | `IDX_rewards_wallet_customer_id` | `CREATE UNIQUE INDEX "IDX_rewards_wallet_customer_id" ON public.rewards_wallet USING btree (customer_id) WHERE (deleted_at IS NULL)` |
| `rewards_wallet` | `rewards_wallet_pkey` | `CREATE UNIQUE INDEX rewards_wallet_pkey ON public.rewards_wallet USING btree (id)` |
| `rewards_wallet_transaction` | `IDX_rewards_wallet_transaction_wallet_id` | `CREATE INDEX "IDX_rewards_wallet_transaction_wallet_id" ON public.rewards_wallet_transaction USING btree (wallet_id) WHERE (deleted_at IS NULL)` |
| `rewards_wallet_transaction` | `rewards_wallet_transaction_pkey` | `CREATE UNIQUE INDEX rewards_wallet_transaction_pkey ON public.rewards_wallet_transaction USING btree (id)` |
| `sales_channel` | `IDX_sales_channel_deleted_at` | `CREATE INDEX "IDX_sales_channel_deleted_at" ON public.sales_channel USING btree (deleted_at)` |
| `sales_channel` | `sales_channel_pkey` | `CREATE UNIQUE INDEX sales_channel_pkey ON public.sales_channel USING btree (id)` |
| `sales_channel_stock_location` | `IDX_deleted_at_26d06f470` | `CREATE INDEX "IDX_deleted_at_26d06f470" ON public.sales_channel_stock_location USING btree (deleted_at)` |
| `sales_channel_stock_location` | `IDX_id_26d06f470` | `CREATE INDEX "IDX_id_26d06f470" ON public.sales_channel_stock_location USING btree (id)` |
| `sales_channel_stock_location` | `IDX_sales_channel_id_26d06f470` | `CREATE INDEX "IDX_sales_channel_id_26d06f470" ON public.sales_channel_stock_location USING btree (sales_channel_id) WHERE (deleted_at IS NULL)` |
| `sales_channel_stock_location` | `IDX_stock_location_id_26d06f470` | `CREATE INDEX "IDX_stock_location_id_26d06f470" ON public.sales_channel_stock_location USING btree (stock_location_id) WHERE (deleted_at IS NULL)` |
| `sales_channel_stock_location` | `sales_channel_stock_location_pkey` | `CREATE UNIQUE INDEX sales_channel_stock_location_pkey ON public.sales_channel_stock_location USING btree (sales_channel_id, stock_location_id)` |
| `script_migrations` | `idx_script_name_unique` | `CREATE UNIQUE INDEX idx_script_name_unique ON public.script_migrations USING btree (script_name)` |
| `script_migrations` | `script_migrations_pkey` | `CREATE UNIQUE INDEX script_migrations_pkey ON public.script_migrations USING btree (id)` |
| `security_blocked_ip` | `UQ_security_blocked_ip_ip_address` | `CREATE UNIQUE INDEX "UQ_security_blocked_ip_ip_address" ON public.security_blocked_ip USING btree (ip_address) WHERE (deleted_at IS NULL)` |
| `security_blocked_ip` | `security_blocked_ip_pkey` | `CREATE UNIQUE INDEX security_blocked_ip_pkey ON public.security_blocked_ip USING btree (id)` |
| `security_event` | `IDX_security_event_ip_address` | `CREATE INDEX "IDX_security_event_ip_address" ON public.security_event USING btree (ip_address) WHERE (deleted_at IS NULL)` |
| `security_event` | `IDX_security_event_user_id` | `CREATE INDEX "IDX_security_event_user_id" ON public.security_event USING btree (user_id) WHERE (deleted_at IS NULL)` |
| `security_event` | `security_event_pkey` | `CREATE UNIQUE INDEX security_event_pkey ON public.security_event USING btree (id)` |
| `security_ip_whitelist` | `security_ip_whitelist_pkey` | `CREATE UNIQUE INDEX security_ip_whitelist_pkey ON public.security_ip_whitelist USING btree (id)` |
| `security_user_two_factor` | `UQ_security_user_two_factor_user_id` | `CREATE UNIQUE INDEX "UQ_security_user_two_factor_user_id" ON public.security_user_two_factor USING btree (user_id) WHERE (deleted_at IS NULL)` |
| `security_user_two_factor` | `security_user_two_factor_pkey` | `CREATE UNIQUE INDEX security_user_two_factor_pkey ON public.security_user_two_factor USING btree (id)` |
| `service_zone` | `IDX_service_zone_deleted_at` | `CREATE INDEX "IDX_service_zone_deleted_at" ON public.service_zone USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `service_zone` | `IDX_service_zone_fulfillment_set_id` | `CREATE INDEX "IDX_service_zone_fulfillment_set_id" ON public.service_zone USING btree (fulfillment_set_id) WHERE (deleted_at IS NULL)` |
| `service_zone` | `IDX_service_zone_name_unique` | `CREATE UNIQUE INDEX "IDX_service_zone_name_unique" ON public.service_zone USING btree (name) WHERE (deleted_at IS NULL)` |
| `service_zone` | `service_zone_pkey` | `CREATE UNIQUE INDEX service_zone_pkey ON public.service_zone USING btree (id)` |
| `setting` | `IDX_setting_group_key` | `CREATE UNIQUE INDEX "IDX_setting_group_key" ON public.setting USING btree ("group", key) WHERE (deleted_at IS NULL)` |
| `setting` | `setting_pkey` | `CREATE UNIQUE INDEX setting_pkey ON public.setting USING btree (id)` |
| `shipping_option` | `IDX_shipping_option_deleted_at` | `CREATE INDEX "IDX_shipping_option_deleted_at" ON public.shipping_option USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `shipping_option` | `IDX_shipping_option_provider_id` | `CREATE INDEX "IDX_shipping_option_provider_id" ON public.shipping_option USING btree (provider_id) WHERE (deleted_at IS NULL)` |
| `shipping_option` | `IDX_shipping_option_service_zone_id` | `CREATE INDEX "IDX_shipping_option_service_zone_id" ON public.shipping_option USING btree (service_zone_id) WHERE (deleted_at IS NULL)` |
| `shipping_option` | `IDX_shipping_option_shipping_option_type_id` | `CREATE INDEX "IDX_shipping_option_shipping_option_type_id" ON public.shipping_option USING btree (shipping_option_type_id) WHERE (deleted_at IS NULL)` |
| `shipping_option` | `IDX_shipping_option_shipping_profile_id` | `CREATE INDEX "IDX_shipping_option_shipping_profile_id" ON public.shipping_option USING btree (shipping_profile_id) WHERE (deleted_at IS NULL)` |
| `shipping_option` | `shipping_option_pkey` | `CREATE UNIQUE INDEX shipping_option_pkey ON public.shipping_option USING btree (id)` |
| `shipping_option_price_set` | `IDX_deleted_at_ba32fa9c` | `CREATE INDEX "IDX_deleted_at_ba32fa9c" ON public.shipping_option_price_set USING btree (deleted_at)` |
| `shipping_option_price_set` | `IDX_id_ba32fa9c` | `CREATE INDEX "IDX_id_ba32fa9c" ON public.shipping_option_price_set USING btree (id)` |
| `shipping_option_price_set` | `IDX_price_set_id_ba32fa9c` | `CREATE INDEX "IDX_price_set_id_ba32fa9c" ON public.shipping_option_price_set USING btree (price_set_id) WHERE (deleted_at IS NULL)` |
| `shipping_option_price_set` | `IDX_shipping_option_id_ba32fa9c` | `CREATE INDEX "IDX_shipping_option_id_ba32fa9c" ON public.shipping_option_price_set USING btree (shipping_option_id) WHERE (deleted_at IS NULL)` |
| `shipping_option_price_set` | `shipping_option_price_set_pkey` | `CREATE UNIQUE INDEX shipping_option_price_set_pkey ON public.shipping_option_price_set USING btree (shipping_option_id, price_set_id)` |
| `shipping_option_rule` | `IDX_shipping_option_rule_deleted_at` | `CREATE INDEX "IDX_shipping_option_rule_deleted_at" ON public.shipping_option_rule USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `shipping_option_rule` | `IDX_shipping_option_rule_shipping_option_id` | `CREATE INDEX "IDX_shipping_option_rule_shipping_option_id" ON public.shipping_option_rule USING btree (shipping_option_id) WHERE (deleted_at IS NULL)` |
| `shipping_option_rule` | `shipping_option_rule_pkey` | `CREATE UNIQUE INDEX shipping_option_rule_pkey ON public.shipping_option_rule USING btree (id)` |
| `shipping_option_type` | `IDX_shipping_option_type_deleted_at` | `CREATE INDEX "IDX_shipping_option_type_deleted_at" ON public.shipping_option_type USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `shipping_option_type` | `shipping_option_type_pkey` | `CREATE UNIQUE INDEX shipping_option_type_pkey ON public.shipping_option_type USING btree (id)` |
| `shipping_profile` | `IDX_shipping_profile_deleted_at` | `CREATE INDEX "IDX_shipping_profile_deleted_at" ON public.shipping_profile USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `shipping_profile` | `IDX_shipping_profile_name_unique` | `CREATE UNIQUE INDEX "IDX_shipping_profile_name_unique" ON public.shipping_profile USING btree (name) WHERE (deleted_at IS NULL)` |
| `shipping_profile` | `shipping_profile_pkey` | `CREATE UNIQUE INDEX shipping_profile_pkey ON public.shipping_profile USING btree (id)` |
| `shop` | `shop_pkey` | `CREATE UNIQUE INDEX shop_pkey ON public.shop USING btree (id)` |
| `shop_manager` | `IDX_shop_manager_shop_id` | `CREATE INDEX "IDX_shop_manager_shop_id" ON public.shop_manager USING btree (shop_id) WHERE (deleted_at IS NULL)` |
| `shop_manager` | `shop_manager_pkey` | `CREATE UNIQUE INDEX shop_manager_pkey ON public.shop_manager USING btree (id)` |
| `shopmodule_shop_deliverymodule_delivery` | `IDX_deleted_at_44b31ea` | `CREATE INDEX "IDX_deleted_at_44b31ea" ON public.shopmodule_shop_deliverymodule_delivery USING btree (deleted_at)` |
| `shopmodule_shop_deliverymodule_delivery` | `IDX_delivery_id_44b31ea` | `CREATE INDEX "IDX_delivery_id_44b31ea" ON public.shopmodule_shop_deliverymodule_delivery USING btree (delivery_id) WHERE (deleted_at IS NULL)` |
| `shopmodule_shop_deliverymodule_delivery` | `IDX_id_44b31ea` | `CREATE INDEX "IDX_id_44b31ea" ON public.shopmodule_shop_deliverymodule_delivery USING btree (id)` |
| `shopmodule_shop_deliverymodule_delivery` | `IDX_shop_id_44b31ea` | `CREATE INDEX "IDX_shop_id_44b31ea" ON public.shopmodule_shop_deliverymodule_delivery USING btree (shop_id) WHERE (deleted_at IS NULL)` |
| `shopmodule_shop_deliverymodule_delivery` | `shopmodule_shop_deliverymodule_delivery_pkey` | `CREATE UNIQUE INDEX shopmodule_shop_deliverymodule_delivery_pkey ON public.shopmodule_shop_deliverymodule_delivery USING btree (shop_id, delivery_id)` |
| `shopmodule_shop_product_product` | `IDX_deleted_at_f5e225e` | `CREATE INDEX "IDX_deleted_at_f5e225e" ON public.shopmodule_shop_product_product USING btree (deleted_at)` |
| `shopmodule_shop_product_product` | `IDX_id_f5e225e` | `CREATE INDEX "IDX_id_f5e225e" ON public.shopmodule_shop_product_product USING btree (id)` |
| `shopmodule_shop_product_product` | `IDX_product_id_f5e225e` | `CREATE INDEX "IDX_product_id_f5e225e" ON public.shopmodule_shop_product_product USING btree (product_id) WHERE (deleted_at IS NULL)` |
| `shopmodule_shop_product_product` | `IDX_shop_id_f5e225e` | `CREATE INDEX "IDX_shop_id_f5e225e" ON public.shopmodule_shop_product_product USING btree (shop_id) WHERE (deleted_at IS NULL)` |
| `shopmodule_shop_product_product` | `shopmodule_shop_product_product_pkey` | `CREATE UNIQUE INDEX shopmodule_shop_product_product_pkey ON public.shopmodule_shop_product_product USING btree (shop_id, product_id)` |
| `slot_reservation` | `IDX_slot_reservation_branch_id` | `CREATE INDEX "IDX_slot_reservation_branch_id" ON public.slot_reservation USING btree (branch_id) WHERE (deleted_at IS NULL)` |
| `slot_reservation` | `IDX_slot_reservation_deleted_at` | `CREATE INDEX "IDX_slot_reservation_deleted_at" ON public.slot_reservation USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `slot_reservation` | `slot_reservation_pkey` | `CREATE UNIQUE INDEX slot_reservation_pkey ON public.slot_reservation USING btree (id)` |
| `stock_location` | `IDX_stock_location_address_id_unique` | `CREATE UNIQUE INDEX "IDX_stock_location_address_id_unique" ON public.stock_location USING btree (address_id) WHERE (deleted_at IS NULL)` |
| `stock_location` | `IDX_stock_location_deleted_at` | `CREATE INDEX "IDX_stock_location_deleted_at" ON public.stock_location USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `stock_location` | `stock_location_pkey` | `CREATE UNIQUE INDEX stock_location_pkey ON public.stock_location USING btree (id)` |
| `stock_location_address` | `IDX_stock_location_address_deleted_at` | `CREATE INDEX "IDX_stock_location_address_deleted_at" ON public.stock_location_address USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `stock_location_address` | `stock_location_address_pkey` | `CREATE UNIQUE INDEX stock_location_address_pkey ON public.stock_location_address USING btree (id)` |
| `stock_notification` | `IDX_stock_notification_product_id` | `CREATE INDEX "IDX_stock_notification_product_id" ON public.stock_notification USING btree (product_id) WHERE (deleted_at IS NULL)` |
| `stock_notification` | `IDX_stock_notification_status` | `CREATE INDEX "IDX_stock_notification_status" ON public.stock_notification USING btree (status) WHERE (deleted_at IS NULL)` |
| `stock_notification` | `stock_notification_pkey` | `CREATE UNIQUE INDEX stock_notification_pkey ON public.stock_notification USING btree (id)` |
| `store` | `IDX_store_deleted_at` | `CREATE INDEX "IDX_store_deleted_at" ON public.store USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `store` | `store_pkey` | `CREATE UNIQUE INDEX store_pkey ON public.store USING btree (id)` |
| `store_currency` | `IDX_store_currency_deleted_at` | `CREATE INDEX "IDX_store_currency_deleted_at" ON public.store_currency USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `store_currency` | `IDX_store_currency_store_id` | `CREATE INDEX "IDX_store_currency_store_id" ON public.store_currency USING btree (store_id) WHERE (deleted_at IS NULL)` |
| `store_currency` | `store_currency_pkey` | `CREATE UNIQUE INDEX store_currency_pkey ON public.store_currency USING btree (id)` |
| `store_locale` | `IDX_store_locale_deleted_at` | `CREATE INDEX "IDX_store_locale_deleted_at" ON public.store_locale USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `store_locale` | `IDX_store_locale_store_id` | `CREATE INDEX "IDX_store_locale_store_id" ON public.store_locale USING btree (store_id) WHERE (deleted_at IS NULL)` |
| `store_locale` | `store_locale_pkey` | `CREATE UNIQUE INDEX store_locale_pkey ON public.store_locale USING btree (id)` |
| `subscription` | `IDX_subscription_customer_id` | `CREATE INDEX "IDX_subscription_customer_id" ON public.subscription USING btree (customer_id) WHERE (deleted_at IS NULL)` |
| `subscription` | `IDX_subscription_next_date` | `CREATE INDEX "IDX_subscription_next_date" ON public.subscription USING btree (next_date) WHERE (deleted_at IS NULL)` |
| `subscription` | `IDX_subscription_status` | `CREATE INDEX "IDX_subscription_status" ON public.subscription USING btree (status) WHERE (deleted_at IS NULL)` |
| `subscription` | `subscription_pkey` | `CREATE UNIQUE INDEX subscription_pkey ON public.subscription USING btree (id)` |
| `support_ticket` | `IDX_support_ticket_customer_id` | `CREATE INDEX "IDX_support_ticket_customer_id" ON public.support_ticket USING btree (customer_id) WHERE (deleted_at IS NULL)` |
| `support_ticket` | `UQ_support_ticket_ticket_no` | `CREATE UNIQUE INDEX "UQ_support_ticket_ticket_no" ON public.support_ticket USING btree (ticket_no) WHERE (deleted_at IS NULL)` |
| `support_ticket` | `support_ticket_pkey` | `CREATE UNIQUE INDEX support_ticket_pkey ON public.support_ticket USING btree (id)` |
| `tax_provider` | `IDX_tax_provider_deleted_at` | `CREATE INDEX "IDX_tax_provider_deleted_at" ON public.tax_provider USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `tax_provider` | `tax_provider_pkey` | `CREATE UNIQUE INDEX tax_provider_pkey ON public.tax_provider USING btree (id)` |
| `tax_rate` | `IDX_single_default_region` | `CREATE UNIQUE INDEX "IDX_single_default_region" ON public.tax_rate USING btree (tax_region_id) WHERE ((is_default = true) AND (deleted_at IS NULL))` |
| `tax_rate` | `IDX_tax_rate_deleted_at` | `CREATE INDEX "IDX_tax_rate_deleted_at" ON public.tax_rate USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `tax_rate` | `IDX_tax_rate_tax_region_id` | `CREATE INDEX "IDX_tax_rate_tax_region_id" ON public.tax_rate USING btree (tax_region_id) WHERE (deleted_at IS NULL)` |
| `tax_rate` | `tax_rate_pkey` | `CREATE UNIQUE INDEX tax_rate_pkey ON public.tax_rate USING btree (id)` |
| `tax_rate_rule` | `IDX_tax_rate_rule_deleted_at` | `CREATE INDEX "IDX_tax_rate_rule_deleted_at" ON public.tax_rate_rule USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `tax_rate_rule` | `IDX_tax_rate_rule_reference_id` | `CREATE INDEX "IDX_tax_rate_rule_reference_id" ON public.tax_rate_rule USING btree (reference_id) WHERE (deleted_at IS NULL)` |
| `tax_rate_rule` | `IDX_tax_rate_rule_tax_rate_id` | `CREATE INDEX "IDX_tax_rate_rule_tax_rate_id" ON public.tax_rate_rule USING btree (tax_rate_id) WHERE (deleted_at IS NULL)` |
| `tax_rate_rule` | `IDX_tax_rate_rule_unique_rate_reference` | `CREATE UNIQUE INDEX "IDX_tax_rate_rule_unique_rate_reference" ON public.tax_rate_rule USING btree (tax_rate_id, reference_id) WHERE (deleted_at IS NULL)` |
| `tax_rate_rule` | `tax_rate_rule_pkey` | `CREATE UNIQUE INDEX tax_rate_rule_pkey ON public.tax_rate_rule USING btree (id)` |
| `tax_region` | `IDX_tax_region_deleted_at` | `CREATE INDEX "IDX_tax_region_deleted_at" ON public.tax_region USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `tax_region` | `IDX_tax_region_parent_id` | `CREATE INDEX "IDX_tax_region_parent_id" ON public.tax_region USING btree (parent_id)` |
| `tax_region` | `IDX_tax_region_provider_id` | `CREATE INDEX "IDX_tax_region_provider_id" ON public.tax_region USING btree (provider_id) WHERE (deleted_at IS NULL)` |
| `tax_region` | `IDX_tax_region_unique_country_nullable_province` | `CREATE UNIQUE INDEX "IDX_tax_region_unique_country_nullable_province" ON public.tax_region USING btree (country_code) WHERE ((province_code IS NULL) AND (deleted_at IS NULL))` |
| `tax_region` | `IDX_tax_region_unique_country_province` | `CREATE UNIQUE INDEX "IDX_tax_region_unique_country_province" ON public.tax_region USING btree (country_code, province_code) WHERE (deleted_at IS NULL)` |
| `tax_region` | `tax_region_pkey` | `CREATE UNIQUE INDEX tax_region_pkey ON public.tax_region USING btree (id)` |
| `ticket_message` | `IDX_ticket_message_ticket_id` | `CREATE INDEX "IDX_ticket_message_ticket_id" ON public.ticket_message USING btree (ticket_id) WHERE (deleted_at IS NULL)` |
| `ticket_message` | `ticket_message_pkey` | `CREATE UNIQUE INDEX ticket_message_pkey ON public.ticket_message USING btree (id)` |
| `translation` | `IDX_translation_language_code` | `CREATE INDEX "IDX_translation_language_code" ON public.translation USING btree (language_code) WHERE (deleted_at IS NULL)` |
| `translation` | `translation_pkey` | `CREATE UNIQUE INDEX translation_pkey ON public.translation USING btree (id)` |
| `user` | `IDX_user_deleted_at` | `CREATE INDEX "IDX_user_deleted_at" ON public."user" USING btree (deleted_at) WHERE (deleted_at IS NOT NULL)` |
| `user` | `IDX_user_email_unique` | `CREATE UNIQUE INDEX "IDX_user_email_unique" ON public."user" USING btree (email) WHERE (deleted_at IS NULL)` |
| `user` | `user_pkey` | `CREATE UNIQUE INDEX user_pkey ON public."user" USING btree (id)` |
| `user_preference` | `IDX_user_preference_deleted_at` | `CREATE INDEX "IDX_user_preference_deleted_at" ON public.user_preference USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `user_preference` | `IDX_user_preference_user_id` | `CREATE INDEX "IDX_user_preference_user_id" ON public.user_preference USING btree (user_id) WHERE (deleted_at IS NULL)` |
| `user_preference` | `IDX_user_preference_user_id_key_unique` | `CREATE UNIQUE INDEX "IDX_user_preference_user_id_key_unique" ON public.user_preference USING btree (user_id, key) WHERE (deleted_at IS NULL)` |
| `user_preference` | `user_preference_pkey` | `CREATE UNIQUE INDEX user_preference_pkey ON public.user_preference USING btree (id)` |
| `user_rbac_role` | `IDX_deleted_at_64ff0c4c` | `CREATE INDEX "IDX_deleted_at_64ff0c4c" ON public.user_rbac_role USING btree (deleted_at)` |
| `user_rbac_role` | `IDX_id_64ff0c4c` | `CREATE INDEX "IDX_id_64ff0c4c" ON public.user_rbac_role USING btree (id)` |
| `user_rbac_role` | `IDX_rbac_role_id_64ff0c4c` | `CREATE INDEX "IDX_rbac_role_id_64ff0c4c" ON public.user_rbac_role USING btree (rbac_role_id) WHERE (deleted_at IS NULL)` |
| `user_rbac_role` | `IDX_user_id_64ff0c4c` | `CREATE INDEX "IDX_user_id_64ff0c4c" ON public.user_rbac_role USING btree (user_id) WHERE (deleted_at IS NULL)` |
| `user_rbac_role` | `user_rbac_role_pkey` | `CREATE UNIQUE INDEX user_rbac_role_pkey ON public.user_rbac_role USING btree (user_id, rbac_role_id)` |
| `variant_option` | `variant_option_pkey` | `CREATE UNIQUE INDEX variant_option_pkey ON public.variant_option USING btree (id)` |
| `view_configuration` | `IDX_view_configuration_deleted_at` | `CREATE INDEX "IDX_view_configuration_deleted_at" ON public.view_configuration USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `view_configuration` | `IDX_view_configuration_entity_is_system_default` | `CREATE INDEX "IDX_view_configuration_entity_is_system_default" ON public.view_configuration USING btree (entity, is_system_default) WHERE (deleted_at IS NULL)` |
| `view_configuration` | `IDX_view_configuration_entity_user_id` | `CREATE INDEX "IDX_view_configuration_entity_user_id" ON public.view_configuration USING btree (entity, user_id) WHERE (deleted_at IS NULL)` |
| `view_configuration` | `IDX_view_configuration_user_id` | `CREATE INDEX "IDX_view_configuration_user_id" ON public.view_configuration USING btree (user_id) WHERE (deleted_at IS NULL)` |
| `view_configuration` | `view_configuration_pkey` | `CREATE UNIQUE INDEX view_configuration_pkey ON public.view_configuration USING btree (id)` |
| `webhook_delivery` | `IDX_webhook_delivery_webhook_id` | `CREATE INDEX "IDX_webhook_delivery_webhook_id" ON public.webhook_delivery USING btree (webhook_id) WHERE (deleted_at IS NULL)` |
| `webhook_delivery` | `webhook_delivery_pkey` | `CREATE UNIQUE INDEX webhook_delivery_pkey ON public.webhook_delivery USING btree (id)` |
| `webhook_endpoint` | `IDX_webhook_endpoint_is_active` | `CREATE INDEX "IDX_webhook_endpoint_is_active" ON public.webhook_endpoint USING btree (is_active) WHERE (deleted_at IS NULL)` |
| `webhook_endpoint` | `webhook_endpoint_pkey` | `CREATE UNIQUE INDEX webhook_endpoint_pkey ON public.webhook_endpoint USING btree (id)` |
| `wishlist_item` | `IDX_wishlist_item_customer_id` | `CREATE INDEX "IDX_wishlist_item_customer_id" ON public.wishlist_item USING btree (customer_id) WHERE (deleted_at IS NULL)` |
| `wishlist_item` | `IDX_wishlist_item_customer_product` | `CREATE UNIQUE INDEX "IDX_wishlist_item_customer_product" ON public.wishlist_item USING btree (customer_id, product_id) WHERE (deleted_at IS NULL)` |
| `wishlist_item` | `wishlist_item_pkey` | `CREATE UNIQUE INDEX wishlist_item_pkey ON public.wishlist_item USING btree (id)` |
| `workflow_execution` | `IDX_workflow_execution_deleted_at` | `CREATE INDEX "IDX_workflow_execution_deleted_at" ON public.workflow_execution USING btree (deleted_at) WHERE (deleted_at IS NULL)` |
| `workflow_execution` | `IDX_workflow_execution_id` | `CREATE INDEX "IDX_workflow_execution_id" ON public.workflow_execution USING btree (id) WHERE (deleted_at IS NULL)` |
| `workflow_execution` | `IDX_workflow_execution_retention_time_updated_at_state` | `CREATE INDEX "IDX_workflow_execution_retention_time_updated_at_state" ON public.workflow_execution USING btree (retention_time, updated_at, state) WHERE ((deleted_at IS NULL) AND (retention_time IS NOT NULL))` |
| `workflow_execution` | `IDX_workflow_execution_run_id` | `CREATE INDEX "IDX_workflow_execution_run_id" ON public.workflow_execution USING btree (run_id) WHERE (deleted_at IS NULL)` |
| `workflow_execution` | `IDX_workflow_execution_state` | `CREATE INDEX "IDX_workflow_execution_state" ON public.workflow_execution USING btree (state) WHERE (deleted_at IS NULL)` |
| `workflow_execution` | `IDX_workflow_execution_state_updated_at` | `CREATE INDEX "IDX_workflow_execution_state_updated_at" ON public.workflow_execution USING btree (state, updated_at) WHERE (deleted_at IS NULL)` |
| `workflow_execution` | `IDX_workflow_execution_transaction_id` | `CREATE INDEX "IDX_workflow_execution_transaction_id" ON public.workflow_execution USING btree (transaction_id) WHERE (deleted_at IS NULL)` |
| `workflow_execution` | `IDX_workflow_execution_updated_at_retention_time` | `CREATE INDEX "IDX_workflow_execution_updated_at_retention_time" ON public.workflow_execution USING btree (updated_at, retention_time) WHERE ((deleted_at IS NULL) AND (retention_time IS NOT NULL) AND ((state)::text = ANY ((ARRAY['done'::character varying, 'failed'::character varying, 'reverted'::character varying])::text[])))` |
| `workflow_execution` | `IDX_workflow_execution_workflow_id` | `CREATE INDEX "IDX_workflow_execution_workflow_id" ON public.workflow_execution USING btree (workflow_id) WHERE (deleted_at IS NULL)` |
| `workflow_execution` | `IDX_workflow_execution_workflow_id_transaction_id` | `CREATE INDEX "IDX_workflow_execution_workflow_id_transaction_id" ON public.workflow_execution USING btree (workflow_id, transaction_id) WHERE (deleted_at IS NULL)` |
| `workflow_execution` | `IDX_workflow_execution_workflow_id_transaction_id_run_id_unique` | `CREATE UNIQUE INDEX "IDX_workflow_execution_workflow_id_transaction_id_run_id_unique" ON public.workflow_execution USING btree (workflow_id, transaction_id, run_id) WHERE (deleted_at IS NULL)` |
| `workflow_execution` | `workflow_execution_pkey` | `CREATE UNIQUE INDEX workflow_execution_pkey ON public.workflow_execution USING btree (workflow_id, transaction_id, run_id)` |

---

## 3. API Route Handler Audit (Phase 9)

| API Route | Handler File | Auth Protected | Direct DB Access | Schema Validation | Error Handling | Dynamic |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/auth/logout` | `src/app/api/auth/logout/route.ts` | ✓ YES | — | ✓ YES | ⚠️ NO | ✓ |
| `/api/auth/me` | `src/app/api/auth/me/route.ts` | ✓ YES | ✓ YES | ✓ YES | ✓ YES | ✓ |
| `/api/auth/session` | `src/app/api/auth/session/route.ts` | ✓ YES | — | — | ✓ YES | ✓ |
| `/api/customer/address` | `src/app/api/customer/address/route.ts` | ✓ YES | ✓ YES | ✓ YES | ✓ YES | ✓ |
| `/api/customer/me` | `src/app/api/customer/me/route.ts` | ✓ YES | ✓ YES | — | ✓ YES | ✓ |
| `/api/customer/orders` | `src/app/api/customer/orders/route.ts` | ✓ YES | ✓ YES | ✓ YES | ✓ YES | ✓ |
| `/api/customer/profile` | `src/app/api/customer/profile/route.ts` | ✓ YES | ✓ YES | ✓ YES | ✓ YES | ✓ |
| `/api/subscribe` | `src/app/api/subscribe/route.ts` | — Public | — | — | ⚠️ NO | ✓ |
| `/api/v1/accessories` | `src/app/api/v1/accessories/route.ts` | — Public | ✓ YES | — | ✓ YES | ✓ |
| `/api/v1/admin/accessories` | `src/app/api/v1/admin/accessories/route.ts` | — Public | ✓ YES | — | ✓ YES | ✓ |
| `/api/v1/admin/ai/analytics` | `src/app/api/v1/admin/ai/analytics/route.ts` | — Public | — | — | ✓ YES | ✓ |
| `/api/v1/admin/ai/reindex` | `src/app/api/v1/admin/ai/reindex/route.ts` | — Public | — | — | ✓ YES | ✓ |
| `/api/v1/admin/branches` | `src/app/api/v1/admin/branches/route.ts` | — Public | ✓ YES | — | ✓ YES | ✓ |
| `/api/v1/ai/chat` | `src/app/api/v1/ai/chat/route.ts` | — Public | — | ✓ YES | ✓ YES | ✓ |
| `/api/v1/ai/context` | `src/app/api/v1/ai/context/route.ts` | — Public | — | — | ✓ YES | ✓ |
| `/api/v1/branches` | `src/app/api/v1/branches/route.ts` | — Public | ✓ YES | ✓ YES | ✓ YES | ✓ |
| `/api/v1/[...path]` | `src/app/api/v1/[...path]/route.ts` | ✓ YES | ✓ YES | ✓ YES | ✓ YES | ✓ |

---

## 4. Build-Time Database Access Audit (Phase 11)

1. **Hydration Trigger during Build**:
   - Next.js build invokes static route evaluation for 28 pre-rendered routes.
   - During page data collection, `ApiEngine.initialize()` hydrates the in-memory cache directly from PostgreSQL (`Hydrated store: 54 branches, 14 products...`).
2. **Is it required at build time?**:
   - **NO.** Routes pre-rendered as static shell do not require real-time database row locking during CI/build.
   - Recommendation: Decouple store hydration so that build-time page data collection gracefully renders static loading/skeleton shells, while runtime requests query PostgreSQL with connection pooling.

---

## 5. force-dynamic Route Classification (Phase 12)

Total routes declaring `force-dynamic`: **43**

| Classification | Count | Action Plan |
| :--- | :--- | :--- |
| **COOKIE DEPENDENT** | 2 | Keep dynamic. Relies on session token (`_cth_jwt`). |
| **SEARCH PARAMS DEPENDENT** | 7 | Keep dynamic. Relies on live search/filter queries. |
| **DATABASE DEPENDENT** | 8 | Evaluate ISR (`revalidate: 300`) where safe (e.g. blog, city, occasion). |
| **UNNECESSARILY DYNAMIC** | 26 | Convert to static pre-rendering (`○ Static`). |

### Detailed Route-by-Route Breakdown:
| File | Classification | Cookies | Headers | Search Params | DB Access | Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `src/app/(checkout)/checkout/page.tsx` | **COOKIE DEPENDENT** | ✓ | — | — | — | Relies on request cookies (auth token / session). Must remain dynamic. |
| `src/app/(checkout)/layout.tsx` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/(checkout)/your-order/page.tsx` | **COOKIE DEPENDENT** | ✓ | — | ✓ | — | Relies on request cookies (auth token / session). Must remain dynamic. |
| `src/app/(store)/blog/[slug]/page.tsx` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/(store)/campaigns/[id]/page.tsx` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/(store)/category/[slug]/page.tsx` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/(store)/city/[slug]/page.tsx` | **DATABASE DEPENDENT** | — | — | — | ✓ | Reads live PostgreSQL state. Can potentially use ISR (revalidate) instead of force-dynamic. |
| `src/app/(store)/occasions/[slug]/page.tsx` | **DATABASE DEPENDENT** | — | — | — | ✓ | Reads live PostgreSQL state. Can potentially use ISR (revalidate) instead of force-dynamic. |
| `src/app/(store)/page.tsx` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/(store)/qr/[code]/page.tsx` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/(store)/shop/[handle]/page.tsx` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/(store)/[slug]/page.tsx` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/account/addresses/page.tsx` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/account/layout.tsx` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/account/orders/page.tsx` | **DATABASE DEPENDENT** | — | — | — | ✓ | Reads live PostgreSQL state. Can potentially use ISR (revalidate) instead of force-dynamic. |
| `src/app/account/orders/[id]/page.tsx` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/account/page.tsx` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/account/subscriptions/page.tsx` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/account/wallet/page.tsx` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/account/wishlist/page.tsx` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/api/auth/logout/route.ts` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/api/auth/me/route.ts` | **DATABASE DEPENDENT** | — | — | — | ✓ | Reads live PostgreSQL state. Can potentially use ISR (revalidate) instead of force-dynamic. |
| `src/app/api/auth/session/route.ts` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/api/customer/address/route.ts` | **SEARCH PARAMS DEPENDENT** | — | — | ✓ | ✓ | Relies on query string (?q=..., ?category=...). Dynamic at runtime. |
| `src/app/api/customer/me/route.ts` | **DATABASE DEPENDENT** | — | — | — | ✓ | Reads live PostgreSQL state. Can potentially use ISR (revalidate) instead of force-dynamic. |
| `src/app/api/customer/orders/route.ts` | **DATABASE DEPENDENT** | — | — | — | ✓ | Reads live PostgreSQL state. Can potentially use ISR (revalidate) instead of force-dynamic. |
| `src/app/api/customer/profile/route.ts` | **DATABASE DEPENDENT** | — | — | — | ✓ | Reads live PostgreSQL state. Can potentially use ISR (revalidate) instead of force-dynamic. |
| `src/app/api/subscribe/route.ts` | **SEARCH PARAMS DEPENDENT** | — | — | ✓ | — | Relies on query string (?q=..., ?category=...). Dynamic at runtime. |
| `src/app/api/v1/accessories/route.ts` | **SEARCH PARAMS DEPENDENT** | — | — | ✓ | ✓ | Relies on query string (?q=..., ?category=...). Dynamic at runtime. |
| `src/app/api/v1/admin/accessories/route.ts` | **SEARCH PARAMS DEPENDENT** | — | — | ✓ | ✓ | Relies on query string (?q=..., ?category=...). Dynamic at runtime. |
| `src/app/api/v1/admin/ai/analytics/route.ts` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/api/v1/admin/ai/reindex/route.ts` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/api/v1/admin/branches/route.ts` | **SEARCH PARAMS DEPENDENT** | — | — | ✓ | ✓ | Relies on query string (?q=..., ?category=...). Dynamic at runtime. |
| `src/app/api/v1/ai/chat/route.ts` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/api/v1/ai/context/route.ts` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/api/v1/branches/route.ts` | **SEARCH PARAMS DEPENDENT** | — | — | ✓ | ✓ | Relies on query string (?q=..., ?category=...). Dynamic at runtime. |
| `src/app/api/v1/[...path]/route.ts` | **SEARCH PARAMS DEPENDENT** | — | — | ✓ | ✓ | Relies on query string (?q=..., ?category=...). Dynamic at runtime. |
| `src/app/dashboard/delivery-partner/page.tsx` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/dashboard/layout.tsx` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/dashboard/shop/menu/page.tsx` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/dashboard/shop/page.tsx` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/layout.tsx` | **UNNECESSARILY DYNAMIC** | — | — | — | — | No request cookies, headers, or query parameters used. Candidate for static generation or ISR. |
| `src/app/sitemap.ts` | **DATABASE DEPENDENT** | — | — | — | ✓ | Reads live PostgreSQL state. Can potentially use ISR (revalidate) instead of force-dynamic. |
