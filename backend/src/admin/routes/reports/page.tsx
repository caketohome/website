import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Container, Heading, Text, Table, Tabs, Badge, StatusBadge, Button, Input, Select, Label } from "@medusajs/ui";
import { useState, useEffect } from "react";
import { CmsIcon } from "../../components/icons";

const ReportsPage = () => {
  const [retention, setRetention] = useState<any>(null);
  const [roi, setRoi] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [schReportType, setSchReportType] = useState("sales");
  const [schFrequency, setSchFrequency] = useState("daily");

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [retRes, roiRes, staffRes, schRes] = await Promise.all([
        fetch(`/admin/reports/retention?branch_id=${branchId}`).then(r => r.json()),
        fetch(`/admin/reports/campaign-roi`).then(r => r.json()),
        fetch(`/admin/reports/staff-performance?branch_id=${branchId}`).then(r => r.json()),
        fetch(`/admin/reports/schedules`).then(r => r.json()),
      ]);

      setRetention(retRes.report);
      setRoi(roiRes.report || []);
      setStaff(staffRes.report || []);
      setSchedules(schRes.schedules || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [branchId]);

  const handleDownload = (type: string) => {
    window.open(`/admin/reports/export?type=${type}&branch_id=${branchId}`);
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail) return;

    try {
      const res = await fetch("/admin/reports/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_email: recipientEmail,
          report_type: schReportType,
          frequency: schFrequency,
          branch_id: branchId || null,
        }),
      });

      if (res.ok) {
        setRecipientEmail("");
        fetchReports();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Container className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <Heading>Reports & Exports Portal</Heading>
          <Text className="text-ui-fg-subtle">
            Generate and export customer, marketing, and operational logs.
          </Text>
        </div>
        <div className="flex gap-4">
          <Input
            placeholder="Filter by branch ID"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="w-48"
          />
        </div>
      </div>

      <Tabs defaultValue="retention">
        <Tabs.List>
          <Tabs.Trigger value="retention">Customer Retention</Tabs.Trigger>
          <Tabs.Trigger value="roi">Campaign ROI</Tabs.Trigger>
          <Tabs.Trigger value="staff">Staff Performance</Tabs.Trigger>
          <Tabs.Trigger value="schedules">Automated Schedules</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="retention" className="mt-4 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <Heading level="h3">Customer Cohort & Repeat Purchase Metrics</Heading>
            <Button onClick={() => handleDownload("retention")}>Export CSV</Button>
          </div>
          {loading ? (
            <Text>Loading report data...</Text>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Container className="p-4 flex flex-col gap-1 border border-ui-border-base rounded-lg">
                <Text className="text-xs font-semibold text-ui-fg-muted uppercase">Total Buyers</Text>
                <Heading level="h2">{retention?.total_customers || 0}</Heading>
              </Container>
              <Container className="p-4 flex flex-col gap-1 border border-ui-border-base rounded-lg">
                <Text className="text-xs font-semibold text-ui-fg-muted uppercase">Repeat Customers</Text>
                <Heading level="h2">{retention?.repeat_customers || 0}</Heading>
              </Container>
              <Container className="p-4 flex flex-col gap-1 border border-ui-border-base rounded-lg">
                <Text className="text-xs font-semibold text-ui-fg-muted uppercase">Retention Rate</Text>
                <Heading level="h2" className="text-green-600">{retention?.retention_rate || 0}%</Heading>
              </Container>
            </div>
          )}
        </Tabs.Content>

        <Tabs.Content value="roi" className="mt-4 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <Heading level="h3">Marketing Campaigns Value Split</Heading>
            <Button onClick={() => handleDownload("roi")}>Export CSV</Button>
          </div>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Campaign Name</Table.HeaderCell>
                <Table.HeaderCell>Spend Value</Table.HeaderCell>
                <Table.HeaderCell>Conversions Count</Table.HeaderCell>
                <Table.HeaderCell>Revenue Split</Table.HeaderCell>
                <Table.HeaderCell>Net ROI</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {roi.map((r, idx) => (
                <Table.Row key={idx}>
                  <Table.Cell className="font-semibold">{r.campaign_name}</Table.Cell>
                  <Table.Cell>₹{(r.spend / 100).toLocaleString()}</Table.Cell>
                  <Table.Cell>{r.conversions_count}</Table.Cell>
                  <Table.Cell>₹{(r.conversion_value / 100).toLocaleString()}</Table.Cell>
                  <Table.Cell>
                    <StatusBadge color={r.roi >= 0 ? "green" : "red"}>{r.roi}%</StatusBadge>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Tabs.Content>

        <Tabs.Content value="staff" className="mt-4 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <Heading level="h3">Delivery Staff Fulfillment Metrics</Heading>
            <Button onClick={() => handleDownload("staff")}>Export CSV</Button>
          </div>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Driver ID</Table.HeaderCell>
                <Table.HeaderCell>Total Deliveries</Table.HeaderCell>
                <Table.HeaderCell>Successful Fulfillments</Table.HeaderCell>
                <Table.HeaderCell>Failed Fulfillments</Table.HeaderCell>
                <Table.HeaderCell>Success Rate</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {staff.map((d, idx) => (
                <Table.Row key={idx}>
                  <Table.Cell className="font-mono text-xs">{d.driver_id}</Table.Cell>
                  <Table.Cell>{d.total_deliveries}</Table.Cell>
                  <Table.Cell className="text-green-600">{d.completed_deliveries}</Table.Cell>
                  <Table.Cell className="text-red-600">{d.failed_deliveries}</Table.Cell>
                  <Table.Cell>
                    <StatusBadge color={d.success_rate >= 80 ? "green" : "orange"}>
                      {d.success_rate}%
                    </StatusBadge>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Tabs.Content>

        <Tabs.Content value="schedules" className="mt-4 flex flex-col gap-6">
          <form onSubmit={handleCreateSchedule} className="flex flex-col gap-4 border border-ui-border-base p-6 rounded-lg">
            <Heading level="h3">Add Automated Email Report Schedule</Heading>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <Label>Recipient Email</Label>
                <Input
                  type="email"
                  placeholder="manager@caketohome.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Report Type</Label>
                <Select value={schReportType} onValueChange={setSchReportType}>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="sales">Sales & Revenue</Select.Item>
                    <Select.Item value="retention">Customer Retention</Select.Item>
                    <Select.Item value="roi">Campaign ROI</Select.Item>
                    <Select.Item value="staff">Staff Performance</Select.Item>
                  </Select.Content>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1 w-64">
              <Label>Frequency</Label>
              <Select value={schFrequency} onValueChange={setSchFrequency}>
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="daily">Daily</Select.Item>
                  <Select.Item value="weekly">Weekly</Select.Item>
                  <Select.Item value="monthly">Monthly</Select.Item>
                </Select.Content>
              </Select>
            </div>
            <Button type="submit" className="w-fit">Save Schedule</Button>
          </form>

          <Heading level="h3">Current Automated Schedules</Heading>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Schedule ID</Table.HeaderCell>
                <Table.HeaderCell>Recipient Email</Table.HeaderCell>
                <Table.HeaderCell>Report Type</Table.HeaderCell>
                <Table.HeaderCell>Frequency</Table.HeaderCell>
                <Table.HeaderCell>Last Dispatched</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {schedules.map((s) => (
                <Table.Row key={s.id}>
                  <Table.Cell className="font-mono text-xs">{s.id}</Table.Cell>
                  <Table.Cell className="font-semibold">{s.recipient_email}</Table.Cell>
                  <Table.Cell>
                    <Badge color="blue">{s.report_type}</Badge>
                  </Table.Cell>
                  <Table.Cell className="uppercase">{s.frequency}</Table.Cell>
                  <Table.Cell className="text-xs text-ui-fg-muted">
                    {s.last_sent_at ? new Date(s.last_sent_at).toLocaleString() : "Never"}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Tabs.Content>
      </Tabs>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Reports Portal",
  icon: CmsIcon,
});

export default ReportsPage;
