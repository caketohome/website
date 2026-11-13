"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  User,
  Mail,
  AlertCircle,
  Cake,
} from "lucide-react";
import { OtpError, requestOtp, verifyOtp } from "@frontend/lib/data/customer";
import { useCustomer } from "@frontend/providers/customer-provider";

const RESEND_SECONDS = 60;

/** Same rule as the server (src/lib/auth/phone.ts); server re-validates anyway. */
function toTenDigits(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

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

  const [step, setStep] = useState<"phone" | "otp" | "profile">("phone");
  const [destination, setDestination] = useState("/account");
  const [verifiedRole, setVerifiedRole] = useState("CUSTOMER");
  const [phone, setPhone] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(RESEND_SECONDS);
  const [canResend, setCanResend] = useState(false);

  const digitInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    } else if (step === "otp") {
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

  const describe = (err: unknown): string => {
    if (err instanceof OtpError) {
      if (err.retryAfter) {
        setCountdown(err.retryAfter);
        setCanResend(false);
      }
      return err.message;
    }
    return "Something went wrong. Please try again.";
  };

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const tenDigits = toTenDigits(phone);
    if (!tenDigits) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (step === "otp" && !canResend) return;

    setLoading(true);
    try {
      await requestOtp(tenDigits);
      setCountdown(RESEND_SECONDS);
      setCanResend(false);
      setOtpDigits(["", "", "", "", "", ""]);
      setStep("otp");
      setTimeout(() => digitInputRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(describe(err));
    } finally {
      setLoading(false);
    }
  };

  const finish = async (role: string, target: string) => {
    await refetchCustomer();
    if (onSuccess) onSuccess({ role });
    if (isModal && role === "CUSTOMER" && !redirectUrl) {
      if (onClose) onClose();
      return;
    }
    // Customers may return to where they were; staff go where the server's role says.
    router.push(role === "CUSTOMER" && redirectUrl ? redirectUrl : target);
    router.refresh();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const code = getFullOtp();
    const tenDigits = toTenDigits(phone);
    if (!tenDigits || code.length !== 6) {
      setError("Enter the complete 6-digit code.");
      return;
    }

    setLoading(true);
    try {
      // Server verifies with Supabase and sets httpOnly session cookies; role comes back from the DB.
      const result = await verifyOtp(tenDigits, code);
      setOtpDigits(["", "", "", "", "", ""]);
      if (result.needs_profile) {
        setVerifiedRole(result.role);
        setDestination(result.redirect_to);
        setStep("profile");
        return;
      }
      await finish(result.role, result.redirect_to);
    } catch (err) {
      setOtpDigits(["", "", "", "", "", ""]);
      setError(describe(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name: name.trim(), email: email.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new OtpError(data?.code || "update_failed", data?.error || "Could not save your profile.");
      await finish(verifiedRole, destination);
    } catch (err) {
      setError(describe(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-5 text-left">
      {/* Error Alert */}
      {error && (
        <div className="p-3.5 rounded-xl bg-[#1D2F5D]/10 border border-[#D4AF37]/30 text-[#D4AF37]/80 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#D4AF37]" />
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
            disabled={loading || !toTenDigits(phone)}
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
          <div className="text-xs text-neutral-400">
            Enter the 6-digit code sent to <span className="font-mono text-amber-400 font-bold">+91 {toTenDigits(phone)}</span>
          </div>

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
            <div className="grid grid-cols-6 gap-2" role="group" aria-label="One-time code">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    digitInputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={idx === 0 ? "one-time-code" : "off"}
                  aria-label={`Digit ${idx + 1} of 6`}
                  maxLength={idx === 0 ? 6 : 1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onPaste={(e) => {
                    e.preventDefault();
                    handleDigitChange(idx, e.clipboardData.getData("text"));
                  }}
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
                onClick={() => handleRequestOtp()}
                disabled={loading}
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

      {/* STEP 3: PROFILE COMPLETION (phone already verified by Supabase) */}
      {step === "profile" && (
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1">
            <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Cake className="w-3.5 h-3.5 text-amber-400" />
              Number verified — finish your CakeToHome profile
            </h3>
            <p className="text-[11px] text-neutral-300 leading-tight">Tell us what to call you.</p>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-neutral-300">
              Your Full Name <span className="text-[#D4AF37]">*</span>
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
            disabled={loading || name.trim().length < 2}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? "Saving..." : "Save & Continue"}
          </button>
        </form>
      )}

      {/* Trust Footnote */}
      <div className="pt-2 text-center flex items-center justify-center gap-1.5 text-[11px] text-neutral-400 select-none">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>Secure SMS verification</span>
      </div>
    </div>
  );
}
