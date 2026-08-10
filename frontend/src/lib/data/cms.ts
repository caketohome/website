import { ApiEngine } from "../api-engine";

export interface HomepageSection {
  id: string;
  name: string;
  section_type: string;
  title?: string | null;
  subtitle?: string | null;
  config?: unknown;
  sort_order?: number;
  is_active?: boolean;
}

export interface CmsBanner {
  id: string;
  title?: string | null;
  image_url: string;
  mobile_image_url?: string | null;
  link_url?: string | null;
  alt_text?: string | null;
  sort_order?: number;
}

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  page_type?: string;
  type?: string;
  status: string;
  h1?: string;
  subheading?: string;
  intro_content?: string;
  excerpt?: string | null;
  featured_image?: string | null;
  author?: string | null;
  reading_time?: number | null;
  published_at?: string | null;
  sections?: any[];
  blocks?: any[] | null;
  breadcrumb_title?: string | null;
  draft_config?: any;
  published_config?: any;
  meta_title?: string | null;
  meta_description?: string | null;
  canonical_url?: string | null;
  og_image?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  twitter_card?: string | null;
  twitter_title?: string | null;
  twitter_description?: string | null;
  twitter_image?: string | null;
  structured_data_type?: string | null;
  keywords?: string | null;
  announcement_bar?: {
    enabled?: boolean;
    text?: string;
    cta_text?: string;
    cta_url?: string;
    bg_color?: string;
  };
  header_config?: {
    show_header?: boolean;
    style?: string;
  };
}

export async function getHomepage(lang = "en"): Promise<{
  page: CmsPage | null;
  sections: any[];
  banners: any[];
  announcementBar?: any;
  headerConfig?: any;
}> {
  const page = ApiEngine.getCmsPage("home");
  if (!page) {
    return { page: null, sections: [], banners: [], announcementBar: undefined, headerConfig: undefined };
  }

  // If page is published, return published configuration
  if (page.status === "published") {
    const pubConfig = page.published_config || {};
    const sections = Array.isArray(pubConfig.sections) && pubConfig.sections.length > 0
      ? pubConfig.sections
      : (Array.isArray(page.sections) ? page.sections : []);
    const banners = Array.isArray(pubConfig.banners)
      ? pubConfig.banners
      : (Array.isArray(page.draft_config?.banners) ? page.draft_config.banners : []);

    return {
      page: page as CmsPage,
      sections,
      banners,
      announcementBar: pubConfig.announcement_bar || page.announcement_bar,
      headerConfig: pubConfig.header_config || page.header_config,
    };
  }

  // If not published, storefront returns empty published config
  return {
    page: page as CmsPage,
    sections: [],
    banners: [],
    announcementBar: page.announcement_bar,
    headerConfig: page.header_config,
  };
}

export async function getCmsPage(slug: string, lang = "en"): Promise<CmsPage | null> {
  const page = ApiEngine.getCmsPage(slug);
  if (!page) return null;

  // If page is published, merge published_config fields
  if (page.status === "published") {
    const pub = page.published_config || {};
    return {
      ...page,
      sections: Array.isArray(pub.sections) && pub.sections.length > 0 ? pub.sections : page.sections,
      h1: pub.h1 || page.h1 || page.title,
      subheading: pub.subheading || page.subheading || "",
      intro_content: pub.intro_content || page.intro_content || "",
      meta_title: pub.meta_title || page.meta_title || page.title,
      meta_description: pub.meta_description || page.meta_description || "",
      canonical_url: pub.canonical_url || page.canonical_url || "",
      og_title: pub.og_title || page.og_title || page.title,
      og_description: pub.og_description || page.og_description || page.meta_description,
      og_image: pub.og_image || page.og_image || "",
      announcement_bar: pub.announcement_bar || page.announcement_bar,
      header_config: pub.header_config || page.header_config,
      theme: pub.theme || page.theme,
    } as CmsPage;
  }

  return page as CmsPage;
}

export async function getNavigation(location: string, lang = "en"): Promise<any | null> {
  const pages = ApiEngine.listCmsPages();
  const navPages = pages
    .filter((p: any) => p.status === "published" && !p.hide_from_nav && p.nav_location === location)
    .map((p: any) => ({
      id: p.id,
      title: p.breadcrumb_title || p.title,
      url: p.url_path || `/${p.slug}`,
    }));

  return { id: `nav_${location}`, name: `${location} Navigation`, location, items: navPages };
}

export async function getBlogPosts(opts?: { lang?: string; categoryId?: string; limit?: number; offset?: number }): Promise<any[]> {
  const pages = ApiEngine.listCmsPages();
  return pages.filter((p: any) => p.page_type === "blog" && p.status === "published");
}

export async function resolveRedirect(from: string): Promise<any> {
  const redirects = (ApiEngine as any).getSeoRedirects ? ApiEngine.getSeoRedirects() : [];
  return redirects.find((r: any) => r.from_path === from || r.from === from) || null;
}
