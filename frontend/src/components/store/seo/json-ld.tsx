/**
 * JSON-LD structured data components for CakeToHome SEO.
 *
 * Emits <script type="application/ld+json"> blocks for:
 *   - Organization (site-wide, on every page via root layout)
 *   - WebSite (site-wide, with SearchAction)
 *   - Article (blog posts)
 *   - BreadcrumbList (CMS pages + blog)
 *
 * Product, Review, and FAQ structured data will be added in Phase 3
 * (Catalog) once product/review models exist.
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://caketohome.com";

type JsonLd = Record<string, unknown>;

function Script({ data }: { data: JsonLd }) {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
    );
}

/** Organization + WebSite structured data — rendered once in the root layout. */
export function OrganizationJsonLd() {
    const org: JsonLd = {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "CakeToHome",
        url: BASE_URL,
        description: "Order premium cakes and bakery products online with delivery to your doorstep.",
        sameAs: [
            "https://www.facebook.com/caketohome",
            "https://www.instagram.com/caketohome",
        ],
    };
    const website: JsonLd = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "CakeToHome",
        url: BASE_URL,
        potentialAction: {
            "@type": "SearchAction",
            target: `${BASE_URL}/search?q={search_term_string}`,
            "query-input": "required name=search_term_string",
        },
    };
    return (
        <>
            <Script data={org} />
            <Script data={website} />
        </>
    );
}

/** Article structured data — rendered on blog post pages. */
export function ArticleJsonLd({
    title,
    description,
    imageUrl,
    author,
    datePublished,
    url,
}: {
    title: string;
    description?: string;
    imageUrl?: string | null;
    author?: string | null;
    datePublished?: string | null;
    url: string;
}) {
    const article: JsonLd = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title,
        description: description ?? undefined,
        image: imageUrl ? [imageUrl] : undefined,
        author: {
            "@type": "Organization",
            name: author ?? "CakeToHome",
        },
        publisher: {
            "@type": "Organization",
            name: "CakeToHome",
            url: BASE_URL,
        },
        datePublished: datePublished ?? undefined,
        mainEntityOfPage: {
            "@type": "WebPage",
            "@id": url,
        },
    };
    return <Script data={article} />;
}

/** BreadcrumbList structured data — rendered on CMS pages and blog posts. */
export function BreadcrumbJsonLd({
    crumbs,
}: {
    crumbs: { name: string; url: string }[];
}) {
    const list: JsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.name,
            item: c.url,
        })),
    };
    return <Script data={list} />;
}

/** Product structured data — rendered on Product Detail Pages (PDP). */
export function ProductJsonLd({
    product,
    price,
    averageRating,
    reviewCount,
    reviews,
}: {
    product: any;
    price: number | null;
    averageRating?: number;
    reviewCount?: number;
    reviews?: any[];
}) {
    const offers: JsonLd = price
        ? {
            "@type": "Offer",
            price: String(price),
            priceCurrency: "INR",
            availability: product.variants?.[0]?.inventory_quantity > 0
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            url: `${BASE_URL}/products/${product.id}`,
        }
        : {};

    const rating: JsonLd = averageRating && reviewCount && reviewCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: String(averageRating),
            reviewCount: String(reviewCount),
        }
        : {};

    const formattedReviews = reviews?.map((r) => ({
        "@type": "Review",
        reviewRating: {
            "@type": "Rating",
            ratingValue: String(r.rating),
            bestRating: "5",
        },
        author: {
            "@type": "Person",
            name: r.customer_name || "Guest",
        },
        datePublished: r.created_at,
        reviewBody: r.body || "",
        name: r.title || "",
    }));

    const productSchema: JsonLd = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.title,
        description: product.description || undefined,
        image: product.thumbnail ? [product.thumbnail] : undefined,
        sku: product.id,
        offers: price ? offers : undefined,
        aggregateRating: averageRating && reviewCount && reviewCount > 0 ? rating : undefined,
        review: formattedReviews && formattedReviews.length > 0 ? formattedReviews : undefined,
    };

    return <Script data={productSchema} />;
}

