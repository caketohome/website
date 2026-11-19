"use client";

import React, { useState } from "react";
import { Truck, Clock, MapPin, CheckCircle2, ShieldAlert } from "lucide-react";
import { ProductFulfillmentBadge } from "../shop/product-fulfillment-badge";

interface PdpDeliveryCheckerProps {
  productId: string;
  shopId?: string;
  showDeliveryChecker?: boolean;
}

export function PdpDeliveryChecker({
  productId,
  shopId,
  showDeliveryChecker = true,
}: PdpDeliveryCheckerProps) {
  if (!showDeliveryChecker) return null;

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider font-bold text-brand-text flex items-center gap-1.5">
          <Truck className="w-4 h-4 text-brand-primary" /> Delivery Availability & Slot
        </span>
      </div>

      {/* Embedded Real-time Fulfillment Engine Badge */}
      <div className="pt-1">
        <ProductFulfillmentBadge
          productId={productId}
          branchId={shopId}
          showDetails={true}
        />
      </div>

      {/* Delivery Highlights */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Scheduled & Express slots</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Temperature-controlled packaging</span>
        </div>
      </div>
    </div>
  );
}
