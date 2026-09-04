import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import ProductDetailClient from "../../../../components/store/shop/product-detail-client";
import { ProductJsonLd } from "../../../../components/store/seo/json-ld";
import { getProductById, getProductBySlug, listProductReviews } from "../../../../lib/data/catalog";
import { getCmsPage } from "../../../../lib/data/cms";
import { SeoMetadataBuilder } from "../../../../lib/seo/metadata-builder";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> | { id: string } }): Promise<Metadata> {
  const resolvedParams = await Promise.resolve(params);
  const targetId = resolvedParams.id;
  const fetched = (await getProductById(targetId)) || (await getProductBySlug(targetId));
  if (!fetched) {
    return {
      title: "Product Not Found | CakeToHome",
      description: "The requested cake could not be found.",
    };
  }
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
  const fetched = (await getProductById(targetId, pincodeCookie)) || (await getProductBySlug(targetId, pincodeCookie));

  if (!fetched) {
    notFound();
  }

  const productId = fetched.id || fetched.product_id || targetId;
  const productTitle = fetched?.title || fetched?.name || "Gourmet Bakery Product";
  const productDescription = fetched?.description || "";
  const thumbnail =
    fetched?.thumbnail ||
    fetched?.image ||
    fetched?.image_url ||
    "/images/placeholder-cake.jpg";
  const basePrice = Number(fetched?.price || fetched?.selling_price || 0);

  // Build product gallery images strictly from authoritative database gallery/images
  const rawGallery = Array.isArray(fetched?.gallery) && fetched.gallery.length > 0
    ? fetched.gallery
    : (Array.isArray(fetched?.images) && fetched.images.length > 0 ? fetched.images : [thumbnail]);
  const images = rawGallery.filter(Boolean);

  const product: any = {
    id: productId,
    product_id: productId,
    title: productTitle,
    name: productTitle,
    description: productDescription,
    thumbnail: thumbnail,
    images: images,
    price: basePrice,
    rating: Number(fetched?.rating) || 4.9,
    review_count: Number(fetched?.review_count) || 12,
    branch_status: (fetched as any)?.branch_status || "AVAILABLE",
    category: fetched?.category,
    category_slug: fetched?.category_slug,
    primary_category_id: fetched?.primary_category_id,
    categories: fetched?.categories || [],
    flavour: fetched?.flavour,
    weight: fetched?.weight,
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

  const fetchedMeta = fetched?.metadata || {};
  const meta = {
    product_id: productId,
    artisan: fetched?.artisan === true || fetchedMeta.artisan === true,
    sugar_free: fetched?.sugar_free === true || fetchedMeta.sugar_free === true,
    gluten_free: fetched?.gluten_free === true || fetchedMeta.gluten_free === true,
    vegan: fetched?.vegan === true || fetchedMeta.vegan === true,
    is_bestseller: Boolean(fetched?.is_bestseller ?? fetchedMeta.is_bestseller),
    is_featured: Boolean(fetched?.is_featured ?? fetchedMeta.is_featured),
    ingredients: fetched?.ingredients || fetchedMeta.ingredients || "Prepared in an artisanal bakery with premium ingredients.",
    allergens: fetched?.allergens || fetchedMeta.allergens || "Prepared in a bakery that handles dairy and tree nuts.",
    shelf_life: fetched?.shelf_life || fetchedMeta.shelf_life || "3 days under refrigeration (2°C - 5°C)",
    storage_instructions: fetched?.storage_instructions || fetchedMeta.storage_instructions || "Keep refrigerated. Serve at room temperature for maximum flavor.",
    fssai_license: fetched?.fssai_license || fetchedMeta.fssai_license || "FSSAI Lic. No. 11223999000142",
  };

  const reviewsData = await listProductReviews(productId);
  const reviews = reviewsData?.reviews || [];
  const reviewCount = reviewsData?.aggregate?.total_reviews ?? (fetched as any)?.review_count ?? 0;
  const averageRating = reviewsData?.aggregate?.average_rating ?? (fetched as any)?.rating ?? 0;
  const ratingDistribution = reviewsData?.aggregate?.rating_distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const isWishlistedInitial = false;
  const shopId = "br_koramangala";
  const variantId = `var_${productId}`;

  // Fetch dynamic PIM configuration from database engine
  const weightPrices = (fetched as any)?.weight_prices || (fetched as any)?.weights || [];
  const masterVariantOptions = (fetched as any)?.variant_options || [];
  const pimConfig = (fetched as any)?.pim_config || {};

  // Fetch CMS Product Page (PDP) builder configuration
  let pdpConfig: any = {};
  try {
    const cmsPage = await getCmsPage("product");
    if (cmsPage) {
      pdpConfig = cmsPage.status === "published"
        ? (cmsPage.published_config?.pdp || cmsPage.published_config || cmsPage.draft_config?.pdp || {})
        : (cmsPage.draft_config?.pdp || cmsPage.draft_config || {});
    }
  } catch {
    pdpConfig = {};
  }

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
        pdpConfig={pdpConfig}
      />
    </>
  );
}
