"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { X, Copy, Check, Sparkles, ArrowRight, Phone, ShieldCheck, RefreshCw, Tag, AlertCircle, User, Mail } from "lucide-react";
import { PopupCampaign, EngagementContext } from "@frontend/lib/engagement/types";
import { renderTemplate } from "@frontend/lib/engagement/template-renderer";
import { requestOtp, verifyOtp } from "@frontend/lib/data/customer";
import { loginCustomer } from "@frontend/lib/actions/users";

interface StorefrontPopupModalProps {
  campaign: PopupCampaign;
  context: EngagementContext;
  onClose: () => void;
  onCtaAction?: (action: string, meta?: any) => void;
}

export function StorefrontPopupModal({
  campaign,
  context,
  onClose,
  onCtaAction,
}: StorefrontPopupModalProps) {
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Phone & OTP authentication state
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [authStep, setAuthStep] = useState<"idle" | "phone" | "otp" | "new_customer" | "success">("idle");
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(30);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const version = campaign.current_version || campaign.draft_version;
  const content = version?.content;
  const design = version?.design;
  const media = version?.media;
  const offer = version?.offer;
  const phoneConfig = content?.phoneConfig;

  const isPhoneLoginPopup =
    content?.primaryButton?.action === "LOGIN_WITH_MOBILE" ||
    campaign.popup_type === "LOGIN" ||
    (Boolean(phoneConfig?.enabled) && content?.primaryButton?.action !== "CLOSE");

  // Initialize auth step if phone login popup
  useEffect(() => {
    if (isPhoneLoginPopup && authStep === "idle") {
      setAuthStep("phone");
    }
  }, [isPhoneLoginPopup, authStep]);

  // Responsive device check
  useEffect(() => {
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  // Resend timer countdown
  useEffect(() => {
    if (authStep !== "otp" || resendSeconds <= 0) return;
    const timer = setInterval(() => {
      setResendSeconds((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [authStep, resendSeconds]);

  // Keyboard escape listener (unless phone is mandatory)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !phoneConfig?.mandatory) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, phoneConfig?.mandatory]);

  // Interpolate dynamic template text
  const renderedHeadline = useMemo(() => {
    return renderTemplate(content?.headline || "Special Offer", context, offer);
  }, [content?.headline, context, offer]);

  const renderedDesc = useMemo(() => {
    return renderTemplate(content?.description || "", context, offer);
  }, [content?.description, context, offer]);

  const renderedEyebrow = useMemo(() => {
    return renderTemplate(content?.eyebrow || "", context, offer);
  }, [content?.eyebrow, context, offer]);

  const renderedBadge = useMemo(() => {
    return renderTemplate(content?.badge || "", context, offer);
  }, [content?.badge, context, offer]);

  const renderedPrimaryLabel = useMemo(() => {
    return renderTemplate(
      phoneConfig?.buttonLabel || content?.primaryButton?.label || (isPhoneLoginPopup ? "Continue with Mobile Number" : "Claim Offer"),
      context,
      offer
    );
  }, [phoneConfig?.buttonLabel, content?.primaryButton?.label, isPhoneLoginPopup, context, offer]);

  const resolvedCouponCode = offer?.couponCode || content?.primaryButton?.couponCode || "";

  // Resolve media image
  const resolvedImageUrl = useMemo(() => {
    if (isMobile && media?.mobileImageUrl) return media.mobileImageUrl;
    if (!media || media.source === "NO_IMAGE") return null;
    if (media.source === "PRODUCT_IMAGE") {
      return context.product?.image || media.imageUrl || null;
    }
    if (media.source === "CART_IMAGES") {
      return context.cart?.items?.[0]?.thumbnail || media.imageUrl || null;
    }
    return media.imageUrl || null;
  }, [media, context, isMobile]);

  const handleCopyCode = useCallback(() => {
    if (!resolvedCouponCode) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(resolvedCouponCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [resolvedCouponCode]);

  // Phone input formatting
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (raw.length <= 10) {
      setPhone(raw);
      setAuthError(null);
    }
  };

  // Submit Mobile Number -> Request OTP via existing CakeToHome Auth
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanDigits = phone.replace(/\D/g, "").slice(-10);
    if (cleanDigits.length !== 10) {
      setAuthError("Enter a valid mobile number.");
      return;
    }

    setLoading(true);
    setAuthError(null);

    try {
      const fullNumber = `+91${cleanDigits}`;
      const res = await requestOtp(fullNumber);

      if (res?.dev_otp) {
        setDevOtp(res.dev_otp);
      }

      if (res.account_exists === false) {
        setIsNewCustomer(true);
      } else {
        setIsNewCustomer(false);
      }

      setAuthStep("otp");
      setResendSeconds(30);

      // Focus first OTP input after DOM renders
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 100);
    } catch (err: any) {
      setAuthError(err.message || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP digit changes with functional updater to prevent state collisions
  const handleOtpChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    if (!clean && value !== "") return;

    setOtp((prevOtp) => {
      const newOtp = [...prevOtp];
      if (clean.length > 1) {
        const digits = clean.slice(0, 6).split("");
        for (let i = 0; i < 6; i++) {
          newOtp[i] = digits[i] || "";
        }
        return newOtp;
      }
      newOtp[index] = clean;
      return newOtp;
    });

    setAuthError(null);

    if (clean.length > 1) {
      const nextIdx = Math.min(clean.length, 5);
      otpInputsRef.current[nextIdx]?.focus();
    } else if (clean && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  // Handle Backspace navigation in OTP boxes
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  // Complete session creation and authoritative role routing
  const completeAuthSession = async (
    res: any,
    fullNumber: string
  ) => {
    const token = res.token || res.accessToken;
    if (!token) {
      throw new Error("Authentication failed: No access token returned.");
    }

    const serverRole = (res.role || res.detected_role || "CUSTOMER").toUpperCase();
    const userId = res.user?.id || res.customer_id;
    const userPhone = res.user?.phone || fullNumber;
    const branchId = res.branch_id || res.user?.branch_id || res.user?.shop_id;
    const partnerId = res.partner_id || res.user?.partner_id;

    // 1. Immediate client cookies for instant hydration & middleware
    document.cookie = `_cth_role=${serverRole}; path=/;`;
    document.cookie = `_cth_jwt=${token}; path=/; SameSite=Lax;`;
    if (userId) document.cookie = `_cth_user_id=${userId}; path=/; SameSite=Lax;`;
    if (userPhone) document.cookie = `_cth_phone=${userPhone}; path=/; SameSite=Lax;`;
    if (branchId) document.cookie = `_cth_branch_id=${branchId}; path=/; SameSite=Lax;`;
    if (partnerId) document.cookie = `_cth_partner_id=${partnerId}; path=/; SameSite=Lax;`;

    // 2. Server session persistence via existing Server Action
    await loginCustomer(token, serverRole, userId, userPhone, branchId, partnerId).catch(() => null);

    // 3. Local storage token persistence
    try {
      localStorage.setItem("cth_access_token", token);
      localStorage.setItem("cth_user", JSON.stringify(res.user || { id: userId, phone: userPhone, role: serverRole }));
      if (resolvedCouponCode) {
        localStorage.setItem("applied_discount_code", resolvedCouponCode);
        localStorage.setItem("_cth_pending_coupon", resolvedCouponCode);
      }
    } catch {
      // Ignore storage errors
    }

    setAuthStep("success");

    if (onCtaAction) {
      onCtaAction("LOGIN_SUCCESS", {
        phone: fullNumber,
        user: res.user,
        role: serverRole,
        couponCode: resolvedCouponCode,
      });
    }

    // Dispatch global auth change event so header / cart updates live
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cth_auth_changed", { detail: { role: serverRole, user: res.user } }));
    }

    // 4. Server-Authoritative Destination Resolution
    let destination: string | null = null;
    if (serverRole === "DELIVERY_PARTNER" || serverRole === "DLP") {
      destination = "/dashboard/delivery-partner";
    } else if (serverRole === "BRANCH_MANAGER" || serverRole === "SHOP_MANAGER" || serverRole === "SHOP" || serverRole === "SHPMGR") {
      destination = "/dashboard/shop";
    } else if (serverRole === "SUPER_ADMIN" || serverRole === "ADMIN") {
      destination = "/dashboard";
    } else {
      // Customer: check if popup or context requested a specific redirection
      if (phoneConfig?.action === "LOGIN_REDIRECT" && phoneConfig?.redirectUrl) {
        destination = phoneConfig.redirectUrl;
      } else if (context?.redirectUrl) {
        destination = context.redirectUrl;
      }
    }

    setTimeout(() => {
      onClose();
      if (destination) {
        window.location.assign(destination);
      }
    }, 1000);
  };

  // Verify OTP & Authenticate Existing User (or route new customer to Step 3)
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const otpCode = otp.join("").replace(/\D/g, "");
    if (otpCode.length !== 6) {
      setAuthError("Please enter all 6 digits of the verification code.");
      return;
    }

    // If known new customer, proceed to Step 3 to collect name
    if (isNewCustomer && authStep === "otp") {
      setAuthStep("new_customer");
      return;
    }

    setLoading(true);
    setAuthError(null);

    try {
      const cleanDigits = phone.replace(/\D/g, "").slice(-10);
      const fullNumber = `+91${cleanDigits}`;
      const res: any = await verifyOtp(fullNumber, otpCode);

      if (!res || (!res.token && !res.accessToken)) {
        throw new Error("Invalid OTP. Please try again.");
      }

      // If the server tells us this is a new customer and we haven't asked for name yet
      if (res.is_new_customer && authStep !== "new_customer") {
        setIsNewCustomer(true);
        setAuthStep("new_customer");
        setLoading(false);
        return;
      }

      await completeAuthSession(res, fullNumber);
    } catch (err: any) {
      setAuthError(err.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 3 Submit: Create Account with Name & Email for New Customers
  const handleCreateNewCustomerAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setAuthError("Please enter your full name.");
      return;
    }

    const otpCode = otp.join("").replace(/\D/g, "");
    if (otpCode.length !== 6) {
      setAuthError("Please enter the 6-digit OTP.");
      setAuthStep("otp");
      return;
    }

    setLoading(true);
    setAuthError(null);

    try {
      const cleanDigits = phone.replace(/\D/g, "").slice(-10);
      const fullNumber = `+91${cleanDigits}`;
      const extra = { name: name.trim(), email: email.trim() || undefined };
      const res: any = await verifyOtp(fullNumber, otpCode, extra);

      if (!res || (!res.token && !res.accessToken)) {
        throw new Error("Account creation failed. Please try again.");
      }

      await completeAuthSession(res, fullNumber);
    } catch (err: any) {
      setAuthError(err.message || "Account creation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Standard CTA action handler
  const handlePrimaryClick = () => {
    if (isPhoneLoginPopup && authStep === "phone") {
      handleRequestOtp();
      return;
    }

    const action = content?.primaryButton?.action || "OPEN_CART";
    if (action === "APPLY_COUPON" && resolvedCouponCode) {
      handleCopyCode();
      try {
        localStorage.setItem("applied_discount_code", resolvedCouponCode);
        localStorage.setItem("_cth_pending_coupon", resolvedCouponCode);
      } catch {
        // Ignore storage error
      }
    }
    if (onCtaAction) {
      onCtaAction(action, {
        couponCode: resolvedCouponCode,
        targetUrl: content?.primaryButton?.targetUrl,
        productId: content?.primaryButton?.productId || context.product?.id,
      });
    }
    if (action === "CLOSE") {
      onClose();
    }
  };

  const handleSecondaryClick = () => {
    const action = content?.secondaryButton?.action || "CLOSE";
    if (onCtaAction) {
      onCtaAction(action, { targetUrl: content?.secondaryButton?.targetUrl });
    }
    onClose();
  };

  const accentColor = design?.accentColor || "#1D2F5D";
  const borderRadius = design?.borderRadius || 20;
  const maxWidth = design?.width || 520;
  const isSplitLayout = !isMobile && design?.desktopLayout === "SPLIT_LAYOUT" && resolvedImageUrl;
  const isSidePanel = !isMobile && design?.desktopLayout === "SIDE_PANEL";

  // Position class for wrapper
  const containerPositionClass = isSidePanel
    ? "fixed bottom-6 right-6 z-50 flex items-end justify-end pointer-events-none p-4"
    : isMobile && design?.mobileLayout === "BOTTOM_SHEET"
    ? "fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs p-0 animate-fade-in"
    : "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 animate-fade-in";

  return (
    <div
      className={containerPositionClass}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSidePanel && !phoneConfig?.mandatory) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={renderedHeadline}
    >
      <div
        style={{
          borderRadius: isMobile && design?.mobileLayout === "BOTTOM_SHEET" ? `${borderRadius}px ${borderRadius}px 0 0` : `${borderRadius}px`,
          maxWidth: isSidePanel ? "400px" : `${maxWidth}px`,
        }}
        className={`pointer-events-auto relative w-full bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 transition-all ${
          isMobile && design?.mobileLayout === "BOTTOM_SHEET"
            ? "animate-slide-in-bottom max-h-[90vh] overflow-y-auto"
            : "animate-scale-up"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button (Hidden if mandatory) */}
        {!phoneConfig?.mandatory && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close popup"
            className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 text-neutral-700 dark:text-neutral-200 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Modal Content Structure */}
        <div className={isSplitLayout ? "grid grid-cols-1 md:grid-cols-2" : "flex flex-col"}>
          {/* Visual Artwork Banner */}
          {resolvedImageUrl && (
            <div
              className={`relative bg-neutral-100 dark:bg-neutral-800 overflow-hidden ${
                isSplitLayout ? "h-full min-h-[340px]" : "w-full h-44 sm:h-52"
              }`}
            >
              <img
                src={resolvedImageUrl}
                alt={renderedHeadline}
                className="w-full h-full object-cover"
                loading="eager"
              />
              {renderedBadge && (
                <div
                  style={{ backgroundColor: accentColor }}
                  className="absolute top-3 left-3 px-3 py-1 rounded-full text-white text-xs font-bold shadow-md tracking-wide"
                >
                  {renderedBadge}
                </div>
              )}
            </div>
          )}

          {/* Text & Action Panel */}
          <div className="p-5 sm:p-7 flex flex-col gap-4">
            {/* Header info */}
            <div className="flex flex-col gap-1.5">
              {renderedEyebrow && (
                <span
                  style={{ color: accentColor }}
                  className="text-xs uppercase font-bold tracking-wider"
                >
                  {renderedEyebrow}
                </span>
              )}

              <h3 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-white leading-tight">
                {renderedHeadline}
              </h3>

              {renderedDesc && (
                <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed pt-0.5">
                  {renderedDesc}
                </p>
              )}
            </div>

            {/* Coupon Voucher Box */}
            {offer?.type === "COUPON" && resolvedCouponCode && (
              <div className="p-3 sm:p-3.5 rounded-xl bg-brand-gold-soft/80 dark:bg-[#0c1326]/40 border border-dashed border-[#D4AF37]/40 dark:border-[#D4AF37]/20 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-brand-gold-soft dark:bg-[#142040]/60 text-[#1D2F5D] dark:text-[#D4AF37] flex items-center justify-center shrink-0">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-[#152347] dark:text-[#D4AF37]/80 uppercase font-semibold block tracking-wider">
                      Promo Code
                    </span>
                    <span className="text-sm font-mono font-bold text-[#1D2F5D] dark:text-[#D4AF37] truncate block">
                      {resolvedCouponCode}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1D2F5D] hover:bg-[#152347] text-white transition-colors flex items-center gap-1 shrink-0 shadow-xs cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* PHONE & OTP LOGIN FLOW — INTEGRATED WITH EXISTING CAKETOHOME AUTH */}
            {isPhoneLoginPopup && (
              <div className="flex flex-col gap-3 pt-1">
                {authError && (
                  <div className="p-2.5 rounded-lg bg-brand-gold-soft dark:bg-[#0c1326]/50 border border-[#D4AF37]/30 dark:border-[#D4AF37]/20 text-[#152347] dark:text-[#D4AF37]/80 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                {/* Step 1: Mobile Number Input Form */}
                {authStep === "phone" && (
                  <form onSubmit={handleRequestOtp} className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        {phoneConfig?.placeholder || "Mobile Number"}
                      </label>
                      <div className="flex items-center rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus-within:border-[#D4AF37] focus-within:ring-2 focus-within:ring-[#D4AF37]/50/20 overflow-hidden transition-all">
                        <div className="px-3 py-2.5 text-xs font-bold text-neutral-600 dark:text-neutral-300 border-r border-neutral-200 dark:border-neutral-700 flex items-center gap-1 shrink-0 bg-neutral-100 dark:bg-neutral-900">
                          <span>🇮🇳</span>
                          <span>+91</span>
                        </div>
                        <input
                          type="tel"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={phone}
                          onChange={handlePhoneChange}
                          placeholder="98765 43210"
                          maxLength={10}
                          autoFocus
                          disabled={loading}
                          className="w-full px-3 py-2.5 text-sm bg-transparent text-neutral-900 dark:text-white font-medium focus:outline-none placeholder:text-neutral-400"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || phone.length < 10}
                      style={{ backgroundColor: accentColor }}
                      className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm shadow-md hover:brightness-105 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Sending OTP...</span>
                        </>
                      ) : (
                        <>
                          <span>{renderedPrimaryLabel}</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* Step 2: 6-Digit OTP Verification Form */}
                {authStep === "otp" && (
                  <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3 animate-fade-in">
                    <div className="flex flex-col gap-1 text-center">
                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Enter 6-Digit Verification Code
                      </span>
                      <span className="text-[11px] text-neutral-500">
                        Sent to +91 {phone.slice(0, 5)} {phone.slice(5)}
                      </span>
                      {devOtp && (
                        <div className="flex items-center justify-center gap-2 mt-1">
                          <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                            🔑 Dev OTP: <strong>{devOtp}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const digits = devOtp.slice(0, 6).split("");
                              setOtp(digits);
                            }}
                            className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white py-0.5 px-2 rounded font-medium transition-colors cursor-pointer"
                          >
                            Auto-fill
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 6 OTP input boxes */}
                    <div className="flex justify-between gap-2 py-1">
                      {otp.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => { otpInputsRef.current[idx] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(idx, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                          disabled={loading}
                          className="w-11 h-12 text-center text-lg font-bold rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/50/20 focus:outline-none transition-all"
                        />
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs text-neutral-500 px-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthStep("phone");
                          setOtp(["", "", "", "", "", ""]);
                          setAuthError(null);
                        }}
                        className="hover:underline text-neutral-600 dark:text-neutral-400 cursor-pointer"
                      >
                        Change number
                      </button>
                      <button
                        type="button"
                        disabled={resendSeconds > 0 || loading}
                        onClick={() => handleRequestOtp()}
                        className="text-[#1D2F5D] hover:underline disabled:opacity-40 disabled:cursor-not-allowed font-medium cursor-pointer"
                      >
                        {resendSeconds > 0 ? `Resend OTP (${resendSeconds}s)` : "Resend OTP"}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || otp.join("").length !== 6}
                      style={{ backgroundColor: accentColor }}
                      className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm shadow-md hover:brightness-105 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Verifying...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>{isNewCustomer ? "Continue" : "Verify & Continue"}</span>
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* Step 3: Complete Account Information (ONLY for New Customer) */}
                {authStep === "new_customer" && (
                  <form onSubmit={handleCreateNewCustomerAccount} className="flex flex-col gap-3 animate-fade-in">
                    <div className="flex flex-col gap-1 pb-1">
                      <span className="text-sm font-bold text-neutral-900 dark:text-white">
                        Complete your account
                      </span>
                      <span className="text-xs text-neutral-500">
                        Looks like you&apos;re new to CakeToHome! Enter your details to continue.
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        <span>Full Name <span className="text-[#D4AF37]">*</span></span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Rahul Sharma"
                        autoFocus
                        disabled={loading}
                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/50/20 focus:outline-none placeholder:text-neutral-400 transition-all"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />
                        <span>Email Address (Optional)</span>
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. rahul@example.com"
                        disabled={loading}
                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/50/20 focus:outline-none placeholder:text-neutral-400 transition-all"
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-neutral-500 pt-1">
                      <span>Mobile: <strong>+91 {phone}</strong></span>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthStep("phone");
                          setOtp(["", "", "", "", "", ""]);
                          setAuthError(null);
                        }}
                        className="hover:underline text-neutral-600 dark:text-neutral-400 cursor-pointer"
                      >
                        Change
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !name.trim()}
                      style={{ backgroundColor: accentColor }}
                      className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm shadow-md hover:brightness-105 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Creating account...</span>
                        </>
                      ) : (
                        <>
                          <span>Create Account & Continue</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* Step 4: Success Banner */}
                {authStep === "success" && (
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center flex flex-col items-center gap-2 animate-fade-in">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 flex items-center justify-center">
                      <Check className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                      Welcome to CakeToHome!
                    </span>
                    <span className="text-xs text-emerald-700 dark:text-emerald-400">
                      Your phone login was successful.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Standard Action Buttons (When not in phone login mode) */}
            {!isPhoneLoginPopup && (
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={handlePrimaryClick}
                  style={{ backgroundColor: accentColor }}
                  className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm shadow-md hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{renderedPrimaryLabel}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Secondary CTA / Continue as Guest */}
            {!phoneConfig?.mandatory && (
              <button
                type="button"
                onClick={handleSecondaryClick}
                className="w-full py-1.5 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors text-center cursor-pointer"
              >
                {phoneConfig?.guestButtonLabel || content?.secondaryButton?.label || "Continue Browsing"}
              </button>
            )}

            {/* Legal / Disclaimer Text */}
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 text-center block pt-0.5">
              {phoneConfig?.disclaimerText || content?.legalText || "By continuing, you agree to CakeToHome's Terms of Service & Privacy Policy."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
