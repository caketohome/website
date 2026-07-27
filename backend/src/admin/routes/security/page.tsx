import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Container, Heading, Text, Table, StatusBadge, Button, Input, Badge } from "@medusajs/ui";
import { useState, useEffect } from "react";
import { ShieldAlert } from "lucide-react";

const SecurityDashboardPage = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [whitelists, setWhitelists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 2FA Setup states
  const [twoFactorSecret, setTwoFactorSecret] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [setupMessage, setSetupMessage] = useState("");

  // IP whitelist states
  const [newIp, setNewIp] = useState("");
  const [newIpDesc, setNewIpDesc] = useState("");

  const fetchLogs = async () => {
    try {
      const res = await fetch("/admin/security/logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setEvents(data.events || []);
        setBlocks(data.blocks || []);
        setWhitelists(data.whitelists || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSetup2FA = async () => {
    try {
      const res = await fetch("/admin/auth/2fa/setup", { method: "POST" });
      if (res.ok) {
        const payload = await res.json();
        setTwoFactorSecret(payload.secret);
        setQrCodeUrl(payload.qrCodeUrl);
        setSetupMessage("2FA secret generated. Scan QR or enter secret, then verify.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleVerify2FA = async () => {
    try {
      const res = await fetch("/admin/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpCode }),
      });
      if (res.ok) {
        setSetupMessage("✅ Two-Factor Authentication successfully enabled!");
        setTotpCode("");
      } else {
        setSetupMessage("❌ Invalid verification code. Try again.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddWhitelist = async () => {
    if (!newIp) return;
    try {
      const res = await fetch("/admin/security/ip-whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip_address: newIp, description: newIpDesc }),
      });
      if (res.ok) {
        setNewIp("");
        setNewIpDesc("");
        fetchLogs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <Text>Loading Security Dashboard...</Text>;
  }

  return (
    <Container className="flex flex-col gap-6">
      <div>
        <Heading>Security Hardening Console</Heading>
        <Text className="text-ui-fg-subtle">
          Manage admin Two-Factor configuration, audit records, and IP whitelisting.
        </Text>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Container className="col-span-2 p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Heading level="h2">Security Events Alert Log</Heading>
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Event</Table.HeaderCell>
                  <Table.HeaderCell>Severity</Table.HeaderCell>
                  <Table.HeaderCell>Details</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {events.map((evt) => (
                  <Table.Row key={evt.id}>
                    <Table.Cell className="font-semibold text-sm">{evt.event_type}</Table.Cell>
                    <Table.Cell>
                      <StatusBadge color={evt.severity === "high" || evt.severity === "critical" ? "red" : "orange"}>
                        {evt.severity}
                      </StatusBadge>
                    </Table.Cell>
                    <Table.Cell className="text-xs text-ui-fg-muted">{evt.details}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>

          <div className="flex flex-col gap-2 mt-4">
            <Heading level="h2">Admin IP Whitelist</Heading>
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="IP / Subnet CIDR (e.g. 192.168.1.0/24)"
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
              />
              <Input
                placeholder="Description"
                value={newIpDesc}
                onChange={(e) => setNewIpDesc(e.target.value)}
              />
              <Button onClick={handleAddWhitelist}>Add IP</Button>
            </div>

            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Allowed Subnets</Table.HeaderCell>
                  <Table.HeaderCell>Description</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {whitelists.map((wl) => (
                  <Table.Row key={wl.id}>
                    <Table.Cell className="font-mono text-sm font-semibold">{wl.ip_address}</Table.Cell>
                    <Table.Cell className="text-xs text-ui-fg-muted">{wl.description || "N/A"}</Table.Cell>
                    <Table.Cell>
                      <Badge color={wl.is_active ? "green" : "grey"}>
                        {wl.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </Container>

        <Container className="col-span-1 p-6 flex flex-col gap-4">
          <Heading level="h2">Configure Admin 2FA (TOTP)</Heading>
          <Text className="text-ui-fg-subtle text-xs">
            Protect your account with standard authenticator applications.
          </Text>

          {!twoFactorSecret ? (
            <Button onClick={handleSetup2FA} className="w-full mt-2">
              Setup Two-Factor
            </Button>
          ) : (
            <div className="flex flex-col gap-3 p-3 border rounded-lg bg-ui-bg-subtle text-xs">
              <div className="font-mono break-all font-semibold select-all mb-2">
                Secret: {twoFactorSecret}
              </div>
              <div className="text-ui-fg-muted mb-2">
                QR Auth URL: <a href={qrCodeUrl} className="underline text-blue-600 font-mono break-all">{qrCodeUrl}</a>
              </div>
              <Input
                placeholder="Enter 6-digit TOTP code"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
              />
              <Button onClick={handleVerify2FA} className="w-full mt-2">
                Verify and Enable
              </Button>
            </div>
          )}

          {setupMessage && (
            <div className="p-3 border rounded-lg text-xs font-semibold text-center mt-2 bg-slate-50">
              {setupMessage}
            </div>
          )}
        </Container>
      </div>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Security Hardening",
  icon: ShieldAlert,
});

export default SecurityDashboardPage;
