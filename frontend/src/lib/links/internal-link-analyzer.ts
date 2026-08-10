/**
 * Internal Link Graph & PageRank Analyzer
 * 
 * Analyzes internal site topology:
 * - Maps inbound (inlinks) & outbound (outlinks) links per page
 * - Classifies pages into:
 *     • orphan: 0 inbound links
 *     • weak: 1 inbound link
 *     • optimal: 2-5 inbound links
 *     • authority_hub: 6+ inbound links
 * - Finds high-value internal link insertion opportunities
 */

export interface PageLinkMetrics {
  url: string;
  entityType: string;
  inboundCount: number;
  outboundCount: number;
  classification: "orphan" | "weak" | "optimal" | "authority_hub";
  inboundSources: string[];
  suggestedTargetLinks: { targetUrl: string; anchorText: string; reason: string }[];
}

export class InternalLinkGraphAnalyzer {

  static analyzeLinkGraph(pages: any[], internalLinks: any[]): {
    metrics: PageLinkMetrics[];
    orphanCount: number;
    weakCount: number;
    authorityCount: number;
  } {
    const inboundMap: Record<string, string[]> = {};
    const outboundMap: Record<string, string[]> = {};

    // Initialize map
    pages.forEach((p) => {
      const u = p.url || `/${p.slug}`;
      inboundMap[u] = [];
      outboundMap[u] = [];
    });

    // Populate from internalLinks
    internalLinks.forEach((link) => {
      if (outboundMap[link.source_url]) outboundMap[link.source_url].push(link.target_url);
      if (!inboundMap[link.target_url]) inboundMap[link.target_url] = [];
      inboundMap[link.target_url].push(link.source_url);
    });

    let orphanCount = 0;
    let weakCount = 0;
    let authorityCount = 0;

    const metrics: PageLinkMetrics[] = pages.map((p) => {
      const u = p.url || `/${p.slug}`;
      const inlinks = inboundMap[u] || [];
      const outlinks = outboundMap[u] || [];
      const inboundCount = inlinks.length;
      const outboundCount = outlinks.length;

      let classification: "orphan" | "weak" | "optimal" | "authority_hub" = "optimal";
      if (inboundCount === 0 && u !== "/" && !u.endsWith("/sitemap.xml")) {
        classification = "orphan";
        orphanCount++;
      } else if (inboundCount === 1) {
        classification = "weak";
        weakCount++;
      } else if (inboundCount >= 6) {
        classification = "authority_hub";
        authorityCount++;
      }

      // Generate suggested target links
      const suggestions: { targetUrl: string; anchorText: string; reason: string }[] = [];
      if (p.entity_type === "product") {
        suggestions.push({
          targetUrl: "/categories/artisanal-cakes",
          anchorText: "Explore Artisanal Cakes",
          reason: "Link product to parent category hub",
        });
      } else if (p.entity_type === "branch") {
        suggestions.push({
          targetUrl: "/products",
          anchorText: "Order Cakes Online",
          reason: "Link local branch page to main product catalog",
        });
      }

      return {
        url: u,
        entityType: p.entity_type || "page",
        inboundCount,
        outboundCount,
        classification,
        inboundSources: inlinks,
        suggestedTargetLinks: suggestions,
      };
    });

    return {
      metrics,
      orphanCount,
      weakCount,
      authorityCount,
    };
  }
}
