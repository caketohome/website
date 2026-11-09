import { CmsRepository } from "../repositories/cms.repository";

let _cachedApiEngine: any = null;
async function getServerApiEngine(): Promise<any> {
  if (typeof window !== "undefined") return null;
  if (!_cachedApiEngine) {
    try {
      const mod = await import("../api-engine");
      _cachedApiEngine = mod.ApiEngine;
    } catch {
      return null;
    }
  }
  return _cachedApiEngine;
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
}

export interface CmsNavigationItem {
  id?: string;
  title?: string;
  label?: string;
  type?: "url" | "page" | "category" | "blog";
  url?: string;
  page_slug?: string;
  category_slug?: string;
  image?: string;
  icon?: string;
  badge?: string;
  children?: CmsNavigationItem[];
  schedule?: any;
  permissions?: any;
}

export interface CmsNavigation {
  id: string;
  name: string;
  location: string;
  items: CmsNavigationItem[];
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
  pdp_config?: any;
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
  theme?: {
    bg_color?: string;
    text_color?: string;
    heading_font?: string;
    font_family?: string;
    accent_color?: string;
    radius?: string;
    card_style?: string;
  };
}

export async function getHomepage(lang = "en"): Promise<{
  page: CmsPage | null;
  sections: any[];
  banners: any[];
  announcementBar?: any;
  headerConfig?: any;
  theme?: any;
}> {
  // Authoritative Server Data Path: Query PostgreSQL directly
  if (typeof window === "undefined") {
    try {
      const [page, dbSections] = await Promise.all([
        CmsRepository.findPageBySlug("home"),
        CmsRepository.findHomepageSections(),
      ]);
      if (page) {
        if (page.status === "published") {
          const pubConfig = (page.published_config as any) || {};
          const pageSections = Array.isArray(pubConfig.sections) && pubConfig.sections.length > 0
            ? pubConfig.sections
            : (Array.isArray(page.sections) && page.sections.length > 0 ? page.sections : []);
          const sections = pageSections.length > 0 ? pageSections : dbSections;
          const banners = Array.isArray(pubConfig.banners)
            ? pubConfig.banners
            : (Array.isArray(page.draft_config?.banners) ? page.draft_config.banners : []);

          return {
            page: {
              ...page,
              meta_title: pubConfig.meta_title || page.meta_title,
              meta_description: pubConfig.meta_description || page.meta_description,
              h1: pubConfig.h1 || (page as any).h1,
              subheading: pubConfig.subheading || (page as any).subheading,
              intro_content: pubConfig.intro_content || (page as any).intro_content,
            } as unknown as CmsPage,
            sections,
            banners,
            announcementBar: pubConfig.announcement_bar || (page as any).announcement_bar,
            headerConfig: pubConfig.header_config || (page as any).header_config,
            theme: pubConfig.theme || (page as any).theme || null,
          };
        }

        return {
          page: page as unknown as CmsPage,
          sections: dbSections,
          banners: [],
          announcementBar: (page as any).announcement_bar,
          headerConfig: (page as any).header_config,
          theme: (page as any).theme || null,
        };
      }
    } catch (err) {
      console.error("[getHomepage CmsRepository Error]", err);
    }
  }

  // Fallback for client-side or if no published home page configured
  return { page: null, sections: [], banners: [], announcementBar: undefined, headerConfig: undefined };
}

export async function getCmsPage(slug: string, lang = "en", includeDrafts = false): Promise<CmsPage | null> {
  // Authoritative Server Data Path: Query PostgreSQL directly
  if (typeof window === "undefined") {
    try {
      const page = await CmsRepository.findPageBySlug(slug);
      if (page) {
        if (page.status !== "published" && !includeDrafts) {
          return null;
        }

        if (page.status === "published") {
          const pub = (page.published_config as any) || {};
          return {
            ...page,
            sections: Array.isArray(pub.sections) && pub.sections.length > 0 ? pub.sections : page.sections,
            h1: pub.h1 || (page as any).h1 || page.title,
            subheading: pub.subheading || (page as any).subheading || "",
            intro_content: pub.intro_content || (page as any).intro_content || "",
            meta_title: pub.meta_title || page.meta_title || page.title,
            meta_description: pub.meta_description || page.meta_description || "",
            canonical_url: pub.canonical_url || page.canonical_url || "",
            og_title: pub.og_title || (page as any).og_title || page.title,
            og_description: pub.og_description || (page as any).og_description || page.meta_description,
            og_image: pub.og_image || page.og_image || "",
            announcement_bar: pub.announcement_bar || (page as any).announcement_bar,
            header_config: pub.header_config || (page as any).header_config,
            theme: pub.theme || (page as any).theme,
          } as unknown as CmsPage;
        }

        return page as unknown as CmsPage;
      }
    } catch (err) {
      console.error("[getCmsPage CmsRepository Error]", err);
    }
  }

  return null;
}

export async function getOccasions(): Promise<any[]> {
  if (typeof window === "undefined") {
    try {
      const { listOccasions } = await import("./catalog");
      return await listOccasions();
    } catch {
      return [];
    }
  }
  return [];
}

export async function getNavigation(location: string, lang = "en"): Promise<any | null> {
  if (typeof window === "undefined") {
    try {
      const nav = await CmsRepository.findNavigation(location);
      if (nav && Array.isArray(nav.items) && nav.items.length > 0) {
        return nav;
      }

      // If no dedicated nav record, dynamically construct from active published pages in PostgreSQL
      const allPages = await CmsRepository.findAllPages();
      const navPages = (allPages || [])
        .filter((p: any) => p.status === "published" && !p.hide_from_nav && (p.nav_location === location || p.nav_location === "all"))
        .map((p: any) => ({
          id: p.id,
          title: p.breadcrumb_title || p.title,
          url: p.url_path || `/${p.slug}`,
        }));

      return { id: `nav_${location}`, name: `${location} Navigation`, location, items: navPages };
    } catch (err) {
      console.error("[getNavigation Error]", err);
      return { id: `nav_${location}`, name: `${location} Navigation`, location, items: [] };
    }
  }

  return { id: `nav_${location}`, name: `${location} Navigation`, location, items: [] };
}

export async function getBlogPosts(opts?: { lang?: string; categoryId?: string; limit?: number; offset?: number }): Promise<any[]> {
  if (typeof window === "undefined") {
    try {
      const allPages = await CmsRepository.findAllPages();
      return (allPages || []).filter((p: any) => (p.type === "blog" || p.page_type === "blog") && p.status === "published");
    } catch (err) {
      console.error("[getBlogPosts Error]", err);
      return [];
    }
  }
  return [];
}

export async function resolveRedirect(from: string): Promise<any> {
  if (typeof window === "undefined") {
    try {
      return await CmsRepository.findRedirect(from);
    } catch (err) {
      console.error("[resolveRedirect Error]", err);
      return null;
    }
  }
  return null;
}
