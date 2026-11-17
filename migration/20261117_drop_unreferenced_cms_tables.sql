-- Drop CMS tables no code references. Rows backed up to backups/20261117_dropped_tables_backup.json.
-- No CASCADE: fails if anything depends on them. tax_provider kept (tax_region FK depends on it).
BEGIN;
DROP TABLE IF EXISTS public.cms_page_template;
DROP TABLE IF EXISTS public.cms_theme_setting;
COMMIT;
