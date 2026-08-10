import { MedusaService } from "@medusajs/utils";
import { EventEmitter } from "events";
import { ChatSession, ChatMessage, SupportTicket, TicketMessage, ContactSubmission } from "./models";
import { SupportValidationError, SupportNotFoundError } from "./errors";

class SupportModuleService extends (MedusaService({
  ChatSession,
  ChatMessage,
  SupportTicket,
  TicketMessage,
  ContactSubmission,
}) as any) {
  protected container: any;
  public static chatEmitter = new EventEmitter();

  constructor(dependencies: any, ...args: any[]) {
    super(dependencies, ...args);
    this.container = dependencies;
  }

  // ── Live Chat Session & Message Methods ─────────────────────────────────

  async createChatSession(data: { customer_id?: string }): Promise<any> {
    const created = await (this as any).createChatSessions([
      {
        customer_id: data.customer_id || null,
        status: "active",
      },
    ]);
    return created[0];
  }

  async closeChatSession(id: string): Promise<any> {
    const session = await (this as any).retrieveChatSession(id).catch(() => null);
    if (!session) {
      throw new SupportNotFoundError(`Chat session ${id} not found.`);
    }

    const updated = await (this as any).updateChatSessions({
      id,
      status: "closed",
    });
    return updated[0];
  }

  async sendChatMessage(sessionId: string, senderType: string, message: string): Promise<any> {
    if (!message || !message.trim()) {
      throw new SupportValidationError("Message content is required.");
    }
    if (senderType !== "customer" && senderType !== "agent") {
      throw new SupportValidationError("Invalid sender type.");
    }

    const session = await (this as any).retrieveChatSession(sessionId).catch(() => null);
    if (!session) {
      throw new SupportNotFoundError(`Chat session ${sessionId} not found.`);
    }
    if (session.status === "closed") {
      throw new SupportValidationError("Cannot send messages to a closed chat session.");
    }

    const created = await (this as any).createChatMessages([
      {
        session_id: sessionId,
        sender_type: senderType,
        message: message.trim(),
      },
    ]);

    // Update session timestamp dynamically via empty update
    await (this as any).updateChatSessions({
      id: sessionId,
      status: "active",
    });

    const chatMessage = created[0];
    SupportModuleService.chatEmitter.emit("message", chatMessage);

    return chatMessage;
  }

  // ── Support Tickets Methods ─────────────────────────────────────────────

  async createSupportTicket(data: { customer_id: string; subject: string; description: string; priority?: string }): Promise<any> {
    if (!data.customer_id) throw new SupportValidationError("Customer ID is required.");
    if (!data.subject || !data.subject.trim()) throw new SupportValidationError("Subject is required.");
    if (!data.description || !data.description.trim()) throw new SupportValidationError("Description is required.");

    const ticketNo = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;

    const created = await (this as any).createSupportTickets([
      {
        ticket_no: ticketNo,
        customer_id: data.customer_id,
        subject: data.subject.trim(),
        description: data.description.trim(),
        priority: data.priority || "medium",
        status: "open",
        assigned_to: null,
      },
    ]);
    return created[0];
  }

  async replyToTicket(ticketId: string, senderType: string, message: string): Promise<any> {
    if (!message || !message.trim()) {
      throw new SupportValidationError("Reply message cannot be empty.");
    }
    if (senderType !== "customer" && senderType !== "agent") {
      throw new SupportValidationError("Invalid sender type.");
    }

    const ticket = await (this as any).retrieveSupportTicket(ticketId).catch(() => null);
    if (!ticket) {
      throw new SupportNotFoundError(`Ticket ${ticketId} not found.`);
    }

    const created = await (this as any).createTicketMessages([
      {
        ticket_id: ticketId,
        sender_type: senderType,
        message: message.trim(),
      },
    ]);

    // Touch ticket update time
    await (this as any).updateSupportTickets({
      id: ticketId,
      status: ticket.status,
    });

    return created[0];
  }

  async assignTicket(ticketId: string, assignedTo: string): Promise<any> {
    const ticket = await (this as any).retrieveSupportTicket(ticketId).catch(() => null);
    if (!ticket) {
      throw new SupportNotFoundError(`Ticket ${ticketId} not found.`);
    }

    const updated = await (this as any).updateSupportTickets({
      id: ticketId,
      assigned_to: assignedTo,
      status: "in_progress",
    });
    return updated[0];
  }

  async resolveTicket(ticketId: string, status: string): Promise<any> {
    if (status !== "resolved" && status !== "closed") {
      throw new SupportValidationError("Status must be resolved or closed.");
    }

    const ticket = await (this as any).retrieveSupportTicket(ticketId).catch(() => null);
    if (!ticket) {
      throw new SupportNotFoundError(`Ticket ${ticketId} not found.`);
    }

    const updated = await (this as any).updateSupportTickets({
      id: ticketId,
      status,
    });
    return updated[0];
  }

  // ── Contact Submissions Methods ──────────────────────────────────────────

  async createContactSubmission(data: { name: string; email: string; phone: string; subject: string; message: string }): Promise<any> {
    if (!data.name || !data.name.trim()) throw new SupportValidationError("Name is required.");
    if (!data.email || !data.email.trim()) throw new SupportValidationError("Email is required.");
    if (!data.message || !data.message.trim()) throw new SupportValidationError("Message is required.");

    const created = await (this as any).createContactSubmissions([
      {
        name: data.name.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        subject: data.subject ? data.subject.trim() : "General Inquiry",
        message: data.message.trim(),
        is_resolved: false,
      },
    ]);
    return created[0];
  }

  async resolveContactSubmission(id: string): Promise<any> {
    const submission = await (this as any).retrieveContactSubmission(id).catch(() => null);
    if (!submission) {
      throw new SupportNotFoundError(`Contact submission ${id} not found.`);
    }

    const updated = await (this as any).updateContactSubmissions({
      id,
      is_resolved: true,
    });
    return updated[0];
  }
}

export default SupportModuleService;
