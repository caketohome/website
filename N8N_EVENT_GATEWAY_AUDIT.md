# CakeToHome — n8n Event Gateway Architecture Audit

## 1. Executive Summary
This document provides an exhaustive technical audit of the current event dispatch, webhook, and n8n automation infrastructure in CakeToHome.

---

## 2. Current Endpoint Architecture
- **Multi-Endpoint Model vs Single Gateway**:
  - The previous system allowed creating arbitrary endpoint records (`ep_*`), which created ambiguity over whether separate webhook endpoints should be configured for each automation workflow (e.g., cart recovery vs orders vs CRM).
  - The platform baseline already configured a primary endpoint:
    `ep_n8n_production` $\rightarrow$ `https://n8n.caketohome.com/webhook/v1/caketohome-events`.
  - In practice, n8n best practice dictates having **ONE primary webhook receiver** per environment, which receives all business events in a standardized envelope and uses a Switch/Router node inside n8n to direct events to specialized child workflows.

---

## 3. Current Event Architecture & Envelope
- **Current Canonical Envelope**:
  - `event_id`: Unique prefixed ID (`evt_<timestamp>_<random>`).
  - `event_type`: Dot-notated string (e.g. `order.created`, `cart.abandoned`, `customer.reorder_candidate.created`).
  - `event_version`: Integer version (default `1`).
  - `occurred_at`: ISO 8601 UTC timestamp.
  - `producer`: `"caketohome"`.
  - `source`: `"caketohome"`.
  - `environment`: `"production" | "staging" | "development"`.
  - `request_id`: Tracing request ID.
  - `correlation_id`: Distributed correlation ID.
  - `customer_uid`: Canonical customer identifier (`cth_cus_*`).
  - `order_id` / `store_id` / `branch_id` / `city_id`: Multi-city and branch routing metadata.
  - `idempotency_key`: Deduplication key (`idem_evt_*`).
  - `payload` & `data`: Sanitized business event attributes.

---

## 4. Current Transactional Outbox
- **Outbox Pattern**:
  - When business operations occur (e.g. `order.created`, `cart.abandoned`, `customer.registered`), the event is persisted into the `WebhookOutboxItem` table atomically within the application store.
  - Outbox status begins as `PENDING`.
  - An asynchronous background worker (`dispatchPendingWebhooks`) queries pending items whose `next_attempt_at <= now` and processes them in batches.
  - External network calls are **never** executed inside the customer request database transaction. If the network or n8n is slow or unreachable, the customer checkout/login is unaffected.

---

## 5. Current Event Routing & Workflow Integration
- **Event Catalogue**: 34+ distinct business events classified across 11 domains:
  - `AUTH`: `customer.login.success`, `customer.login.failed`, `customer.logout`, `customer.registered`
  - `PROFILE`: `customer.profile.updated`, `customer.address.updated`
  - `CART`: `cart.created`, `cart.updated`, `cart.item.added`, `cart.item.removed`, `cart.abandoned`, `cart.recovered`
  - `CHECKOUT`: `checkout.started`, `checkout.completed`, `checkout.failed`
  - `ORDER`: `order.created`, `order.paid`, `order.confirmed`, `order.preparing`, `order.ready`, `order.out_for_delivery`, `order.delivered`, `order.cancelled`, `order.refund.processed`
  - `DELIVERY`: `delivery.assigned`, `delivery.picked_up`, `delivery.failed`, `delivery.delivered`
  - `RECOVERY`: `recovery.link.created`, `recovery.link.opened`, `recovery.message.sent`, `recovery.message.clicked`, `recovery.converted`
  - `REORDER_CRM`: `customer.reorder_candidate.created`, `customer.reorder_candidate.updated`, `customer.reorder_converted`
  - `WISHLIST`: `wishlist.item.added`, `wishlist.item.removed`
  - `MARKETING`: `popup.impression`, `popup.clicked`, `coupon.applied`, `campaign.converted`
  - `SYSTEM`: `test.webhook.ping`, `test.caketohome`

---

## 6. Current Security & Cryptographic Signing
- **HMAC-SHA256 Signing**:
  - Each outgoing request includes header: `X-CakeToHome-Signature: t=<timestamp>,v1=<hexDigest>`.
  - Signature computed over `${timestamp}.${bodyJson}` using the endpoint's configured secret.
  - Verification uses timing-safe buffer comparison (`crypto.timingSafeEqual`) to prevent timing attacks.
  - Clock skew protection rejects requests where `|now - timestamp| > 300` seconds.
- **Sensitive Field Sanitization**:
  - Strict recursive scrubber eliminates passwords, OTPs, raw JWTs, session tokens, and credit card CVVs before outbox persistence and webhook transmission.

---

## 7. Current Retries & Dead Letter Queue (DLQ)
- **Exponential Backoff**:
  - Attempts: $1$ to $5$.
  - Backoff formula: $\min(3600, 4^{\text{attempt}-1} \times 5) + \text{jitter}$ seconds ($5\text{s} \rightarrow 20\text{s} \rightarrow 80\text{s} \rightarrow 320\text{s}$).
- **Dead Letter Queue (DLQ)**:
  - If attempts reach `max_attempts` (default 5) without HTTP 2xx, status transitions to `DEAD_LETTER`.
  - Admin UI provides DLQ inspection, error cause analysis, manual replay, and discard capabilities.

---

## 8. Current Admin UI
- Tab in Admin Dashboard: `webhooks` ("🔌 n8n Webhooks").
- Component: `frontend/src/components/dashboard/admin/webhooks-panel.tsx`.
- Features: Endpoint configuration, Subscriptions, Outbox & DLQ tables, Delivery logs with payload preview modal, Diagnostic test ping.
- **Identified Improvement Areas**:
  1. Clearly rebrand to **Enterprise Event Gateway & n8n Automation**.
  2. Enforce the **Single Primary Endpoint per Environment** architecture.
  3. Introduce the **Event Router & Workflow Registry** visualization showing how `event_type` maps to downstream n8n workflows without separate endpoints.
  4. Display real-time telemetry and end-to-end diagnostic suite.
