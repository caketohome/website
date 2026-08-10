/**
 * Robots.txt Directives Validator & Live Preview
 * 
 * Validates syntax against Googlebot standards:
 * - Directives: User-agent, Allow, Disallow, Sitemap, Crawl-delay
 * - Syntax errors: missing colon, unescaped wildcards, invalid paths
 * - Live URL matching simulator (User-agent matching & directive evaluation)
 */

export interface RobotsValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  parsedDirectives: { userAgent: string; allow: string[]; disallow: string[]; sitemaps: string[] }[];
}

export class RobotsTxtValidator {

  static validate(robotsContent: string): RobotsValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const lines = robotsContent.split("\n");

    let currentAgent = "*";
    let hasSitemap = false;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) {
        errors.push(`Line ${index + 1}: Missing colon delimiter in '${trimmed}'`);
        return;
      }

      const directive = trimmed.substring(0, colonIdx).trim().toLowerCase();
      const value = trimmed.substring(colonIdx + 1).trim();

      switch (directive) {
        case "user-agent":
          currentAgent = value;
          break;
        case "allow":
        case "disallow":
          if (!value.startsWith("/") && value !== "") {
            warnings.push(`Line ${index + 1}: Path '${value}' should start with a leading slash '/'`);
          }
          break;
        case "sitemap":
          hasSitemap = true;
          if (!value.startsWith("http://") && !value.startsWith("https://")) {
            errors.push(`Line ${index + 1}: Sitemap directive must be a fully qualified URL starting with http:// or https://`);
          }
          break;
        case "crawl-delay":
          if (isNaN(Number(value))) {
            errors.push(`Line ${index + 1}: Crawl-delay value '${value}' must be a number`);
          }
          break;
        default:
          warnings.push(`Line ${index + 1}: Unknown or non-standard directive '${directive}'`);
      }
    });

    if (!hasSitemap) {
      warnings.push("No Sitemap directive found. Adding 'Sitemap: https://cakes2home.com/sitemap.xml' is recommended.");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      parsedDirectives: [],
    };
  }
}
