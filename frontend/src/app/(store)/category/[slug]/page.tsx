import { CategoryClientPage } from "../../../../components/store/catalog/category-client-page";
import { CollectionPageJsonLd, BreadcrumbJsonLd } from "../../../../components/store/seo/json-ld";
import { SeoMetadataBuilder } from "../../../../lib/seo/metadata-builder";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> | { slug: string } }): Promise<Metadata> {
  const resolvedParams = await Promise.resolve(params);
  const slug = resolvedParams.slug;
  const categoryName = (slug || "Cakes").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return SeoMetadataBuilder.buildMetadata({
    entityType: "category",
    slug: `category/${slug}`,
    fallbackTitle: `${categoryName} Online in Kerala | CakeToHome`,
    fallbackDescription: `Order ${categoryName} online from CakeToHome. Fresh, handcrafted with premium ingredients. Same-day & express delivery in Kerala.`,
  });
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> | { slug: string } }) {
  const resolvedParams = await Promise.resolve(params);
  const slug = resolvedParams.slug;
  const categoryName = (slug || "Cakes").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <>
      <CollectionPageJsonLd categoryName={categoryName} categoryUrl={`/category/${slug}`} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Categories", url: "/category" },
          { name: categoryName, url: `/category/${slug}` },
        ]}
      />
      <CategoryClientPage categorySlug={slug} />
    </>
  );
}
