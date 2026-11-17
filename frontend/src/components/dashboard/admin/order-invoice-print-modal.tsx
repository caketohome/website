"use client";

import { Heading, Text, Badge, Button } from "@medusajs/ui";
import { Printer, X, FileText, Download } from "lucide-react";

interface OrderInvoicePrintModalProps {
  order?: any;
  invoice?: any;
  onClose: () => void;
}

export function OrderInvoicePrintModal({ order, invoice, onClose }: OrderInvoicePrintModalProps) {
  const handlePrint = () => {
    window.print();
  };

  const inv = invoice || order?.invoice || order || {};
  const customer = inv.customer || order?.customer || {};
  const shipping = inv.shipping_address || order?.shipping_address || {};
  const branch = inv.branch || order?.branch || {};
  const payment = inv.payment || order?.payment || {};
  const items = Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : (order?.items || []);
  const compliance = inv.metadata || order?.compliance_snapshot || {};

  const invoiceNumber = inv.invoice_number || order?.invoice_number || "PENDING_INVOICE";
  const invoiceDate = new Date(inv.invoice_date || inv.created_at || order?.created_at || Date.now()).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const sellerLegalName = inv.seller_legal_name || compliance.seller_legal_name || order?.seller_legal_name || branch?.metadata?.seller_legal_name || "UNVERIFIED_SELLER_IDENTITY";
  const sellerTradeName = inv.seller_trade_name || compliance.seller_trade_name || branch?.name || "UNVERIFIED_SELLER";
  const sellerGstin = inv.seller_gstin || compliance.seller_gstin || order?.seller_gstin || branch?.metadata?.gstin || branch?.metadata?.gst_number || branch?.gstin || "UNVERIFIED_GSTIN";
  const sellerState = inv.seller_state || compliance.seller_state || branch?.state || "";
  const sellerStateCode = inv.seller_state_code || compliance.seller_state_code || branch?.state_code || "";

  // Reject false statutory FSSAI licence "11223344556677"
  const rawFssai = inv.seller_fssai_number || compliance.seller_fssai_number || branch?.fssai_number || branch?.metadata?.fssai_number;
  const sellerFssai = (rawFssai && rawFssai !== "11223344556677") ? rawFssai : "UNVERIFIED_FSSAI";

  const sellerAddress = inv.seller_address || compliance.seller_address || branch?.address || "";
  const isIntraState = inv.is_intra_state !== false;
  const supplyType = inv.supply_type || compliance.supply_type || (isIntraState ? "INTRA-STATE (CGST + SGST)" : "INTER-STATE (IGST)");

  const isTestMode = inv.is_test || inv.test_watermark || order?.classification === "TEST" || (order as any)?.metadata?.classification === "TEST" || String(order?.id || "").includes("test_") || String(sellerFssai).includes("TEST");

  const totalVal = Number(inv.grand_total ?? order?.total_amount ?? order?.total ?? order?.payment?.grand_total ?? 0);
  const taxAmt = Number(inv.tax_total ?? order?.tax_amount ?? order?.payment?.tax_total ?? 0);
  const taxableVal = Number(inv.subtotal ?? order?.payment?.taxable_value ?? compliance.taxable_value ?? Math.max(0, totalVal - taxAmt));
  const cgstAmt = Number(inv.cgst ?? compliance.cgst ?? (isIntraState ? Number((taxAmt / 2).toFixed(2)) : 0));
  const sgstAmt = Number(inv.sgst ?? compliance.sgst ?? (isIntraState ? Number((taxAmt / 2).toFixed(2)) : 0));
  const igstAmt = Number(inv.igst ?? compliance.igst ?? (!isIntraState ? taxAmt : 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-slate-900 border rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] relative">
        {/* Action Header */}
        <div className="p-4 border-b flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/40 print:hidden">
          <Heading level="h3" className="text-sm font-bold flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
            <FileText className="w-5 h-5 text-emerald-600" /> GST Tax Invoice ({invoiceNumber})
          </Heading>
          <div className="flex items-center gap-2">
            <Button size="small" variant="secondary" onClick={handlePrint} className="bg-emerald-600 text-white hover:bg-emerald-700">
              <Printer className="w-3.5 h-3.5 mr-1" /> Print Tax Invoice
            </Button>
            <button onClick={onClose} className="p-1 rounded hover:bg-emerald-100 text-slate-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Visible Test Watermark Banner in Test Mode */}
        {isTestMode && (
          <div className="bg-brand-gold text-black font-extrabold text-center py-1.5 px-4 text-xs uppercase tracking-widest border-b border-brand-gold print:block shadow-inner" id="invoice-test-watermark-banner">
            ⚠️ TEST — NOT A VALID TAX INVOICE (SYNTHETIC FIXTURE — NOT FOR STATUTORY FILING)
          </div>
        )}

        {/* Printable Tax Invoice Content */}
        <div className="p-8 overflow-y-auto text-xs space-y-6 print:p-0 print:text-black">
          {/* Company & Invoice Header */}
          <div className="flex items-start justify-between border-b pb-4">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/brand/caketo-home-logo-navy.png"
                alt="CakeToHome"
                className="h-10 w-auto object-contain mb-2 print:block dark:hidden"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/brand/caketo-home-logo-white.png"
                alt="CakeToHome"
                className="h-10 w-auto object-contain mb-2 hidden dark:block print:hidden"
              />
              <h1 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">{sellerTradeName}</h1>
              <p className="text-xs font-bold text-slate-700">{sellerLegalName}</p>
              <p className="text-[11px] text-slate-500">{sellerAddress}</p>
              <p className="text-[11px] font-semibold text-slate-700">
                GSTIN: <span className="font-mono">{sellerGstin}</span> | State: {sellerState} ({sellerStateCode})
              </p>
              <p className="text-[11px] text-slate-500">
                FSSAI Lic #: <span className="font-mono font-bold">{sellerFssai}</span> | Support: support@cakes2home.com
              </p>
            </div>
            <div className="text-right space-y-1">
              <span className="bg-emerald-100 text-emerald-800 font-extrabold text-xs px-3 py-1 rounded-full inline-block uppercase tracking-wider">
                TAX INVOICE
              </span>
              <p className="font-mono text-base font-extrabold text-slate-900">{invoiceNumber}</p>
              <p className="text-[11px] text-slate-600 font-semibold">Invoice Date: {invoiceDate}</p>
              <p className="text-[11px] text-slate-500">Order ID: <span className="font-mono font-bold">{order?.order_number || order?.id}</span></p>
              <p className="text-[11px] text-slate-500">Place of Supply: <span className="font-semibold">{shipping?.state || sellerState} ({shipping?.state_code || sellerStateCode})</span></p>
            </div>
          </div>

          {/* Billed To / Shipped To Grid */}
          <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Billed To (Customer):</span>
              <p className="font-extrabold text-sm text-slate-900 dark:text-white">{customer?.name || order?.customer_name || "—"}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">GSTIN: <span className="font-mono font-bold">{customer?.gstin || order?.metadata?.customer_gstin || "URP (Unregistered Person)"}</span></p>
              <p className="text-xs text-slate-600 dark:text-slate-300">Ph: {customer?.phone || order?.customer_phone || "—"}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">Email: {customer?.email || order?.customer_email || "—"}</p>
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Shipping Delivery Address:</span>
              <p className="font-bold text-xs text-slate-800 dark:text-slate-200">{shipping?.address_1 || order?.delivery_address || (order?.customer?.address && typeof order.customer.address === "string" ? order.customer.address : "—")}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">{shipping?.area || order?.delivery_area || ""}{shipping?.city || order?.delivery_city ? `, ${shipping?.city || order?.delivery_city}` : ""}{shipping?.pincode || order?.delivery_pincode ? ` - ${shipping?.pincode || order?.delivery_pincode}` : ""}</p>
              <p className="text-[11px] text-slate-500 mt-1">Supply Type: <span className="font-bold text-emerald-700">{supplyType}</span></p>
            </div>
          </div>

          {/* Itemized Table */}
          <table className="w-full text-left border-collapse border rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 border-b font-bold text-[11px] text-slate-700 dark:text-slate-300">
                <th className="p-2.5">Sl</th>
                <th className="p-2.5">Product Description</th>
                <th className="p-2.5 text-center">HSN/SAC</th>
                <th className="p-2.5 text-center">UQC</th>
                <th className="p-2.5 text-center">Qty</th>
                <th className="p-2.5 text-right">Unit Price</th>
                <th className="p-2.5 text-right">Taxable Value</th>
                {isIntraState ? (
                  <>
                    <th className="p-2.5 text-right">CGST</th>
                    <th className="p-2.5 text-right">SGST</th>
                  </>
                ) : (
                  <th className="p-2.5 text-right">IGST</th>
                )}
                <th className="p-2.5 text-right">Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs">
              {items.length > 0 ? (
                items.map((item: any, idx: number) => {
                  const qty = Number(item.quantity || 1);
                  const itemUnitPrice = Number(item.unit_price ?? item.price ?? 0);
                  const itemSubtotal = Number(item.subtotal ?? item.total_line_amount ?? (itemUnitPrice * qty));
                  const itemTax = Number(item.tax_amount ?? (Number(item.cgst || 0) + Number(item.sgst || 0) + Number(item.igst || 0)));
                  const itemTaxable = Number(item.taxable_value ?? (itemSubtotal > itemTax ? itemSubtotal - itemTax : itemSubtotal));
                  const itemCgst = Number(item.cgst ?? (isIntraState && itemTax > 0 ? Number((itemTax / 2).toFixed(2)) : 0));
                  const itemSgst = Number(item.sgst ?? (isIntraState && itemTax > 0 ? Number((itemTax / 2).toFixed(2)) : 0));
                  const itemIgst = Number(item.igst ?? (!isIntraState && itemTax > 0 ? itemTax : 0));
                  return (
                    <tr key={item.id || idx}>
                      <td className="p-2.5 text-center">{idx + 1}</td>
                      <td className="p-2.5">
                        <p className="font-bold text-slate-900 dark:text-white">{item.title || item.product_name || "Artisan Cake"}</p>
                        <p className="text-[10px] text-slate-500">{item.weight || "1.0 kg"} &bull; {item.flavour || "Artisan Flavor"} &bull; {item.artisan ? "artisan" : "Standard"}</p>
                      </td>
                      <td className="p-2.5 text-center font-mono text-[11px]">{item.hsn_code || "UNCLASSIFIED"}</td>
                      <td className="p-2.5 text-center font-bold">{item.uqc || "NOS"}</td>
                      <td className="p-2.5 text-center font-bold">{qty}</td>
                      <td className="p-2.5 text-right">₹{itemUnitPrice.toLocaleString("en-IN")}</td>
                      <td className="p-2.5 text-right font-medium">₹{itemTaxable.toLocaleString("en-IN")}</td>
                      {isIntraState ? (
                        <>
                          <td className="p-2.5 text-right text-slate-600">₹{itemCgst.toLocaleString("en-IN")}</td>
                          <td className="p-2.5 text-right text-slate-600">₹{itemSgst.toLocaleString("en-IN")}</td>
                        </>
                      ) : (
                        <td className="p-2.5 text-right text-slate-600">₹{itemIgst.toLocaleString("en-IN")}</td>
                      )}
                      <td className="p-2.5 text-right font-bold text-slate-900 dark:text-white">₹{itemSubtotal.toLocaleString("en-IN")}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={isIntraState ? 10 : 9} className="p-6 text-center text-slate-500 italic">
                    No items recorded for this order snapshot.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Financial Calculation & GST Summary */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2 border-t">
            <div className="space-y-1.5 text-[11px] text-slate-600">
              <p><span className="font-bold text-slate-700">Payment Method:</span> {payment?.method || order?.payment_method || "—"}</p>
              <p><span className="font-bold text-slate-700">Transaction ID:</span> <span className="font-mono">{payment?.transaction_id || order?.payment_transaction_id || "—"}</span></p>
              <p><span className="font-bold text-slate-700">Payment Status:</span> <Badge color={order?.payment_status === "paid" || payment?.status === "captured" ? "green" : "grey"} className="text-[9px] uppercase font-bold">{order?.payment_status?.toUpperCase() || payment?.status?.toUpperCase() || "PENDING"}</Badge></p>
              <p className="text-[10px] text-slate-400 mt-2">Fulfillment Hub: <span className="font-bold text-slate-700">{compliance.branch_name || branch?.name || order?.branch_name || "—"}</span></p>
            </div>

            <div className="w-full sm:w-72 space-y-1.5 text-xs bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border font-medium">
              <div className="flex justify-between text-slate-600">
                <span>Taxable Value:</span>
                <span className="font-mono font-bold">₹{taxableVal.toLocaleString("en-IN")}</span>
              </div>
              {isIntraState ? (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>CGST:</span>
                    <span className="font-mono">₹{cgstAmt.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>SGST:</span>
                    <span className="font-mono">₹{sgstAmt.toLocaleString("en-IN")}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-slate-600">
                  <span>IGST:</span>
                  <span className="font-mono">₹{igstAmt.toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black border-t pt-2 text-emerald-700 dark:text-emerald-400">
                <span>Grand Total:</span>
                <span className="font-mono text-base">₹{totalVal.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-end border-t pt-6 text-[10px] text-slate-500">
            <div>
              <p className="font-bold text-slate-700">Terms &amp; Conditions:</p>
              <p>1. Perishable confectionery goods. Consume within 24 hours of delivery.</p>
              <p>2. Subject to local jurisdiction.</p>
              <p>3. Goods once sold cannot be returned due to food hygiene regulations.</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-slate-900 text-xs">For {sellerLegalName}</p>
              <div className="h-10"></div>
              <p className="text-[10px] font-semibold text-slate-500">Authorized Signatory</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
