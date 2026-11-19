import Link from "next/link";
import { BreadcrumbJsonLd } from "../../../components/store/seo/json-ld";
import { SeoMetadataBuilder } from "../../../lib/seo/metadata-builder";
import { dbQuery } from "../../../lib/db";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return SeoMetadataBuilder.buildMetadata({
    entityType: "category",
    slug: "categories",
    fallbackTitle: "Cake Categories & Occasions | CakeToHome Kerala",
    fallbackDescription: "Explore all handcrafted cake categories: Chocolate Truffle, Red Velvet, Fruit Cakes, Wedding Cakes, and Birthday Specials with fast 2-hour delivery.",
  });
}

interface CategoryRow {
  id: string;
  name: string;
  handle: string;
  description?: string;
  metadata?: any;
}

export default async function CategoriesPage() {
  let categories: CategoryRow[] = [];
  try {
    const res = await dbQuery<CategoryRow>(
      "SELECT id, name, handle, description, metadata FROM product_category WHERE is_active = true OR is_internal = false ORDER BY rank ASC"
    );
    categories = res.rows;
  } catch {
    // Fallback query
    try {
      const fallback = await dbQuery<CategoryRow>("SELECT id, name, handle, description, metadata FROM product_category LIMIT 20");
      categories = fallback.rows;
    } catch {
      categories = [];
    }
  }

  return (
    <div className="min-h-screen bg-brand-warm-white text-brand-navy pt-6 pb-16">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Categories", url: "/categories" },
        ]}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-gold block mb-2">
            Patisserie Collections
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-brand-navy tracking-tight">
            Explore All Cake Categories
          </h1>
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">
            Every creation is handcrafted fresh on-demand with premium Belgian cocoa, 100% natural pure butter, and zero artificial preservatives.
          </p>
        </div>

        {categories.length === 0 && (
          <div className="mx-auto max-w-md rounded-xl border border-brand-border bg-white px-6 py-10 text-center">
            <p className="font-serif text-lg text-brand-navy">Categories are on their way</p>
            <p className="mt-2 text-sm text-brand-text-muted">
              We&apos;re setting up our cake collections. Browse everything we have right now.
            </p>
            <Link
              href="/search"
              className="mt-5 inline-flex rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary transition-colors"
            >
              Browse all cakes
            </Link>
          </div>
        )}

        {/* Category Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {categories.map((cat) => {
            const meta = typeof cat.metadata === "string" ? JSON.parse(cat.metadata || "{}") : (cat.metadata || {});
            const image = meta.image || meta.thumbnail || "/images/placeholder-cake.jpg";
            const count = Number(meta.product_count) || 0; // real count only; never invent one

            return (
              <Link
                key={cat.id}
                href={`/products?category=${encodeURIComponent(cat.handle || cat.name)}`}
                className="group bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-brand-gold/50 transition-all duration-300 overflow-hidden flex flex-col"
              >
                <div className="aspect-[4/3] w-full bg-slate-100 relative overflow-hidden">
                  <img
                    src={image}
                    alt={cat.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
                  {count > 0 && (
                    <span className="absolute bottom-3 left-3 bg-brand-navy/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                      {count} {count === 1 ? "cake" : "cakes"}
                    </span>
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h2 className="text-base font-bold text-brand-navy group-hover:text-brand-gold transition-colors">
                      {cat.name}
                    </h2>
                    {cat.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {cat.description}
                      </p>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-brand-navy">
                    <span>View Collection</span>
                    <span className="text-brand-gold group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
