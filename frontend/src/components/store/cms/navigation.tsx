import Link from "next/link";
import { getNavigation, type CmsNavigation } from "@frontend/lib/data/cms";
import { trackNavClick } from "@frontend/lib/data/analytics";

/**
 * CMS-driven navigation renderer.
 *
 * Fetches a navigation tree (by location: header | footer | mega_menu |
 * sidebar | mobile) from the CMS module and renders it. Falls back to an
 * empty fragment when no navigation is configured so the storefront never
 * breaks when the CMS is empty.
 *
 * Each navigation item shape (stored as JSON in cms_navigation.items):
 *   { label, type, url, page_slug, category_slug, image, icon, badge, children, schedule, permissions }
 *
 * `type` controls how the link is resolved:
 *   - "url"        → direct href
 *   - "page"       → /<page_slug>
 *   - "category"   → /category/<category_slug>
 *   - "blog"       → /blog/<page_slug>
 */

export interface NavItem {
    id?: string;
    label: string;
    type?: "url" | "page" | "category" | "blog";
    url?: string;
    page_slug?: string;
    category_slug?: string;
    icon?: string;
    badge?: string;
    children?: NavItem[];
}

function resolveHref(item: NavItem): string {
    if (item.type === "page" && item.page_slug) return `/${item.page_slug}`;
    if (item.type === "blog" && item.page_slug) return `/blog/${item.page_slug}`;
    if (item.type === "category" && item.category_slug) return `/category/${item.category_slug}`;
    return item.url ?? "#";
}

function handleClick(label: string, location: string, url: string) {
    // Client-side analytics — best-effort.
    trackNavClick(label, location, url);
}

/**
 * Server component that loads a CMS navigation tree by location.
 * Returns null when no navigation is configured (caller renders nothing).
 */
export async function CmsNavigationLoader({
    location,
    lang = "en",
}: {
    location: string;
    lang?: string;
}): Promise<CmsNavigation | null> {
    return getNavigation(location, lang);
}

/**
 * Header navigation — renders a horizontal list of top-level items with
 * simple dropdown support for children (CSS hover).
 */
export async function HeaderNavigation({ lang = "en" }: { lang?: string }) {
    const nav = await CmsNavigationLoader({ location: "header", lang });
    if (!nav || !nav.items || (nav.items as NavItem[]).length === 0) return null;

    const items = nav.items as NavItem[];

    return (
        <nav className="hidden md:flex items-center gap-6">
            {items.map((item, idx) => (
                <div key={item.id || `${item.label}-${idx}`} className="relative group">
                    <Link
                        href={resolveHref(item)}
                        className="font-sans text-xs lg:text-sm font-semibold tracking-tight text-[#1D2F5D]/90 hover:text-[#1D2F5D] transition-colors"
                    >
                        {item.label}
                        {item.badge && (
                            <span className="ml-1.5 text-[10px] bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                {item.badge}
                            </span>
                        )}
                    </Link>
                    {item.children && item.children.length > 0 && (
                        <div className="absolute left-0 top-full hidden group-hover:flex flex-col gap-2 bg-white text-slate-900 shadow-xl rounded-xl p-3 min-w-48 z-50 border border-gray-100">
                            {item.children.map((child, cIdx) => (
                                <Link
                                    key={child.id || `${child.label}-${cIdx}`}
                                    href={resolveHref(child)}
                                    className="text-sm text-slate-800 hover:text-black hover:bg-gray-100 px-2 py-1 rounded transition-colors whitespace-nowrap"
                                >
                                    {child.label}
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </nav>
    );
}

/**
 * Footer navigation — renders a flat list of links (typically used for
 * footer link columns like About, Privacy, Terms, Contact).
 */
export async function FooterNavigation({ lang = "en" }: { lang?: string }) {
    const nav = await CmsNavigationLoader({ location: "footer", lang });
    if (!nav || !nav.items || (nav.items as NavItem[]).length === 0) return null;

    const items = nav.items as NavItem[];

    return (
        <nav className="flex flex-wrap gap-4 justify-center">
            {items.map((item, idx) => (
                <Link
                    key={item.id || `${item.label}-${idx}`}
                    href={resolveHref(item)}
                    className="text-xs sm:text-sm text-slate-400 hover:text-[#D4AF37] transition-colors hover:underline"
                >
                    {item.label}
                </Link>
            ))}
        </nav>
    );
}
