import ProductDetailClient from "@frontend/components/store/shop/product-detail-client";
import { ProductJsonLd } from "@frontend/components/store/seo/json-ld";

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const product: any = {
    id: params.id || "prod_truffle_01",
    title: "Rich Chocolate Truffle Cake",
    description: "Decadent Dutch cocoa cake layers with dark chocolate ganache and customizable toppings",
    thumbnail: "https://images.unsplash.com/photo-1578985545062-69928b1d9587",
    variants: [{ id: "var_truffle_half_kg", sku: "TRUFFLE-500G", title: "500g", price: 699 }],
    metadata: { shop_id: "br_koramangala" },
  };

  const meta = { product_id: product.id, eggless: true, is_bestseller: true };
  const reviews: any[] = [];
  const reviewCount = 128;
  const averageRating = 4.9;
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 128 };
  const isWishlistedInitial = false;
  const shopId = "br_koramangala";
  const variantId = "var_truffle_half_kg";
  const cakeOptions: any[] = [];

  return (
    <>
      <ProductJsonLd product={product} price={699} averageRating={4.9} reviewCount={128} reviews={[]} />
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
        cakeOptions={cakeOptions}
      />
    </>
  );
}
