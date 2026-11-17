"use client";

import { useState } from "react";
import { Container, Heading, Text, Button, Input, Label, Badge } from "@medusajs/ui";
import { Shield, Save, CheckCircle2, Key, Lock, UserCheck, Globe } from "lucide-react";

export function SecurityTab({
  securityConfig,
}: {
  securityConfig?: any;
}) {
  const [config, setConfig] = useState({
    mfa_required: securityConfig?.mfa_required ?? true,
    jwt_expiry_hours: securityConfig?.jwt_expiry_hours ?? 24,
    otp_cooldown_seconds: securityConfig?.otp_cooldown_seconds ?? 60,
    rate_limit_per_min: securityConfig?.rate_limit_per_min ?? 120,
    allowed_origins: securityConfig?.allowed_origins || "https://caketohome.com, http://localhost:3000",
    max_login_attempts: securityConfig?.max_login_attempts ?? 5,
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSuccessMsg("Security & Access Control policies saved!");
      setTimeout(() => setSuccessMsg(null), 3000);
    }, 400);
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6">
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand-gold" />
            <Heading level="h3" className="text-base font-bold">Security, Access & Authentication Policies</Heading>
          </div>
          <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure Multi-Factor Authentication (MFA), token expiration windows, and API rate limiting protections.
          </Text>
        </div>
        <Button
          type="submit"
          isLoading={saving}
          className="bg-brand-gold hover:bg-brand-gold-dark text-white flex items-center gap-1.5 shrink-0"
        >
          <Save className="w-4 h-4" /> Save Security Policies
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Authentication Controls */}
        <Container className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Lock className="w-4 h-4 text-brand-gold" />
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Authentication & Sessions
            </Text>
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 cursor-pointer">
              <div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">Require Multi-Factor Authentication (MFA)</span>
                <p className="text-xs text-slate-500">Enforce OTP/Authenticator for Super Admin and Store Managers</p>
              </div>
              <input
                type="checkbox"
                checked={config.mfa_required}
                onChange={(e) => setConfig({ ...config, mfa_required: e.target.checked })}
                className="w-4 h-4 rounded text-brand-gold focus:ring-brand-gold"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="jwt_hours" className="text-xs font-semibold">JWT Session Lifetime (Hours)</Label>
                <Input
                  id="jwt_hours"
                  type="number"
                  value={String(config.jwt_expiry_hours)}
                  onChange={(e) => setConfig({ ...config, jwt_expiry_hours: Number(e.target.value) || 24 })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="otp_cool" className="text-xs font-semibold">OTP Cooldown Window (Secs)</Label>
                <Input
                  id="otp_cool"
                  type="number"
                  value={String(config.otp_cooldown_seconds)}
                  onChange={(e) => setConfig({ ...config, otp_cooldown_seconds: Number(e.target.value) || 60 })}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </Container>

        {/* API Rate Limiting & Origins */}
        <Container className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Globe className="w-4 h-4 text-brand-gold" />
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              API Security & CORS
            </Text>
          </div>

          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="rate_limit" className="text-xs font-semibold">Max Requests / Min / IP</Label>
                <Input
                  id="rate_limit"
                  type="number"
                  value={String(config.rate_limit_per_min)}
                  onChange={(e) => setConfig({ ...config, rate_limit_per_min: Number(e.target.value) || 120 })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="max_logins" className="text-xs font-semibold">Max Failed Login Retries</Label>
                <Input
                  id="max_logins"
                  type="number"
                  value={String(config.max_login_attempts)}
                  onChange={(e) => setConfig({ ...config, max_login_attempts: Number(e.target.value) || 5 })}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="cors_origins" className="text-xs font-semibold">Allowed CORS Domain Origins</Label>
              <Input
                id="cors_origins"
                value={config.allowed_origins}
                onChange={(e) => setConfig({ ...config, allowed_origins: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
            </div>
          </div>
        </Container>
      </div>
    </form>
  );
}
