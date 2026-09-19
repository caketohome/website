"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { CustomerProfileDTO } from "@frontend/lib/crm/types";

interface CustomerContextType {
  customer: CustomerProfileDTO | null;
  loading: boolean;
  authenticated: boolean;
  refetchCustomer: () => Promise<void>;
  updateProfile: (payload: Partial<CustomerProfileDTO>) => Promise<boolean>;
  logout: () => Promise<void>;
}

const CustomerContext = createContext<CustomerContextType>({
  customer: null,
  loading: true,
  authenticated: false,
  refetchCustomer: async () => {},
  updateProfile: async () => false,
  logout: async () => {},
});

// Error Boundary Component
class CustomerErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, info: any) {
    console.error("[CustomerProvider Error Boundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.children;
    }
    return this.props.children;
  }
}

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<CustomerProfileDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef<Promise<any> | null>(null);

  const fetchCustomer = useCallback(async () => {
    // Request deduplication
    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    try {
      // Check cookies first
      if (typeof document !== "undefined") {
        const hasSession =
          document.cookie.includes("_cth_jwt") ||
          document.cookie.includes("_cth_customer_uid") ||
          document.cookie.includes("_cth_phone") ||
          document.cookie.includes("_cth_user_id");

        if (!hasSession) {
          setCustomer(null);
          setLoading(false);
          return;
        }
      }

      const reqPromise = (async () => {
        const res = await fetch("/api/v1/customer/me", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.customer) {
            setCustomer(data.customer);
            return data.customer;
          }
        }

        setCustomer(null);
        return null;
      })();

      inFlightRef.current = reqPromise;
      await reqPromise;
    } catch (err) {
      console.warn("[CustomerProvider] fetch error:", err);
      setCustomer(null);
    } finally {
      inFlightRef.current = null;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomer();

    // Listen for storage / login events across tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "cth_access_token" || e.key === "cth_auth_event") {
        fetchCustomer();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [fetchCustomer]);

  const updateProfile = useCallback(async (payload: Partial<CustomerProfileDTO>): Promise<boolean> => {
    try {
      const res = await fetch("/api/v1/customer/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.customer) {
          setCustomer(data.customer);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" }).catch(() => null);
      if (typeof document !== "undefined") {
        const cookiesToClear = [
          "_cth_jwt",
          "_cth_role",
          "_cth_user_id",
          "_cth_customer_uid",
          "_cth_phone",
          "_cth_branch_id",
          "_cth_partner_id",
        ];
        cookiesToClear.forEach((c) => {
          document.cookie = `${c}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
        });
        localStorage.removeItem("cth_access_token");
        localStorage.removeItem("cth_user");
      }
      setCustomer(null);
      window.location.assign("/login");
    } catch {
      window.location.assign("/login");
    }
  }, []);

  return (
    <CustomerErrorBoundary>
      <CustomerContext.Provider
        value={{
          customer,
          loading,
          authenticated: Boolean(customer),
          refetchCustomer: fetchCustomer,
          updateProfile,
          logout,
        }}
      >
        {children}
      </CustomerContext.Provider>
    </CustomerErrorBoundary>
  );
}

export function useCustomer() {
  const context = useContext(CustomerContext);
  if (!context) {
    throw new Error("useCustomer must be used within a CustomerProvider");
  }
  return context;
}
