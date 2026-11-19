import { OtpLoginForm } from "@frontend/components/store/auth/otp-login-form";
import { CakeToHomeLogo } from "@frontend/components/common/logo";

export const dynamic = "force-dynamic";

/** Rider sign-in: full-screen, one-handed, phone first. Same phone + OTP login as the rest of the app. */
export default function RiderLoginPage() {
  return (
    <main
      className="min-h-[100dvh] w-full bg-white dark:bg-slate-950 flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex-1 flex flex-col justify-center px-5 py-8 w-full max-w-md mx-auto gap-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <CakeToHomeLogo variant="navy" mode="full" height={44} href="/rider/login" priority />
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Rider sign in</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">Use the mobile number your branch registered for you.</p>
          </div>
        </div>

        <div className="[&_input]:text-lg [&_input]:min-h-[52px] [&_button[type=submit]]:min-h-[52px] [&_button[type=submit]]:text-base">
          <OtpLoginForm redirectUrl="/dashboard/delivery-partner" />
        </div>
      </div>

      <p className="px-5 pb-6 text-center text-xs text-slate-500">
        Not registered as a rider? Ask your branch manager to add your number.
      </p>
    </main>
  );
}
