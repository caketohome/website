# CMS Architecture Inventory

## 1. Core Architecture Pattern: Hybrid Relational-Document Model
CakeToHome implements a hybrid CMS architecture:
- **Relational Tables:** Manage page metadata, routing, status lifecycle, revisions, and media assets:
  - `cms_page`: Core entity (`id`, `slug`, `title`, `type`, `status`, `published_at`, `updated_at`)
  - `cms_revision`: Immutable historical version snapshots
  - `media`: Asset storage registry with WebP/AVIF variants and dimensions
  - `cms_homepage_section`: Standalone modular sections
  - `cms_navigation`: Hierarchical menu trees
  - `cms_banner`: Promotional hero banners
  - `cms_redirect`: 301/302 path redirects
- **JSON Document Block Composition:** Within `cms_page.blocks`, rich hierarchical structures are stored:
  - `sections`: Ordered array of active page sections
  - `draft_config`: In-flight editor state
  - `published_config`: Authoritative public storefront configuration
  - `version_history`: In-line version log

## 2. Component Structure
- **Admin Configurator:** `frontend/src/components/dashboard/admin/page-configurator.tsx`
- **Storefront Renderer:** `frontend/src/components/store/cms/page-renderer.tsx`
- **Section Registry:** `frontend/src/lib/cms/section-registry.ts` (12 section categories, 28+ section types)
- **Data Access:** `frontend/src/lib/repositories/cms.repository.ts` and `frontend/src/lib/data/cms.ts`
- **Media Processor:** `frontend/src/lib/util/image-compressor.ts` and `MediaProcessor` (Sharp)
