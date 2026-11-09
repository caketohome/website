# Database Schema and Relationship Audit

## 1. `cms_page` Table Schema (Post-Migration c7_15)
- `id` (text, PK)
- `slug` (text, unique per language)
- `title` (text, NOT NULL)
- `type` (text, DEFAULT 'landing')
- `status` (text, DEFAULT 'draft' — 'draft', 'published', 'archived')
- `blocks` (text/JSON)
- `meta_title` (text)
- `meta_description` (text)
- `canonical_url` (text)
- `og_image` (text)
- `author` (text)
- `excerpt` (text)
- `featured_image` (text)
- `reading_time` (integer, DEFAULT 0)
- `published_at` (timestamptz)
- `archived_at` (timestamptz)
- `language_code` (text, DEFAULT 'en')
- `template_id` (text)
- `category_id` (text)
- `parent_id` (text)
- `sort_order` (integer, DEFAULT 0)
- `breadcrumb_title` (text)
- `url_path` (text)
- `robots_tag` (text, DEFAULT 'index, follow')
- `twitter_card` (text, DEFAULT 'summary_large_image')
- `structured_data_type` (text, DEFAULT 'WebPage')
- `visibility_rules` (text/JSON)
- `nav_location` (text, DEFAULT 'none')
- `hide_from_nav` (boolean, DEFAULT false)
- `analytics_summary` (text/JSON)
- `created_at` (timestamptz, DEFAULT now())
- `updated_at` (timestamptz, DEFAULT now())
- `deleted_at` (timestamptz)

## 2. Relational Indexes & Constraints
- `IDX_cms_page_slug_lang`: UNIQUE on `("slug", "language_code") WHERE deleted_at IS NULL`
- `IDX_cms_page_type_status`: Index on `("type", "status") WHERE deleted_at IS NULL`
- `IDX_cms_revision_page`: Index on `("page_id") WHERE deleted_at IS NULL`
- `IDX_media_folder`: Index on `("folder") WHERE deleted_at IS NULL`
