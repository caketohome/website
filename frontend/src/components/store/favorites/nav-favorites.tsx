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
      className="relative p-2 rounded-full text-navy-accent/80 hover:text-navy-accent hover:bg-navy-accent/5 transition-colors"
      title="My Favorites"
      aria-label={`My Favorites (${favoritesCount} items)`}
    >
      <Heart className="w-5 h-5" />
      {favoritesCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-rose-600 rounded-full shadow-sm">
          {favoritesCount > 99 ? "99+" : favoritesCount}
        </span>
      )}
    </Link>
  );
}
