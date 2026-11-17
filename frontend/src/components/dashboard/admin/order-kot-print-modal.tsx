"use client";

import { Heading, Text, Badge, Button } from "@medusajs/ui";
import { Printer, X, ChefHat, Clock, AlertTriangle } from "lucide-react";

interface OrderKotPrintModalProps {
  order: any;
  onClose: () => void;
}

export function OrderKotPrintModal({ order, onClose }: OrderKotPrintModalProps) {
  const handlePrint = () => {
    window.print();
  };

  const items = order?.items || [];
  const customization = order?.customization || {};
  const kitchen = order?.kitchen || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-slate-900 border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Action Header */}
        <div className="p-4 border-b flex items-center justify-between bg-brand-gold-light dark:bg-brand-gold-dark/40 print:hidden">
          <Heading level="h3" className="text-sm font-bold flex items-center gap-2 text-brand-gold-dark dark:text-brand-gold/40">
            <ChefHat className="w-5 h-5 text-brand-gold" /> Kitchen Order Ticket (KOT)
          </Heading>
          <div className="flex items-center gap-2">
            <Button size="small" variant="secondary" onClick={handlePrint} className="bg-brand-gold text-white hover:bg-brand-gold-dark">
              <Printer className="w-3.5 h-3.5 mr-1" /> Print KOT Ticket
            </Button>
            <button onClick={onClose} className="p-1 rounded hover:bg-brand-gold-light text-slate-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Ticket Area */}
        <div className="p-6 overflow-y-auto font-mono text-xs space-y-4 print:p-0 print:text-black">
          <div className="text-center border-b-2 border-black pb-3 space-y-1 flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/brand/caketo-home-logo-black.png"
              alt="CakeToHome"
              className="h-9 w-auto object-contain mx-auto mb-1 print:block dark:hidden"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/brand/caketo-home-logo-white.png"
              alt="CakeToHome"
              className="h-9 w-auto object-contain mx-auto mb-1 hidden dark:block print:hidden"
            />
            <h2 className="text-base font-extrabold uppercase tracking-wider">BAKERY KITCHEN</h2>
            <p className="text-sm font-bold">{order?.branch?.name || "Indiranagar Flagship Hub"}</p>
            <p className="text-xs">KOT TICKET #: <span className="font-extrabold underline">{kitchen?.kot_number || "KOT-0042"}</span></p>
            <p className="text-[10px] text-slate-500">{new Date().toLocaleString("en-IN")}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] border-b pb-2">
            <div>
              <span className="font-bold text-slate-500">ORDER NUMBER:</span>
              <p className="font-extrabold text-sm">{order?.order_number || order?.id}</p>
            </div>
            <div>
              <span className="font-bold text-slate-500">DELIVERY SLOT:</span>
              <p className="font-bold">{order?.delivery_date} ({order?.delivery_slot?.split(" ")[0]})</p>
            </div>
            <div>
              <span className="font-bold text-slate-500">CHEF ASSIGNED:</span>
              <p className="font-bold">{kitchen?.chef_assigned || "Master Pastry Chef"}</p>
            </div>
            <div>
              <span className="font-bold text-slate-500">PREP TARGET:</span>
              <p className="font-bold flex items-center gap-1">
                <Clock className="w-3 h-3 text-brand-gold" /> {kitchen?.prep_time_minutes || 45} mins
              </p>
            </div>
          </div>

          {/* Itemized Specification */}
          <div className="space-y-3 border-b pb-3">
            <p className="font-extrabold text-xs uppercase bg-black text-white px-2 py-0.5 inline-block">CAKE PRODUCTION SPECIFICATIONS</p>

            {items.map((item: any, idx: number) => (
              <div key={item.id || idx} className="p-2 border rounded bg-slate-50 dark:bg-slate-800/50 space-y-1">
                <div className="flex items-start justify-between font-bold text-sm">
                  <span>{item.quantity}x {item.title}</span>
                  <Badge color={item.artisan ? "green" : "red"}>{item.artisan ? "100% artisan" : "FRESH BAKED"}</Badge>
                </div>
                <div className="text-xs grid grid-cols-3 gap-1 pt-1 font-semibold text-slate-700 dark:text-slate-300">
                  <div><span className="text-[10px] text-slate-400 block">WEIGHT:</span>{item.weight}</div>
                  <div><span className="text-[10px] text-slate-400 block">FLAVOR:</span>{item.flavour}</div>
                  <div><span className="text-[10px] text-slate-400 block">SHAPE:</span>{item.shape}</div>
                </div>

                {item.cake_message && (
                  <div className="mt-2 p-1.5 bg-brand-gold-light dark:bg-brand-gold-dark/60 rounded border border-brand-gold/40 text-brand-gold-dark dark:text-brand-gold/40">
                    <span className="text-[10px] font-bold block uppercase tracking-wider">Piping Text Message on Cake:</span>
                    <p className="font-extrabold text-xs">&ldquo;{item.cake_message}&rdquo;</p>
                  </div>
                )}

                {item.photo_url && (
                  <div className="mt-2 p-1.5 bg-blue-50 dark:bg-blue-950/40 rounded border border-blue-200 text-blue-900 dark:text-blue-200 flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.photo_url} alt="Photo Cake" className="w-12 h-12 rounded object-cover border" />
                    <div>
                      <span className="text-[10px] font-bold uppercase block text-blue-700">Edible Photo Cake Print</span>
                      <p className="text-[10px]">Print edible sheet &amp; apply to cake surface</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add-ons & Packaging Instructions */}
          <div className="space-y-2 text-xs">
            <p className="font-bold text-slate-500 uppercase text-[10px]">ADD-ONS &amp; PACKAGING NOTES:</p>
            <div className="flex flex-wrap gap-1">
              {(customization?.add_ons || []).map((addon: string, i: number) => (
                <Badge key={i} color="purple" className="text-[10px]">{addon}</Badge>
              ))}
            </div>
            {customization?.special_instructions && (
              <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs font-semibold flex items-start gap-1">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-[10px] uppercase">Special Customer Note:</span>
                  <p>{customization.special_instructions}</p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t-2 border-dashed border-black text-center text-[10px] text-slate-500">
            <p className="font-bold uppercase">KOT END - VERIFY PIPING TEXT &amp; WEIGHT BEFORE PACKING</p>
          </div>
        </div>
      </div>
    </div>
  );
}
