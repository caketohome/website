# CMS Security and RLS Audit

## 1. Cross-Site Scripting (XSS) Prevention
- **Rich Text Blocks:** `page-renderer.tsx` renders text blocks using standard React JSX interpolation (`<div>{content}</div>`). React natively escapes all HTML entities, neutralizing injection attacks.
- **Image Uploads:** Prohibits SVG, XML, and executable payloads.
- **Inline Scripts:** No user-controlled text is injected into `dangerouslySetInnerHTML` tags.

## 2. Access Control & Tenant Scope
- Public storefront APIs only expose pages where `status = 'published'` and `deleted_at IS NULL`.
- Draft content and revision histories are strictly restricted to authenticated Admin roles.
