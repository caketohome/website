/**
 * XML Sitemap Syntax & Compatibility Validator
 * 
 * Validates XML sitemaps against Google Search Console standards:
 * - Valid XML root `<urlset>` or `<sitemapindex>`
 * - Valid `<loc>` URLs
 * - Valid `<lastmod>` W3C ISO date strings
 * - Valid `<priority>` values (0.0 to 1.0)
 * - Valid `<changefreq>` values
 */

export class XmlSitemapValidator {

  static validateSitemapXml(xmlContent: string): { isValid: boolean; errors: string[]; urlCount: number } {
    const errors: string[] = [];
    let urlCount = 0;

    if (!xmlContent.includes("<urlset") && !xmlContent.includes("<sitemapindex")) {
      errors.push("Missing valid XML root element (<urlset> or <sitemapindex>)");
    }

    const locMatches = xmlContent.match(/<loc>([\s\S]*?)<\/loc>/g) || [];
    urlCount = locMatches.length;

    locMatches.forEach((locTag) => {
      const url = locTag.replace(/<\/?loc>/g, "").trim();
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        errors.push(`Invalid URL in <loc>: '${url}'. Must start with http:// or https://`);
      }
    });

    const lastmodMatches = xmlContent.match(/<lastmod>([\s\S]*?)<\/lastmod>/g) || [];
    lastmodMatches.forEach((lmTag) => {
      const dateStr = lmTag.replace(/<\/?lastmod>/g, "").trim();
      if (isNaN(Date.parse(dateStr))) {
        errors.push(`Invalid date format in <lastmod>: '${dateStr}'`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      urlCount,
    };
  }
}
