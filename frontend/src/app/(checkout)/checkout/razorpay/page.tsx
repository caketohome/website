"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Script from "next/script";
import Link from "next/link";
import { ShieldCheck, Lock, AlertCircle, ArrowLeft, Loader2, RefreshCw } from "lucide-react";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export default function RazorpayCheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const orderId = searchParams.get("order_id") || "CTH-ORD-" + Date.now().toString().slice(-6);
  const amountStr = searchParams.get("amount") || "699.00";
  const amount = parseFloat(amountStr) || 699.0;

  const [razorpayOrderId, setRazorpayOrderId] = useState<string | null>(null);
  const [razorpayKeyId, setRazorpayKeyId] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"initializing" | "ready" | "processing" | "success" | "failed" | "dismissed">("initializing");

  const hasLaunchedRef = useRef(false);

  // 1. Initialize Razorpay Order via authoritative backend API
  const initializeOrder = useCallback(async () => {
    setIsInitializing(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/v1/payments/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.razorpay_order_id) {
        setRazorpayOrderId(data.razorpay_order_id);
        setRazorpayKeyId(data.key_id);
        setPaymentStatus("ready");
      } else {
        setPaymentStatus("failed");
        setErrorMessage(data.message || "Failed to initialize Razorpay payment order session.");
      }
    } catch (err: any) {
      console.error("[Razorpay Checkout] Initialization error:", err);
      setPaymentStatus("failed");
      setErrorMessage("Network error initializing payment gateway: " + err.message);
    } finally {
      setIsInitializing(false);
    }
  }, [orderId]);

  useEffect(() => {
    initializeOrder();
  }, [initializeOrder]);

  // 2. Launch Razorpay Standard Checkout modal
  const launchRazorpayModal = useCallback(() => {
    if (!sdkReady || !window.Razorpay) {
      setErrorMessage("Razorpay payment gateway SDK is still loading. Please wait a moment.");
      return;
    }

    if (!razorpayOrderId || !razorpayKeyId) {
      setErrorMessage("Payment order session not ready. Please retry.");
      return;
    }

    try {
      const options = {
        key: razorpayKeyId,
        amount: Math.round(amount * 100),
        currency: "INR",
        name: "CakeToHome",
        description: `Order #${orderId} - Fresh Artisan Bakery`,
        order_id: razorpayOrderId,
        image: "/images/logo.png",
        prefill: {
          name: "Valued Customer",
          email: "customer@cakestohome.com",
          contact: "9876543210"
        },
        theme: {
          color: "#2563EB" // Approved CakeToHome Brand Blue
        },
        handler: async function (response: any) {
          setIsProcessingPayment(true);
          setPaymentStatus("processing");

          try {
            const verifyRes = await fetch("/api/v1/payments/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                order_id: orderId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();

            if (verifyRes.ok && verifyData.success) {
              setPaymentStatus("success");
              // Redirect to order confirmation page
              router.push(`/your-order?order_id=${encodeURIComponent(orderId)}`);
            } else {
              setPaymentStatus("failed");
              setErrorMessage(verifyData.message || "Payment verification failed. Please contact support.");
            }
          } catch (verifyErr: any) {
            console.error("[Razorpay Verify] Error:", verifyErr);
            setPaymentStatus("failed");
            setErrorMessage("Network error during payment verification. Please check your order status.");
          } finally {
            setIsProcessingPayment(false);
          }
        },
        modal: {
          ondismiss: function () {
            setPaymentStatus("dismissed");
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        console.warn("[Razorpay] Payment Failed:", response.error);
        setPaymentStatus("failed");
        setErrorMessage(response.error?.description || "Payment was declined by bank or card issuer.");
      });

      rzp.open();
    } catch (err: any) {
      console.error("[Razorpay Launch] Error:", err);
      setPaymentStatus("failed");
      setErrorMessage("Could not launch Razorpay modal: " + err.message);
    }
  }, [sdkReady, razorpayOrderId, razorpayKeyId, amount, orderId, router]);

  // Auto-launch once ready
  useEffect(() => {
    if (sdkReady && paymentStatus === "ready" && !hasLaunchedRef.current) {
      hasLaunchedRef.current = true;
      launchRazorpayModal();
    }
  }, [sdkReady, paymentStatus, launchRazorpayModal]);

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
        onLoad={() => {
          setSdkReady(true);
        }}
        onError={() => {
          setErrorMessage("Failed to load Razorpay checkout script from checkout.razorpay.com.");
        }}
      />

      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <Link
              href="/checkout"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Cancel & Return
            </Link>
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5" /> 256-Bit SSL Secure
            </div>
          </div>

          {/* Amount & Order Details */}
          <div className="py-6 text-center">
            <div className="inline-flex p-3 rounded-2xl bg-blue-50 text-blue-600 mb-3">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Razorpay Standard Checkout</h1>
            <p className="text-xs text-slate-500 mt-1">Order #{orderId}</p>

            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-xs text-slate-500">Payable Amount</div>
              <div className="text-3xl font-black text-slate-900 mt-0.5">
                ₹{amount.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Dynamic Status / Actions */}
          <div className="flex flex-col gap-4">
            {isInitializing && (
              <div className="flex flex-col items-center justify-center p-6 gap-2">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                <span className="text-xs text-slate-500">Initializing secure payment gateway...</span>
              </div>
            )}

            {isProcessingPayment && (
              <div className="flex flex-col items-center justify-center p-6 gap-2">
                <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                <span className="text-xs font-semibold text-emerald-800">Verifying payment authorization with bank...</span>
              </div>
            )}

            {errorMessage && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {!isInitializing && !isProcessingPayment && (
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={launchRazorpayModal}
                  className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" /> Open Payment Modal
                </button>

                <button
                  type="button"
                  onClick={initializeOrder}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry Session Connection
                </button>
              </div>
            )}

            {/* Test Simulation Button in Test Mode */}
            {process.env.NODE_ENV !== "production" && !isProcessingPayment && (
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={async () => {
                    setIsProcessingPayment(true);
                    try {
                      const mockPayId = `pay_mock_${Date.now()}`;
                      const verifyRes = await fetch("/api/v1/payments/razorpay/verify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          order_id: orderId,
                          razorpay_order_id: razorpayOrderId || `order_rzp_mock_${Date.now()}`,
                          razorpay_payment_id: mockPayId,
                          razorpay_signature: `test_mock_sig_${Date.now()}`,
                        }),
                      });
                      const data = await verifyRes.json();
                      if (data.success) {
                        router.push(`/your-order?order_id=${encodeURIComponent(orderId)}`);
                      } else {
                        setErrorMessage(data.message || "Simulation failed");
                      }
                    } catch (e: any) {
                      setErrorMessage(e.message);
                    } finally {
                      setIsProcessingPayment(false);
                    }
                  }}
                  className="w-full py-2 px-3 border border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-100/50 text-blue-700 text-[11px] font-semibold rounded-lg transition-colors"
                >
                  ⚡ Simulate Instant Sandbox Success (Dev / QA Test)
                </button>
              </div>
            )}
          </div>

          {/* Footer Security Badges */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-4 text-[11px] text-slate-400">
            <span>UPI</span>
            <span>•</span>
            <span>Visa / Mastercard</span>
            <span>•</span>
            <span>RuPay</span>
            <span>•</span>
            <span>Netbanking</span>
          </div>
        </div>
      </div>
    </>
  );
}
