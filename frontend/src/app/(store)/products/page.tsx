import { ProductsCatalogClient } from "../../../components/store/catalog/products-catalog-client";
import { CollectionPageJsonLd, BreadcrumbJsonLd } from "../../../components/store/seo/json-ld";
import { SeoMetadataBuilder } from "../../../lib/seo/metadata-builder";
import { searchProducts, getCatalogFilterOptions } from "../../../lib/data/catalog";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return SeoMetadataBuilder.buildMetadata({
    entityType: "category",
    slug: "products",
    fallbackTitle: "Gourmet Cakes & Sweets Catalog | CakeToHome Bangalore",
    fallbackDescription: "Explore our full range of handcrafted chocolate, vanilla, artisan, fruit, and custom celebration cakes online with same-day and midnight delivery.",
  });
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const params = searchParams ? await Promise.resolve(searchParams) : {};
  const category = typeof params.category === "string" ? params.category : undefined;
  const flavour = typeof params.flavour === "string" ? params.flavour : undefined;
  const weight = typeof params.weight === "string" ? params.weight : undefined;
  const min_price = typeof params.min_price === "string" ? Number(params.min_price) : undefined;
  const max_price = typeof params.max_price === "string" ? Number(params.max_price) : undefined;
  const sort = typeof params.sort === "string" ? (params.sort as any) : undefined;
  const q = typeof params.search === "string" ? params.search : typeof params.q === "string" ? params.q : undefined;

  const initialFilters = {
    category,
    flavour,
    weight,
    min_price: typeof min_price === "number" && !isNaN(min_price) ? min_price : undefined,
    max_price: typeof max_price === "number" && !isNaN(max_price) ? max_price : undefined,
    sort,
    q,
    limit: 48,
  };

  const [initialData, filterOptions] = await Promise.all([
    searchProducts(initialFilters).catch(() => ({ results: [], count: 0, offset: 0, limit: 48 })),
    getCatalogFilterOptions().catch(() => ({ categories: [], flavours: [], weights: [], minPrice: 499, maxPrice: 3500 })),
  ]);

  return (
    <>
      <CollectionPageJsonLd categoryName={category ? `${category} Cakes` : "All Cakes"} categoryUrl="/products" />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "All Products", url: "/products" },
        ]}
      />
      <ProductsCatalogClient
        initialProducts={initialData.results}
        initialCount={initialData.count}
        initialFilters={initialFilters}
        initialFilterOptions={filterOptions}
      />
    </>
  );
}
