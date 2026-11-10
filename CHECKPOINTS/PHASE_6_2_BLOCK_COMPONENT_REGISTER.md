# CAKETOHOME — PHASE 6.2 BLOCK COMPONENT REGISTER
**Phase:** 6.2 — Workstream K  
**Author:** Senior Full-Stack Engineer  
**Status:** VERIFIED  

---

### 1. Component Register (45+ Section Types)

| Block Type | Category | Description | Primary Props |
| :--- | :--- | :--- | :--- |
| **`hero`** | Banners | Full-width or split hero with headline, subheadline, image, and CTA buttons. | `title`, `subtitle`, `imageUrl`, `ctaText`, `ctaUrl` |
| **`features`** | Value Props | Multi-column feature grid displaying value propositions and icons. | `title`, `features: [{ icon, title, description }]` |
| **`product_grid`** | Commerce | Dynamic PIM catalog grid querying products from PostgreSQL. | `category`, `limit`, `sortBy`, `showPrice` |
| **`category_strip`** | Navigation | Circular or card category navigation strip. | `categories: [{ name, slug, image }]` |
| **`testimonials`** | Social Proof | Customer review slider/grid with star ratings and photos. | `items: [{ name, comment, rating, avatar }]` |
| **`faq`** | Content | Collapsible accordion FAQ list with schema markup. | `faqs: [{ question, answer }]` |
| **`usp_banner`** | Trust | Compact delivery/freshness guarantee bar. | `text`, `icon`, `backgroundColor` |
| **`rich_text`** | Content | Sanitized markdown / WYSIWYG article text block. | `htmlContent`, `alignment` |
| **`cta`** | Conversion | High-contrast call to action banner. | `headline`, `buttonText`, `buttonUrl` |
| **`contact_form`** | Interactive | Customer inquiry form with branch routing. | `fields`, `submitEndpoint`, `recipientEmail` |
