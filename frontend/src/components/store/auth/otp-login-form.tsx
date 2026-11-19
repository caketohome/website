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
import { CountryPhoneInput } from "./country-phone-input";
import { normalizePhone } from "@frontend/lib/auth/phone";
import { DEFAULT_COUNTRY, type Country } from "@frontend/lib/auth/countries";

const RESEND_SECONDS = 60;

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

  // International phone state
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");

  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(RESEND_SECONDS);
  const [canResend, setCanResend] = useState(false);

  /** The E.164 number sent to the server — stored so OTP step uses same value */
  const [submittedE164, setSubmittedE164] = useState<string>("");

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

  /** Get validated E.164 from current phone + country, or null */
  const getE164 = (): string | null =>
    normalizePhone(phone, selectedCountry.dialCode, selectedCountry.iso2);

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const e164 = getE164();
    if (!e164) {
      setError("Enter a valid phone number for the selected country.");
      return;
    }
    if (step === "otp" && !canResend) return;

    setLoading(true);
    try {
      await requestOtp(e164);
      setSubmittedE164(e164);
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
    if (role === "CUSTOMER") {
      // Customers just get signed in: stay on the page (modal), or go back to where they were.
      if (isModal && !redirectUrl) {
        if (onClose) onClose();
        router.refresh();
        return;
      }
      let back = redirectUrl || "";
      if (!back && typeof window !== "undefined" && document.referrer) {
        try {
          const ref = new URL(document.referrer);
          if (ref.origin === window.location.origin && !/^\/(login|signup|rider\/login)/.test(ref.pathname)) back = ref.pathname + ref.search;
        } catch { /* ignore */ }
      }
      router.push(back || "/");
      router.refresh();
      return;
    }
    // Admin, shop staff, riders, partners: their own panel.
    router.push(target);
    router.refresh();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const code = getFullOtp();
    if (!submittedE164 || code.length !== 6) {
      setError("Enter the complete 6-digit code.");
      return;
    }

    setLoading(true);
    try {
      const result = await verifyOtp(submittedE164, code);
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

  /** Formatted display of the submitted number for OTP step */
  const maskedDisplay = submittedE164
    ? submittedE164
    : `+${selectedCountry.dialCode} ${phone}`;

  return (
    <div className="w-full space-y-5 text-left">
      {/* Error Alert */}
      {error && (
        <div className="p-3.5 rounded-lg bg-[#FDECEC] border border-[#C93636]/25 text-[#C93636] text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#C93636]" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: PHONE INPUT */}
      {step === "phone" && (
        <form onSubmit={handleRequestOtp} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-brand-text">
              Mobile Number
            </label>
            <CountryPhoneInput
              value={phone}
              onChange={setPhone}
              selectedCountry={selectedCountry}
              onCountryChange={(c) => {
                setSelectedCountry(c);
                setPhone(""); // reset number when country changes
              }}
              disabled={loading}
              autoFocus
            />
            <p className="text-[11px] text-brand-text-muted">
              We&apos;ll send a 6-digit verification code to this number.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !getE164()}
            className="w-full py-3.5 rounded-lg bg-brand-navy hover:bg-brand-primary text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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

      {/* STEP 2: VERIFY OTP */}
      {step === "otp" && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="text-xs text-brand-text-muted">
            Enter the 6-digit code sent to{" "}
            <span className="font-mono text-brand-navy font-bold">{maskedDisplay}</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-brand-text">
                Verification Code
              </label>
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setOtpDigits(["", "", "", "", "", ""]);
                  setError(null);
                  setSubmittedE164("");
                }}
                className="text-xs text-brand-primary hover:underline font-medium"
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
                  className="w-full aspect-square bg-white border border-brand-border focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none rounded-xl text-center text-lg font-mono font-bold text-brand-navy transition-all select-none"
                  autoFocus={idx === 0}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || getFullOtp().length !== 6}
            className="w-full py-3.5 rounded-lg bg-brand-navy hover:bg-brand-primary text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
                className="text-xs font-semibold text-brand-primary hover:underline cursor-pointer"
              >
                Didn&apos;t receive code? Resend OTP
              </button>
            ) : (
              <span className="text-xs text-brand-text-muted">
                Resend code in <span className="font-mono text-brand-text font-bold">{countdown}s</span>
              </span>
            )}
          </div>
        </form>
      )}

      {/* STEP 3: PROFILE COMPLETION */}
      {step === "profile" && (
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="p-3.5 rounded-lg bg-brand-gold-light/50 border border-brand-gold/25 space-y-1">
            <h3 className="text-xs font-bold text-brand-gold-dark flex items-center gap-1.5">
              <Cake className="w-3.5 h-3.5 text-brand-gold" />
              Number verified — finish your CakeToHome profile
            </h3>
            <p className="text-[11px] text-brand-text leading-tight">Tell us what to call you.</p>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-brand-text">
              Your Full Name <span className="text-brand-gold">*</span>
            </label>
            <div className="relative flex items-center">
              <User className="w-3.5 h-3.5 absolute left-3.5 text-brand-text-muted" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex R Ashok"
                className="w-full bg-white border border-brand-border focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none rounded-xl pl-9 pr-4 py-2.5 text-xs text-brand-text placeholder:text-brand-text-muted/70"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-brand-text">
              Email Address <span className="text-brand-text-muted font-normal">(Optional for Invoices)</span>
            </label>
            <div className="relative flex items-center">
              <Mail className="w-3.5 h-3.5 absolute left-3.5 text-brand-text-muted" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. alex@example.com"
                className="w-full bg-white border border-brand-border focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none rounded-xl pl-9 pr-4 py-2.5 text-xs text-brand-text placeholder:text-brand-text-muted/70"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || name.trim().length < 2}
            className="w-full py-3.5 rounded-lg bg-brand-navy hover:bg-brand-primary text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? "Saving..." : "Save & Continue"}
          </button>
        </form>
      )}

      {/* Trust Footnote */}
      <div className="pt-2 text-center flex items-center justify-center gap-1.5 text-[11px] text-brand-text-muted select-none">
        <ShieldCheck className="w-3.5 h-3.5 text-[#16834A] shrink-0" />
        <span>Secure SMS verification · International numbers supported</span>
      </div>
    </div>
  );
}
