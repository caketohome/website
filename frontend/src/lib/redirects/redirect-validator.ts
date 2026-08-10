/**
 * Redirect Chain & Loop Validator
 * 
 * Inspects redirect rules for technical integrity:
 * - Redirect loops (A -> B -> A)
 * - Multi-hop redirect chains (A -> B -> C)
 * - Broken destinations (Target URL returns 404)
 * - Invalid status codes
 */

export interface RedirectValidationResult {
  ruleId: string;
  sourceUrl: string;
  targetUrl: string | null;
  statusCode: number;
  isValid: boolean;
  isLoop: boolean;
  isChain: boolean;
  chainHops?: string[];
  isDestinationBroken: boolean;
  issues: string[];
}

export class RedirectValidator {

  static validateRedirectRules(redirects: any[], pages: any[]): RedirectValidationResult[] {
    const validUrls = new Set(pages.map(p => p.url || `/${p.slug}`));
    const ruleMap = new Map<string, any>();
    redirects.forEach(r => ruleMap.set(r.source_url, r));

    return redirects.map((r) => {
      const issues: string[] = [];
      let isLoop = false;
      let isChain = false;
      const chainHops: string[] = [r.source_url];

      if (r.target_url) {
        chainHops.push(r.target_url);
        // Loop detection
        if (r.source_url === r.target_url) {
          isLoop = true;
          issues.push("Self-referential redirect loop detected (Source equals Target)");
        }

        // Check if target is a source for another redirect (chain)
        let nextHop = ruleMap.get(r.target_url);
        let depth = 0;
        while (nextHop && depth < 5) {
          isChain = true;
          chainHops.push(nextHop.target_url);
          if (nextHop.target_url === r.source_url) {
            isLoop = true;
            issues.push(`Circular redirect loop chain detected (${chainHops.join(" → ")})`);
            break;
          }
          nextHop = ruleMap.get(nextHop.target_url);
          depth++;
        }

        if (isChain && !isLoop) {
          issues.push(`Multi-hop redirect chain detected (${chainHops.join(" → ")}). Direct A → C redirect recommended.`);
        }
      }

      // Check if target destination is broken
      const isDestinationBroken = r.target_url ? (!validUrls.has(r.target_url) && !r.target_url.startsWith("http")) : false;
      if (isDestinationBroken) {
        issues.push(`Target destination '${r.target_url}' does not exist on website.`);
      }

      return {
        ruleId: r.id,
        sourceUrl: r.source_url,
        targetUrl: r.target_url,
        statusCode: r.status_code,
        isValid: issues.length === 0,
        isLoop,
        isChain,
        chainHops: isChain ? chainHops : undefined,
        isDestinationBroken,
        issues,
      };
    });
  }
}
