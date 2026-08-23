import { getCmsPage } from "@frontend/lib/data/cms";
import { trackBlogRead } from "@frontend/lib/data/analytics";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@frontend/components/store/seo/json-ld";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
    params,
}: {
    params: { slug: string };
}): Promise<Metadata> {
    const post = await getCmsPage(params.slug);
    if (!post) return {};

    return {
        title: post.meta_title ?? post.title,
        description: post.meta_description ?? post.excerpt ?? undefined,
        openGraph: {
            title: post.meta_title ?? post.title,
            description: post.meta_description ?? post.excerpt ?? undefined,
            images: post.featured_image ? [{ url: post.featured_image }] : undefined,
            type: "article",
        },
    };
}

export default async function BlogPostPage({
    params,
}: {
    params: { slug: string };
}) {
    const post = await getCmsPage(params.slug);
    if (!post) notFound();

    // Track blog read (best-effort, non-blocking).
    trackBlogRead(params.slug);

    const blocks = (post.blocks as Array<{ type?: string; content?: string }>) ?? [];
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://caketohome.com";
    const postUrl = `${baseUrl}/blog/${params.slug}`;

    return (
        <article className="flex flex-col gap-6 max-w-3xl mx-auto">
            <ArticleJsonLd
                title={post.title}
                description={post.meta_description ?? post.excerpt ?? undefined}
                imageUrl={post.featured_image}
                author={post.author}
                datePublished={post.published_at}
                url={postUrl}
            />
            <BreadcrumbJsonLd
                crumbs={[
                    { name: "Home", url: baseUrl },
                    { name: "Blog", url: `${baseUrl}/blog` },
                    { name: post.title, url: postUrl },
                ]}
            />
            <div className="p-0 overflow-hidden rounded-2xl">
                {post.featured_image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={post.featured_image}
                        alt={post.title}
                        className="w-full h-64 object-cover"
                    />
                )}
            </div>
            <h1 className="text-3xl font-semibold">{post.title}</h1>
            <p className="text-slate-500 text-sm">
                By {post.author ?? "CakeToHome"}
                {post.reading_time ? ` · ${post.reading_time} min read` : ""}
            </p>
            {post.excerpt && (
                <p className="text-ui-fg-subtle text-lg">{post.excerpt}</p>
            )}
            <div className="prose max-w-none">
                {blocks.map((block, i) => (
                    <div key={i}>
                        {block.type === "heading" ? (
                            <h2>{block.content}</h2>
                        ) : (
                            <p>{block.content}</p>
                        )}
                    </div>
                ))}
            </div>
        </article>
    );
}
