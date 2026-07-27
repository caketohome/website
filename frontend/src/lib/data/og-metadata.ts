import type { Metadata } from "next";

/**
 * OpenGraph metadata helper — Phase 9.2.
 *
 * Builds a Next.js Metadata object with OpenGraph + Twitter card tags for
 * campaign landing pages, product pages, and blog posts. Centralizes the OG
 * tag generation so every shareable page produces consistent social previews.
 *
 * Usage:
 *   export const metadata = buildOpenGraphMetadata({
 *     title: "Diwali Flash Sale — 30% off all cakes",
 *     description: "Limited-time Diwali offer...",
 *     url: "https://caketohome.com/campaigns/diwali-flash-sale",
 *     image: "https://cdn.caketohome.com/campaigns/diwali-banner.jpg",
 *     type: "article",
 *   });
 */
export function buildOpenGraphMetadata(input: {
    title: string;
    description?: string;
    url?: string;
    image?: string;
    type?: "website" | "article" | "product";
    siteName?: string;
    twitterCard?: "summary" | "summary_large_image" | "player" | "app";
    publishedTime?: string;
    author?: string;
}): Metadata {
    const siteName = input.siteName ?? "CakeToHome";
    const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ??
        process.env.NEXT_PUBLIC_BACKEND_URL ??
        "https://caketohome.com";

    const ogUrl = input.url ?? baseUrl;
    const ogImage = input.image ?? `${baseUrl}/og-default.jpg`;
    const ogType = input.type ?? "website";
    const twitterCard = input.twitterCard ?? "summary_large_image";

    const metadata: Metadata = {
        title: input.title,
        description: input.description,
        openGraph: {
            title: input.title,
            description: input.description,
            url: ogUrl,
            siteName,
            images: [{ url: ogImage, width: 1200, height: 630, alt: input.title }],
            type: ogType as any,
            ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
            ...(input.author ? { authors: [input.author] } : {}),
        },
        twitter: {
            card: twitterCard as any,
            title: input.title,
            description: input.description,
            images: [ogImage],
        },
    };

    return metadata;
}
