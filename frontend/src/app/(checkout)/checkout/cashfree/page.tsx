"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Script from "next/script";
import Link from "next/link";
import { ShieldCheck, Lock, AlertCircle, ArrowLeft, Loader2, ExternalLink } from "lucide-react";

declare global {
  interface Window {
    Cashfree?: any;
  }
}

export default function CashfreeCheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const orderId = searchParams.get("order_id") || "CTH-ORD-" + Date.now().toString().slice(-6);
  const amountStr = searchParams.get("amount") || "525.00";
  const amount = parseFloat(amountStr) || 525.0;

  const [paymentSessionId, setPaymentSessionId] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLaunchingCheckout, setIsLaunchingCheckout] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState<"connecting" | "ready" | "credentials_pending" | "error">("connecting");

  // 1. Fetch or initialize payment session from authoritative backend
  const initializePaymentSession = useCallback(async () => {
    setIsInitializing(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/v1/payments/cashfree/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          amount: amount,
          currency: "INR",
          return_url: `${window.location.origin}/your-order?order_id=${encodeURIComponent(orderId)}`,
          notify_url: `${window.location.origin}/api/v1/payments/cashfree/webhook`,
        }),
      });

      const data = await res.json();

      if (res.ok && data.payment_session_id) {
        setPaymentSessionId(data.payment_session_id);
        setGatewayStatus("ready");
      } else {
        setGatewayStatus("credentials_pending");
        setErrorMessage(
          data.message || "Cashfree sandbox credentials are not yet configured for live session generation."
        );
      }
    } catch (err: any) {
      console.warn("[Cashfree Checkout] Session initialization notice:", err.message);
      setGatewayStatus("credentials_pending");
      setErrorMessage("Unable to establish remote Cashfree gateway session. Operating in sandbox compliance mode.");
    } finally {
      setIsInitializing(false);
    }
  }, [orderId, amount]);

  useEffect(() => {
    initializePaymentSession();
  }, [initializePaymentSession]);

  // 2. Launch Official Cashfree Checkout via Web SDK v3
  const handleLaunchOfficialCheckout = () => {
    if (!window.Cashfree) {
      setErrorMessage("Cashfree Web SDK is not loaded yet. Please wait a moment.");
      return;
    }

    if (!paymentSessionId) {
      setErrorMessage("No active Cashfree payment session found. Please re-initialize.");
      return;
    }

    setIsLaunchingCheckout(true);

    try {
      const cashfreeMode = process.env.NEXT_PUBLIC_CASHFREE_ENV === "production" ? "production" : "sandbox";
      const cashfree = window.Cashfree({ mode: cashfreeMode });

      cashfree.checkout({
        paymentSessionId: paymentSessionId,
        redirectTarget: "_self",
      });
    } catch (err: any) {
      console.error("[Cashfree SDK] Launch error:", err);
      setIsLaunchingCheckout(false);
      setErrorMessage(`Failed to open Cashfree Checkout: ${err.message}`);
    }
  };

  return (
    <>
      {/* Official Cashfree Web SDK v3 */}
      <Script
        src="https://sdk.cashfree.com/js/v3/cashfree.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log("[Cashfree SDK] Official v3 script loaded successfully from sdk.cashfree.com");
          setSdkReady(true);
        }}
        onError={() => {
          console.error("[Cashfree SDK] Failed to load official Cashfree SDK from sdk.cashfree.com");
          setErrorMessage("Failed to load official Cashfree Web SDK. Check internet connectivity.");
        }}
      />

      <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 flex flex-col items-center justify-center font-sans antialiased">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
          {/* Cashfree Official Brand Header */}
          <div className="bg-[#0b2265] p-6 text-white flex items-center justify-between border-b border-blue-900/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center font-black text-xl text-[#0b2265] shadow-md">
                CF
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold tracking-tight">cashfree payments</h1>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    OFFICIAL PG
                  </span>
                </div>
                <p className="text-xs text-blue-200/80">API Version 2023-08-01 • Secure Payment Gateway</p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] uppercase tracking-wider text-blue-200">Amount Due</span>
              <div className="text-2xl font-black text-white">₹{amount.toFixed(2)}</div>
            </div>
          </div>

          {/* Order Details Bar */}
          <div className="bg-slate-900/90 px-6 py-3 border-b border-slate-800 flex justify-between items-center text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Order ID:</span>
              <span className="font-mono font-bold text-amber-400">{orderId}</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <Lock className="w-3.5 h-3.5" />
              <span>256-bit SSL Encrypted</span>
            </div>
          </div>

          {/* Main Content Viewport */}
          <div className="p-6 flex flex-col gap-6">
            {/* SDK & Gateway Status Indicator */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300">
                <p className="font-bold text-white mb-0.5">Authoritative Gateway Handshake</p>
                <p className="text-slate-400">
                  Payments are processed directly through Cashfree Payments India Private Limited via the official Cashfree JS SDK v3.
                </p>
                <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-400">
                  <span>SDK: <b className={sdkReady ? "text-emerald-400" : "text-amber-400"}>{sdkReady ? "Ready (v3)" : "Loading..."}</b></span>
                  <span>Session: <b className={paymentSessionId ? "text-emerald-400 font-mono" : "text-slate-500 font-mono"}>{paymentSessionId ? "Generated" : "Pending"}</b></span>
                </div>
              </div>
            </div>

            {/* Error or Notice Box */}
            {errorMessage && (
              <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/40 text-amber-200 flex items-start gap-3 text-xs">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-100">Gateway Environment Notice</p>
                  <p className="text-amber-300/80 mt-0.5">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Primary Action Button */}
            <div className="flex flex-col gap-3">
              <button
                type="button"
                disabled={isInitializing || isLaunchingCheckout}
                onClick={handleLaunchOfficialCheckout}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-2xl shadow-xl shadow-blue-950/50 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {isLaunchingCheckout ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Opening Cashfree Gateway...</span>
                  </>
                ) : isInitializing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Initializing Cashfree Session...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Proceed to Cashfree Official Checkout (₹{amount.toFixed(2)})</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <Link
                  href="/checkout"
                  className="inline-flex items-center gap-1.5 hover:text-white transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Cart Review</span>
                </Link>

                <a
                  href="https://www.cashfree.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-blue-400 transition"
                >
                  <span>Cashfree Security</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
