"use client";

import { useState } from "react";
import { X, MessageSquare, Send, CheckCircle, ExternalLink, ShieldCheck, AlertCircle } from "lucide-react";
import { Badge, Button, Heading, Text, Label } from "@medusajs/ui";
import { CustomerProfile, CustomerRecord } from "@frontend/lib/crm/types";
import { formatDisplayPhone } from "@frontend/lib/crm/crm-engine";
import { apiClient } from "@frontend/lib/api-client";

interface WhatsAppContactModalProps {
  customer: CustomerProfile | CustomerRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const WHATSAPP_TEMPLATES = [
  {
    id: "ABANDONED_CART_1",
    name: "Abandoned Cart 10% Discount",
    category: "RECOVERY",
    text: (name: string, cartVal: number) =>
      `Hi ${name || "there"}! 🎂 Your delicious celebration cake (₹${cartVal || 749}) is reserved at Cakes2Home. Complete your order now with 10% OFF using code *SWEET10* with instant 60-min delivery! Tap here to complete: https://caketohome.com/cart`,
  },
  {
    id: "WELCOME_OFFER",
    name: "New Customer Welcome 15% Voucher",
    category: "MARKETING",
    text: (name: string) =>
      `Welcome to Cakes2Home, ${name || "Valued Customer"}! 🎉 Enjoy 15% OFF your very first order of artisan handcrafted cakes. Use coupon code *FIRSTTREAT* at checkout: https://caketohome.com`,
  },
  {
    id: "VIP_REORDER",
    name: "VIP Special Celebration Re-order",
    category: "LOYALTY",
    text: (name: string) =>
      `Hello ${name || "VIP Customer"}! ⭐ As a valued VIP member of Cakes2Home, enjoy complimentary priority delivery and double loyalty points on your next birthday order. Browse our freshest cakes: https://caketohome.com`,
  },
  {
    id: "ANNUAL_REORDER_REMINDER",
    name: "Annual Celebration Reorder Reminder",
    category: "REORDER",
    text: (name: string) =>
      `Hi ${name || "Valued Patron"}! 🎂 Warm wishes from CakeToHome! Around this time last year, you celebrated with our handcrafted cakes. We would love to bake a fresh gourmet cake with custom message decoration for your upcoming celebration this year! Explore our fresh menu: https://caketohome.com`,
  },
  {
    id: "CUSTOM",
    name: "Custom Personalized Message",
    category: "CUSTOM",
    text: (name: string) => `Hello ${name || "Customer"}, this is Cakes2Home customer care...`,
  },
];

export function WhatsAppContactModal({ customer, isOpen, onClose, onSuccess }: WhatsAppContactModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState("ABANDONED_CART_1");
  const [customText, setCustomText] = useState("");
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  if (!isOpen || !customer) return null;

  const activeTemplate = WHATSAPP_TEMPLATES.find((t) => t.id === selectedTemplateId) || WHATSAPP_TEMPLATES[0];
  const cartVal = (customer as any).active_cart_value || (customer as any).abandoned_carts?.[0]?.grand_total || 999;
  const messagePreview =
    selectedTemplateId === "CUSTOM"
      ? customText || activeTemplate.text(customer.name, cartVal)
      : activeTemplate.text(customer.name, cartVal);

  const cleanPhone = customer.phone.replace(/\D/g, "");
  const intlPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const waUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(messagePreview)}`;

  const handleSend = async () => {
    setSending(true);
    try {
      if ((customer as any).active_cart_id) {
        await apiClient.sendAdminRecoveryWhatsApp((customer as any).active_cart_id, selectedTemplateId, {
          custom_message: messagePreview,
        });
      } else {
        await apiClient.recordAdminCallAction(customer.customer_uid, undefined, "WHATSAPP_DISPATCHED");
      }

      setSentSuccess(true);
      if (typeof window !== "undefined") {
        window.open(waUrl, "_blank");
      }
      setTimeout(() => {
        setSentSuccess(false);
        if (onSuccess) onSuccess();
        onClose();
      }, 1800);
    } catch (err) {
      console.error("Failed to record WhatsApp outreach:", err);
    } finally {
      setSending(false);
    }
  };

  const isEligible = customer.consent?.whatsapp_status !== "OPTED_OUT";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-green-50/50 dark:bg-green-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center text-white">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <Heading level="h2" className="text-base font-bold text-neutral-900 dark:text-white">
                WhatsApp Outreach
              </Heading>
              <Text className="text-xs text-neutral-500">
                To: <span className="font-semibold text-neutral-800 dark:text-neutral-200">{customer.name}</span> ({formatDisplayPhone(customer.phone)})
              </Text>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-4">
          {!isEligible ? (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl flex items-center gap-2 text-xs text-red-800 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Customer has opted out of WhatsApp communications. Direct marketing messaging is prohibited.</span>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>WhatsApp Verified & Consent Eligible. Messages comply with India TRAI & META DLT guidelines.</span>
            </div>
          )}

          {/* Template Selector */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
              Select Message Template
            </Label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="p-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
            >
              {WHATSAPP_TEMPLATES.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.name}
                </option>
              ))}
            </select>
          </div>

          {/* Custom edit field if custom */}
          {selectedTemplateId === "CUSTOM" && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                Custom Message Text
              </Label>
              <textarea
                rows={4}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Write custom WhatsApp message..."
                className="p-2.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
              />
            </div>
          )}

          {/* Interpolated Live Preview */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
              Live WhatsApp Chat Preview
            </span>
            <div className="p-4 rounded-xl bg-emerald-900/10 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed font-sans relative">
              <p className="whitespace-pre-wrap">{messagePreview}</p>
              <span className="text-[10px] text-neutral-400 block text-right mt-2 font-mono">
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ✓✓
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-900/60">
          <Button variant="secondary" size="small" onClick={onClose} className="text-xs">
            Cancel
          </Button>

          <Button
            size="small"
            onClick={handleSend}
            isLoading={sending}
            disabled={!isEligible}
            className="bg-green-600 hover:bg-green-700 text-white text-xs flex items-center gap-1.5"
          >
            {sentSuccess ? (
              <>
                <CheckCircle className="w-3.5 h-3.5" /> Dispatched!
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" /> Launch WhatsApp Web / App
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
