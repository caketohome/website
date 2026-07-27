import { getBlogPosts } from "@frontend/lib/data/cms";
import { Heading, Text, Container } from "@medusajs/ui";
import { Link } from "next-view-transitions";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Blog — CakeToHome",
    description: "Cake tips, recipes, and celebration ideas from CakeToHome.",
};

export default async function BlogPage() {
    const posts = await getBlogPosts({ limit: 20 }).catch(() => []);

    return (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto">
            <Heading level="h1">Blog</Heading>
            {posts.length === 0 ? (
                <Text className="text-ui-fg-subtle">No posts yet.</Text>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {posts.map((post) => (
                        <Link key={post.id} href={`/blog/${post.slug}`}>
                            <Container className="p-4 flex flex-col gap-2 h-full">
                                {post.featured_image && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={post.featured_image}
                                        alt={post.title}
                                        className="rounded-lg w-full h-40 object-cover"
                                    />
                                )}
                                <Heading level="h3" className="text-lg">
                                    {post.title}
                                </Heading>
                                {post.excerpt && (
                                    <Text className="text-ui-fg-subtle text-sm">
                                        {post.excerpt}
                                    </Text>
                                )}
                                <Text className="text-ui-fg-subtle text-xs">
                                    {post.author ?? "CakeToHome"}
                                    {post.reading_time ? ` · ${post.reading_time} min read` : ""}
                                </Text>
                            </Container>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
