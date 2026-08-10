import type { MetadataRoute } from "next";
import { ApiEngine } from "../lib/api-engine";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://cakes2home.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), priority: 1, changeFrequency: "daily" },
    { url: `${BASE_URL}/products`, lastModified: new Date(), priority: 0.9, changeFrequency: "daily" },
    { url: `${BASE_URL}/compare`, lastModified: new Date(), priority: 0.4, changeFrequency: "weekly" },
    { url: `${BASE_URL}/blog`, lastModified: new Date(), priority: 0.6, changeFrequency: "daily" },
  ];

  // Dynamic Product routes
  let products: any[] = [];
  try {
    products = ApiEngine.getProducts() || [];
  } catch (e) {
    products = [];
  }
  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${BASE_URL}/products/${p.handle || p.id}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    priority: 0.8,
    changeFrequency: "daily",
  }));

  // Dynamic Category routes
  let categories: any[] = [];
  try {
    categories = (ApiEngine as any).listCategories ? (ApiEngine as any).listCategories() : [];
  } catch (e) {
    categories = [];
  }
  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${BASE_URL}/category/${c.slug || c.id}`,
    lastModified: c.updated_at ? new Date(c.updated_at) : new Date(),
    priority: 0.8,
    changeFrequency: "weekly",
  }));

  // Branch routes
  let branches: any[] = [];
  try {
    branches = (ApiEngine as any).getBakeryBranches ? (ApiEngine as any).getBakeryBranches() : [];
  } catch (e) {
    branches = [];
  }
  const branchRoutes: MetadataRoute.Sitemap = branches.map((b) => ({
    url: `${BASE_URL}/bakeries/${b.slug || b.id}`,
    lastModified: new Date(),
    priority: 0.7,
    changeFrequency: "weekly",
  }));

  // Custom SEO Pages
  let seoPages: any[] = [];
  try {
    seoPages = ApiEngine.getSeoPages() || [];
  } catch (e) {
    seoPages = [];
  }
  const customSeoRoutes: MetadataRoute.Sitemap = seoPages
    .filter((sp) => sp.status === "active" && sp.url && !sp.url.includes("/admin") && !sp.url.includes("/checkout"))
    .map((sp) => ({
      url: sp.url.startsWith("http") ? sp.url : `${BASE_URL}${sp.url.startsWith("/") ? "" : "/"}${sp.url}`,
      lastModified: sp.updated_at ? new Date(sp.updated_at) : new Date(),
      priority: 0.7,
      changeFrequency: "weekly",
    }));

  return [...staticRoutes, ...productRoutes, ...categoryRoutes, ...branchRoutes, ...customSeoRoutes];
}
