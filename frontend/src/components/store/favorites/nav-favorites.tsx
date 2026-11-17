"use client";

import React from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useFavorites } from "@/providers/favorites-provider";

export function NavFavorites() {
  const { favoritesCount } = useFavorites();

  return (
    <Link
      href="/account/wishlist"
      className="relative flex items-center justify-center min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] p-2 rounded-xl text-slate-600 hover:text-brand-primary hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
      title="My Favorites"
      aria-label={`My Favorites (${favoritesCount} items)`}
    >
      <Heart className="w-5 h-5 text-slate-600 hover:text-brand-primary" />
      {favoritesCount > 0 && (
        <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-brand-primary rounded-full shadow-sm pointer-events-none">
          {favoritesCount > 99 ? "99+" : favoritesCount}
        </span>
      )}
    </Link>
  );
}
