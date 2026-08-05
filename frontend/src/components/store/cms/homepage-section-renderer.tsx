import { Container, Heading, Text, Button } from "@medusajs/ui";
import { Link } from "next-view-transitions";
import type { HomepageSection, CmsBanner } from "@frontend/lib/data/cms";

/**
 * Dynamic homepage section renderer.
 * Maps a section_type (from the admin homepage builder) to a storefront
 * component. Each section's `config` JSON drives the content.
 *
 * Supported section types: hero, slider, featured_cakes, categories,
 * birthday_collection, anniversary_collection, same_day_delivery, trending,
 * offers, coupons, product_carousel, category_carousel, gallery, testimonials,
 * faq, instagram, blog, video, countdown, rich_text, custom_html, branches,
 * delivery_areas, ai_recommendations, recently_viewed, recommended.
 */

function BannerSlider({ banners }: { banners: CmsBanner[] }) {
    if (!banners || banners.length === 0) return null;
    return (
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
            {banners.map((b) => (
                <Link
                    key={b.id}
                    href={b.link_url ?? "#"}
                    className="shrink-0 snap-center"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={b.image_url}
                        alt={b.alt_text ?? b.title ?? ""}
                        loading="lazy"
                        className="rounded-lg max-h-80 object-cover w-full"
                    />
                </Link>
            ))}
        </div>
    );
}

function SectionShell({
    section,
    children,
}: {
    section: HomepageSection;
    children: React.ReactNode;
}) {
    return (
        <section className="flex flex-col gap-3">
            {section.title && <Heading level="h2">{section.title}</Heading>}
            {section.subtitle && (
                <Text className="text-ui-fg-subtle">{section.subtitle}</Text>
            )}
            {children}
        </section>
    );
}

export function HomepageSectionRenderer({
    section,
    banners,
}: {
    section: HomepageSection;
    banners: CmsBanner[];
}) {
    const config = (section.config as Record<string, unknown>) ?? {};

    switch (section.section_type) {
        case "hero":
        case "slider":
            return (
                <SectionShell section={section}>
                    <BannerSlider banners={banners} />
                </SectionShell>
            );

        case "featured_cakes":
        case "trending":
        case "same_day_delivery":
        case "birthday_collection":
        case "anniversary_collection":
        case "product_carousel":
        case "ai_recommendations":
        case "recently_viewed":
        case "recommended":
            return (
                <SectionShell section={section}>
                    <Container className="p-6">
                        <Text className="text-ui-fg-subtle">
                            Product carousel for &ldquo;{section.name}&rdquo;.
                            Product data integration is part of Phase 3 (Catalog).
                        </Text>
                    </Container>
                </SectionShell>
            );

        case "categories":
        case "category_carousel":
            return (
                <SectionShell section={section}>
                    <Container className="p-6">
                        <Text className="text-ui-fg-subtle">
                            Category carousel for &ldquo;{section.name}&rdquo;.
                        </Text>
                    </Container>
                </SectionShell>
            );

        case "offers":
        case "coupons":
            return (
                <SectionShell section={section}>
                    <Container className="p-6 flex flex-col gap-2">
                        <Text className="font-medium">Active Offers</Text>
                        <Text className="text-ui-fg-subtle text-sm">
                            Offer widgets are powered by the Rules Engine (M2).
                        </Text>
                    </Container>
                </SectionShell>
            );

        case "countdown":
            return (
                <SectionShell section={section}>
                    <Container className="p-6">
                        <Text className="text-ui-fg-subtle">
                            Countdown timer — flash sale widget (Rules Engine).
                        </Text>
                    </Container>
                </SectionShell>
            );

        case "gallery":
        case "instagram":
            return (
                <SectionShell section={section}>
                    <Container className="p-6">
                        <Text className="text-ui-fg-subtle">
                            Gallery / Instagram feed for &ldquo;{section.name}&rdquo;.
                        </Text>
                    </Container>
                </SectionShell>
            );

        case "testimonials":
            return (
                <SectionShell section={section}>
                    <Container className="p-6">
                        <Text className="text-ui-fg-subtle">
                            Customer testimonials.
                        </Text>
                    </Container>
                </SectionShell>
            );

        case "faq":
            return (
                <SectionShell section={section}>
                    <Container className="p-6">
                        <Text className="text-ui-fg-subtle">
                            FAQ section (CMS-managed).
                        </Text>
                    </Container>
                </SectionShell>
            );

        case "blog":
            return (
                <SectionShell section={section}>
                    <Container className="p-6 flex flex-col gap-2">
                        <Text className="font-medium">From the Blog</Text>
                        <Link href="/blog">
                            <Button variant="transparent" size="small">
                                View all posts →
                            </Button>
                        </Link>
                    </Container>
                </SectionShell>
            );

        case "video":
            return (
                <SectionShell section={section}>
                    <Container className="p-6">
                        <Text className="text-ui-fg-subtle">
                            Video section for &ldquo;{section.name}&rdquo;.
                        </Text>
                    </Container>
                </SectionShell>
            );

        case "rich_text": {
            const content = (config.content as string) ?? "";
            return (
                <SectionShell section={section}>
                    <Container className="p-6 prose max-w-none">
                        <Text>{content}</Text>
                    </Container>
                </SectionShell>
            );
        }

        case "custom_html": {
            const html = (config.html as string) ?? "";
            return (
                <SectionShell section={section}>
                    <div dangerouslySetInnerHTML={{ __html: html }} />
                </SectionShell>
            );
        }

        case "branches":
        case "delivery_areas":
            return (
                <SectionShell section={section}>
                    <Container className="p-6">
                        <Text className="text-ui-fg-subtle">
                            Branches / delivery areas (multi-branch — Phase 6).
                        </Text>
                    </Container>
                </SectionShell>
            );

        default:
            return (
                <SectionShell section={section}>
                    <Container className="p-6">
                        <Text className="text-ui-fg-subtle">
                            Unknown section type: {section.section_type}
                        </Text>
                    </Container>
                </SectionShell>
            );
    }
}
