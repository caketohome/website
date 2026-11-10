"use client";

import React, { useState } from "react";
import { BookOpen, Utensils, AlertTriangle, Snowflake, Truck, ChevronDown } from "lucide-react";

interface PdpInfoTabsProps {
  description: string;
  ingredients?: string;
  allergens?: string;
  storageInstructions?: string;
  shelfLife?: string;
  showIngredients?: boolean;
  showAllergens?: boolean;
}

export function PdpInfoTabs({
  description,
  ingredients,
  allergens,
  storageInstructions,
  shelfLife,
  showIngredients = true,
  showAllergens = true,
}: PdpInfoTabsProps) {
  const tabs = [
    {
      id: "desc",
      label: "Description & Notes",
      icon: BookOpen,
      content: (
        <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
          {description || "Handcrafted with rich, velvety layers and frosted with fresh cream."}
        </div>
      ),
      visible: true,
    },
    {
      id: "ingredients",
      label: "Ingredients",
      icon: Utensils,
      content: (
        <div className="text-slate-600 text-sm leading-relaxed">
          <p className="font-semibold text-slate-800 mb-1.5">Artisanal Bakery Recipe:</p>
          <p>{ingredients || "Prepared with premium Belgian dark cocoa, unbleached pastry flour, pure dairy butter, cane sugar, and Madagascar vanilla."}</p>
        </div>
      ),
      visible: showIngredients && Boolean(ingredients),
    },
    {
      id: "allergens",
      label: "Allergen Advisory",
      icon: AlertTriangle,
      content: (
        <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200/60 text-slate-700 text-sm leading-relaxed">
          <span className="font-bold text-rose-800 block mb-1">Notice for Customers with Allergies:</span>
          <p>{allergens || "Contains dairy (butter, milk, cream) and wheat (gluten). Prepared in a kitchen that also handles tree nuts, almonds, and soy."}</p>
        </div>
      ),
      visible: showAllergens && Boolean(allergens),
    },
    {
      id: "storage",
      label: "Care & Storage",
      icon: Snowflake,
      content: (
        <div className="text-slate-600 text-sm leading-relaxed space-y-2">
          <p>
            <strong className="text-[#0F172A]">Refrigeration:</strong>{" "}
            {storageInstructions || "Store refrigerated at 2°C to 5°C. Keep in an airtight container or original box to maintain moisture."}
          </p>
          {shelfLife && (
            <p>
              <strong className="text-[#0F172A]">Best Before:</strong> Consume within {shelfLife}.
            </p>
          )}
          <p className="text-xs text-slate-500 italic">
            Chef's Tip: For the best flavor and velvety mouthfeel, remove from the refrigerator 15-20 minutes before serving.
          </p>
        </div>
      ),
      visible: Boolean(storageInstructions || shelfLife),
    },
    {
      id: "delivery",
      label: "Delivery & Returns",
      icon: Truck,
      content: (
        <div className="text-slate-600 text-sm leading-relaxed space-y-2">
          <p>
            <strong className="text-[#0F172A]">Temperature-Controlled Delivery:</strong> All cakes are transported in air-conditioned delivery vans to prevent melting or shape distortion.
          </p>
          <p>
            <strong className="text-[#0F172A]">Cancellation Policy:</strong> Orders can be cancelled or rescheduled up to 4 hours prior to the chosen delivery slot.
          </p>
          <p>
            <strong className="text-[#0F172A]">Freshness Guarantee:</strong> If your cake arrives damaged or incomplete, contact support immediately for an instant replacement or refund.
          </p>
        </div>
      ),
      visible: true,
    },
  ].filter((t) => t.visible);

  const [activeTabId, setActiveTabId] = useState<string>(tabs[0]?.id || "desc");

  return (
    <div className="w-full bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-7 mt-8">
      {/* Tab Navigation Headers */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 border-b border-slate-200/80 scrollbar-none">
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          const isActive = activeTabId === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTabId(tab.id)}
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap transition-all ${
                isActive
                  ? "bg-[#2563EB] text-white shadow-sm ring-1 ring-blue-400/30"
                  : "text-slate-600 hover:text-[#2563EB] hover:bg-slate-50"
              }`}
            >
              <IconComponent className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Panel */}
      <div className="pt-5 animate-in fade-in duration-200">
        {tabs.find((t) => t.id === activeTabId)?.content}
      </div>
    </div>
  );
}
