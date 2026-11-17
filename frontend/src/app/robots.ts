import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://caketohome.com";

/**
 * robots.txt — allows all public crawling, blocks private admin/checkout/cart routes.
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: ["/account", "/checkout", "/cart", "/dashboard", "/admin", "/login", "/signup", "/search"],
        },
        sitemap: `${BASE_URL}/sitemap.xml`,
        host: BASE_URL,
    };
}
