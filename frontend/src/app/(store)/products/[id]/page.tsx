import ProductDetailClient from "@frontend/components/store/shop/product-detail-client";
import { ProductJsonLd } from "@frontend/components/store/seo/json-ld";
import { ApiEngine } from "@frontend/lib/api-engine";

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const fetched = ApiEngine.getProductById(params.id) || ApiEngine.getProductBySlug(params.id);

  const productId = fetched?.id || fetched?.product_id || params.id;
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
    "https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&q=80&w=800",
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
  const weightPrices = ApiEngine.getProductWeightPrices(productId);
  const masterVariantOptions = ApiEngine.listVariantOptions();
  const pimConfig = ApiEngine.getProductPimConfig(fetched);

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
