import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Container, Heading, Text, Table, StatusBadge, Input } from "@medusajs/ui";
import { useState, useEffect } from "react";
import { SettingsIcon } from "../../components/icons";

const AuditLogsPage = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/admin/audit-logs${actionFilter ? `?action=${actionFilter}` : ""}`);
      const result = await response.json();
      setLogs(result.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  return (
    <Container className="flex flex-col gap-6">
      <div>
        <Heading>Platform Audit Logs</Heading>
        <Text className="text-ui-fg-subtle">
          Trace immutable activity logs for administrative mutations and security auditing.
        </Text>
      </div>

      <div className="flex gap-4 w-72">
        <Input
          placeholder="Filter by action (e.g. create)"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        />
      </div>

      {loading ? (
        <Text>Loading activity logs...</Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Actor ID</Table.HeaderCell>
              <Table.HeaderCell>Actor Type</Table.HeaderCell>
              <Table.HeaderCell>Action</Table.HeaderCell>
              <Table.HeaderCell>Entity</Table.HeaderCell>
              <Table.HeaderCell>Entity ID</Table.HeaderCell>
              <Table.HeaderCell>IP Address</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {logs.map((log) => (
              <Table.Row key={log.id}>
                <Table.Cell className="font-mono text-xs">{log.actor_id || "system"}</Table.Cell>
                <Table.Cell className="text-ui-fg-muted">{log.actor_type}</Table.Cell>
                <Table.Cell>
                  <StatusBadge color={log.action.includes("delete") ? "red" : "green"}>
                    {log.action}
                  </StatusBadge>
                </Table.Cell>
                <Table.Cell className="font-semibold">{log.entity || "global"}</Table.Cell>
                <Table.Cell className="font-mono text-xs">{log.entity_id}</Table.Cell>
                <Table.Cell className="font-mono text-xs">{log.ip_address || "—"}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Audit Logs",
  icon: SettingsIcon,
});

export default AuditLogsPage;
