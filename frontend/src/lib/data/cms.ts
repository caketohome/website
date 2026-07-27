/**
 * CakeToHome Storefront CMS & Navigation Data Layer
 */

import { apiClient } from "../api-client";

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  type: string;
  status: string;
  excerpt?: string | null;
  featured_image?: string | null;
  author?: string | null;
  reading_time?: number | null;
  published_at?: string | null;
  blocks?: unknown[] | null;
  meta_title?: string | null;
  meta_description?: string | null;
  canonical_url?: string | null;
  og_image?: string | null;
}

export interface HomepageSection {
  id: string;
  name: string;
  section_type: string;
  title?: string | null;
  subtitle?: string | null;
  config?: unknown;
  sort_order?: number;
  is_active?: boolean;
  visibility?: unknown;
  theme?: unknown;
  language_code?: string;
}

export interface CmsBanner {
  id: string;
  title?: string | null;
  image_url: string;
  mobile_image_url?: string | null;
  link_url?: string | null;
  alt_text?: string | null;
  sort_order?: number;
  target?: unknown;
}

export interface CmsNavigation {
  id: string;
  name: string;
  location: string;
  items?: unknown[];
  is_active?: boolean;
  language_code?: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  featured_image?: string | null;
  author?: string | null;
  reading_time?: number;
  published_at?: string | null;
  blocks?: unknown[];
}

export async function getHomepage(lang = "en"): Promise<{ sections: HomepageSection[]; banners: CmsBanner[] }> {
  return { sections: [], banners: [] };
}

export async function getCmsPage(slug: string, lang = "en"): Promise<CmsPage | null> {
  return { id: "page_01", slug, title: "CakeToHome Bakery", type: "standard", status: "published", excerpt: "Gourmet artisanal cake delivery", featured_image: null, author: "Master Baker", reading_time: 3, published_at: new Date().toISOString(), blocks: [], meta_title: "CakeToHome Gourmet Bakery", meta_description: "Artisanal cakes and gourmet bakery delivery", og_image: null };
}

export async function getNavigation(location: string, lang = "en"): Promise<CmsNavigation | null> {
  return { id: "nav_01", name: "Main Navigation", location, items: [] };
}

export async function getBlogPosts(opts?: { lang?: string; categoryId?: string; limit?: number; offset?: number }): Promise<BlogPost[]> {
  return [];
}

export async function resolveRedirect(from: string): Promise<any> {
  return null;
}
