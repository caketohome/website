import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://caketohome.com";

/**
 * robots.txt — allows all crawling, points to the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: ["/account", "/checkout", "/dashboard"],
        },
        sitemap: `${BASE_URL}/sitemap.xml`,
        host: BASE_URL,
    };
}
