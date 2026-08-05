"use client";

import { useEffect, useState, memo } from "react";
import { Container, Heading, Text, StatusBadge, Badge, Button, Input, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { Bell, Plus, Check } from "lucide-react";

export const NotificationsPanel = memo(function NotificationsPanel() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchNotificationsData = () => {
    setLoading(true);
    Promise.all([
      apiClient.getAdminNotifications().then((r: any) => setNotifications(r?.notifications || r?.data || [])).catch(() => null),
      apiClient.getAdminSupportTickets().then((r: any) => setTickets(r?.tickets || r?.data || [])).catch(() => null),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotificationsData();
  }, []);

  const handleCreateNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setSuccessMsg(null);

    const newNotif = {
      title,
      message,
    };

    const res = await apiClient.createAdminNotification(newNotif);
    if (res?.notification) {
      setNotifications((prev) => [res.notification, ...prev]);
    } else {
      fetchNotificationsData();
    }
    setSuccessMsg(`Successfully broadcast notification "${title}"!`);
    setTitle("");
    setMessage("");
    setSubmitting(false);
    setTimeout(() => {
      setShowCreateModal(false);
      setSuccessMsg(null);
    }, 1500);
  };

  const handleMarkRead = async (id: string) => {
    await apiClient.markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h2" className="text-xl">Notifications & Support</Heading>
          <Text className="text-ui-fg-subtle text-sm">System notifications, operational alerts, and customer support tickets.</Text>
        </div>
        <Button size="small" onClick={() => setShowCreateModal(true)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="w-4 h-4" /> Broadcast Notification / Alert
        </Button>
      </div>

      {showCreateModal && (
        <Container className="p-6 border-2 border-blue-500/30 bg-blue-50/20 dark:bg-blue-950/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" />
              <Text className="font-semibold text-base">Broadcast System Notification</Text>
            </div>
            <button onClick={() => setShowCreateModal(false)} className="text-xs text-ui-fg-subtle hover:underline">Close</button>
          </div>

          <form onSubmit={handleCreateNotification} className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="notif_title">Notification Title</Label>
              <Input
                id="notif_title"
                placeholder="e.g. Flash Sale Alert or Kitchen Alert"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="notif_msg">Message Content</Label>
              <Input
                id="notif_msg"
                placeholder="Details about the notification..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-end gap-3 mt-2">
              <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button type="submit" isLoading={submitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                Send Notification
              </Button>
            </div>
            {successMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs rounded">
                ✓ {successMsg}
              </div>
            )}
          </form>
        </Container>
      )}

      {loading ? (
        <Container className="p-8 text-center"><Text className="text-ui-fg-muted">Loading...</Text></Container>
      ) : (
        <>
          <Container className="p-5">
            <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider mb-3">System Notifications ({notifications.length})</Text>
            {notifications.length === 0 ? (
              <Text className="text-sm text-ui-fg-muted">No system notifications.</Text>
            ) : (
              <div className="flex flex-col gap-2">
                {notifications.map((n: any, i: number) => (
                  <div key={n.id || i} className="flex items-center justify-between p-3 bg-ui-bg-subtle rounded-lg text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-sm">{n.title || "Notification"}</span>
                      {n.message && <span className="text-ui-fg-muted">{n.message}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge color={n.read ? "grey" : "blue"} className="text-[10px]">{n.read ? "Read" : "Unread"}</Badge>
                      {!n.read && (
                        <button
                          onClick={() => handleMarkRead(n.id)}
                          className="text-blue-600 hover:underline text-[11px] font-medium flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Mark Read
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Container>

          <Container className="p-5">
            <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider mb-3">Support Tickets ({tickets.length})</Text>
            {tickets.length === 0 ? (
              <Text className="text-sm text-ui-fg-muted">No support tickets currently pending.</Text>
            ) : (
              <Container className="p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-ui-bg-subtle">
                      <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">ID</th>
                      <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Subject</th>
                      <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Status</th>
                      <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Priority</th>
                    </tr>
                  </thead>
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
});
