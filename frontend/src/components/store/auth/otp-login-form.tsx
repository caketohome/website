"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Text, Heading } from "@medusajs/ui";
import { ErrorComponent } from "@frontend/components/common/error-component";
import { requestOtp, verifyOtp, detectUserRole } from "@frontend/lib/data/customer";
import { loginCustomer } from "@frontend/lib/actions/users";

const isDev = process.env.NODE_ENV !== "production";

export interface OtpLoginFormProps {
    intentAction?: string;
    redirectUrl?: string;
    onSuccess?: (user: any) => void;
    isModal?: boolean;
    onClose?: () => void;
}

export function OtpLoginForm({ intentAction, redirectUrl, onSuccess, isModal, onClose }: OtpLoginFormProps = {}) {
    const router = useRouter();
    const [step, setStep] = useState<"phone" | "otp" | "new_customer">("phone");
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [isNewUser, setIsNewUser] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [devOtp, setDevOtp] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);

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

            if (result.account_exists === false) {
                setIsNewUser(true);
                setStep("new_customer");
            } else {
                setIsNewUser(false);
                setStep("otp");
            }
        } catch (err: any) {
            setError(err.message || "Failed to send OTP. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    async function handleVerifyAndLogin(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        const formData = new FormData(e.currentTarget);
        const code = (formData.get("otp") as string || otp || "").replace(/\D/g, "");
        if (code.length !== 6) {
            setError("Please enter the 6-digit OTP.");
            return;
        }

        if (step === "new_customer" && !name.trim()) {
            setError("Please enter your full name to create an account.");
            return;
        }

        setLoading(true);

        try {
            const currentPhone = phone || (typeof document !== "undefined" ? (document.getElementById("phone") as HTMLInputElement)?.value : "") || "";

            const extra = step === "new_customer" ? { name: name.trim(), email: email.trim() || undefined } : undefined;
            const result = await verifyOtp(currentPhone, code, extra);

            if (!result || !result.token) {
                setError("Verification failed. Please try again.");
                setLoading(false);
                return;
            }

            const serverRole = (result.role || result.detected_role || "CUSTOMER").toUpperCase();
            const userId = result.user?.id || result.customer_id;
            const userPhone = result.user?.phone || currentPhone;
            const branchId = result.branch_id || result.user?.branch_id || result.user?.shop_id;
            const partnerId = result.partner_id || result.user?.partner_id;

            let targetPath = redirectUrl || "/account";
            if (serverRole === "DELIVERY_PARTNER" || serverRole === "DLP") {
                targetPath = "/dashboard/delivery-partner";
            } else if (serverRole === "BRANCH_MANAGER" || serverRole === "SHOP_MANAGER" || serverRole === "SHOP" || serverRole === "SHPMGR") {
                targetPath = "/dashboard/shop";
            } else if (serverRole === "SUPER_ADMIN" || serverRole === "ADMIN") {
                targetPath = "/dashboard";
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

            setInfo("Authentication successful!");

            if (onSuccess) {
                onSuccess(result);
            }

            if (isModal && serverRole === "CUSTOMER" && !redirectUrl) {
                // If in modal mode for customer and no redirect explicitly requested, do not force full navigation
                setLoading(false);
                if (onClose) onClose();
                return;
            }

            window.location.assign(targetPath);
        } catch (err: any) {
            setError(err.message || "Verification failed. Please check your OTP.");
            setLoading(false);
        }
    }

    if (step === "phone") {
        return (
            <div className="flex flex-col gap-4 max-w-96 w-full">
                <div>
                    <Label htmlFor="phone">Mobile Number</Label>
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
                    Continue
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

    if (step === "new_customer") {
        return (
            <form onSubmit={handleVerifyAndLogin} className="flex flex-col gap-4 max-w-96 w-full border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30 p-5 rounded-xl">
                <div className="flex flex-col gap-1 border-b border-amber-200 dark:border-amber-900 pb-3">
                    <Heading level="h2" className="text-base font-semibold text-amber-900 dark:text-amber-100">
                        Looks like you&apos;re new to CakeToHome
                    </Heading>
                    <Text className="text-xs text-amber-800 dark:text-amber-300">
                        Create your account to track orders and save addresses.
                    </Text>
                </div>

                <div>
                    <Label htmlFor="otp">Verification Code (OTP)</Label>
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

                <div>
                    <Label htmlFor="name">Your Full Name <span className="text-rose-500">*</span></Label>
                    <Input
                        id="name"
                        name="name"
                        type="text"
                        placeholder="e.g. Rahul Sharma"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>

                <div>
                    <Label htmlFor="email">Email Address (Optional)</Label>
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="e.g. rahul@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <Text className="text-ui-fg-subtle text-xs">
                    Mobile: <span className="font-mono font-semibold">{phone}</span>{" "}
                    <button
                        type="button"
                        className="underline text-blue-600 dark:text-blue-400 ml-1"
                        onClick={() => {
                            setStep("phone");
                            setOtp("");
                            setError(null);
                            setInfo(null);
                        }}
                    >
                        Change
                    </button>
                </Text>

                {isDev && devOtp && (
                    <div className="p-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md flex items-center justify-between gap-2">
                        <Text className="text-xs font-semibold text-blue-900 dark:text-blue-100">
                            🔑 Dev OTP: <span className="font-mono text-sm underline">{devOtp}</span>
                        </Text>
                        <button
                            type="button"
                            onClick={() => setOtp(devOtp)}
                            className="text-xs bg-blue-600 hover:bg-blue-700 text-white py-0.5 px-2 rounded font-medium transition-colors"
                        >
                            Auto-fill
                        </button>
                    </div>
                )}

                <Button type="submit" size="large" isLoading={loading}>
                    Create Account & Continue
                </Button>

                {error && (
                    <ErrorComponent
                        title="Account Creation Failed"
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

    return (
        <form onSubmit={handleVerifyAndLogin} className="flex flex-col gap-4 max-w-96 w-full">
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
                    className="underline text-blue-600 dark:text-blue-400"
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
                Verify & Continue
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

