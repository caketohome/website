"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { authLogout, clearClientAuthCookies, clearClientAuthStorage, broadcastMultiTabLogout, initMultiTabLogoutListener } from "@/lib/auth-service";

export interface AuthUser {
  id: string;
  customer_uid?: string;
  name: string;
  first_name: string;
  last_name?: string;
  email: string;
  phone: string;
  role: string;
  branch_id?: string | null;
  branch_name?: string | null;
  delivery_partner_id?: string | null;
  partner_number?: string | null;
  profile_ids?: string[];
  profile_names?: string[];
  permissions?: string[];
  date_of_birth?: string | null;
  created_at?: string;
}

export interface AuthContextType {
  currentUser: AuthUser | null;
  user: AuthUser | null; // Alias for convenience
  loading: boolean;
  isAuthenticated: boolean;
  login: (user?: AuthUser) => Promise<void>;
  logout: (redirectUrl?: string) => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  user: null,
  loading: true,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
  refreshUser: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const inFlightPromiseRef = useRef<Promise<AuthUser | null> | null>(null);
  const router = useRouter();

  // Primary authoritative session fetch from GET /api/auth/me
  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    if (inFlightPromiseRef.current) {
      return inFlightPromiseRef.current;
    }

    const fetchPromise = (async () => {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
        });

        if (res.ok) {
          const body = await res.json();
          if (body.success && body.data?.user) {
            const resolvedUser = body.data.user;
            setCurrentUser(resolvedUser);
            return resolvedUser;
          }
        }

        // Fallback attempt to /api/customer/profile if auth/me is not ready
        if (res.status === 401 || !res.ok) {
          setCurrentUser(null);
          return null;
        }

        setCurrentUser(null);
        return null;
      } catch (err) {
        console.warn("[AuthProvider] Session refresh error:", err);
        setCurrentUser(null);
        return null;
      } finally {
        inFlightPromiseRef.current = null;
        setLoading(false);
      }
    })();

    inFlightPromiseRef.current = fetchPromise;
    return fetchPromise;
  }, []);

  const logout = useCallback(async (redirectUrl: string = "/login") => {
    // 1. Instant local React state purge
    setCurrentUser(null);
    setLoading(false);

    // 2. Clear all cookies, localStorage, and sessionStorage
    clearClientAuthCookies();
    clearClientAuthStorage();

    // 3. Inform server & broadcast across tabs
    await authLogout({ redirectUrl, reason: "user_initiated" });
  }, []);

  const login = useCallback(async (user?: AuthUser) => {
    if (user) {
      setCurrentUser(user);
      setLoading(false);
    } else {
      await refreshUser();
    }
  }, [refreshUser]);

  // Initial session discovery & listeners
  useEffect(() => {
    refreshUser();

    // Multi-tab logout sync
    const cleanupTabListener = initMultiTabLogoutListener(() => {
      setCurrentUser(null);
      setLoading(false);
      router.refresh();
    });

    // Global 401 Interceptor: Auto-logout on unauthorized responses
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      if (response.status === 401) {
        const url = typeof args[0] === "string" ? args[0] : args[0] instanceof Request ? args[0].url : "";
        // Don't loop on /api/auth/me or /api/auth/logout
        if (!url.includes("/api/auth/me") && !url.includes("/api/auth/logout") && !url.includes("/api/v1/auth/logout")) {
          console.warn("[AuthProvider] 401 Unauthorized detected for:", url);
          setCurrentUser(null);
          clearClientAuthCookies();
          clearClientAuthStorage();
        }
      }

      return response;
    };

    return () => {
      cleanupTabListener();
      window.fetch = originalFetch;
    };
  }, [refreshUser, router]);

  return (
    <AuthContext.Provider
      value={{
        currentUser: currentUser ?? null,
        user: currentUser ?? null,
        loading,
        isAuthenticated: Boolean(currentUser),
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
