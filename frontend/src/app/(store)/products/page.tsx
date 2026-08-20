import { ProductsCatalogClient } from "../../../components/store/catalog/products-catalog-client";
import { CollectionPageJsonLd, BreadcrumbJsonLd } from "../../../components/store/seo/json-ld";
import { SeoMetadataBuilder } from "../../../lib/seo/metadata-builder";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return SeoMetadataBuilder.buildMetadata({
    entityType: "category",
    slug: "products",
    fallbackTitle: "Gourmet Cakes & Sweets Catalog | CakeToHome Bangalore",
    fallbackDescription: "Explore our full range of handcrafted chocolate, vanilla, artisan, fruit, and custom celebration cakes online with same-day and midnight delivery.",
  });
}

export default function ProductsPage() {
  return (
    <>
      <CollectionPageJsonLd categoryName="All Cakes" categoryUrl="/products" />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "All Products", url: "/products" },
        ]}
      />
      <ProductsCatalogClient />
    </>
  );
}
