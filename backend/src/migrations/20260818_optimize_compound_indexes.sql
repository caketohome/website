-- CakeToHome — Forward Database Optimization Migration
-- Version: 3.0.1
-- Purpose: Add high-throughput compound indexes for CRM, Outbox, Telemarketing, and Analytics

-- 1. CRM Customer Activity Timeline Index (Optimizes Customer 360 drawer and audit queries)
CREATE INDEX IF NOT EXISTS idx_activity_customer_uid_created 
ON customer_activity_log(customer_uid, created_at DESC);

-- 2. Transactional Webhook Outbox Pending Dispatch Partial Index (Optimizes worker polling)
CREATE INDEX IF NOT EXISTS idx_outbox_pending_dispatch 
ON webhook_outbox(status, next_attempt_at) 
WHERE status = 'PENDING';

-- 3. Telemarketing Outreach Candidate Queue Filter Index (Optimizes priority calling list retrieval)
CREATE INDEX IF NOT EXISTS idx_telemarketing_queue_filter 
ON telemarketing_candidate(contact_status, priority, expected_date);

-- 4. Storefront Engagement Popup Impression Analytics Compound Index
CREATE INDEX IF NOT EXISTS idx_popup_impressions_analytics 
ON popup_impressions(popup_campaign_id, created_at DESC);
