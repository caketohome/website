# CAKETOHOME — PHASE 6.2 API CONTRACTS & OPENAPI SPECIFICATION
**Phase:** 6.2 — Workstream K  
**Author:** Backend/API Engineer  
**Status:** VERIFIED  

---

### 1. Primary API Endpoints

#### `GET /api/v1/cms/pages`
- **Response:** `200 OK`
- **Body:** `{ pages: CmsPage[], total: number }`

#### `GET /api/v1/cms/pages/:slug`
- **Response:** `200 OK` | `404 Not Found`
- **Body:** `{ page: CmsPage, success: boolean }`

#### `POST /api/v1/cms/pages`
- **Payload:** `{ title: string, slug: string, type: string, status?: string, blocks: any[], meta_title?: string }`
- **Response:** `200 OK`
- **Body:** `{ page: CmsPage, success: true }`

#### `PUT /api/v1/cms/pages/:id`
- **Payload:** `Partial<CmsPage>`
- **Response:** `200 OK`
- **Body:** `{ page: CmsPage, success: true }`

#### `POST /api/v1/cms/pages/:id/publish`
- **Response:** `200 OK`
- **Body:** `{ success: true, page: CmsPage }`

#### `POST /api/v1/cms/pages/:id/rollback`
- **Payload:** `{ version: number }`
- **Response:** `200 OK`
- **Body:** `{ success: true, page: CmsPage }`

#### `POST /api/v1/cms/jobs/publish-scheduled`
- **Response:** `200 OK`
- **Body:** `{ success: true, processed: number, published: string[] }`
