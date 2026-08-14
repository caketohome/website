import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiEngine } from "@frontend/lib/api-engine";
import { Sparkles, ArrowRight, ShieldCheck, Clock, Award, Cake, ShoppingCart } from "lucide-react";

interface OccasionPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: OccasionPageProps) {
  const { slug } = await params;
  const occasion = ApiEngine.getOccasionBySlug(slug) || ApiEngine.getOccasionById(slug);

  if (!occasion) {
    return {
      title: "Occasion Cakes | CakeToHome",
      description: "Browse artisanal designer cakes and celebration confections for every special occasion.",
    };
  }

  return {
    title: `${occasion.name} Cakes Online | Fresh Delivery | CakeToHome`,
    description: occasion.description || `Order premium handcrafted cakes & accessories specially curated for ${occasion.name}. Same-day and midnight delivery available across Bangalore & beyond.`,
    openGraph: {
      title: `${occasion.name} Cakes — CakeToHome`,
      description: occasion.description || `Celebrate ${occasion.name} with chef-crafted cakes.`,
    },
  };
}

export default async function OccasionStorefrontPage({ params }: OccasionPageProps) {
  const { slug } = await params;
  const occasion = ApiEngine.getOccasionBySlug(slug) || ApiEngine.getOccasionById(slug);

  if (!occasion) {
    notFound();
  }

  const products = ApiEngine.getOccasionProducts(occasion.slug);
  const accessories = ApiEngine.getRecommendedAccessories(undefined, "product");

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Hero Occasion Banner */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900 text-white py-14 px-4 sm:px-6 lg:px-8 border-b border-purple-800/40">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-purple-500/20 via-transparent to-transparent pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
                <span>{occasion.icon || "🎉"}</span>
                <span>Celebration Collection</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
                {occasion.name} <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-300 to-pink-300">Cakes & Treats</span>
              </h1>
              <p className="text-sm sm:text-base text-purple-100/80 leading-relaxed">
                {occasion.description || `Make your ${occasion.name} unforgettable with freshly baked gourmet cakes, hand-delivered in express time.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-4 text-xs font-medium text-purple-200">
              <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10">
                <Clock className="w-4 h-4 text-purple-400" />
                <span>Same-Day & Midnight Delivery</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>100% Eggless Options</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10">
                <Award className="w-4 h-4 text-amber-400" />
                <span>5-Star Freshness Guaranteed</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Catalog Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Cake className="w-6 h-6 text-purple-600" /> Perfect for {occasion.name} ({products.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Curated chef recommendations tailored for your {occasion.name} party.
            </p>
          </div>

          <Link
            href="/categories"
            className="text-xs font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center gap-1 hover:underline"
          >
            All Categories <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <Cake className="w-12 h-12 mx-auto text-purple-300 dark:text-purple-700" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No cakes found for this occasion</h3>
            <p className="text-xs text-slate-500">Check out our signature gourmet cakes below or browse our full catalog.</p>
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20"
            >
              Explore Homepage Cakes
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {products.map((prod: any) => {
              const prodId = prod.id || prod.product_id;
              const prodPrice = Number(prod.price) || Number(prod.selling_price) || 599;
              return (
                <Link
                  key={prodId}
                  href={`/products/${prod.handle || prodId}`}
                  className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-xl hover:border-purple-300 dark:hover:border-purple-700 transition-all flex flex-col justify-between"
                >
                  <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img
                      src={prod.thumbnail || "https://images.unsplash.com/photo-1578985545062-69928b1d9587"}
                      alt={prod.title || prod.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {prod.eggless && (
                      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-emerald-500/90 text-white text-[10px] font-bold backdrop-blur-sm">
                        🌿 100% Eggless
                      </span>
                    )}
                    <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-purple-900/80 text-purple-200 text-[10px] font-bold backdrop-blur-sm flex items-center gap-1">
                      {occasion.icon} {occasion.name}
                    </span>
                  </div>

                  <div className="p-4 space-y-2 flex flex-col justify-between flex-1">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1 group-hover:text-purple-600 transition-colors">
                        {prod.title || prod.name}
                      </h3>
                      {prod.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                          {prod.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">Starts from</span>
                        <span className="text-base font-extrabold text-purple-700 dark:text-purple-400">
                          ₹{prodPrice}
                        </span>
                      </div>
                      <span className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold text-xs group-hover:bg-purple-600 group-hover:text-white transition-all flex items-center gap-1">
                        View <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Celebration Add-ons & Accessories for Occasion */}
        {accessories.length > 0 && (
          <div className="mt-16 pt-10 border-t border-slate-200 dark:border-slate-800 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" /> Complete the Celebration
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Party toppers, candles, flower bouquets, and greeting cards for {occasion.name}.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3.5">
              {accessories.slice(0, 6).map((acc: any) => (
                <div
                  key={acc.id}
                  className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between"
                >
                  <div className="aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 mb-2">
                    <img
                      src={acc.thumbnail || "https://images.unsplash.com/photo-1513151233558-d860c5398176"}
                      alt={acc.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{acc.name}</h4>
                    <span className="text-xs font-extrabold text-purple-600 dark:text-purple-400 mt-1 block">
                      ₹{acc.price}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
