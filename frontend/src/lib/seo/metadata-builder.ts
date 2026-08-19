import type { Metadata } from "next";

const PRODUCTION_DOMAIN = process.env.NEXT_PUBLIC_BASE_URL || "https://cakes2home.com";

export interface MetadataOptions {
  entityType?: "product" | "category" | "branch" | "city" | "cms" | "blog" | "page";
  entityId?: string;
  slug?: string;
  fallbackTitle?: string;
  fallbackDescription?: string;
  fallbackImage?: string;
  isPrivate?: boolean;
  seoRecord?: {
    meta_title?: string;
    meta_description?: string;
    canonical_url?: string;
    og_image?: string;
    robots_directive?: string;
    url?: string;
  };
}

export class SeoMetadataBuilder {
  /**
   * Central server-side Next.js Metadata generator
   * 
   * Builds realistic content-based defaults and OpenGraph tags.
   * Enforces absolute HTTPS canonical URLs, OpenGraph, Twitter Cards, and proper robots directives.
   * Strictly sanitizes any localhost references, base64 data URIs, or broken image URLs.
   */
  static buildMetadata(options: MetadataOptions): Metadata {
    const {
      entityType = "page",
      entityId,
      slug = "",
      fallbackTitle,
      fallbackDescription,
      fallbackImage,
      isPrivate = false,
      seoRecord,
    } = options;

    // Private routes (cart, checkout, login, admin, search) MUST return noindex, nofollow, nocache
    if (isPrivate) {
      return {
        title: fallbackTitle || "CakeToHome",
        description: fallbackDescription || "Secure online cake ordering",
        robots: {
          index: false,
          follow: false,
          nocache: true,
          googleBot: { index: false, follow: false },
        },
      };
    }

    const existing = seoRecord;

    // Determine Meta Title
    const rawTitle = existing?.meta_title || fallbackTitle || "Online Cakes & Cake Delivery in Bangalore | CakeToHome";
    const title = rawTitle.includes("CakeToHome") ? rawTitle : `${rawTitle} | CakeToHome`;

    // Determine Meta Description
    const description =
      existing?.meta_description ||
      fallbackDescription ||
      "Order fresh handcrafted artisanal cakes online with same-day and midnight delivery. Premium birthday, wedding, and celebration cakes from CakeToHome.";

    // Determine Absolute Canonical URL & Sanitize Domain
    const relativePath = existing?.url || (slug ? (slug.startsWith("/") ? slug : `/${slug}`) : "/");
    let canonicalUrl = existing?.canonical_url || `${PRODUCTION_DOMAIN}${relativePath === "/" ? "" : relativePath}`;
    if (canonicalUrl.includes("localhost") || canonicalUrl.includes("127.0.0.1")) {
      canonicalUrl = canonicalUrl.replace(/http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, PRODUCTION_DOMAIN);
    }

    // Determine Social Sharing Image & Sanitize Image URL
    const rawImage = existing?.og_image || fallbackImage || `${PRODUCTION_DOMAIN}/images/default-og-cake.jpg`;
    let imageUrl = rawImage;
    if (imageUrl.includes("localhost") || imageUrl.includes("127.0.0.1")) {
      imageUrl = imageUrl.replace(/http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, PRODUCTION_DOMAIN);
    }
    if (imageUrl.startsWith("data:image")) {
      imageUrl = `${PRODUCTION_DOMAIN}/images/default-og-cake.jpg`;
    }
    if (!imageUrl.startsWith("http")) {
      imageUrl = `${PRODUCTION_DOMAIN}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
    }

    // Determine Robots Directives
    const robotsDirective = existing?.robots_directive || "index,follow";
    const canIndex = !robotsDirective.includes("noindex");
    const canFollow = !robotsDirective.includes("nofollow");

    return {
      title,
      description,
      metadataBase: new URL(PRODUCTION_DOMAIN),
      alternates: {
        canonical: canonicalUrl,
      },
      robots: {
        index: canIndex,
        follow: canFollow,
        googleBot: {
          index: canIndex,
          follow: canFollow,
          "max-video-preview": -1,
          "max-image-preview": "large",
          "max-snippet": -1,
        },
      },
      openGraph: {
        title,
        description,
        url: canonicalUrl,
        siteName: "CakeToHome",
        locale: "en_IN",
        type: "website",
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [imageUrl],
      },
    };
  }
}
