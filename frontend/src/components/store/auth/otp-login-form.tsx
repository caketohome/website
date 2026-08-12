"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Text } from "@medusajs/ui";
import { ErrorComponent } from "@frontend/components/common/error-component";
import { requestOtp, verifyOtp, detectUserRole } from "@frontend/lib/data/customer";
import { loginCustomer, setRoleCookie } from "@frontend/lib/actions/users";

const isDev = process.env.NODE_ENV !== "production";

export function OtpLoginForm() {
    const router = useRouter();
    const [step, setStep] = useState<"phone" | "otp">("phone");
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [devOtp, setDevOtp] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);

    const activeInput = phone || (typeof document !== "undefined" ? (document.getElementById("phone") as HTMLInputElement)?.value : "") || "";
    const detectedInfo = detectUserRole(activeInput);

    async function handleRequestOtp(e?: any) {
        if (e && typeof e.preventDefault === "function") {
            e.preventDefault();
        }
        setError(null);
        setInfo(null);
        const currentPhone = (typeof document !== "undefined" ? (document.getElementById("phone") as HTMLInputElement)?.value : "") || phone || "";
        if (currentPhone.trim().length < 3) {
            setError("Please enter a valid mobile number or username.");
            return;
        }
        setPhone(currentPhone);
        setLoading(true);

        try {
            const result = await requestOtp(currentPhone);
            if (isDev && result?.dev_otp) {
                setDevOtp(result.dev_otp);
                setInfo(`Development OTP: ${result.dev_otp}`);
            } else {
                setInfo("OTP sent to your mobile number.");
            }
            setStep("otp");
        } catch (err: any) {
            setError(err.message || "Failed to send OTP. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    async function handleVerifyOtp(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        const formData = new FormData(e.currentTarget);
        const code = (formData.get("otp") as string || otp || "").replace(/\D/g, "");
        if (code.length !== 6) {
            setError("Please enter the 6-digit OTP.");
            return;
        }
        setLoading(true);

        try {
            const currentPhone = phone || (typeof document !== "undefined" ? (document.getElementById("phone") as HTMLInputElement)?.value : "") || "";

            // Call the real backend OTP verification endpoint
            const result = await verifyOtp(currentPhone, code);

            if (!result || !result.token) {
                setError("Verification failed. Please try again.");
                setLoading(false);
                return;
            }

            const serverRole = (result as any).role || (result as any).user?.role || result.detected_role || "CUSTOMER";
            const userId = (result as any).user?.id || result.customer_id;
            const userPhone = (result as any).user?.phone || currentPhone;
            const branchId = (result as any).branch_id || (result as any).user?.branch_id || (result as any).user?.shop_id;
            const partnerId = (result as any).partner_id || (result as any).user?.partner_id;

            let targetPath = "/account";
            const normRole = (serverRole || "").toUpperCase();
            if (normRole === "DELIVERY_PARTNER" || normRole === "DLP") {
                targetPath = "/dashboard/delivery-partner";
            } else if (normRole === "BRANCH_MANAGER" || normRole === "SHOP_MANAGER" || normRole === "SHOP" || normRole === "SHPMGR") {
                targetPath = "/dashboard/shop";
            } else if (normRole === "SUPER_ADMIN" || normRole === "ADMIN") {
                targetPath = "/admin";
            }

            // Set cookies client-side for immediate hydration
            document.cookie = `_cth_role=${serverRole}; path=/;`;
            document.cookie = `_cth_jwt=${result.token}; path=/; SameSite=Lax;`;
            if (userId) document.cookie = `_cth_user_id=${userId}; path=/; SameSite=Lax;`;
            if (userPhone) document.cookie = `_cth_phone=${userPhone}; path=/; SameSite=Lax;`;
            if (branchId) document.cookie = `_cth_branch_id=${branchId}; path=/; SameSite=Lax;`;
            if (partnerId) document.cookie = `_cth_partner_id=${partnerId}; path=/; SameSite=Lax;`;

            // Persist session cookies on server
            await loginCustomer(result.token, serverRole, userId, userPhone, branchId, partnerId).catch(() => null);

            setInfo("Login successful! Redirecting...");

            // Instant non-blocking navigation
            window.location.assign(targetPath);
        } catch (err: any) {
            setError(err.message || "Verification failed. Please check your OTP.");
            setLoading(false);
        }
    }

    if (step === "phone") {
        return (
            <div className="flex flex-col gap-4 max-w-96">
                <div>
                    <Label htmlFor="phone">Mobile Number or Username</Label>
                    <Input
                        id="phone"
                        name="phone"
                        type="text"
                        placeholder="e.g. +91 98765 43210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleRequestOtp(e);
                        }}
                        autoFocus
                    />
                </div>

                <Button type="button" size="large" isLoading={loading} onClick={handleRequestOtp}>
                    Send OTP
                </Button>
                {error && (
                    <ErrorComponent
                        title="Authentication Error"
                        message={error}
                        onDismiss={() => setError(null)}
                    />
                )}
                {info && (
                    <Text className="text-ui-fg-subtle text-center text-sm">{info}</Text>
                )}
            </div>
        );
    }

    return (
        <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4 max-w-96">
            <div>
                <Label htmlFor="otp">Verification Code</Label>
                <Input
                    id="otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    autoFocus
                />
            </div>

            <Text className="text-ui-fg-subtle text-sm">
                OTP sent to {phone}.{" "}
                <button
                    type="button"
                    className="underline"
                    onClick={() => {
                        setStep("phone");
                        setOtp("");
                        setError(null);
                        setInfo(null);
                    }}
                >
                    Change number
                </button>
            </Text>

            {/* Development-only OTP helper — hidden in production builds */}
            {isDev && devOtp && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md flex flex-col gap-2">
                    <Text className="text-xs font-semibold text-blue-900 dark:text-blue-100">
                        🔑 Dev OTP: <span className="font-mono text-sm underline">{devOtp}</span>
                    </Text>
                    <button
                        type="button"
                        onClick={() => setOtp(devOtp)}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 rounded font-medium transition-colors w-fit"
                    >
                        Auto-fill OTP
                    </button>
                </div>
            )}

            <Button type="submit" size="large" isLoading={loading}>
                Verify & Login
            </Button>
            {error && (
                <ErrorComponent
                    title="Verification Failed"
                    message={error}
                    onDismiss={() => setError(null)}
                />
            )}
            {info && (
                <Text className="text-ui-fg-subtle text-center text-sm">{info}</Text>
            )}
        </form>
    );
}
