# CMS Bug Reproduction Register

| Bug ID | Title | Reproduction Steps | Root Cause | Impact | Status |
|---|---|---|---|---|---|
| **BUG-CMS-01** | Missing Columns in `cms_page` | Run `SELECT id, type, status, blocks FROM cms_page` in `cth_test`. | Baseline `cth_test` created with 4-column stub table; `CREATE TABLE IF NOT EXISTS` skipped MikroORM migration. | Queries fail with `column "type" does not exist`. Admin cannot save or list pages. | **FIXED via Migration c7_15** |
| **BUG-CMS-02** | Missing Columns in `cms_homepage_section` | Run `SELECT id, name, section_type FROM cms_homepage_section` in `cth_test`. | Stub table in baseline had only 3 columns (`id`, `sort_order`, `created_at`). | Queries fail with `column "name" does not exist`. | **FIXED via Migration c7_15** |
| **BUG-CMS-03** | Missing Relational Tables | Query `media` or `cms_revision` in `cth_test`. | Tables were never created in frontend PostgreSQL schema. | Revisions and media uploads throw relation not found errors. | **FIXED via Migration c7_15** |
| **BUG-CMS-04** | Silent Catch in `findPageBySlug` | Request non-existent or failing page query. | `try ... catch` in `cms.repository.ts` logged a warning and returned `null`, masking DB schema errors. | Frontend fell back to empty page without notifying admin. | **FIXED & REHEARSED** |
| **BUG-CMS-05** | Missing Baseline Homepage Row | Query `SELECT * FROM cms_page WHERE id = 'cmspg_home'`. | Table was completely empty (0 rows). | Storefront rendered fallback empty view. | **SEEDED in Rehearsal** |
