import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Container, Heading, Text, StatusBadge, Button } from "@medusajs/ui";
import { useState, useEffect } from "react";
import { SettingsIcon } from "../../components/icons";

const DiagnosticsPage = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchDiagnostics = async () => {
    try {
      const res = await fetch("/admin/health/diagnostics");
      if (res.ok) {
        const payload = await res.json();
        setData(payload.diagnostics);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
    const interval = setInterval(fetchDiagnostics, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      // Simulate sync exchange rate API trigger or run background sync
      await new Promise((resolve) => setTimeout(resolve, 1500));
      alert("Exchange rates sync triggered successfully!");
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <Text>Loading Diagnostics Workspace...</Text>;
  }

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs}h ${mins}m ${secs}s`;
  };

  return (
    <Container className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <Heading>Platform Diagnostics</Heading>
          <Text className="text-ui-fg-subtle">
            Real-time status metrics and service health diagnostics.
          </Text>
        </div>
        <StatusBadge color={data?.status === "healthy" ? "green" : "red"}>
          {data?.status || "unknown"}
        </StatusBadge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Container className="p-4 flex flex-col gap-2">
          <Text className="text-ui-fg-muted font-semibold text-xs uppercase">Database Link</Text>
          <div className="flex justify-between items-center mt-1">
            <Text className="text-xl font-bold">PostgreSQL</Text>
            <StatusBadge color={data?.database?.status === "up" ? "green" : "red"}>
              {data?.database?.status || "down"}
            </StatusBadge>
          </div>
        </Container>

        <Container className="p-4 flex flex-col gap-2">
          <Text className="text-ui-fg-muted font-semibold text-xs uppercase">Redis Service</Text>
          <div className="flex justify-between items-center mt-1">
            <Text className="text-xl font-bold">Redis Cache</Text>
            <StatusBadge color={data?.redis?.status === "up" ? "green" : "red"}>
              {data?.redis?.mode || data?.redis?.status || "down"}
            </StatusBadge>
          </div>
        </Container>

        <Container className="p-4 flex flex-col gap-2">
          <Text className="text-ui-fg-muted font-semibold text-xs uppercase">Platform Uptime</Text>
          <Text className="text-xl font-bold mt-1">
            {data?.uptime ? formatUptime(data.uptime) : "0s"}
          </Text>
        </Container>

        <Container className="p-4 flex flex-col gap-2">
          <Text className="text-ui-fg-muted font-semibold text-xs uppercase">Heap Memory</Text>
          <Text className="text-xl font-bold mt-1">
            {data?.memory_usage?.heapUsed
              ? `${(data.memory_usage.heapUsed / 1024 / 1024).toFixed(1)} MB`
              : "0 MB"}
          </Text>
        </Container>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Container className="p-6 flex flex-col gap-4">
          <Heading level="h2">Node Runtime Configuration</Heading>
          <div className="flex flex-col gap-2 text-sm border-t pt-3">
            <div className="flex justify-between">
              <Text className="text-ui-fg-subtle">Node.js Version</Text>
              <Text className="font-semibold">{data?.node_version}</Text>
            </div>
            <div className="flex justify-between">
              <Text className="text-ui-fg-subtle">Core Version</Text>
              <Text className="font-semibold">{data?.version}</Text>
            </div>
            <div className="flex justify-between">
              <Text className="text-ui-fg-subtle">Platform RSS Memory</Text>
              <Text className="font-semibold">
                {data?.memory_usage?.rss
                  ? `${(data.memory_usage.rss / 1024 / 1024).toFixed(1)} MB`
                  : "0 MB"}
              </Text>
            </div>
          </div>
        </Container>

        <Container className="p-6 flex flex-col justify-between">
          <div>
            <Heading level="h2">Exchange Rates Sync</Heading>
            <Text className="text-ui-fg-subtle mt-1 text-sm">
              Trigger manual rates update from simulated currency exchange provider.
            </Text>
          </div>
          <Button onClick={handleManualSync} disabled={syncing} className="mt-4 w-full">
            {syncing ? "Syncing Exchange Rates..." : "Sync Exchange Rates"}
          </Button>
        </Container>
      </div>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Diagnostics",
  icon: SettingsIcon,
});

export default DiagnosticsPage;
