"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface CustomerOrder {
  id: string;
  order_number?: string;
  created_at: string;
  status: string;
  order_status?: string;
  payment_status?: string;
  fulfillment_status?: string;
  subtotal: number;
  delivery_fee?: number;
  discount_total?: number;
  tax_total?: number;
  grand_total: number;
  total?: number;
  currency_code?: string;
  branch_name?: string;
  city_name?: string;
  delivery_slot?: string;
  scheduled_delivery_date?: string;
  items: Array<{
    id?: string;
    product_id: string;
    product_name?: string;
    title?: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    thumbnail?: string;
    weight?: string;
    shape?: string;
    flavour?: string;
    cake_message?: string;
  }>;
  shipping_address?: {
    name?: string;
    phone?: string;
    address_1: string;
    address_2?: string;
    city: string;
    postal_code: string;
  };
}

export function useOrders() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [totalOrders, setTotalOrders] = useState<number>(0);
  const [totalSpend, setTotalSpend] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const inFlightPromiseRef = useRef<Promise<CustomerOrder[]> | null>(null);

  const fetchOrders = useCallback(async (): Promise<CustomerOrder[]> => {
    if (inFlightPromiseRef.current) {
      return inFlightPromiseRef.current;
    }

    const promise = (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/customer/orders", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });

        if (!res.ok) {
          if (res.status === 401) {
            setOrders([]);
            return [];
          }
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to load orders");
        }

        const body = await res.json();
        if (body.success && body.data) {
          const list = body.data.orders || [];
          setOrders(list);
          setTotalOrders(body.data.total_orders ?? list.length);
          setTotalSpend(body.data.total_spend ?? 0);
          return list;
        }

        setOrders([]);
        return [];
      } catch (err: any) {
        setError(err.message || "Unable to load orders");
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
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    totalOrders,
    totalSpend,
    loading,
    error,
    refetch: fetchOrders,
  };
}
