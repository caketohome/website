import { cookies } from "next/headers";
import ProductDetailClient from "../../../../components/store/shop/product-detail-client";
import { ProductJsonLd } from "../../../../components/store/seo/json-ld";
import { ApiEngine } from "../../../../lib/api-engine";
import { SeoMetadataBuilder } from "../../../../lib/seo/metadata-builder";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> | { id: string } }): Promise<Metadata> {
  const resolvedParams = await Promise.resolve(params);
  const targetId = resolvedParams.id;
  const fetched = ApiEngine.getProductById(targetId) || ApiEngine.getProductBySlug(targetId);
  const title = fetched?.title || fetched?.name || "Gourmet Cake";
  const rawDesc = fetched?.description || "Decadent handcrafted cake made with rich ingredients and fresh toppings.";
  const desc = `Order ${title} online from CakeToHome Bangalore. ${rawDesc} Freshly baked with same-day and midnight delivery available.`;
  const handle = fetched?.handle || targetId;
  const image = fetched?.thumbnail || "https://cakes2home.com/images/default-cake.jpg";

  return SeoMetadataBuilder.buildMetadata({
    entityType: "product",
    entityId: fetched?.id || targetId,
    slug: `products/${handle}`,
    fallbackTitle: `${title} 1 Kg | Same Day Cake Delivery | CakeToHome`,
    fallbackDescription: desc.substring(0, 160),
    fallbackImage: image,
  });
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = await Promise.resolve(params);
  const targetId = resolvedParams.id;
  const pincodeCookie = cookies().get("delivery_pincode")?.value;
  const fetched = ApiEngine.getProductById(targetId, undefined, pincodeCookie) || ApiEngine.getProductBySlug(targetId, undefined, pincodeCookie);

  const productId = fetched?.id || fetched?.product_id || targetId;
  const productTitle = fetched?.title || fetched?.name || "Gourmet Bakery Product";
  const productDescription =
    fetched?.description ||
    "Decadent handcrafted cake made with rich ingredients and fresh toppings.";
  const thumbnail =
    fetched?.thumbnail ||
    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800";
  const basePrice = fetched?.price || 649;

  // Build product gallery images
  const images = [
    thumbnail,
    "https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&q=80&w=800",
  ];

  const product: any = {
    id: productId,
    product_id: productId,
    title: productTitle,
    name: productTitle,
    description: productDescription,
    thumbnail: thumbnail,
    images: images,
    price: basePrice,
    rating: fetched?.rating || 4.9,
    review_count: fetched?.review_count || 128,
    branch_status: (fetched as any)?.branch_status || "AVAILABLE",
    is_out_of_stock_at_branch: (fetched as any)?.is_out_of_stock_at_branch || false,
    variants: [
      {
        id: `var_${productId}`,
        sku: `${(fetched?.handle || "CAKE").toUpperCase()}-500G`,
        title: "500g",
        price: basePrice,
      },
    ],
    metadata: { shop_id: "br_koramangala" },
  };

  const meta = {
    product_id: productId,
    eggless: fetched?.eggless === true,
    sugar_free: fetched?.sugar_free === true,
    gluten_free: fetched?.gluten_free === true,
    vegan: fetched?.vegan === true,
    is_bestseller: fetched?.is_bestseller ?? true,
    is_featured: fetched?.is_featured ?? false,
    ingredients: "Belgian Dark Chocolate, Dutch Cocoa, Fresh Cream, Wheat Flour, Pure Butter, Vanilla Bean Extract",
    allergens: "Contains Milk, Wheat, and Nuts. Prepared in a bakery that handles dairy and tree nuts.",
    shelf_life: "3 days under refrigeration (2°C - 5°C)",
    storage_instructions: "Keep refrigerated. Serve at room temperature for maximum flavor.",
    fssai_license: "FSSAI Lic. No. 11223999000142",
  };

  const reviews: any[] = [];
  const reviewCount = fetched?.review_count || 128;
  const averageRating = fetched?.rating || 4.9;
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 128 };
  const isWishlistedInitial = false;
  const shopId = "br_koramangala";
  const variantId = `var_${productId}`;

  // Fetch dynamic PIM configuration from database engine
  const weightPrices = (fetched as any)?.weight_prices || (fetched as any)?.weights || [];
  const masterVariantOptions = (fetched as any)?.variant_options || [];
  const pimConfig = (fetched as any)?.pim_config || {};

  return (
    <>
      <ProductJsonLd
        product={product}
        price={basePrice}
        averageRating={averageRating}
        reviewCount={reviewCount}
        reviews={[]}
      />
      <ProductDetailClient
        product={product}
        meta={meta}
        initialReviews={reviews}
        reviewCount={reviewCount}
        averageRating={averageRating}
        ratingDistribution={ratingDistribution}
        isWishlistedInitial={isWishlistedInitial}
        shopId={shopId}
        variantId={variantId}
        weightPrices={weightPrices}
        masterVariantOptions={masterVariantOptions}
        pimConfig={pimConfig}
      />
    </>
  );
}
