import { getCmsPage } from "@frontend/lib/data/cms";
import { BreadcrumbJsonLd } from "@frontend/components/store/seo/json-ld";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

/**
 * Dynamic CMS page route.
 * Resolves any published CMS page by slug (About, Contact, Privacy, Terms, etc.).
 * Falls through to 404 if no page exists (so it doesn't shadow other routes).
 */
export async function generateMetadata({
    params,
}: {
    params: { slug: string };
}): Promise<Metadata> {
    const page = await getCmsPage(params.slug);
    if (!page) return {};

    return {
        title: page.meta_title ?? page.title,
        description: page.meta_description ?? undefined,
        alternates: { canonical: page.canonical_url ?? undefined },
        openGraph: {
            title: page.meta_title ?? page.title,
            description: page.meta_description ?? undefined,
            images: page.og_image ? [{ url: page.og_image }] : undefined,
        },
    };
}

export default async function CmsPageRoute({
    params,
}: {
    params: { slug: string };
}) {
    const page = await getCmsPage(params.slug);
    if (!page) notFound();

    const blocks = (page.blocks as Array<{ type?: string; content?: string }>) ?? [];
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://caketohome.com";
    const pageUrl = `${baseUrl}/${params.slug}`;

    return (
        <article className="flex flex-col gap-6 max-w-3xl mx-auto">
            <BreadcrumbJsonLd
                crumbs={[
                    { name: "Home", url: baseUrl },
                    { name: page.title, url: pageUrl },
                ]}
            />
            <h1 className="text-3xl font-semibold">{page.title}</h1>
            {page.excerpt && (
                <p className="text-ui-fg-subtle text-lg">{page.excerpt}</p>
            )}
            <div className="prose max-w-none">
                {blocks.length === 0 ? (
                    <p className="text-ui-fg-subtle">No content blocks.</p>
                ) : (
                    blocks.map((block, i) => (
                        <div key={i}>
                            {block.type === "rich_text" || block.type === "paragraph" ? (
                                <p>{block.content}</p>
                            ) : block.type === "heading" ? (
                                <h2>{block.content}</h2>
                            ) : (
                                <p>{block.content}</p>
                            )}
                        </div>
                    ))
                )}
            </div>
        </article>
    );
}
