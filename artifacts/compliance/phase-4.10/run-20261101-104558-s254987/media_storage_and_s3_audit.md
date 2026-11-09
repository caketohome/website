# Media Storage and AWS S3 Audit

## 1. Media Pipeline
1. **Client-Side Compression:** `cms-image-uploader.tsx` automatically compresses uploads to WebP via canvas resizing before sending payloads.
2. **Security Filtering:**
   - SVG uploads are strictly prohibited to prevent stored XML/SVG XSS.
   - Files containing `<svg`, `<?xml`, or `<script` are instantly rejected with HTTP 400.
3. **Server-Side Sharp Processing:** `MediaProcessor` generates WebP and AVIF variants, extracts dimensions, computes blur placeholders, and calculates SHA-256 content hashes.
4. **Relational Registry:** Assets are indexed in the `media` table with folder classification.

## 2. AWS S3 Deployment Readiness
For cloud production:
- S3 presigned PUT URLs handle direct browser-to-bucket uploads.
- CDN distribution (CloudFront) serves optimized public media.
- Credentials remain strictly server-side; zero AWS keys exposed in client bundles.
