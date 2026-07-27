import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Container, Heading, Text, Table, Tabs, Badge, Button, Input, StatusBadge, Label } from "@medusajs/ui";
import { useState, useEffect } from "react";
import { BikeIcon } from "../../components/icons";

const SupportPage = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [contactSubmissions, setContactSubmissions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);

  // Fetch initial desk status
  const fetchInbox = async () => {
    try {
      const [sessRes, tktRes, conRes] = await Promise.all([
        fetch("/admin/support/chat/sessions").then((r) => r.json()),
        fetch("/admin/support/tickets").then((r) => r.json()),
        fetch("/admin/support/contact-submissions").then((r) => r.json()),
      ]);

      setSessions(sessRes.sessions || []);
      setTickets(tktRes.tickets || []);
      setContactSubmissions(conRes.submissions || []);
    } catch (err) {
      console.error("Failed to load workspace data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox();
  }, []);

  // Establish real-time SSE listener for chats
  useEffect(() => {
    const sse = new EventSource("/admin/support/chat/messages/stream");
    sse.onmessage = (event) => {
      if (event.data === "connected") return;
      const data = JSON.parse(event.data);
      if (activeSessionId && data.session_id === activeSessionId) {
        setMessages((prev) => [...prev, data]);
      }
      // Refresh list to show updated active sessions
      fetchInbox();
    };

    return () => {
      sse.close();
    };
  }, [activeSessionId]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText || !activeSessionId) return;

    try {
      const res = await fetch("/admin/support/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: activeSessionId,
          message: replyText,
        }),
      });

      if (res.ok) {
        const payload = await res.json();
        setMessages((prev) => [...prev, payload.message]);
        setReplyText("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignTicket = async (ticketId: string) => {
    try {
      const res = await fetch(`/admin/support/tickets/${ticketId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          assigned_to: "agent_1",
        }),
      });
      if (res.ok) fetchInbox();
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveTicket = async (ticketId: string) => {
    try {
      const res = await fetch(`/admin/support/tickets/${ticketId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "status",
          status: "resolved",
        }),
      });
      if (res.ok) fetchInbox();
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveContact = async (id: string) => {
    try {
      const res = await fetch(`/admin/support/contact-submissions/${id}/resolve`, {
        method: "POST",
      });
      if (res.ok) fetchInbox();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Container className="flex flex-col gap-6">
      <div>
        <Heading>Support Workspace</Heading>
        <Text className="text-ui-fg-subtle">
          Manage live chats, support tickets, and guest contact inquiries.
        </Text>
      </div>

      <Tabs defaultValue="chat">
        <Tabs.List>
          <Tabs.Trigger value="chat">Live Support Chats</Tabs.Trigger>
          <Tabs.Trigger value="tickets">Support Tickets</Tabs.Trigger>
          <Tabs.Trigger value="contact">Contact submissions</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="chat" className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Container className="col-span-1 p-4 border border-ui-border-base rounded-lg flex flex-col gap-3">
            <Heading level="h3">Active Sessions</Heading>
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setActiveSessionId(s.id);
                  setMessages([]);
                }}
                className={`w-full text-left p-3 border rounded-lg transition-all ${
                  activeSessionId === s.id
                    ? "border-ui-border-interactive bg-ui-bg-interactive text-white"
                    : "border-ui-border-base hover:bg-ui-bg-subtle-hover"
                }`}
              >
                <div className="font-mono text-xs font-semibold mb-1">
                  {s.id.substring(0, 12)}...
                </div>
                <div className="flex justify-between items-center text-xs">
                  <Badge color={s.status === "active" ? "green" : "red"}>{s.status}</Badge>
                  <span className="text-[10px] opacity-75">
                    {new Date(s.updated_at).toLocaleTimeString()}
                  </span>
                </div>
              </button>
            ))}
          </Container>

          <Container className="col-span-2 p-6 border border-ui-border-base rounded-lg flex flex-col justify-between min-h-[400px]">
            {activeSessionId ? (
              <>
                <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2">
                  <Heading level="h3">Chat Timeline ({activeSessionId.substring(0, 12)})</Heading>
                  {messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col max-w-[70%] p-3 rounded-lg text-sm ${
                        m.sender_type === "agent"
                          ? "self-end bg-ui-bg-interactive text-white"
                          : "self-start bg-ui-bg-subtle text-ui-fg-base"
                      }`}
                    >
                      <Text>{m.message}</Text>
                      <span className="text-[9px] opacity-60 mt-1 self-end">
                        {new Date(m.sent_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSendReply} className="flex gap-2 border-t pt-4">
                  <Input
                    placeholder="Type message response..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="flex-grow"
                  />
                  <Button type="submit">Send</Button>
                </form>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <Text className="text-ui-fg-muted">Select an active session to chat</Text>
              </div>
            )}
          </Container>
        </Tabs.Content>

        <Tabs.Content value="tickets" className="mt-4 flex flex-col gap-4">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Ticket No</Table.HeaderCell>
                <Table.HeaderCell>Subject</Table.HeaderCell>
                <Table.HeaderCell>Priority</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Assigned Agent</Table.HeaderCell>
                <Table.HeaderCell>Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {tickets.map((t) => (
                <Table.Row key={t.id}>
                  <Table.Cell className="font-mono text-sm font-semibold">{t.ticket_no}</Table.Cell>
                  <Table.Cell className="font-medium">{t.subject}</Table.Cell>
                  <Table.Cell>
                    <Badge color={t.priority === "critical" ? "red" : "orange"}>
                      {t.priority}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge color={t.status === "open" ? "blue" : "green"}>
                      {t.status}
                    </StatusBadge>
                  </Table.Cell>
                  <Table.Cell className="font-mono text-xs">{t.assigned_to || "unassigned"}</Table.Cell>
                  <Table.Cell className="flex gap-2">
                    {!t.assigned_to && (
                      <Button size="small" onClick={() => handleAssignTicket(t.id)}>
                        Claim
                      </Button>
                    )}
                    {t.status !== "resolved" && (
                      <Button variant="secondary" size="small" onClick={() => handleResolveTicket(t.id)}>
                        Resolve
                      </Button>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Tabs.Content>

        <Tabs.Content value="contact" className="mt-4 flex flex-col gap-4">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Customer Name</Table.HeaderCell>
                <Table.HeaderCell>Contact info</Table.HeaderCell>
                <Table.HeaderCell>Subject</Table.HeaderCell>
                <Table.HeaderCell>Message</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {contactSubmissions.map((c) => (
                <Table.Row key={c.id}>
                  <Table.Cell className="font-bold">{c.name}</Table.Cell>
                  <Table.Cell className="text-xs">
                    <div>{c.email}</div>
                    <div className="opacity-75">{c.phone}</div>
                  </Table.Cell>
                  <Table.Cell className="font-medium">{c.subject}</Table.Cell>
                  <Table.Cell className="max-w-xs truncate text-xs">{c.message}</Table.Cell>
                  <Table.Cell>
                    <Badge color={c.is_resolved ? "green" : "orange"}>
                      {c.is_resolved ? "Resolved" : "Pending"}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    {!c.is_resolved && (
                      <Button size="small" onClick={() => handleResolveContact(c.id)}>
                        Resolve
                      </Button>
                    )}
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
  label: "Support Desk",
  icon: BikeIcon,
});

export default SupportPage;
