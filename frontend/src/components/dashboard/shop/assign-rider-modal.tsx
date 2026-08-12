"use client";

import React, { useEffect, useState } from "react";
import { fetchBranchDeliveryPartners, assignBranchOrderRider } from "@frontend/lib/data/manager";

interface AssignRiderModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
  onAssigned: () => void;
}

export default function AssignRiderModal({ order, isOpen, onClose, onAssigned }: AssignRiderModalProps) {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(null);
      fetchBranchDeliveryPartners()
        .then((res) => {
          if (res.success && res.partners) {
            setPartners(res.partners);
          }
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen || !order) return null;

  const handleAssign = async (partnerId: string) => {
    try {
      setSubmittingId(partnerId);
      setError(null);
      const res = await assignBranchOrderRider(order.id, partnerId);
      if (!res.success && res.error) {
        setError(res.error);
      } else {
        onAssigned();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "Failed to assign rider");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 bg-zinc-900 text-white flex justify-between items-center">
          <div>
            <h3 className="font-bold text-base">Assign Delivery Partner</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Order #{order.order_number} • Slot: {order.delivery_slot || "2:00 PM - 4:00 PM"}</p>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white">
            ✕
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-700 dark:text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Eligible Branch Riders</span>
            <span className="text-xs text-zinc-400">{partners.length} assigned to this kitchen hub</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-zinc-500 text-sm">Fetching eligible riders for this branch...</div>
          ) : partners.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs bg-zinc-50 dark:bg-zinc-950/50 rounded-xl">
              No delivery partners are currently assigned or active for this operational branch.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {partners.map((p) => {
                const isOnline = p.availability_status === "ONLINE";
                const isCapacityFull = (p.current_active_orders || 0) >= (p.maximum_concurrent_orders || 5);
                const isAssignedToThis = order.delivery_partner_id === p.id;

                return (
                  <div
                    key={p.id}
                    className={`p-3.5 rounded-xl border transition flex items-center justify-between ${
                      isAssignedToThis
                        ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                        : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 hover:border-zinc-300"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-zinc-900 dark:text-white">{p.name}</h4>
                        <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-zinc-400"}`} />
                        <span className="text-[10px] font-semibold text-zinc-500">
                          {isOnline ? "ONLINE" : p.availability_status}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">{p.phone} • ★ {p.rating || 5.0}</p>
                      <div className="flex gap-2 text-[11px] text-zinc-600 dark:text-zinc-400 mt-1">
                        <span>
                          Active Load: <b className={isCapacityFull ? "text-rose-600 font-bold" : "text-zinc-900 dark:text-white font-bold"}>
                            {p.current_active_orders || 0}/{p.maximum_concurrent_orders || 5} orders
                          </b>
                        </span>
                      </div>
                    </div>

                    <div>
                      {isAssignedToThis ? (
                        <span className="px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                          Assigned
                        </span>
                      ) : (
                        <button
                          disabled={isCapacityFull || submittingId === p.id}
                          onClick={() => handleAssign(p.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {submittingId === p.id ? "Assigning..." : isCapacityFull ? "Capacity Full" : "Assign Rider"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
