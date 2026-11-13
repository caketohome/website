"use client";

import React from "react";
import Image from "next/image";
import { Sparkles, Image as ImageIcon, MessageSquare, Gift, Check } from "lucide-react";

function Switch({
  checked,
  onCheckedChange,
  id,
  label,
}: {
  checked: boolean;
  onCheckedChange: (val: boolean) => void;
  id?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      aria-label={label || "Toggle"}
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#800020] focus-visible:ring-offset-2 ${
        checked ? "bg-[#800020]" : "bg-slate-300"
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export interface AccessoryOption {
  id: string;
  name: string;
  price: number;
  thumbnail?: string;
  stock?: number;
  available_stock?: number;
  low_stock_threshold?: number;
}

interface PdpCustomizationFormProps {
  showDietary?: boolean;
  hasSugarFree?: boolean;
  isSugarFree: boolean;
  onSugarFreeChange: (val: boolean) => void;

  hasGlutenFree?: boolean;
  isGlutenFree: boolean;
  onGlutenFreeChange: (val: boolean) => void;

  hasVegan?: boolean;
  isVegan: boolean;
  onVeganChange: (val: boolean) => void;

  showPhotoCake?: boolean;
  requiredPhotoCake?: boolean;
  isPhotoCake: boolean;
  onPhotoCakeChange: (val: boolean) => void;
  photoUrl: string;
  onPhotoUrlChange: (url: string) => void;

  showCakeMessage?: boolean;
  requiredCakeMessage?: boolean;
  cakeMessage: string;
  onCakeMessageChange: (msg: string) => void;
  messageInputRef?: React.RefObject<HTMLInputElement | null>;

  accessories?: AccessoryOption[];
  selectedAddonIds: string[];
  onToggleAddon: (id: string) => void;

  greetingCardText: string;
  onGreetingCardTextChange: (text: string) => void;
}

export function PdpCustomizationForm({
  showDietary = true,
  hasSugarFree = false,
  isSugarFree,
  onSugarFreeChange,

  hasGlutenFree = false,
  isGlutenFree,
  onGlutenFreeChange,

  hasVegan = false,
  isVegan,
  onVeganChange,

  showPhotoCake = false,
  requiredPhotoCake = false,
  isPhotoCake,
  onPhotoCakeChange,
  photoUrl,
  onPhotoUrlChange,

  showCakeMessage = true,
  requiredCakeMessage = false,
  cakeMessage,
  onCakeMessageChange,
  messageInputRef,

  accessories = [],
  selectedAddonIds,
  onToggleAddon,

  greetingCardText,
  onGreetingCardTextChange,
}: PdpCustomizationFormProps) {
  const hasAnyDietary = hasSugarFree || hasGlutenFree || hasVegan;
  const isGreetingCardSelected = selectedAddonIds.some(
    (id) => id.includes("card") || id.includes("crd") || id.includes("03")
  );

  return (
    <div className="flex flex-col gap-6 w-full pt-4 border-t border-slate-200/80">
      {/* 1. Dietary Enhancements */}
      {showDietary && hasAnyDietary && (
        <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/60 flex flex-col gap-3">
          <label className="text-xs uppercase tracking-wider font-bold text-[#0F172A] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" /> Dietary Customization
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {hasSugarFree && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                <span className="text-xs font-semibold text-slate-700">Sugar-Free (+₹100)</span>
                <Switch checked={isSugarFree} onCheckedChange={onSugarFreeChange} />
              </div>
            )}
            {hasGlutenFree && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                <span className="text-xs font-semibold text-slate-700">Gluten-Free (+₹100)</span>
                <Switch checked={isGlutenFree} onCheckedChange={onGlutenFreeChange} />
              </div>
            )}
            {hasVegan && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                <span className="text-xs font-semibold text-slate-700">100% Vegan (+₹120)</span>
                <Switch checked={isVegan} onCheckedChange={onVeganChange} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Photo Cake Option */}
      {showPhotoCake && (
        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Edible Photo Print (+₹250) {requiredPhotoCake && <span className="text-rose-500">*</span>}
                </span>
                <span className="text-[11px] text-slate-500">High-resolution edible sugar sheet placed on cake</span>
              </div>
            </div>
            <Switch checked={isPhotoCake} onCheckedChange={onPhotoCakeChange} />
          </div>

          {isPhotoCake && (
            <div className="pt-2 animate-in fade-in">
              <input
                type="url"
                value={photoUrl}
                onChange={(e) => onPhotoUrlChange(e.target.value)}
                placeholder="Paste direct photo link (or upload URL)..."
                className="w-full text-xs sm:text-sm py-2.5 px-3.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>
          )}
        </div>
      )}

      {/* 3. Inscription Message on Cake */}
      {showCakeMessage && (
        <div className="flex flex-col gap-2 p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex justify-between items-center">
            <label
              htmlFor="cake-inscription-input"
              className="text-xs uppercase tracking-wider font-bold text-[#0F172A] flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#0F172A]" />
              <span>Message on Cake</span>
              {requiredCakeMessage ? (
                <span className="text-rose-500">*</span>
              ) : (
                <span className="text-[11px] text-slate-400 font-normal tracking-normal lowercase">(optional)</span>
              )}
            </label>
            <span data-testid="pdp-cake-message-counter" className={`text-[11px] font-medium ${cakeMessage.length === 30 ? "text-rose-600 font-bold" : "text-slate-400"}`}>
              {cakeMessage.length} / 30 chars
            </span>
          </div>

          <input
            id="cake-inscription-input"
            ref={messageInputRef as any}
            type="text"
            value={cakeMessage}
            maxLength={30}
            onChange={(e) => onCakeMessageChange(e.target.value.slice(0, 30))}
            placeholder="e.g., Happy 25th Anniversary Maya!"
            className="w-full text-sm py-2.5 px-3.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-slate-800 transition-all"
          />
        </div>
      )}

      {/* 4. Curated Celebration Accessories */}
      {accessories.length > 0 && (
        <div className="flex flex-col gap-3">
          <label className="text-xs uppercase tracking-wider font-bold text-[#0F172A] flex items-center gap-1.5">
            <Gift className="w-3.5 h-3.5 text-[#2563EB]" /> Complete the Celebration
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {accessories.map((item) => {
              const isSelected = selectedAddonIds.includes(item.id);
              const isOutOfStock = item.available_stock !== undefined ? item.available_stock <= 0 : (item.stock !== undefined ? item.stock <= 0 : false);
              return (
                <div
                  key={item.id}
                  onClick={() => !isOutOfStock && onToggleAddon(item.id)}
                  className={`p-3 rounded-2xl border transition-all flex items-center gap-3 select-none ${
                    isOutOfStock
                      ? "border-slate-200 bg-slate-50/80 opacity-60 cursor-not-allowed"
                      : isSelected
                      ? "border-[#2563EB] bg-amber-50/40 shadow-xs ring-1 ring-[#2563EB] cursor-pointer"
                      : "border-slate-200 bg-white hover:border-slate-300 shadow-2xs cursor-pointer"
                  }`}
                >
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                    <Image
                      src={item.thumbnail || "/images/placeholder-cake.jpg"}
                      alt={item.name}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  </div>

                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-xs font-semibold text-slate-900 truncate">{item.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-bold text-[#0F172A]">₹{item.price}</span>
                      {isOutOfStock ? (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">Out of Stock at this Store</span>
                      ) : (item.available_stock !== undefined && item.available_stock <= (item.low_stock_threshold || 5)) ? (
                        <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Only {item.available_stock} left</span>
                      ) : null}
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                      isOutOfStock
                        ? "bg-slate-200 border-slate-300 text-slate-400"
                        : isSelected
                        ? "bg-[#2563EB] border-[#2563EB] text-white"
                        : "bg-slate-100 border-slate-300 text-transparent"
                    }`}
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Custom Handwritten Greeting Card Text Note */}
          {isGreetingCardSelected && (
            <div className="pt-2 animate-in fade-in">
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Handwritten Message for Greeting Card:
              </label>
              <textarea
                value={greetingCardText}
                onChange={(e) => onGreetingCardTextChange(e.target.value)}
                rows={2}
                placeholder="Write your heartfelt message here..."
                className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] shadow-2xs"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
