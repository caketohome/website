"use client";

import React, { useEffect, useState } from "react";
import { fetchBranchOrderKot, reprintBranchOrderKot } from "@frontend/lib/data/manager";

interface KotModalProps {
  orderId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function KotModal({ orderId, isOpen, onClose }: KotModalProps) {
  const [kotData, setKotData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [reprintCount, setReprintCount] = useState(1);

  useEffect(() => {
    if (isOpen && orderId) {
      setLoading(true);
      fetchBranchOrderKot(orderId)
        .then((res) => {
          if (res.success && res.kot) {
            setKotData(res.kot);
            setReprintCount(res.kot.reprint_count || 1);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, orderId]);

  if (!isOpen || !orderId) return null;

  const handlePrint = async () => {
    try {
      await reprintBranchOrderKot(orderId);
      setReprintCount((prev) => prev + 1);
      window.print();
    } catch {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl border border-brand-border dark:border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-brand-navy text-white flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-lg">🖨️</span>
            <h3 className="font-bold text-sm">Kitchen Order Ticket (KOT)</h3>
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
              Reprint #{reprintCount}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-xs font-bold rounded-lg transition"
            >
              Print Ticket
            </button>
            <button
              onClick={onClose}
              className="p-1 text-brand-text-muted hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Printable Ticket */}
        {loading ? (
          <div className="p-8 text-center text-brand-text-muted text-sm">Loading KOT Ticket Data...</div>
        ) : kotData ? (
          <div className="p-6 font-mono text-brand-navy dark:text-zinc-100 space-y-4 bg-white dark:bg-zinc-900 print:p-0 print:text-black">
            {/* Header / Brand */}
            <div className="text-center border-b-2 border-dashed border-zinc-400 pb-3 flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/brand/caketo-home-logo-black.png"
                alt="CakeToHome"
                className="h-8 w-auto object-contain mx-auto mb-1 print:block dark:hidden"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/brand/caketo-home-logo-white.png"
                alt="CakeToHome"
                className="h-8 w-auto object-contain mx-auto mb-1 hidden dark:block print:hidden"
              />
              <h2 className="text-sm font-black tracking-wider uppercase">GOURMET KITCHEN</h2>
              <p className="text-xs text-brand-text-muted font-sans">{kotData.branch_name} ({kotData.branch_code})</p>
              <div className="flex justify-between text-xs mt-2 font-bold">
                <span>KOT: {kotData.kot_number}</span>
                <span>ORD: #{kotData.order_number}</span>
              </div>
            </div>

            {/* Delivery Meta */}
            <div className="grid grid-cols-2 gap-2 text-xs border-b border-dashed border-brand-border pb-2">
              <div>
                <span className="text-brand-text-muted font-sans text-[10px]">CUSTOMER:</span>
                <p className="font-bold truncate">{kotData.customer_name}</p>
              </div>
              <div>
                <span className="text-brand-text-muted font-sans text-[10px]">DELIVERY SLOT:</span>
                <p className="font-bold text-brand-primary dark:text-rose-400">{kotData.delivery_slot}</p>
              </div>
              <div>
                <span className="text-brand-text-muted font-sans text-[10px]">DATE:</span>
                <p className="font-bold">{kotData.delivery_date}</p>
              </div>
              <div>
                <span className="text-brand-text-muted font-sans text-[10px]">PRIORITY:</span>
                <p className="font-black text-brand-gold uppercase">{kotData.priority || "NORMAL"}</p>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2 border-b-2 border-dashed border-zinc-400 pb-3">
              <span className="text-[10px] text-brand-text-muted font-sans font-bold uppercase">BAKING & PREP ITEMS:</span>
              {kotData.items.map((item: any, i: number) => (
                <div key={i} className="p-2 bg-brand-surface-muted dark:bg-zinc-800/50 rounded border border-brand-border dark:border-zinc-700">
                  <div className="flex justify-between font-bold text-sm">
                    <span>{item.title}</span>
                    <span>x{item.quantity}</span>
                  </div>
                  <div className="text-xs text-brand-text-muted dark:text-zinc-300 grid grid-cols-2 gap-1 mt-1">
                    <span>Weight: <b className="text-brand-navy dark:text-white">{item.weight}</b></span>
                    <span>Flavor: <b className="text-brand-navy dark:text-white">{item.flavor}</b></span>
                    <span>Filling: <b className="text-brand-navy dark:text-white">{item.filling}</b></span>
                    <span>Shape: <b className="text-brand-navy dark:text-white">{item.shape}</b></span>
                  </div>
                </div>
              ))}
            </div>

            {/* Custom Inscription */}
            <div className="p-2.5 bg-brand-light dark:bg-rose-950/30 rounded border border-brand-primary/20 dark:border-rose-900">
              <span className="text-[10px] text-brand-primary dark:text-rose-300 font-sans font-bold uppercase">MESSAGE ON CAKE:</span>
              <p className="font-bold text-brand-primary dark:text-rose-300 text-sm mt-0.5">
                &ldquo;{kotData.customization?.cake_message || "Best Wishes!"}&rdquo;
              </p>
            </div>

            {/* Photo Cake Preview if applicable */}
            {kotData.photo_cake?.is_photo_cake && (
              <div className="p-2.5 bg-brand-light dark:bg-brand-navy/30 rounded border border-brand-primary/30 dark:border-brand-navy flex gap-3 items-center">
                {kotData.photo_cake.photo_url && (
                  <img src={kotData.photo_cake.photo_url} alt="Photo Preview" className="w-14 h-14 rounded object-cover border border-brand-primary/30" />
                )}
                <div className="text-xs">
                  <p className="font-bold text-brand-navy dark:text-brand-primary/30">PHOTO CAKE PRINT SHEET</p>
                  <p className="text-[10px] text-brand-text-muted">{kotData.photo_cake.instructions}</p>
                </div>
              </div>
            )}

            {/* Accessories Checklist */}
            <div className="text-xs space-y-1">
              <span className="text-[10px] text-brand-text-muted font-sans font-bold uppercase">PACKAGING CHECKLIST:</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 font-bold">
                  <input type="checkbox" defaultChecked className="rounded text-brand-primary" /> Knife
                </label>
                <label className="flex items-center gap-1.5 font-bold">
                  <input type="checkbox" defaultChecked className="rounded text-brand-primary" /> Candle
                </label>
                <label className="flex items-center gap-1.5 font-bold">
                  <input type="checkbox" defaultChecked className="rounded text-brand-primary" /> Box Seal
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] text-brand-text-muted pt-2 border-t border-brand-border font-sans">
              Printed on {new Date().toLocaleString("en-IN")} • KOT Audit Logged
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-brand-primary">Failed to load KOT data.</div>
        )}
      </div>
    </div>
  );
}
