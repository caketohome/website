import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://caketohome.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), priority: 1, changeFrequency: "daily" },
    { url: `${BASE_URL}/products`, lastModified: new Date(), priority: 0.9, changeFrequency: "daily" },
    { url: `${BASE_URL}/search`, lastModified: new Date(), priority: 0.7, changeFrequency: "weekly" },
    { url: `${BASE_URL}/compare`, lastModified: new Date(), priority: 0.4, changeFrequency: "weekly" },
    { url: `${BASE_URL}/blog`, lastModified: new Date(), priority: 0.6, changeFrequency: "daily" },
    { url: `${BASE_URL}/login`, lastModified: new Date(), priority: 0.4, changeFrequency: "monthly" },
  ];

  return staticRoutes;
}
