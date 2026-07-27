"use client";
import { useEffect, useState } from "react";
import { Container, Heading, Text, StatusBadge, Badge } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";

export function NotificationsPanel() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiClient.getAdminNotifications().then((r: any) => setNotifications(r?.notifications || r?.data || [])).catch(() => null),
      apiClient.getAdminSupportTickets().then((r: any) => setTickets(r?.tickets || r?.data || [])).catch(() => null),
    ]).finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div><Heading level="h2" className="text-xl">Notifications & Support</Heading>
        <Text className="text-ui-fg-subtle text-sm">Manage notifications templates and support tickets.</Text></div>

      {loading ? (
        <Container className="p-8 text-center"><Text className="text-ui-fg-muted">Loading...</Text></Container>
      ) : (
        <>
          <Container className="p-5">
            <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider mb-3">Notifications ({notifications.length})</Text>
            {notifications.length === 0 ? (
              <Text className="text-sm text-ui-fg-muted">No notifications configured. Set up via <code>/admin/notifications</code>.</Text>
            ) : (
              <div className="flex flex-col gap-2">
                {notifications.slice(0, 20).map((n: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-ui-bg-subtle rounded-lg text-xs">
                    <span>{n.title || n.message || `Notification #${i + 1}`}</span>
                    <Badge color={n.is_read ? "grey" : "blue"} className="text-[10px]">{n.is_read ? "Read" : "Unread"}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Container>

          <Container className="p-5">
            <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider mb-3">Support Tickets ({tickets.length})</Text>
            {tickets.length === 0 ? (
              <Text className="text-sm text-ui-fg-muted">No support tickets. Tickets are created via <code>/admin/support/tickets</code>.</Text>
            ) : (
              <Container className="p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-ui-bg-subtle">
                    <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">ID</th>
                    <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Subject</th>
                    <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Status</th>
                    <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Priority</th>
                  </tr></thead>
                  <tbody>
                    {tickets.slice(0, 20).map((t: any, i: number) => (
                      <tr key={i} className="border-b hover:bg-ui-bg-subtle-hover">
                        <td className="p-3 font-mono text-xs">{t.id || `TKT-${i + 1}`}</td>
                        <td className="p-3 text-xs">{t.subject || t.title || "—"}</td>
                        <td className="p-3"><StatusBadge color={t.status === "open" ? "orange" : t.status === "resolved" ? "green" : "grey"} className="text-[10px]">{t.status || "open"}</StatusBadge></td>
                        <td className="p-3"><Badge color={t.priority === "high" ? "red" : t.priority === "medium" ? "orange" : "grey"} className="text-[10px]">{t.priority || "normal"}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Container>
            )}
          </Container>
        </>
      )}
    </div>
  );
}
