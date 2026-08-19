"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface CustomerAddress {
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
}

export function useAddresses() {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const inFlightPromiseRef = useRef<Promise<CustomerAddress[]> | null>(null);

  const fetchAddresses = useCallback(async (): Promise<CustomerAddress[]> => {
    if (inFlightPromiseRef.current) {
      return inFlightPromiseRef.current;
    }

    const promise = (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/customer/address", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });

        if (!res.ok) {
          if (res.status === 401) {
            setAddresses([]);
            return [];
          }
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to load addresses");
        }

        const body = await res.json();
        if (body.success && body.data) {
          const list = body.data.addresses || [];
          setAddresses(list);
          return list;
        }

        setAddresses([]);
        return [];
      } catch (err: any) {
        setError(err.message || "Unable to load addresses");
        return [];
      } finally {
        inFlightPromiseRef.current = null;
        setLoading(false);
      }
    })();

    inFlightPromiseRef.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const saveAddress = useCallback(
    async (addressData: Partial<CustomerAddress>): Promise<{ success: boolean; error?: string }> => {
      setSaving(true);
      setError(null);

      try {
        const res = await fetch("/api/customer/address", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(addressData),
        });

        const body = await res.json();

        if (!res.ok || !body.success) {
          const errorMsg = body.message || body.error || "Failed to save address";
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        if (body.data?.addresses) {
          setAddresses(body.data.addresses);
        }

        return { success: true };
      } catch (err: any) {
        const errorMsg = err.message || "Network error while saving address";
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const deleteAddress = useCallback(
    async (addressId: string): Promise<{ success: boolean; error?: string }> => {
      setSaving(true);
      setError(null);

      try {
        const res = await fetch(`/api/customer/address?id=${encodeURIComponent(addressId)}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        });

        const body = await res.json();

        if (!res.ok || !body.success) {
          const errorMsg = body.message || body.error || "Failed to delete address";
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        if (body.data?.addresses) {
          setAddresses(body.data.addresses);
        }

        return { success: true };
      } catch (err: any) {
        const errorMsg = err.message || "Network error while deleting address";
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setSaving(false);
      }
    },
    []
  );

  return {
    addresses,
    loading,
    error,
    saving,
    refetch: fetchAddresses,
    saveAddress,
    deleteAddress,
  };
}
