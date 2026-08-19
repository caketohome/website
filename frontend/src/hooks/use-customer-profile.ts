"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface CustomerProfileData {
  id: string;
  customer_uid: string;
  name: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string | null;
  preferences?: {
    favourite_flavour?: string;
    whatsapp_notifications?: boolean;
    sms_notifications?: boolean;
    marketing_emails?: boolean;
  };
  stats?: {
    total_orders: number;
    total_spend: number;
    last_order_date: string | null;
  };
  addresses?: Array<{
    id: string;
    label?: string;
    type?: string;
    name?: string;
    phone?: string;
    address_1: string;
    address_2?: string;
    landmark?: string;
    city: string;
    state?: string;
    postal_code: string;
    is_default?: boolean;
  }>;
  created_at?: string;
}

export function useCustomerProfile(initialData?: CustomerProfileData | null) {
  const [profile, setProfile] = useState<CustomerProfileData | null>(initialData || null);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<boolean>(false);
  const inFlightPromiseRef = useRef<Promise<CustomerProfileData | null> | null>(null);

  const fetchProfile = useCallback(async (): Promise<CustomerProfileData | null> => {
    if (inFlightPromiseRef.current) {
      return inFlightPromiseRef.current;
    }

    const promise = (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/customer/profile", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });

        if (!res.ok) {
          if (res.status === 401) {
            setProfile(null);
            return null;
          }
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to load customer profile");
        }

        const body = await res.json();
        if (body.success && body.data?.profile) {
          setProfile(body.data.profile);
          return body.data.profile;
        }

        setProfile(null);
        return null;
      } catch (err: any) {
        setError(err.message || "Unable to load customer profile");
        return null;
      } finally {
        inFlightPromiseRef.current = null;
        setLoading(false);
      }
    })();

    inFlightPromiseRef.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    if (!initialData) {
      fetchProfile();
    }
  }, [fetchProfile, initialData]);

  const updateProfile = useCallback(
    async (payload: Partial<CustomerProfileData>): Promise<{ success: boolean; error?: string }> => {
      if (!profile) return { success: false, error: "No profile loaded" };

      const backupProfile = { ...profile };

      // ── Optimistic UI Update ──
      const optimisticallyUpdated: CustomerProfileData = {
        ...profile,
        ...payload,
        name: payload.full_name || profile.name,
        full_name: payload.full_name || profile.full_name,
        email: payload.email !== undefined ? payload.email : profile.email,
        date_of_birth: payload.date_of_birth !== undefined ? payload.date_of_birth : profile.date_of_birth,
        preferences: {
          ...(profile.preferences || {}),
          ...(payload.preferences || {}),
        },
      };

      setProfile(optimisticallyUpdated);
      setUpdating(true);
      setError(null);

      try {
        const res = await fetch("/api/customer/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const body = await res.json();

        if (!res.ok || !body.success) {
          // Instant Rollback on failure
          setProfile(backupProfile);
          const errorMsg = body.message || body.error || "Failed to update profile";
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        if (body.data?.profile) {
          setProfile(body.data.profile);
        }

        return { success: true };
      } catch (err: any) {
        // Instant Rollback on exception
        setProfile(backupProfile);
        const errorMsg = err.message || "Network error while saving profile";
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setUpdating(false);
      }
    },
    [profile]
  );

  return {
    profile,
    loading,
    error,
    updating,
    refetch: fetchProfile,
    updateProfile,
  };
}
