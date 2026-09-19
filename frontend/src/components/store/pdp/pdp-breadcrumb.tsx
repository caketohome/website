import React from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

interface PdpBreadcrumbProps {
  category?: string;
  categorySlug?: string;
  productTitle: string;
}

export function PdpBreadcrumb({
  category,
  categorySlug,
  productTitle,
}: PdpBreadcrumbProps) {
  const catSlug = categorySlug || (category ? category.toLowerCase().replace(/\s+/g, "-") : "");

  return (
    <nav aria-label="Breadcrumb" className="w-full">
      <ol
        className="flex items-center gap-1.5 sm:gap-2 text-xs text-slate-500 flex-wrap font-medium"
        itemScope
        itemType="https://schema.org/BreadcrumbList"
      >
        <li
          itemProp="itemListElement"
          itemScope
          itemType="https://schema.org/ListItem"
          className="flex items-center gap-1.5"
        >
          <Link
            href="/"
            itemProp="item"
            className="flex items-center gap-1 text-slate-500 hover:text-[#1D2F5D] transition-colors py-1"
          >
            <Home className="w-3.5 h-3.5 text-slate-400" />
            <span itemProp="name" className="hidden sm:inline">Home</span>
          </Link>
          <meta itemProp="position" content="1" />
          <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" aria-hidden="true" />
        </li>

        <li
          itemProp="itemListElement"
          itemScope
          itemType="https://schema.org/ListItem"
          className="flex items-center gap-1.5"
        >
          <Link
            href="/products"
            itemProp="item"
            className="text-slate-500 hover:text-[#1D2F5D] transition-colors py-1"
          >
            <span itemProp="name">Cakes</span>
          </Link>
          <meta itemProp="position" content="2" />
          <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" aria-hidden="true" />
        </li>

        {category && (
          <li
            itemProp="itemListElement"
            itemScope
            itemType="https://schema.org/ListItem"
            className="flex items-center gap-1.5"
          >
            <Link
              href={`/products?category=${catSlug}`}
              itemProp="item"
              className="text-slate-500 hover:text-[#1D2F5D] transition-colors py-1 truncate max-w-[140px] sm:max-w-[200px]"
            >
              <span itemProp="name">{category}</span>
            </Link>
            <meta itemProp="position" content="3" />
            <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" aria-hidden="true" />
          </li>
        )}

        <li
          itemProp="itemListElement"
          itemScope
          itemType="https://schema.org/ListItem"
          className="truncate max-w-[180px] sm:max-w-[280px]"
        >
          <span
            itemProp="name"
            className="text-[#1D2F5D] font-semibold truncate block py-1"
            aria-current="page"
          >
            {productTitle}
          </span>
          <meta itemProp="position" content={category ? "4" : "3"} />
        </li>
      </ol>
    </nav>
  );
}
