"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";

export default function CashfreeDecommissionedPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const orderId = searchParams.get("order_id") || "";
  const amountStr = searchParams.get("amount") || "699.00";

  useEffect(() => {
    // Immediately redirect to genuine Razorpay checkout
    const timer = setTimeout(() => {
      router.replace(`/checkout/razorpay?order_id=${encodeURIComponent(orderId)}&amount=${encodeURIComponent(amountStr)}`);
    }, 1200);

    return () => clearTimeout(timer);
  }, [orderId, amountStr, router]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center flex flex-col items-center gap-4">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">Upgrading to Razorpay Secure Checkout</h1>
        <p className="text-xs text-slate-500 leading-relaxed">
          Cashfree payment gateway has been decommissioned. Redirecting you to CakeToHome's secure Razorpay checkout portal...
        </p>
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 mt-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Redirecting securely...
        </div>
      </div>
    </div>
  );
}
