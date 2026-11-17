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
    let jsonStr = JSON.stringify(data);
    jsonStr = jsonStr.replace(/http:\/\/localhost(:\d+)?/g, "https://caketohome.com").replace(/http:\/\/127\.0\.0\.1(:\d+)?/g, "https://caketohome.com");
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonStr }}
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
        logo: `${BASE_URL}/assets/brand/caketo-home-logo-navy.png`,
        image: `${BASE_URL}/assets/brand/caketo-home-logo-navy.png`,
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
    items,
}: {
    crumbs?: { name: string; url: string }[];
    items?: { name: string; url: string }[];
}) {
    const listItems = crumbs || items || [];
    const list: JsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: listItems.map((c, i) => ({
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

/** LocalBusiness (Bakery) structured data — rendered on branch & city landing pages. */
export function LocalBusinessJsonLd({
    name,
    description,
    city,
    address,
    telephone,
    latitude,
    longitude,
    openingHours,
    image,
    url,
}: {
    name: string;
    description?: string;
    city?: string;
    address?: string;
    telephone?: string;
    latitude?: number;
    longitude?: number;
    openingHours?: string;
    image?: string;
    url?: string;
}) {
    const business: JsonLd = {
        "@context": "https://schema.org",
        "@type": ["LocalBusiness", "Bakery"],
        name: name || "CakeToHome Bakery",
        description: description || `Premium cake delivery in ${city || "Kerala"}`,
        url: url || BASE_URL,
        telephone: telephone || "+91 98765 43210",
        image: image ? [image] : undefined,
        address: address ? {
            "@type": "PostalAddress",
            streetAddress: address,
            addressLocality: city || "Kollam",
            addressRegion: "Kerala",
            addressCountry: "IN",
        } : undefined,
        geo: (latitude && longitude) ? {
            "@type": "GeoCoordinates",
            latitude: String(latitude),
            longitude: String(longitude),
        } : undefined,
        openingHours: openingHours || "Mo-Su 08:00-23:00",
        priceRange: "₹₹",
    };
    return <Script data={business} />;
}

/** FAQPage structured data — rendered on FAQ & product pages with AEO FAQs. */
export function FAQPageJsonLd({
    faqs,
}: {
    faqs: { question: string; answer: string }[];
}) {
    if (!faqs || faqs.length === 0) return null;
    const faqSchema: JsonLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: f.answer,
            },
        })),
    };
    return <Script data={faqSchema} />;
}

/** HowTo structured data — rendered for cake ordering / recipe guides. */
export function HowToJsonLd({
    name,
    description,
    steps,
}: {
    name: string;
    description?: string;
    steps: { name: string; text: string; url?: string; image?: string }[];
}) {
    if (!steps || steps.length === 0) return null;
    const howToSchema: JsonLd = {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name,
        description: description || undefined,
        step: steps.map((s, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: s.name,
            text: s.text,
            url: s.url || undefined,
            image: s.image || undefined,
        })),
    };
    return <Script data={howToSchema} />;
}

/** Recipe structured data — for artisanal cake recipes & blog posts. */
export function RecipeJsonLd({
    name,
    description,
    author,
    image,
    prepTime,
    cookTime,
    recipeYield,
}: {
    name: string;
    description?: string;
    author?: string;
    image?: string;
    prepTime?: string;
    cookTime?: string;
    recipeYield?: string;
}) {
    const recipeSchema: JsonLd = {
        "@context": "https://schema.org",
        "@type": "Recipe",
        name,
        description: description || undefined,
        author: { "@type": "Organization", name: author || "CakeToHome Chefs" },
        image: image ? [image] : undefined,
        prepTime: prepTime || "PT30M",
        cookTime: cookTime || "PT45M",
        recipeYield: recipeYield || "8 servings",
    };
    return <Script data={recipeSchema} />;
}

/** Speakable structured data — for Voice Search & Answer Engine Optimization (AEO). */
export function SpeakableJsonLd({
    cssSelectors,
    xpath,
}: {
    cssSelectors?: string[];
    xpath?: string[];
}) {
    const speakableSchema: JsonLd = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        speakable: {
            "@type": "SpeakableSpecification",
            cssSelector: cssSelectors || ["h1", ".speakable-answer", ".faq-answer"],
            xpath: xpath || undefined,
        },
    };
    return <Script data={speakableSchema} />;
}

/** CollectionPage structured data — rendered on product catalog & category pages. */
export function CollectionPageJsonLd({
    categoryName,
    categoryUrl,
}: {
    categoryName: string;
    categoryUrl: string;
}) {
    const schema: JsonLd = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${categoryName} | CakeToHome Catalog`,
        url: categoryUrl.startsWith("http") ? categoryUrl : `${BASE_URL}${categoryUrl.startsWith("/") ? "" : "/"}${categoryUrl}`,
        description: `Explore our collection of ${categoryName} available for online order with fast delivery.`,
    };
    return <Script data={schema} />;
}


