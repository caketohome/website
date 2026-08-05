"use client";

import { useEffect, useState, memo } from "react";
import { Container, Heading, Text, Badge, Button, Input, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { Shield, ScrollText, Wrench, Save } from "lucide-react";

export const SettingsPanel = memo(function SettingsPanel() {
  const [settings, setSettings] = useState<any>({});
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [security, setSecurity] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [storeName, setStoreName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState("599");

  const fetchSettingsData = () => {
    setLoading(true);
    Promise.all([
      apiClient.getAdminSettings().then((r: any) => {
        const s = r?.settings || r?.data || r || {};
        setSettings(s);
        setStoreName(s.store_name || "CakeToHome Bakery");
        setSupportEmail(s.support_email || "support@cakes2home.com");
        setSupportPhone(s.support_phone || "+91 80 4900 1234");
        setFreeDeliveryThreshold(String(s.free_delivery_threshold || 599));
      }).catch(() => null),
      apiClient.getAdminAuditLogs().then((r: any) => setAuditLogs(r?.logs || r?.data || [])).catch(() => null),
      apiClient.getAdminSecurityConfig().then((r: any) => setSecurity(r?.config || r?.data || r || {})).catch(() => null),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSettingsData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg(null);

    const payload = {
      ...settings,
      store_name: storeName,
      support_email: supportEmail,
      support_phone: supportPhone,
      free_delivery_threshold: Number(freeDeliveryThreshold) || 599,
      updated_at: new Date().toISOString(),
    };

    await apiClient.updateAdminSettings(payload);
    setSettings(payload);
    setSuccessMsg("Platform settings saved successfully!");
    setSubmitting(false);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h2" className="text-xl">Settings & Security</Heading>
          <Text className="text-ui-fg-subtle text-sm">Platform configuration, security controls, and system audit logs.</Text>
        </div>
        <Button onClick={handleSaveSettings} isLoading={submitting} className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white">
          <Save className="w-4 h-4" /> Save Platform Settings
        </Button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs rounded">
          ✓ {successMsg}
        </div>
      )}

      {loading ? (
        <Container className="p-8 text-center"><Text className="text-ui-fg-muted">Loading settings...</Text></Container>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Container className="p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-ui-fg-subtle" />
                <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider">Platform Configuration</Text>
              </div>

              <form onSubmit={handleSaveSettings} className="flex flex-col gap-3">
                <div>
                  <Label htmlFor="store_name">Store / Brand Name</Label>
                  <Input id="store_name" value={storeName} onChange={(e) => setStoreName(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="support_email">Support Email</Label>
                  <Input id="support_email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="support_phone">Support Phone</Label>
                  <Input id="support_phone" value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="free_del_thresh">Free Delivery Threshold (₹)</Label>
                  <Input id="free_del_thresh" type="number" value={freeDeliveryThreshold} onChange={(e) => setFreeDeliveryThreshold(e.target.value)} required />
                </div>
              </form>
            </Container>

            <Container className="p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-ui-fg-subtle" />
                <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider">Security Configuration</Text>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { label: "MFA Authentication", value: security.mfa_enabled !== false ? "Enabled" : "Disabled" },
                  { label: "JWT Token Expiry", value: security.jwt_expiry || "24h" },
                  { label: "OTP Cooldown TTL", value: "30 seconds" },
                  { label: "Rate Limiting", value: security.rate_limiting || "100 req/min" },
                  { label: "CORS Allowed Origins", value: "localhost:3000, localhost:9000" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between p-2 bg-ui-bg-subtle rounded text-xs">
                    <span className="text-ui-fg-muted">{s.label}</span>
                    <Badge color="blue" className="text-[10px]">{String(s.value)}</Badge>
                  </div>
                ))}
              </div>
            </Container>
          </div>

          <Container className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <ScrollText className="w-4 h-4 text-ui-fg-subtle" />
              <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider">System Audit Logs ({auditLogs.length})</Text>
            </div>
            {auditLogs.length === 0 ? (
              <Text className="text-sm text-ui-fg-muted">No audit logs recorded yet.</Text>
            ) : (
              <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                {auditLogs.slice(0, 30).map((log: any, i: number) => (
                  <div key={log.id || i} className="flex items-center gap-3 p-2 bg-ui-bg-subtle rounded text-xs">
                    <span className="text-ui-fg-muted w-36 shrink-0">{log.timestamp ? new Date(log.timestamp).toLocaleString() : "—"}</span>
                    <span className="font-mono text-ui-fg-muted">{log.user || log.actor || "system"}</span>
                    <span className="font-medium text-amber-700 dark:text-amber-300">{log.action || log.event || `Event #${i + 1}`}</span>
                    <Badge color="grey" className="ml-auto text-[10px]">{log.ip || "127.0.0.1"}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Container>
        </>
      )}
    </div>
  );
});
