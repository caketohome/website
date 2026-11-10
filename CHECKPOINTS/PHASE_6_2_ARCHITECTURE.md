# CAKETOHOME — PHASE 6.2 ARCHITECTURE DESIGN DOCUMENT
**Phase:** 6.2 — Workstream K  
**Author:** Principal Software Architect  
**Status:** VERIFIED  

---

### 1. High-Level Architecture Diagram

```mermaid
flowchart TD
    Admin[Authorized Admin] -->|Configures Pages & Blocks| Configurator[PageConfigurator UI]
    Configurator -->|REST API /api/v1/cms/*| ApiRouter[Next.js App Router API]
    ApiRouter -->|Validates & Coordinates| CmsRepo[CmsRepository]
    CmsRepo -->|Reads/Writes| Postgres[(PostgreSQL 16 Engine)]
    Postgres -->|Tables: cms_page, cms_revision, cms_block, media| DBData[CMS Relational Data]
    CmsRepo -->|Cache Revalidation| NextCache[Next.js on-demand revalidatePath]
    Customer[Storefront Customer] -->|Navigates /[slug]| PageRenderer[Storefront PageRenderer]
    PageRenderer -->|Queries published content| CmsRepo
    PageRenderer -->|Binds dynamic products| ProductRepo[ProductRepository]
    ProductRepo -->|Queries active catalog| ProductTable[(public.product)]
```

### 2. Architectural Boundaries & Isolation
1. **Commerce Funnels Protected:** Static route paths for `/checkout`, `/your-order`, `/cart`, `/admin`, and `/dashboard` take precedence over `/[slug]`.
2. **Cashfree-Only Isolation:** CMS block templates cannot invoke payment endpoints or alter transaction flows.
3. **Error Boundaries:** Each section within `PageRenderer` is isolated in an error boundary.
