# CAKETOHOME — PHASE 6.2 REVISION HISTORY & ROLLBACK REPORT
**Phase:** 6.2 — Workstream K  
**Author:** Database Architect & Release Engineer  
**Status:** VERIFIED  

---

### 1. Revision Snapshot Mechanism
Whenever a page is published:
1. `CmsRepository.publishPage` reads current page blocks and metadata.
2. Computes `version = MAX(version) + 1`.
3. Inserts immutable row into `cms_revision`.
4. Saves `published_config = blocks` on `cms_page`.

### 2. Rollback Execution
When an administrator triggers `POST /api/v1/cms/pages/:id/rollback` with a version number:
1. Queries `cms_revision` for snapshot.
2. Restores snapshot content into `cms_page.blocks`.
3. Revalidates storefront path immediately.
4. Verified via Test 7 in `test_phase6_2_cms_lifecycle.cjs`.
