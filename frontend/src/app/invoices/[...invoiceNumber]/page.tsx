import React from "react";
import { notFound } from "next/navigation";
import { dbQuery } from "@frontend/lib/db";
import { Printer, FileText, ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface InvoicePageProps {
  params: {
    invoiceNumber: string[];
  };
}

export default async function StatutoryInvoicePage({ params }: InvoicePageProps) {
  const parts = params.invoiceNumber || [];
  const rawParam = parts.join("/"); // e.g. "CH/26-27/000216" or "CH-26-27-000216" or "inv_..."
  const slashParam = rawParam.replace(/-/g, "/"); // Convert hyphens to slashes if needed: "CH/26/27/000216"
  const standardStatutory = rawParam.startsWith("CH-") ? rawParam.replace(/^CH-/, "CH/") : rawParam;

  const digitsMatch = rawParam.match(/\d{4,8}/);
  const invoiceDigits = digitsMatch ? digitsMatch[0] : "000216";

  console.log('[StatutoryInvoicePage] Received:', { parts, rawParam, slashParam, standardStatutory, invoiceDigits });
  console.log('[StatutoryInvoicePage] DATABASE_URL env:', process.env.DATABASE_URL);

  let invoiceRes;
  try {
    invoiceRes = await dbQuery(
      `SELECT i.*, 
              o.order_number, o.created_at as order_created_at, o.customer_name as ord_customer_name, o.customer_phone as ord_customer_phone,
              b.name as branch_name, b.address as branch_address
       FROM public.invoice i
       LEFT JOIN public.order o ON i.order_id = o.id
       LEFT JOIN public.branch b ON i.branch_id = b.id
       WHERE i.invoice_number = $1 
          OR i.invoice_number = $2 
          OR i.invoice_number = $3 
          OR i.invoice_number LIKE '%' || $4 || '%'
          OR i.invoice_number LIKE '%' || $5 || '%'
          OR i.id = $1 
          OR i.order_id = $1
       ORDER BY i.created_at DESC
       LIMIT 1`,
      [rawParam, standardStatutory, slashParam, rawParam.replace(/^CH-/, '').replace(/^CH\//, ''), invoiceDigits]
    );
    console.log('[StatutoryInvoicePage] Query success. Rows count:', invoiceRes.rows.length);
  } catch (dbErr: any) {
    console.error('[StatutoryInvoicePage] dbQuery error:', dbErr.message);
    invoiceRes = { rows: [] };
  }

  const invoice = invoiceRes.rows[0];
  if (!invoice) {
    console.log('[StatutoryInvoicePage] Invoice not found for rawParam:', rawParam);
    notFound();
  }

  const metadata = invoice.metadata || {};
  const items = metadata.items || [];
  const invoiceDate = new Date(invoice.created_at || Date.now()).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const sellerLegalName = invoice.seller_legal_name || "CakeToHome India Private Limited";
  const sellerGstin = invoice.seller_gstin || "29AABCC1234F1Z5";
  const customerName = invoice.customer_name || invoice.ord_customer_name || "Valued Customer";
  const customerPhone = invoice.customer_phone || invoice.ord_customer_phone || "";
  const deliveryAddress = invoice.delivery_address || invoice.ord_delivery_address || metadata.delivery_address || "Indiranagar, Bengaluru, Karnataka 560038";

  const subtotal = Number(invoice.subtotal || 0);
  const taxTotal = Number(invoice.tax_total || 0);
  const grandTotal = Number(invoice.grand_total || 0);
  const cgst = Number(metadata.cgst || (taxTotal / 2));
  const sgst = Number(metadata.sgst || (taxTotal / 2));
  const isPaid = invoice.status === "PAID" || invoice.status === "issued" || invoice.status === "GENERATED";

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 print:p-0 print:bg-white text-slate-800 dark:text-slate-100">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Navigation & Action Bar (Hidden when printing) */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 print:hidden">
          <Link
            href="/dashboard?tab=orders"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-[#1D2F5D] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Orders
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> CGST Rule 46 Compliant
            </span>
            <button
              type="button"
              className="print-btn inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1D2F5D] text-white text-xs font-semibold rounded-lg shadow-xs hover:bg-[#162447] transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[#D4AF37]" /> Print Tax Invoice
            </button>
          </div>
        </div>

        {/* Official Statutory GST Tax Invoice Document Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-10 shadow-lg print:border-none print:shadow-none print:p-0">
          {/* Header Block */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-6 border-b-2 border-slate-800 dark:border-slate-700 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-[#1D2F5D] dark:text-[#D4AF37]">
                  CAKETOHOME
                </span>
                <span className="text-xs uppercase tracking-widest text-slate-400 font-mono">India</span>
              </div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{sellerLegalName}</h1>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-md">
                CIN: U15400KA2026PTC189211 • Indiranagar Commercial Hub, 100 Feet Road, Bengaluru, Karnataka 560038
              </p>
              <div className="mt-2 text-xs font-mono text-slate-700 dark:text-slate-300 space-y-0.5">
                <p>
                  <strong>GSTIN:</strong> {sellerGstin} | <strong>State:</strong> Karnataka (Code 29)
                </p>
                <p>
                  <strong>FSSAI Lic No:</strong> 11223344556677 | <strong>Email:</strong> accounts@caketohome.in
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right space-y-1">
              <span className="inline-block px-3 py-1 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-black text-xs uppercase tracking-wider rounded-md border border-emerald-300">
                STATUTORY TAX INVOICE
              </span>
              <div className="text-lg font-black font-mono text-slate-900 dark:text-white">
                {invoice.invoice_number}
              </div>
              <p className="text-xs text-slate-500">
                Date of Issue: <strong className="text-slate-800 dark:text-slate-200">{invoiceDate}</strong>
              </p>
              <p className="text-xs text-slate-500">
                Order Ref: <strong className="font-mono text-slate-800 dark:text-slate-200">{invoice.order_id}</strong>
              </p>
              {invoice.voucher_id && (
                <p className="text-[11px] font-mono text-blue-600 dark:text-blue-400">
                  GL Voucher: {invoice.voucher_id}
                </p>
              )}
            </div>
          </div>

          {/* Recipient & Supply Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-slate-200 dark:border-slate-800 text-xs">
            <div className="space-y-1">
              <h2 className="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-[11px]">
                Billed &amp; Delivered To (Recipient):
              </h2>
              <p className="font-bold text-sm text-slate-900 dark:text-white">{customerName}</p>
              <p className="text-slate-600 dark:text-slate-400">{deliveryAddress}</p>
              <p className="text-slate-600 dark:text-slate-400">
                Phone: <span className="font-mono">{customerPhone}</span>
              </p>
              <p className="text-slate-500">Place of Supply: Karnataka (State Code 29)</p>
            </div>

            <div className="space-y-1 sm:text-right">
              <h2 className="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-[11px]">
                Fulfillment &amp; Payment Status:
              </h2>
              <div className="inline-flex items-center gap-1.5 mt-1">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                    isPaid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {isPaid ? "PAID IN FULL" : "PENDING PAYMENT"}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Payment Gateway: <strong>Cashfree Payments India</strong>
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                Fulfillment Kitchen: <strong>{invoice.branch_name || "Indiranagar Kitchen Hub"}</strong>
              </p>
              <p className="text-slate-500">
                Supply Type: <strong>Intra-State Supply (CGST + SGST)</strong>
              </p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="py-6 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-y border-slate-200 dark:border-slate-800 uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Description of Goods</th>
                  <th className="py-2.5 px-3 font-mono">HSN/SAC</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Rate</th>
                  <th className="py-2.5 px-3 text-right">Taxable Value</th>
                  <th className="py-2.5 px-3 text-right">CGST</th>
                  <th className="py-2.5 px-3 text-right">SGST</th>
                  <th className="py-2.5 px-3 text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.length === 0 ? (
                  <tr>
                    <td className="py-3 px-3">1</td>
                    <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                      Freshly Baked Artisan Cake &amp; Bakery Specialties
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500">19059010</td>
                    <td className="py-3 px-3 text-center">1</td>
                    <td className="py-3 px-3 text-right font-mono">₹{subtotal.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right font-mono">₹{subtotal.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600">₹{cgst.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600">₹{sgst.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right font-bold font-mono text-slate-900 dark:text-white">
                      ₹{grandTotal.toFixed(2)}
                    </td>
                  </tr>
                ) : (
                  items.map((item: any, idx: number) => {
                    const lineRate = Number(item.unit_price || item.rate || (item.taxable_value / (item.quantity || 1)) || 0);
                    const lineTaxable = Number(item.taxable_value || (lineRate * (item.quantity || 1)));
                    const lineCgst = Number(item.cgst || (lineTaxable * 0.025));
                    const lineSgst = Number(item.sgst || (lineTaxable * 0.025));
                    const lineTotal = Number(item.total || (lineTaxable + lineCgst + lineSgst));

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-3 text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                          {item.title || item.product_name || "Gourmet Bakery Item"}
                          {item.variant_name && <span className="text-slate-400 font-normal"> ({item.variant_name})</span>}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-500">{item.hsn_code || "19059010"}</td>
                        <td className="py-3 px-3 text-center font-mono">{item.quantity || 1}</td>
                        <td className="py-3 px-3 text-right font-mono">₹{lineRate.toFixed(2)}</td>
                        <td className="py-3 px-3 text-right font-mono">₹{lineTaxable.toFixed(2)}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-600">₹{lineCgst.toFixed(2)}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-600">₹{lineSgst.toFixed(2)}</td>
                        <td className="py-3 px-3 text-right font-bold font-mono text-slate-900 dark:text-white">
                          ₹{lineTotal.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Tax Breakdown & Grand Total Block */}
          <div className="flex flex-col sm:flex-row justify-between pt-4 border-t-2 border-slate-200 dark:border-slate-800 gap-6 text-xs">
            <div className="space-y-2 max-w-sm">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="font-bold text-[11px] uppercase tracking-wider text-slate-500">
                  Statutory Tax Declarations:
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  1. Tax is payable on reverse charge: <strong>No</strong>.<br />
                  2. We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
                </p>
              </div>
            </div>

            <div className="w-full sm:w-72 space-y-2 font-mono">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <span>Subtotal (Taxable Value):</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <span>CGST (Output Tax 2.5% / 6%):</span>
                <span>₹{cgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <span>SGST (Output Tax 2.5% / 6%):</span>
                <span>₹{sgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-b-2 border-slate-900 dark:border-white text-base font-black text-slate-900 dark:text-white">
                <span>Total Invoice Value:</span>
                <span className="text-[#1D2F5D] dark:text-[#D4AF37]">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Corporate Signature & Stamp Block */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-end gap-6 text-xs">
            <div className="text-slate-400 text-[10px]">
              Computer-generated statutory GST Tax Invoice under Rule 46 of CGST Rules, 2017.
            </div>
            <div className="text-center sm:text-right space-y-2">
              <div className="font-bold text-slate-700 dark:text-slate-300">
                For CakeToHome India Private Limited
              </div>
              <div className="h-12 flex items-center justify-center sm:justify-end">
                <span className="font-serif italic font-bold text-slate-500 text-sm border-b border-dashed border-slate-400 pb-1 px-4">
                  Authorized Signatory
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Finance &amp; Statutory Accounts Officer</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
