"use client";
import { useEffect, useState } from "react";
import { Container, Heading, Text, Badge } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { Shield, Key, ScrollText, Wrench } from "lucide-react";

export function SettingsPanel() {
  const [settings, setSettings] = useState<any>({});
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [security, setSecurity] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiClient.getAdminSettings().then((r: any) => setSettings(r?.settings || r?.data || r || {})).catch(() => null),
      apiClient.getAdminAuditLogs().then((r: any) => setAuditLogs(r?.logs || r?.data || [])).catch(() => null),
      apiClient.getAdminSecurityConfig().then((r: any) => setSecurity(r?.config || r?.data || r || {})).catch(() => null),
    ]).finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div><Heading level="h2" className="text-xl">Settings & Security</Heading>
        <Text className="text-ui-fg-subtle text-sm">Platform configuration, security settings, and audit logs.</Text></div>

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
              {Object.keys(settings).length === 0 ? (
                <Text className="text-sm text-ui-fg-muted">No configuration found. Configure via <code>/admin/settings</code>.</Text>
              ) : (
                <div className="flex flex-col gap-2">
                  {Object.entries(settings).slice(0, 10).map(([key, value]: [string, any]) => (
                    <div key={key} className="flex items-center justify-between p-2 bg-ui-bg-subtle rounded text-xs">
                      <span className="font-mono text-ui-fg-muted">{key}</span>
                      <span className="font-medium">{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Container>

            <Container className="p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-ui-fg-subtle" />
                <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider">Security Configuration</Text>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { label: "JWT Token Expiry", value: security.jwt_expiry || "24h" },
                  { label: "OTP Validity", value: security.otp_validity || "5 min" },
                  { label: "Max Login Attempts", value: security.max_login_attempts || "5" },
                  { label: "Rate Limiting", value: security.rate_limiting || "100 req/min" },
                  { label: "CORS Origins", value: security.cors_origins || "localhost:3000" },
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
              <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider">Audit Logs ({auditLogs.length})</Text>
            </div>
            {auditLogs.length === 0 ? (
              <Text className="text-sm text-ui-fg-muted">No audit logs. Activity is tracked via <code>/admin/audit-logs</code>.</Text>
            ) : (
              <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                {auditLogs.slice(0, 30).map((log: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-ui-bg-subtle rounded text-xs">
                    <span className="text-ui-fg-muted w-28 shrink-0">{log.timestamp ? new Date(log.timestamp).toLocaleString() : "—"}</span>
                    <span className="font-mono text-ui-fg-muted">{log.actor || "system"}</span>
                    <span>{log.action || log.event || `Event #${i + 1}`}</span>
                    <Badge color="grey" className="ml-auto text-[10px]">{log.resource || "system"}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Container>
        </>
      )}
    </div>
  );
}
