# CAKETOHOME — PHASE 6.2 DATABASE DESIGN SPECIFICATION
**Phase:** 6.2 — Workstream K  
**Author:** Database Architect  
**Status:** VERIFIED  

---

### 1. Schema Design Principles
1. **Additive Only:** No existing columns dropped or renamed. Existing data in `order`, `invoice`, and `payment_transaction` preserved 100%.
2. **PostgreSQL JSONB:** Block layouts stored as JSONB in `cms_page.blocks` for dynamic extensibility.
3. **Immutable History:** `cms_revision` snapshots capture immutable JSONB representations of published versions.
4. **Soft Deletes:** All entities feature `deleted_at TIMESTAMP WITH TIME ZONE NULL`.

### 2. Indexes Implemented
- `idx_cms_page_slug`: UNIQUE BTREE on `cms_page(slug)` WHERE deleted_at IS NULL.
- `idx_cms_page_status`: BTREE on `cms_page(status)`.
- `idx_cms_page_scheduled`: BTREE on `cms_page(scheduled_at)` WHERE status = 'scheduled'.
- `idx_cms_revision_page_id`: BTREE on `cms_revision(page_id, version DESC)`.
- `idx_cms_redirect_from`: UNIQUE BTREE on `cms_redirect(from_path)`.
