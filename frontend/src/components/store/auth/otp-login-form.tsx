"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  User,
  Mail,
  AlertCircle,
  Cake,
} from "lucide-react";
import { requestOtp, verifyOtp } from "@frontend/lib/data/customer";
import { loginCustomer } from "@frontend/lib/actions/users";
import { useCustomer } from "@frontend/providers/customer-provider";

export interface OtpLoginFormProps {
  redirectUrl?: string;
  onSuccess?: (user: any) => void;
  isModal?: boolean;
  onClose?: () => void;
  intentAction?: string;
}

export function OtpLoginForm({
  redirectUrl,
  onSuccess,
  isModal,
  onClose,
  intentAction,
}: OtpLoginFormProps = {}) {
  const router = useRouter();
  const { refetchCustomer } = useCustomer();

  const [step, setStep] = useState<"phone" | "otp" | "new_customer">("phone");
  const [phone, setPhone] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [existingCustomerName, setExistingCustomerName] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(30);
  const [canResend, setCanResend] = useState(false);

  const digitInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if ((step === "otp" || step === "new_customer") && countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    } else if ((step === "otp" || step === "new_customer") && countdown === 0) {
      setCanResend(true);
    }
    return () => clearTimeout(timer);
  }, [step, countdown]);

  // Handle individual digit input
  const handleDigitChange = (index: number, val: string) => {
    const cleaned = val.replace(/\D/g, "");
    if (!cleaned) {
      const newDigits = [...otpDigits];
      newDigits[index] = "";
      setOtpDigits(newDigits);
      return;
    }

    // If pasted full 6 digits
    if (cleaned.length >= 6) {
      const newDigits = cleaned.slice(0, 6).split("");
      setOtpDigits(newDigits);
      digitInputRefs.current[5]?.focus();
      return;
    }

    const lastChar = cleaned.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = lastChar;
    setOtpDigits(newDigits);

    // Auto-advance focus
    if (index < 5 && lastChar) {
      digitInputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      digitInputRefs.current[index - 1]?.focus();
    }
  };

  const getFullOtp = () => otpDigits.join("");

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const cleanDigits = phone.replace(/\D/g, "");
    if (cleanDigits.length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    try {
      const result = await requestOtp(cleanDigits);
      setCountdown(30);
      setCanResend(false);
      setOtpDigits(["", "", "", "", "", ""]);

      if (result.account_exists === false) {
        setExistingCustomerName(null);
        setStep("new_customer");
      } else {
        const rawName = (result as any).customer_name || (result as any).name;
        if (rawName && rawName !== "Customer" && rawName !== "Valued Customer") {
          setExistingCustomerName(rawName.split(" ")[0]);
        } else {
          setExistingCustomerName(null);
        }
        setStep("otp");
      }

      setTimeout(() => {
        digitInputRefs.current[0]?.focus();
      }, 100);
    } catch (err: any) {
      setError(err.message || "Failed to send verification OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = getFullOtp();
    if (cleanCode.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    if (step === "new_customer" && !name.trim()) {
      setError("Please enter your full name to set up your account.");
      return;
    }

    setLoading(true);
    try {
      const cleanDigits = phone.replace(/\D/g, "");
      const extra = step === "new_customer" ? { name: name.trim(), email: email.trim() || undefined } : undefined;
      const result = await verifyOtp(cleanDigits, cleanCode, extra);

      if (!result || !result.token) {
        throw new Error("Invalid verification code. Please check and try again.");
      }

      const serverRole = (result.role || result.detected_role || "CUSTOMER").toUpperCase();
      const userId = result.user?.id || result.customer_id;
      const customerUid = result.user?.customer_uid || result.customer_uid;
      const userPhone = result.user?.phone || cleanDigits;
      const branchId = result.branch_id || result.user?.branch_id;
      const partnerId = result.partner_id || result.user?.partner_id;

      // Set cookies client-side
      if (typeof document !== "undefined") {
        document.cookie = `_cth_role=${serverRole}; path=/; SameSite=Lax;`;
        document.cookie = `_cth_jwt=${result.token}; path=/; SameSite=Lax;`;
        if (userId) document.cookie = `_cth_user_id=${userId}; path=/; SameSite=Lax;`;
        if (customerUid) document.cookie = `_cth_customer_uid=${customerUid}; path=/; SameSite=Lax;`;
        if (userPhone) document.cookie = `_cth_phone=${userPhone}; path=/; SameSite=Lax;`;
        if (branchId) document.cookie = `_cth_branch_id=${branchId}; path=/; SameSite=Lax;`;
        if (partnerId) document.cookie = `_cth_partner_id=${partnerId}; path=/; SameSite=Lax;`;

        localStorage.setItem("cth_access_token", result.token);
        localStorage.setItem("cth_user", JSON.stringify(result.user || {}));
      }

      // Sync server-side session cookies
      await loginCustomer(result.token, serverRole, userId, userPhone, branchId, partnerId, customerUid).catch(() => null);

      // Hydrate reactive customer context
      await refetchCustomer();

      if (onSuccess) {
        onSuccess(result);
      }

      if (isModal && serverRole === "CUSTOMER" && !redirectUrl) {
        setLoading(false);
        if (onClose) onClose();
        return;
      }

      let targetPath = redirectUrl || "/account";
      if (serverRole === "DELIVERY_PARTNER" || serverRole === "DLP") {
        targetPath = "/dashboard/delivery-partner";
      } else if (serverRole === "BRANCH_MANAGER" || serverRole === "SHOP_MANAGER" || serverRole === "SHOP" || serverRole === "SHPMGR") {
        targetPath = "/dashboard/shop";
      } else if (serverRole === "SUPER_ADMIN" || serverRole === "ADMIN") {
        targetPath = "/dashboard";
      }

      router.push(targetPath);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "OTP verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-5 text-left">
      {/* Error Alert */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: PHONE INPUT */}
      {step === "phone" && (
        <form onSubmit={handleRequestOtp} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-300">
              Mobile Number
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 flex items-center gap-1.5 text-xs font-bold text-neutral-400 border-r border-neutral-800 pr-3 select-none">
                <span className="text-base leading-none">🇮🇳</span>
                <span>+91</span>
              </div>
              <input
                id="phone_input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98765 43210"
                maxLength={14}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl pl-24 pr-4 py-3 text-sm text-white font-mono placeholder-neutral-600 transition-all font-medium"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-neutral-400">
              We&apos;ll send a 6-digit verification code to this number.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || phone.replace(/\D/g, "").length < 10}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-neutral-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Sending Code...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Continue <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>
        </form>
      )}

      {/* STEP 2: VERIFY OTP (EXISTING CUSTOMER) */}
      {step === "otp" && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          {existingCustomerName ? (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Welcome back, {existingCustomerName}!</span>
            </div>
          ) : (
            <div className="text-xs text-neutral-400">
              Enter 6-digit code sent to <span className="font-mono text-amber-400 font-bold">+91 {phone}</span>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-300">
                Verification Code
              </label>
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setOtpDigits(["", "", "", "", "", ""]);
                  setError(null);
                }}
                className="text-[11px] text-amber-400 hover:underline font-medium"
              >
                Change Number
              </button>
            </div>

            {/* 6 Individual Numeric Boxes */}
            <div className="grid grid-cols-6 gap-2">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    digitInputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                  className="w-full aspect-square bg-neutral-950 border border-neutral-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl text-center text-lg font-mono font-bold text-white transition-all select-none"
                  autoFocus={idx === 0}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || getFullOtp().length !== 6}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Verifying...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Verify &amp; Enter <CheckCircle2 className="w-4 h-4" />
              </span>
            )}
          </button>

          <div className="text-center pt-1">
            {canResend ? (
              <button
                type="button"
                onClick={handleRequestOtp}
                className="text-xs font-bold text-amber-400 hover:underline cursor-pointer"
              >
                Didn&apos;t receive code? Resend OTP
              </button>
            ) : (
              <span className="text-xs text-neutral-400">
                Resend code in <span className="font-mono text-neutral-300 font-bold">{countdown}s</span>
              </span>
            )}
          </div>
        </form>
      )}

      {/* STEP 3: REGISTRATION ONBOARDING FOR NEW CUSTOMER */}
      {step === "new_customer" && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1">
            <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Cake className="w-3.5 h-3.5 text-amber-400" />
              Create your CakeToHome account
            </h3>
            <p className="text-[11px] text-neutral-300 leading-tight">
              Enter the code sent to <span className="font-mono text-amber-300">+91 {phone}</span> and set your name.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-300">
                6-Digit Verification Code
              </label>
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setOtpDigits(["", "", "", "", "", ""]);
                  setError(null);
                }}
                className="text-[11px] text-amber-400 hover:underline"
              >
                Change Number
              </button>
            </div>
            {/* 6 Individual Numeric Boxes */}
            <div className="grid grid-cols-6 gap-2">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    digitInputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                  className="w-full aspect-square bg-neutral-950 border border-neutral-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl text-center text-lg font-mono font-bold text-white transition-all"
                  autoFocus={idx === 0}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-neutral-300">
              Your Full Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative flex items-center">
              <User className="w-3.5 h-3.5 absolute left-3.5 text-neutral-500" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex R Ashok"
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-neutral-600"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-neutral-300">
              Email Address <span className="text-neutral-500 font-normal">(Optional for Invoices)</span>
            </label>
            <div className="relative flex items-center">
              <Mail className="w-3.5 h-3.5 absolute left-3.5 text-neutral-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. alex@example.com"
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-neutral-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim() || getFullOtp().length !== 6}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? "Creating Account..." : "Complete Registration & Enter"}
          </button>
        </form>
      )}

      {/* Trust Footnote */}
      <div className="pt-2 text-center flex items-center justify-center gap-1.5 text-[11px] text-neutral-400 select-none">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>End-to-End Encrypted &bull; Instant OTP Login</span>
      </div>
    </div>
  );
}
