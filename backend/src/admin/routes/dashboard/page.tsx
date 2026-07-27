import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Container, Heading, Text, Table, Tabs, Badge, StatusBadge, Button, Select } from "@medusajs/ui";
import { useState, useEffect } from "react";
import { ChartPieIcon } from "../../components/icons";

const DashboardPage = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [interval, setInterval] = useState("daily");
  const [branchId, setBranchId] = useState("");
  const [liveEvents, setLiveEvents] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/admin/analytics/dashboard?interval=${interval}&branch_id=${branchId}`);
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [interval, branchId]);

  // Subscribe to real-time events via Server-Sent Events (SSE)
  useEffect(() => {
    const sse = new EventSource("/admin/analytics/live/stream");
    sse.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type !== "connected") {
          setLiveEvents((prev) => [parsed, ...prev].slice(0, 10));
        }
      } catch (err) {
        console.error(err);
      }
    };
    return () => {
      sse.close();
    };
  }, []);

  return (
    <Container className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <Heading>Owner Operations Dashboard</Heading>
          <Text className="text-ui-fg-subtle">
            Aggregated real-time metrics across all branches.
          </Text>
        </div>
        <div className="flex gap-4">
          <Select value={interval} onValueChange={setInterval}>
            <Select.Trigger className="w-40">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="daily">Daily</Select.Item>
              <Select.Item value="weekly">Weekly (Last 7 Days)</Select.Item>
              <Select.Item value="monthly">Monthly (Last 30 Days)</Select.Item>
            </Select.Content>
          </Select>
        </div>
      </div>

      {loading ? (
        <Text>Loading dashboard data...</Text>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Summary metrics cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Container className="p-4 flex flex-col gap-1 border border-ui-border-base rounded-lg">
              <Text className="text-xs font-semibold text-ui-fg-muted uppercase">Total Revenue</Text>
              <Heading level="h2">₹{(Number(data?.revenue || 0) / 100).toLocaleString()}</Heading>
              <Badge color="green" className="w-fit">Gross Earnings</Badge>
            </Container>
            <Container className="p-4 flex flex-col gap-1 border border-ui-border-base rounded-lg">
              <Text className="text-xs font-semibold text-ui-fg-muted uppercase">Operational Expenses</Text>
              <Heading level="h2">₹{(Number(data?.expenses || 0) / 100).toLocaleString()}</Heading>
              <Badge color="orange" className="w-fit">Outflows</Badge>
            </Container>
            <Container className="p-4 flex flex-col gap-1 border border-ui-border-base rounded-lg">
              <Text className="text-xs font-semibold text-ui-fg-muted uppercase">Net Profits</Text>
              <Heading level="h2">₹{(Number(data?.net_profit || 0) / 100).toLocaleString()}</Heading>
              <Badge color="blue" className="w-fit">Margin</Badge>
            </Container>
          </div>

          <Tabs defaultValue="branches">
            <Tabs.List>
              <Tabs.Trigger value="branches">Branch Breakdowns</Tabs.Trigger>
              <Tabs.Trigger value="live">Live Stream Events</Tabs.Trigger>
              <Tabs.Trigger value="trends">Trend Indexes</Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="branches" className="mt-4">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Branch Name</Table.HeaderCell>
                    <Table.HeaderCell>Total Revenue</Table.HeaderCell>
                    <Table.HeaderCell>Expenses</Table.HeaderCell>
                    <Table.HeaderCell>Net Profit Margin</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {(data?.branch_summaries || []).map((b: any) => (
                    <Table.Row key={b.branch_id}>
                      <Table.Cell className="font-semibold">{b.branch_name}</Table.Cell>
                      <Table.Cell>₹{(b.revenue / 100).toLocaleString()}</Table.Cell>
                      <Table.Cell>₹{(b.expenses / 100).toLocaleString()}</Table.Cell>
                      <Table.Cell>
                        <StatusBadge color={b.net_profit >= 0 ? "green" : "red"}>
                          ₹{(b.net_profit / 100).toLocaleString()}
                        </StatusBadge>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </Tabs.Content>

            <Tabs.Content value="live" className="mt-4">
              <Container className="p-4 flex flex-col gap-4">
                <Heading level="h3">Real-time Stream logs (Server-Sent Events)</Heading>
                {liveEvents.length === 0 ? (
                  <Text className="text-ui-fg-muted">Waiting for events...</Text>
                ) : (
                  <div className="flex flex-col gap-2">
                    {liveEvents.map((evt, idx) => (
                      <div key={idx} className="flex justify-between border-b pb-2 text-sm font-mono">
                        <span className="text-blue-600">{evt.event_type}</span>
                        <span>{evt.branch_id || "global"}</span>
                        <span className="text-gray-500">{new Date(evt.created_at).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Container>
            </Tabs.Content>

            <Tabs.Content value="trends" className="mt-4">
              <Container className="p-4 flex flex-col gap-4">
                <Heading level="h3">Revenue and Outflow Trends</Heading>
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Date Bucket</Table.HeaderCell>
                      <Table.HeaderCell>Aggregated Revenue</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {(data?.sales_trends || []).map((t: any, idx: number) => (
                      <Table.Row key={idx}>
                        <Table.Cell className="font-mono">{t.date}</Table.Cell>
                        <Table.Cell className="font-semibold text-green-600">₹{(t.value / 100).toLocaleString()}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </Container>
            </Tabs.Content>
          </Tabs>
        </div>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Owner Dashboard",
  icon: ChartPieIcon,
});

export default DashboardPage;
