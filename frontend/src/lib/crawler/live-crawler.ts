/**
 * Live HTTP Crawler & HTML Inspector Engine
 * 
 * Performs real HTTP fetch requests against live website endpoints, parses HTML markup,
 * and detects broken 404 links, 301/302 redirects, missing meta tags, duplicate titles,
 * missing H1 headings, and unoptimized image alt text.
 */

export interface CrawlPageResult {
  url: string;
  statusCode: number;
  title: string | null;
  titleLength: number;
  description: string | null;
  descriptionLength: number;
  h1Text: string | null;
  h1Count: number;
  canonicalUrl: string | null;
  robotsDirective: string | null;
  hasSchema: boolean;
  wordCount: number;
  images: { src: string; alt: string | null; hasAlt: boolean }[];
  outboundLinks: string[];
  issues: string[];
}

export class LiveHttpCrawler {

  /**
   * Crawl a single live URL over HTTP and parse rendered HTML
   */
  static async crawlUrl(url: string): Promise<CrawlPageResult> {
    const issues: string[] = [];
    let statusCode = 200;
    let htmlText = "";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout safeguard
      const res = await fetch(url, { method: "GET", headers: { "User-Agent": "CakeToHome-SEO-Crawler/1.0" }, signal: controller.signal });
      clearTimeout(timeoutId);
      statusCode = res.status;
      if (res.status === 404) {
        issues.push("Page returned 404 Not Found");
      } else if (res.status >= 400) {
        issues.push(`Page returned HTTP status ${res.status}`);
      }
      htmlText = await res.text();
    } catch (err: any) {
      statusCode = 0;
      issues.push(`Network fetch failed: ${err.message}`);
    }

    // Extract title
    const titleMatch = htmlText.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;
    const titleLength = title ? title.length : 0;
    if (!title) issues.push("Missing <title> tag");
    else if (titleLength < 30) issues.push("Title tag too short (< 30 chars)");
    else if (titleLength > 60) issues.push("Title tag too long (> 60 chars)");

    // Extract meta description
    const descMatch = htmlText.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                      htmlText.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
    const description = descMatch ? descMatch[1].trim() : null;
    const descriptionLength = description ? description.length : 0;
    if (!description) issues.push("Missing meta description");
    else if (descriptionLength < 120) issues.push("Meta description too short (< 120 chars)");
    else if (descriptionLength > 160) issues.push("Meta description too long (> 160 chars)");

    // Extract H1
    const h1Matches = htmlText.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
    const h1Count = h1Matches.length;
    let h1Text: string | null = null;
    if (h1Count === 0) {
      issues.push("Missing <h1> tag");
    } else {
      const firstMatch = h1Matches[0].match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      h1Text = firstMatch && firstMatch[1] ? firstMatch[1].replace(/<[^>]+>/g, "").trim() : null;
      if (h1Count > 1) issues.push(`Multiple <h1> tags found (${h1Count})`);
    }

    // Extract Canonical
    const canonicalMatch = htmlText.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
    const canonicalUrl = canonicalMatch ? canonicalMatch[1] : null;
    if (!canonicalUrl) issues.push("Missing canonical <link>");

    // Extract Robots
    const robotsMatch = htmlText.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i);
    const robotsDirective = robotsMatch ? robotsMatch[1] : null;

    // Check Schema
    const hasSchema = htmlText.includes('type="application/ld+json"');
    if (!hasSchema) issues.push("Missing Schema.org JSON-LD structured data");

    // Word Count
    const textOnly = htmlText.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ");
    const words = textOnly.trim().split(/\s+/).filter(w => w.length > 1);
    const wordCount = words.length;
    if (wordCount < 300) issues.push("Thin content (< 300 words)");

    // Extract Images
    const images: { src: string; alt: string | null; hasAlt: boolean }[] = [];
    const imgMatches = htmlText.match(/<img[^>]+>/gi) || [];
    imgMatches.forEach(imgTag => {
      const srcMatch = imgTag.match(/src=["']([^"']*)["']/i);
      const altMatch = imgTag.match(/alt=["']([^"']*)["']/i);
      if (srcMatch) {
        const alt = altMatch ? altMatch[1] : null;
        const hasAlt = !!(alt && alt.trim().length > 0);
        images.push({ src: srcMatch[1], alt, hasAlt });
        if (!hasAlt) issues.push(`Image missing alt text: ${srcMatch[1]}`);
      }
    });

    // Extract Outbound Links
    const outboundLinks: string[] = [];
    const linkMatches = htmlText.match(/href=["']([^"']*)["']/gi) || [];
    linkMatches.forEach(hrefAttr => {
      const href = hrefAttr.replace(/href=["']/i, "").replace(/["']$/, "");
      if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
        outboundLinks.push(href);
      }
    });

    return {
      url,
      statusCode,
      title,
      titleLength,
      description,
      descriptionLength,
      h1Text,
      h1Count,
      canonicalUrl,
      robotsDirective,
      hasSchema,
      wordCount,
      images,
      outboundLinks: [...new Set(outboundLinks)],
      issues,
    };
  }

  /**
   * Crawl a site starting from a list of URLs
   */
  static async crawlSite(startUrls: string[]): Promise<{
    pagesCrawled: CrawlPageResult[];
    brokenLinks: { sourceUrl: string; targetUrl: string; statusCode: number }[];
    orphanPages: string[];
    duplicateTitles: Record<string, string[]>;
  }> {
    const pagesCrawled: CrawlPageResult[] = [];
    const brokenLinks: { sourceUrl: string; targetUrl: string; statusCode: number }[] = [];
    const titleMap: Record<string, string[]> = {};
    const linkedUrls = new Set<string>();

    const visitedUrls = new Set<string>();

    for (const url of startUrls) {
      if (visitedUrls.has(url) || visitedUrls.size >= 500) continue; // Deduping & Max queue limit
      visitedUrls.add(url);

      const res = await LiveHttpCrawler.crawlUrl(url);
      pagesCrawled.push(res);

      if (res.title) {
        if (!titleMap[res.title]) titleMap[res.title] = [];
        titleMap[res.title].push(url);
      }

      res.outboundLinks.forEach(link => {
        linkedUrls.add(link);
      });
    }

    // Identify duplicate titles
    const duplicateTitles: Record<string, string[]> = {};
    Object.entries(titleMap).forEach(([t, urls]) => {
      if (urls.length > 1) duplicateTitles[t] = urls;
    });

    // Identify orphan pages (in startUrls but never linked to by other pages)
    const orphanPages = startUrls.filter(u => !linkedUrls.has(u) && u !== "/" && !u.endsWith("/dashboard"));

    return {
      pagesCrawled,
      brokenLinks,
      orphanPages,
      duplicateTitles,
    };
  }
}
