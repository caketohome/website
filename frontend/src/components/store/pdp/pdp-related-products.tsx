"use client";

import React from "react";
import { ProductCard } from "../catalog/product-card";
import { Sparkles } from "lucide-react";

interface PdpRelatedProductsProps {
  products: any[];
  currentProductId: string;
  heading?: string;
  limit?: number;
}

export function PdpRelatedProducts({
  products = [],
  currentProductId,
  heading = "You May Also Adore",
  limit = 4,
}: PdpRelatedProductsProps) {
  const filtered = (products || [])
    .filter((p) => {
      const pid = p.id || p.product_id;
      return pid && pid !== currentProductId;
    })
    .slice(0, limit);

  if (filtered.length === 0) return null;

  return (
    <section className="w-full pt-12 mt-12 border-t border-slate-200/90" aria-label="Related Products">
      <div className="flex flex-col gap-2 mb-8 text-center sm:text-left">
        <span className="text-xs uppercase tracking-[0.2em] font-bold text-brand-primary flex items-center justify-center sm:justify-start gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Curated Recommendations
        </span>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-brand-text">
          {heading}
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filtered.map((item) => (
          <ProductCard key={item.id || item.product_id} product={item} />
        ))}
      </div>
    </section>
  );
}
