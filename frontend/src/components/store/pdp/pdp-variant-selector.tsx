"use client";

import React from "react";
import { Check } from "lucide-react";

export interface WeightOption {
  id: string;
  name: string;
  price: number;
  is_enabled?: boolean;
}

export interface GenericOption {
  id: string;
  name: string;
  price_modifier?: number;
  extra_price?: number;
  additional_price?: number;
  is_enabled?: boolean;
}

interface PdpVariantSelectorProps {
  weights: WeightOption[];
  selectedWeight: WeightOption | null;
  onSelectWeight: (weight: WeightOption) => void;
  showWeight?: boolean;
  requiredWeight?: boolean;

  shapes?: GenericOption[];
  selectedShape?: GenericOption | null;
  onSelectShape?: (shape: GenericOption) => void;
  showShape?: boolean;
  requiredShape?: boolean;

  flavours?: GenericOption[];
  selectedFlavour?: GenericOption | null;
  onSelectFlavour?: (flavour: GenericOption) => void;
  showFlavour?: boolean;
  requiredFlavour?: boolean;

  fillings?: GenericOption[];
  selectedFilling?: GenericOption | null;
  onSelectFilling?: (filling: GenericOption) => void;
  showFilling?: boolean;
  requiredFilling?: boolean;

  creams?: GenericOption[];
  selectedCream?: GenericOption | null;
  onSelectCream?: (cream: GenericOption) => void;
  showCream?: boolean;
  requiredCream?: boolean;
}

export function PdpVariantSelector({
  weights = [],
  selectedWeight,
  onSelectWeight,
  showWeight = true,
  requiredWeight = true,

  shapes = [],
  selectedShape,
  onSelectShape,
  showShape = false,
  requiredShape = false,

  flavours = [],
  selectedFlavour,
  onSelectFlavour,
  showFlavour = false,
  requiredFlavour = false,

  fillings = [],
  selectedFilling,
  onSelectFilling,
  showFilling = false,
  requiredFilling = false,

  creams = [],
  selectedCream,
  onSelectCream,
  showCream = false,
  requiredCream = false,
}: PdpVariantSelectorProps) {
  const validWeights = (weights || []).filter((w) => {
    const n = String(w.name || "").trim().toLowerCase();
    return n !== "1 pc" && n !== "1 piece" && n !== "1pc";
  });

  return (
    <div className="flex flex-col gap-6 w-full pt-2">
      {/* 1. Weight / Size Selector */}
      {showWeight && validWeights.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <label className="text-xs uppercase tracking-wider font-bold text-brand-text flex items-center gap-1">
              Select Size & Weight {requiredWeight && <span className="text-rose-500">*</span>}
            </label>
            {selectedWeight && (
              <span className="text-xs text-slate-500 font-medium">
                Serving: ~{selectedWeight.name.includes("0.5") ? "4-6" : selectedWeight.name.includes("1.5") ? "12-16" : selectedWeight.name.includes("2") ? "18-24" : "8-10"} people
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {validWeights.map((w) => {
              const isSelected = selectedWeight && (selectedWeight.id === w.id || selectedWeight.name === w.name);
              return (
                <button
                  key={w.id || w.name}
                  type="button"
                  onClick={() => onSelectWeight(w)}
                  aria-pressed={Boolean(isSelected)}
                  className={`relative flex flex-col items-center justify-center p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 text-center ${
                    isSelected
                      ? "border-brand-primary bg-brand-primary text-white shadow-md scale-[1.02] ring-2 ring-blue-400/30"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50 shadow-2xs"
                  }`}
                >
                  <span className="text-sm font-bold tracking-tight">{w.name}</span>
                  <span className={`text-xs mt-1 font-semibold ${isSelected ? "text-brand-gold/40" : "text-brand-text"}`}>
                    ₹{w.price}
                  </span>
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-brand-primary flex items-center justify-center text-[10px] text-white">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Shape Selector */}
      {showShape && shapes.length > 0 && onSelectShape && (
        <div className="flex flex-col gap-3 pt-3 border-t border-slate-200/80">
          <label className="text-xs uppercase tracking-wider font-bold text-brand-text flex items-center gap-1">
            Cake Shape {requiredShape && <span className="text-rose-500">*</span>}
          </label>
          <div className="flex flex-wrap gap-2.5">
            {shapes.map((s) => {
              const isSelected = selectedShape && (selectedShape.id === s.id || selectedShape.name === s.name);
              const priceMod = Number(s.price_modifier || s.additional_price || 0);
              return (
                <button
                  key={s.id || s.name}
                  type="button"
                  onClick={() => onSelectShape(s)}
                  aria-pressed={Boolean(isSelected)}
                  className={`px-4 py-2.5 rounded-full text-xs font-semibold border transition-all ${
                    isSelected
                      ? "border-brand-primary bg-brand-primary text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {s.name} {priceMod > 0 ? `(+₹${priceMod})` : ""}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Flavour & Filling Selectors */}
      {((showFlavour && flavours.length > 0) || (showFilling && fillings.length > 0)) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200/80">
          {showFlavour && flavours.length > 0 && onSelectFlavour && (
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-wider font-bold text-brand-text">
                Cake Flavour {requiredFlavour && <span className="text-rose-500">*</span>}
              </label>
              <select
                value={selectedFlavour?.name || ""}
                onChange={(e) => {
                  const found = flavours.find((f) => f.name === e.target.value);
                  if (found) onSelectFlavour(found);
                }}
                className="w-full text-sm py-2.5 px-3.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-primary shadow-2xs"
              >
                {flavours.map((f) => {
                  const pMod = Number(f.price_modifier || f.extra_price || 0);
                  return (
                    <option key={f.id || f.name} value={f.name}>
                      {f.name} {pMod > 0 ? `(+₹${pMod})` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {showFilling && fillings.length > 0 && onSelectFilling && (
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-wider font-bold text-brand-text">
                Inner Filling {requiredFilling && <span className="text-rose-500">*</span>}
              </label>
              <select
                value={selectedFilling?.name || ""}
                onChange={(e) => {
                  const found = fillings.find((fil) => fil.name === e.target.value);
                  if (found) onSelectFilling(found);
                }}
                className="w-full text-sm py-2.5 px-3.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-primary shadow-2xs"
              >
                {fillings.map((fil) => {
                  const pMod = Number(fil.price_modifier || fil.extra_price || 0);
                  return (
                    <option key={fil.id || fil.name} value={fil.name}>
                      {fil.name} {pMod > 0 ? `(+₹${pMod})` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>
      )}

      {/* 4. Cream & Frosting Selector */}
      {showCream && creams.length > 0 && onSelectCream && (
        <div className="flex flex-col gap-2 pt-3 border-t border-slate-200/80">
          <label className="text-xs uppercase tracking-wider font-bold text-brand-text">
            Cream & Frosting {requiredCream && <span className="text-rose-500">*</span>}
          </label>
          <select
            value={selectedCream?.name || ""}
            onChange={(e) => {
              const found = creams.find((c) => c.name === e.target.value);
              if (found) onSelectCream(found);
            }}
            className="w-full text-sm py-2.5 px-3.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-primary shadow-2xs"
          >
            {creams.map((c) => {
              const pMod = Number(c.price_modifier || c.extra_price || 0);
              return (
                <option key={c.id || c.name} value={c.name}>
                  {c.name} {pMod > 0 ? `(+₹${pMod})` : ""}
                </option>
              );
            })}
          </select>
        </div>
      )}
    </div>
  );
}
