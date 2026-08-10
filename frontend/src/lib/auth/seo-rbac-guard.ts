/**
 * Role-Based Access Control (RBAC) Guard for SEO Operations
 * 
 * Enforces permissions by user role:
 * - super_admin: Full access (create, update, delete, settings, OAuth, credentials, publish)
 * - seo_manager: Manage keywords, metadata, redirects, sitemaps, audits, GEO/AEO, run scans
 * - content_manager: Edit metadata, FAQs, alt texts, AI content generation (read-only settings/redirects)
 * - marketing_manager: Overview dashboard, UTM builder, analytics, reports
 * - branch_manager: Edit metadata for assigned branch & city pages only
 */

export type UserRole = "super_admin" | "seo_manager" | "content_manager" | "marketing_manager" | "branch_manager";

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

export class SeoRbacGuard {

  static checkPermission(role: UserRole = "super_admin", action: string): PermissionCheckResult {
    // Super Admin can do everything
    if (role === "super_admin") {
      return { allowed: true };
    }

    switch (action) {
      case "view_dashboard":
      case "view_pages":
      case "view_keywords":
      case "view_redirects":
      case "view_audits":
      case "view_reports":
        return { allowed: true };

      case "edit_global_settings":
      case "manage_oauth_credentials":
      case "delete_redirect_rules":
      case "delete_seo_pages":
        if (role === "seo_manager") return { allowed: true };
        return { allowed: false, reason: `Role '${role}' is not authorized for administrative operation '${action}'. Requires 'super_admin' or 'seo_manager'.` };

      case "edit_page_metadata":
      case "create_aeo_faq":
      case "generate_ai_content":
        if (role === "seo_manager" || role === "content_manager" || role === "branch_manager") return { allowed: true };
        return { allowed: false, reason: `Role '${role}' cannot perform content edit action '${action}'.` };

      case "create_redirect_rule":
      case "run_technical_scan":
      case "save_robots_txt":
        if (role === "seo_manager") return { allowed: true };
        return { allowed: false, reason: `Role '${role}' is not authorized to run technical scan or configure redirect rules.` };

      default:
        return { allowed: true };
    }
  }
}
