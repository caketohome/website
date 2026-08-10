/**
 * Comprehensive SEO Audit & Fix Engine
 * 
 * Classifies audit findings into actionable issues with:
 * - Severity: critical | warning | info
 * - Priority Score: 1-100
 * - Fix Status: open | in_progress | fixed | ignored
 * - Automated Auto-Fix Remediations
 */

export interface SeoIssue {
  id: string;
  category: "meta" | "content" | "image" | "redirect" | "link" | "schema" | "speed";
  severity: "critical" | "warning" | "info";
  priority: number;
  title: string;
  description: string;
  page_url: string;
  entity_type?: string;
  entity_id?: string;
  recommendation: string;
  auto_fixable: boolean;
  status: "open" | "in_progress" | "fixed" | "ignored";
  found_at: string;
  fixed_at?: string;
}

export class SeoAuditEngine {

  /**
   * Run complete technical audit across all pages, images, links & metadata
   */
  static generateAuditIssues(
    pages: any[],
    imageAudits: any[],
    brokenLinks: any[],
    redirects: any[]
  ): SeoIssue[] {
    const issues: SeoIssue[] = [];

    // 1. Audit Pages
    pages.forEach((p) => {
      // Missing Meta Title (Critical, Priority 95)
      if (!p.meta_title || p.meta_title.trim() === "") {
        issues.push({
          id: `iss_title_${p.id}`,
          category: "meta",
          severity: "critical",
          priority: 95,
          title: "Missing Meta Title",
          description: `Page '${p.url || p.slug}' has no <title> tag configured.`,
          page_url: p.url || `/${p.slug}`,
          entity_type: p.entity_type,
          entity_id: p.entity_id || p.id,
          recommendation: "Add a unique, keyword-rich meta title between 50 and 60 characters.",
          auto_fixable: true,
          status: "open",
          found_at: new Date().toISOString(),
        });
      } else if (p.meta_title.length < 30 || p.meta_title.length > 70) {
        issues.push({
          id: `iss_title_len_${p.id}`,
          category: "meta",
          severity: "warning",
          priority: 60,
          title: "Sub-optimal Meta Title Length",
          description: `Meta title length is ${p.meta_title.length} characters (optimal is 50-60).`,
          page_url: p.url || `/${p.slug}`,
          entity_type: p.entity_type,
          entity_id: p.entity_id || p.id,
          recommendation: "Adjust title length to be between 50 and 60 characters for best Google display.",
          auto_fixable: true,
          status: "open",
          found_at: new Date().toISOString(),
        });
      }

      // Missing Meta Description (Critical, Priority 90)
      if (!p.meta_description || p.meta_description.trim() === "") {
        issues.push({
          id: `iss_desc_${p.id}`,
          category: "meta",
          severity: "critical",
          priority: 90,
          title: "Missing Meta Description",
          description: `Page '${p.url || p.slug}' has no meta description tag.`,
          page_url: p.url || `/${p.slug}`,
          entity_type: p.entity_type,
          entity_id: p.entity_id || p.id,
          recommendation: "Add a compelling meta description between 140 and 160 characters with call-to-action.",
          auto_fixable: true,
          status: "open",
          found_at: new Date().toISOString(),
        });
      }

      // Missing H1 (Warning, Priority 80)
      if (!p.h1_text && (p.h1_count || 0) === 0) {
        issues.push({
          id: `iss_h1_${p.id}`,
          category: "content",
          severity: "warning",
          priority: 80,
          title: "Missing H1 Heading Tag",
          description: `Page '${p.url || p.slug}' lacks a primary <h1> heading.`,
          page_url: p.url || `/${p.slug}`,
          entity_type: p.entity_type,
          entity_id: p.entity_id || p.id,
          recommendation: "Add a single <h1> heading tag containing the target page keyword.",
          auto_fixable: true,
          status: "open",
          found_at: new Date().toISOString(),
        });
      }

      // Missing Canonical URL (Warning, Priority 75)
      if (!p.canonical_url) {
        issues.push({
          id: `iss_canon_${p.id}`,
          category: "meta",
          severity: "warning",
          priority: 75,
          title: "Missing Canonical Tag",
          description: `Page '${p.url || p.slug}' does not specify a canonical URL.`,
          page_url: p.url || `/${p.slug}`,
          entity_type: p.entity_type,
          entity_id: p.entity_id || p.id,
          recommendation: "Set a canonical URL pointing to the definitive version of this page.",
          auto_fixable: true,
          status: "open",
          found_at: new Date().toISOString(),
        });
      }

      // Missing Schema Markup (Warning, Priority 70)
      if (!p.has_schema) {
        issues.push({
          id: `iss_schema_${p.id}`,
          category: "schema",
          severity: "warning",
          priority: 70,
          title: "Missing Structured Data (JSON-LD)",
          description: `Page '${p.url || p.slug}' has no Schema.org JSON-LD markup.`,
          page_url: p.url || `/${p.slug}`,
          entity_type: p.entity_type,
          entity_id: p.entity_id || p.id,
          recommendation: "Add relevant Schema.org markup (Product, LocalBusiness, Bakery, FAQPage).",
          auto_fixable: true,
          status: "open",
          found_at: new Date().toISOString(),
        });
      }

      // Thin Content (Warning, Priority 65)
      if ((p.word_count || 0) < 300) {
        issues.push({
          id: `iss_thin_${p.id}`,
          category: "content",
          severity: "warning",
          priority: 65,
          title: "Thin Content Detected",
          description: `Page has only ${p.word_count || 0} words (recommended minimum is 300 words).`,
          page_url: p.url || `/${p.slug}`,
          entity_type: p.entity_type,
          entity_id: p.entity_id || p.id,
          recommendation: "Expand content to provide thorough topic coverage (aim for 500+ words).",
          auto_fixable: false,
          status: "open",
          found_at: new Date().toISOString(),
        });
      }
    });

    // 2. Audit Image Alt Attributes (Critical, Priority 85)
    imageAudits.forEach((img, idx) => {
      if (!img.has_alt) {
        issues.push({
          id: `iss_img_alt_${idx}`,
          category: "image",
          severity: "critical",
          priority: 85,
          title: "Product Image Missing ALT Text",
          description: `Image '${img.image_url}' on '${img.page_url}' is missing ALT attribute.`,
          page_url: img.page_url,
          entity_type: img.entity_type,
          entity_id: img.entity_id,
          recommendation: `Add descriptive alt text: '${img.suggested_alt || "CakeToHome Bakery Product"}'`,
          auto_fixable: true,
          status: "open",
          found_at: new Date().toISOString(),
        });
      }
    });

    // 3. Audit Broken Links (Critical, Priority 100)
    brokenLinks.forEach((bl, idx) => {
      if (!bl.is_resolved) {
        issues.push({
          id: `iss_broken_${idx}`,
          category: "link",
          severity: "critical",
          priority: 100,
          title: "404 Broken Internal Link",
          description: `Page '${bl.sourceUrl}' links to broken target '${bl.broken_url || bl.targetUrl}'.`,
          page_url: bl.sourceUrl,
          recommendation: "Create a 301 redirect or update the broken anchor link.",
          auto_fixable: true,
          status: "open",
          found_at: new Date().toISOString(),
        });
      }
    });

    // Sort by priority descending
    return issues.sort((a, b) => b.priority - a.priority);
  }
}
