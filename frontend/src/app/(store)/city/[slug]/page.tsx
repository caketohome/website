import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiEngine } from "@frontend/lib/api-engine";
import {
  MapPin, Clock, ShieldCheck, Award, Cake, ArrowRight,
  Truck, Building2, CheckCircle2, Sparkles, Phone, Star
} from "lucide-react";

export const dynamic = "force-dynamic";

interface CityPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CityPageProps) {
  const { slug } = await params;
  const city = ApiEngine.getCityBySlug(slug) || ApiEngine.getCityById(slug);

  if (!city) {
    return {
      title: "Online Cake Delivery | CakeToHome",
      description: "Order fresh chef-crafted cakes online with same-day and midnight delivery across India.",
    };
  }

  return {
    title: `Online Cake Delivery in ${city.name} | Midnight & Same Day Delivery | CakeToHome`,
    description: `Order delicious artisanal birthday cakes, anniversary confections, and gourmet treats online in ${city.name}, ${city.state}. Hand-delivered in 45-60 minutes from local fulfillment hubs.`,
    openGraph: {
      title: `Online Cake Delivery in ${city.name} — CakeToHome`,
      description: `Premium chef-baked cakes delivered fresh across ${city.name}. Same-day and midnight slots available.`,
    },
  };
}

export default async function CityLandingPage({ params }: CityPageProps) {
  const { slug } = await params;
  const city = ApiEngine.getCityBySlug(slug) || ApiEngine.getCityById(slug);

  if (!city) {
    notFound();
  }

  const branches = ApiEngine.getCityBranches(city.id);
  const stats = ApiEngine.getCityStats(city.id);
  const products = ApiEngine.listProducts().slice(0, 8);
  const occasions = ApiEngine.listOccasions("active").slice(0, 6);

  // Collect all unique serviceable pincodes for this city
  const pincodesList: string[] = [];
  branches.forEach((b: any) => {
    (b.delivery_zones || []).forEach((z: any) => {
      (z.pincodes || []).forEach((p: string) => {
        if (!pincodesList.includes(p)) pincodesList.push(p);
      });
    });
  });

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* ─── Hero City Banner ────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-rose-950 via-purple-950 to-slate-950 text-white py-16 px-4 sm:px-6 lg:px-8 border-b border-purple-800/40">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-rose-500/20 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="space-y-4 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-300 text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
                <MapPin className="w-3.5 h-3.5" />
                <span>{city.state}, {city.country}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
                Online Cake Delivery in{" "}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-rose-300 via-pink-300 to-purple-300">
                  {city.name}
                </span>
              </h1>
              <p className="text-sm sm:text-base text-purple-100/80 leading-relaxed">
                Experience gourmet perfection. Artisanal cakes hand-crafted by master pâtissiers, delivered fresh in 45-60 minutes across {city.name}.
              </p>

              {/* Quick stats pills */}
              <div className="flex flex-wrap gap-3 pt-2">
                <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-white/10 text-xs font-medium flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>{stats.branches} Fulfillment Hub{stats.branches !== 1 ? "s" : ""}</span>
                </div>
                <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-white/10 text-xs font-medium flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-pink-400" />
                  <span>{stats.zones} Delivery Zones</span>
                </div>
                <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-white/10 text-xs font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{stats.pincodes > 0 ? stats.pincodes : pincodesList.length} Pincodes Covered</span>
                </div>
              </div>
            </div>

            {/* Delivery Guarantees Card */}
            <div className="w-full lg:w-80 bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-5 space-y-4 shadow-2xl">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/10 pb-2">
                <Sparkles className="w-4 h-4 text-amber-400" /> {city.name} Delivery Promise
              </h3>
              <div className="space-y-3 text-xs text-purple-100">
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white block">45-Minute Express Delivery</span>
                    <span className="text-[11px] text-purple-200/70">Baked fresh right after your order</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white block">Artisan Recipe Guarantee</span>
                    <span className="text-[11px] text-purple-200/70">Certified hygiene & food safety</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Award className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white block">Midnight Surprise Slots</span>
                    <span className="text-[11px] text-purple-200/70">11:00 PM – 11:59 PM slot delivery</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Occasion Highlights in this City ────────────────────────── */}
      {occasions.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                Shop by Occasion in {city.name}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Find the perfect cake for your celebration</p>
            </div>
            <Link href="/occasions" className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1">
              All Occasions <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {occasions.map((occ) => (
              <Link
                key={occ.id}
                href={`/occasions/${occ.slug}`}
                className="group p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-600 transition-all text-center space-y-2 shadow-sm hover:shadow-md"
              >
                <div className="text-2xl group-hover:scale-110 transition-transform">{occ.icon || "🎂"}</div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-rose-600 dark:group-hover:text-rose-400 truncate">
                  {occ.name}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ─── Trending Gourmet Cakes in this City ─────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Cake className="w-5 h-5 text-rose-600" /> Bestselling Cakes in {city.name}
            </h2>
            <p className="text-xs text-slate-500 mt-1">Handcrafted with premium Belgian chocolate and fresh ingredients</p>
          </div>
          <Link href="/products" className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1 hover:underline">
            View All Cakes <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {products.map((p: any) => (
            <div
              key={p.product_id || p.id}
              className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col justify-between"
            >
              <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800">
                {p.thumbnail || p.images?.[0] ? (
                  <img
                    src={p.thumbnail || p.images?.[0]}
                    alt={p.title || p.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">🎂</div>
                )}
                <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px] shadow">
                  🟢 100% Veg
                </span>
                <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white font-semibold text-[10px] flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> 4.9
                </span>
              </div>

              <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1 group-hover:text-rose-600 transition-colors">
                    {p.title || p.name}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                    {p.description || "Gourmet cake freshly baked on order with signature sponge and buttercream."}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Starting from</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">
                      ₹{p.price || p.base_price || 599}
                    </span>
                  </div>
                  <Link
                    href={`/products/${p.handle || p.slug || p.product_id || p.id}`}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1"
                  >
                    Order Now
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Fulfillment Hubs in this City ───────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-rose-600" /> {city.name} Fulfillment Hubs & Bakeries
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Orders are dispatched from the closest hub to guarantee temperature control and 45-minute delivery.
              </p>
            </div>
          </div>

          {branches.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              Expanding rapidly in {city.name}! Delivery hubs launching shortly.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branches.map((b: any) => (
                <div
                  key={b.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">{b.name}</span>
                    <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded text-[10px] font-mono font-bold">
                      {b.code}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 flex items-start gap-1">
                    <MapPin className="w-3 h-3 shrink-0 mt-0.5 text-slate-400" />
                    <span>{b.address || `${b.name}, ${city.name}`}</span>
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-1">
                    <span>{(b.delivery_zones || []).length} Zones</span>
                    <span>•</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">● Operational</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─── Customer Testimonials in this City ──────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
        <div className="text-center space-y-1 mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Loved by 50,000+ Customers in {city.name}
          </h2>
          <p className="text-xs text-slate-500">Read what fellow cake lovers have to say</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              name: "Priya S.",
              area: city.name,
              comment: "Ordered a midnight birthday cake for my sister. It arrived at exactly 11:50 PM in pristine condition and tasted divine!",
              rating: 5,
            },
            {
              name: "Arun K.",
              area: city.name,
              comment: "Best Red Velvet cake in the city. Delivery was super fast (under 45 minutes) and the packaging was top notch.",
              rating: 5,
            },
            {
              name: "Sneha M.",
              area: city.name,
              comment: "The photo cake customization was so easy and the final result exceeded our expectations. Everyone loved the taste.",
              rating: 5,
            },
          ].map((t, i) => (
            <div
              key={i}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm"
            >
              <div className="flex items-center gap-1 text-amber-400">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-3.5 h-3.5 fill-amber-400" />
                ))}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic">
                &ldquo;{t.comment}&rdquo;
              </p>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-900 dark:text-white">
                {t.name} <span className="font-normal text-slate-400">• {t.area}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
