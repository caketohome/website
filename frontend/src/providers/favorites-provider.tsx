"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/providers/auth-provider";
import { apiClient } from "@/lib/api-client";
import { useRouter, usePathname } from "next/navigation";

interface FavoritesContextType {
  favoriteIds: Set<string>;
  favoritesList: any[];
  favoritesCount: number;
  loading: boolean;
  isFavorited: (productId: string) => boolean;
  toggleFavorite: (productId: string, productMeta?: { title?: string; handle?: string }) => Promise<boolean>;
  addFavorite: (productId: string) => Promise<boolean>;
  removeFavorite: (productId: string) => Promise<boolean>;
  refreshFavorites: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextType>({
  favoriteIds: new Set<string>(),
  favoritesList: [],
  favoritesCount: 0,
  loading: false,
  isFavorited: () => false,
  toggleFavorite: async () => false,
  addFavorite: async () => false,
  removeFavorite: async () => false,
  refreshFavorites: async () => {},
});

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set<string>());
  const [favoritesList, setFavoritesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef<boolean>(false);
  const previousAuthUidRef = useRef<string | null>(null);

  const refreshFavorites = useCallback(async () => {
    if (!currentUser) {
      setFavoriteIds(new Set<string>());
      setFavoritesList([]);
      setLoading(false);
      return;
    }

    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);

    try {
      const res = await apiClient.getCustomerFavorites();
      if (res && res.success) {
        const idList: string[] = Array.isArray(res.favorite_ids) ? res.favorite_ids : (res.favorites || []).map((f: any) => f.product_id || f.id);
        setFavoriteIds(new Set(idList.map(String)));
        setFavoritesList(Array.isArray(res.favorites) ? res.favorites : []);
      }
    } catch (err) {
      console.warn("[FavoritesProvider] Error loading customer favorites:", err);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [currentUser]);

  // Synchronize when customer identity changes (login, logout, switch customer)
  useEffect(() => {
    const currentUid = currentUser?.id || currentUser?.customer_uid || currentUser?.phone || null;
    if (currentUid !== previousAuthUidRef.current) {
      previousAuthUidRef.current = currentUid;
      if (!currentUid) {
        // Customer logged out: instantly purge state
        setFavoriteIds(new Set<string>());
        setFavoritesList([]);
        setLoading(false);
      } else {
        // Customer logged in: fetch fresh favorites
        refreshFavorites();
      }
    }
  }, [currentUser, refreshFavorites]);

  const isFavorited = useCallback(
    (productId: string) => {
      if (!productId) return false;
      return favoriteIds.has(String(productId).trim());
    },
    [favoriteIds]
  );

  const toggleFavorite = useCallback(
    async (productId: string, productMeta?: { title?: string; handle?: string }): Promise<boolean> => {
      if (!productId) return false;
      const cleanProdId = String(productId).trim();

      // Guest handling: prompt login and preserve redirect path
      if (!currentUser) {
        const redirectUrl = pathname ? `/login?redirect=${encodeURIComponent(pathname)}` : "/login";
        if (typeof window !== "undefined") {
          const proceed = window.confirm(
            `Sign in to save ${productMeta?.title ? `"${productMeta.title}"` : "this cake"} to your Favorites!`
          );
          if (proceed) {
            router.push(redirectUrl);
          }
        }
        return false;
      }

      const currentlyFavorited = favoriteIds.has(cleanProdId);
      const nextFavorited = !currentlyFavorited;

      // ── OPTIMISTIC UI UPDATE (Instant 0ms feedback) ──
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (nextFavorited) {
          next.add(cleanProdId);
        } else {
          next.delete(cleanProdId);
        }
        return next;
      });

      if (!nextFavorited) {
        setFavoritesList((prev) => prev.filter((f) => f.product_id !== cleanProdId && f.id !== cleanProdId));
      }

      try {
        if (nextFavorited) {
          const res = await apiClient.addCustomerFavorite(cleanProdId);
          if (!res || !res.success) {
            throw new Error(res?.error || "Failed to add favorite");
          }
          if (res.favorite) {
            setFavoritesList((prev) => [res.favorite, ...prev]);
          }
        } else {
          const res = await apiClient.removeCustomerFavorite(cleanProdId);
          if (!res || !res.success) {
            throw new Error("Failed to remove favorite");
          }
        }
        return true;
      } catch (err: any) {
        console.error("[FavoritesProvider] Network error toggling favorite, rolling back UI:", err);
        // ── ROLLBACK ON NETWORK FAILURE ──
        setFavoriteIds((prev) => {
          const rollback = new Set(prev);
          if (currentlyFavorited) {
            rollback.add(cleanProdId);
          } else {
            rollback.delete(cleanProdId);
          }
          return rollback;
        });
        refreshFavorites();
        return false;
      }
    },
    [currentUser, favoriteIds, pathname, refreshFavorites, router]
  );

  const addFavorite = useCallback(
    async (productId: string): Promise<boolean> => {
      if (isFavorited(productId)) return true;
      return toggleFavorite(productId);
    },
    [isFavorited, toggleFavorite]
  );

  const removeFavorite = useCallback(
    async (productId: string): Promise<boolean> => {
      if (!isFavorited(productId)) return true;
      return toggleFavorite(productId);
    },
    [isFavorited, toggleFavorite]
  );

  const contextValue: FavoritesContextType = {
    favoriteIds,
    favoritesList,
    favoritesCount: favoriteIds.size,
    loading,
    isFavorited,
    toggleFavorite,
    addFavorite,
    removeFavorite,
    refreshFavorites,
  };

  return <FavoritesContext.Provider value={contextValue}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return context;
}
