/**
 * Shared types for the CMS module.
 */

export type CmsPageType = "page" | "blog" | "landing" | "static";
export type CmsPageStatus = "draft" | "published" | "archived";

export interface CmsPageInput {
    slug: string;
    title: string;
    type?: CmsPageType;
    status?: CmsPageStatus;
    blocks?: unknown[];
    meta_title?: string | null;
    meta_description?: string | null;
    canonical_url?: string | null;
    og_image?: string | null;
    author?: string | null;
    excerpt?: string | null;
    featured_image?: string | null;
    reading_time?: number;
    published_at?: Date | null;
    language_code?: string;
    template_id?: string | null;
    category_id?: string | null;
    tags?: string[];
}

export interface HomepageSectionInput {
    name: string;
    section_type: string;
    title?: string | null;
    subtitle?: string | null;
    config?: unknown;
    sort_order?: number;
    is_active?: boolean;
    starts_at?: Date | null;
    ends_at?: Date | null;
    visibility?: unknown;
    theme?: unknown;
    language_code?: string;
}

export interface BannerInput {
    title?: string | null;
    image_url: string;
    mobile_image_url?: string | null;
    link_url?: string | null;
    alt_text?: string | null;
    sort_order?: number;
    is_active?: boolean;
    starts_at?: Date | null;
    ends_at?: Date | null;
    target?: unknown;
    language_code?: string;
}

export interface NavigationInput {
    name: string;
    location: string;
    items?: unknown[];
    is_active?: boolean;
    language_code?: string;
}

export interface RedirectInput {
    from_path: string;
    to_url: string;
    redirect_type?: number;
    is_active?: boolean;
}
