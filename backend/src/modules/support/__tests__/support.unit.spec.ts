import SupportModuleService from "../service";
import orderDeliveredSupportHandler from "../../../subscribers/order-delivered-support-trigger";
import postDeliveryFeedbackJob from "../../../jobs/check-post-delivery-feedback";
import { POST as initSessionApi } from "../../../api/store/support/chat/sessions/route";
import { POST as sendMessageApi } from "../../../api/store/support/chat/messages/route";
import { GET as streamApi } from "../../../api/store/support/chat/messages/stream/route";
import { POST as createTicketApi, GET as listTicketsApi } from "../../../api/store/support/tickets/route";
import { POST as replyTicketApi } from "../../../api/store/support/tickets/[id]/replies/route";
import { POST as resolveContactApi } from "../../../api/admin/support/contact-submissions/[id]/resolve/route";
import { POST as ticketWorkflowApi } from "../../../api/admin/support/tickets/[id]/workflow/route";

describe("Support Module - Phase 12 Communication & Support Unit Tests", () => {
  let service: any;
  let sessionStore: any[];
  let messageStore: any[];
  let ticketStore: any[];
  let ticketMsgStore: any[];
  let contactStore: any[];
  let notificationStore: any[];
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    sessionStore = [];
    messageStore = [];
    ticketStore = [];
    ticketMsgStore = [];
    contactStore = [];
    notificationStore = [];

    const dependencies = {};
    service = new (SupportModuleService as any)(dependencies, {});

    // Stub MedusaService models CRUD operations
    service.createChatSessions = jest.fn(async (arr) => {
      const c = arr.map((s, i) => ({ id: `chatsess_${i + 1}`, ...s }));
      sessionStore.push(...c);
      return c;
    });
    service.retrieveChatSession = jest.fn(async (id) => {
      const match = sessionStore.find((s) => s.id === id);
      if (!match) throw new Error("Not found");
      return match;
    });
    service.updateChatSessions = jest.fn(async (args) => {
      const id = args.id || args.selector?.id;
      const data = args.selector ? args.data : args;
      const match = sessionStore.find((s) => s.id === id);
      if (match) Object.assign(match, data);
      return [match];
    });

    service.createChatMessages = jest.fn(async (arr) => {
      const c = arr.map((m, i) => ({ id: `chatmsg_${i + 1}`, ...m }));
      messageStore.push(...c);
      return c;
    });

    service.createSupportTickets = jest.fn(async (arr) => {
      const c = arr.map((t, i) => ({ id: `ticket_${i + 1}`, ...t }));
      ticketStore.push(...c);
      return c;
    });
    service.retrieveSupportTicket = jest.fn(async (id) => {
      const match = ticketStore.find((t) => t.id === id);
      if (!match) throw new Error("Not found");
      return match;
    });
    service.updateSupportTickets = jest.fn(async (args) => {
      const id = args.id || args.selector?.id;
      const data = args.selector ? args.data : args;
      const match = ticketStore.find((t) => t.id === id);
      if (match) Object.assign(match, data);
      return [match];
    });
    service.listSupportTickets = jest.fn(async (sel) => {
      return ticketStore.filter((t) => !sel.customer_id || t.customer_id === sel.customer_id);
    });

    service.createTicketMessages = jest.fn(async (arr) => {
      const c = arr.map((m, i) => ({ id: `tktmsg_${i + 1}`, ...m }));
      ticketMsgStore.push(...c);
      return c;
    });

    service.createContactSubmissions = jest.fn(async (arr) => {
      const c = arr.map((s, i) => ({ id: `consub_${i + 1}`, ...s }));
      contactStore.push(...c);
      return c;
    });
    service.retrieveContactSubmission = jest.fn(async (id) => {
      const match = contactStore.find((s) => s.id === id);
      if (!match) throw new Error("Not found");
      return match;
    });
    service.updateContactSubmissions = jest.fn(async (args) => {
      const id = args.id || args.selector?.id;
      const data = args.selector ? args.data : args;
      const match = contactStore.find((s) => s.id === id);
      if (match) Object.assign(match, data);
      return [match];
    });

    mockReq = {
      query: {},
      params: {},
      body: {},
      scope: {
        resolve: jest.fn((key: string) => {
          if (key === "supportModuleService") return service;
          return null;
        }),
      },
      auth_context: { customer_id: "cust_1", actor_id: "admin_1" },
      on: jest.fn(),
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      writeHead: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };
  });

  describe("Live Chat messaging lifecycle", () => {
    test("initializes new active chat session", async () => {
      const session = await service.createChatSession({ customer_id: "cust_1" });
      expect(session.id).toBeDefined();
      expect(session.status).toBe("active");
    });

    test("closes active chat sessions", async () => {
      const session = await service.createChatSession({ customer_id: "cust_1" });
      const closed = await service.closeChatSession(session.id);
      expect(closed.status).toBe("closed");
    });

    test("saves and broadcasts messages sent in session", async () => {
      const session = await service.createChatSession({ customer_id: "cust_1" });
      const mockListener = jest.fn();
      SupportModuleService.chatEmitter.on("message", mockListener);

      const msg = await service.sendChatMessage(session.id, "customer", "Hello Agent!");
      expect(msg.message).toBe("Hello Agent!");
      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Hello Agent!",
        })
      );

      SupportModuleService.chatEmitter.off("message", mockListener);
    });

    test("POST /store/support/chat/sessions endpoint initializes chats", async () => {
      await initSessionApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    test("POST /store/support/chat/messages parses parameters and saves message", async () => {
      const session = await service.createChatSession({ customer_id: "cust_1" });
      mockReq.body = { session_id: session.id, message: "Hi!" };
      await sendMessageApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe("Support Ticket Lifecycles", () => {
    test("creates sequential support tickets with default parameters", async () => {
      const ticket = await service.createSupportTicket({
        customer_id: "cust_1",
        subject: "Delivery Delayed",
        description: "My cake is 1 hour late.",
      });
      expect(ticket.ticket_no).toMatch(/TKT-\d{4}/);
      expect(ticket.status).toBe("open");
    });

    test("supports message replies on existing ticket profiles", async () => {
      const ticket = await service.createSupportTicket({
        customer_id: "cust_1",
        subject: "Delayed",
        description: "Delayed",
      });
      const reply = await service.replyToTicket(ticket.id, "customer", "Any update?");
      expect(reply.ticket_id).toBe(ticket.id);
      expect(ticketMsgStore).toHaveLength(1);
    });

    test("assigns and resolves ticket state parameters", async () => {
      const ticket = await service.createSupportTicket({
        customer_id: "cust_1",
        subject: "Delayed",
        description: "Delayed",
      });
      const assigned = await service.assignTicket(ticket.id, "agent_1");
      expect(assigned.assigned_to).toBe("agent_1");
      expect(assigned.status).toBe("in_progress");

      const resolved = await service.resolveTicket(ticket.id, "resolved");
      expect(resolved.status).toBe("resolved");
    });

    test("POST /store/support/tickets endpoint registers tickets", async () => {
      mockReq.body = { subject: "Delayed", description: "Delayed" };
      await createTicketApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe("Contact Form submission queries", () => {
    test("submits inquiries and toggles resolution updates", async () => {
      const submission = await service.createContactSubmission({
        name: "Amit Kumar",
        email: "amit@gmail.com",
        phone: "9999988888",
        subject: "Bulk Discount inquiry",
        message: "Need 10 cakes.",
      });
      expect(submission.is_resolved).toBe(false);

      const resolved = await service.resolveContactSubmission(submission.id);
      expect(resolved.is_resolved).toBe(true);
    });
  });

  describe("Post-delivery Welcomes & Feedback Loops", () => {
    test("Subscriber dispatches confirmation trigger", async () => {
      const mockNotificationService = {
        send: jest.fn(async (args) => {
          notificationStore.push(args);
          return { success: true };
        }),
      };

      const mockOrderModule = {
        retrieveOrder: jest.fn(async () => ({
          id: "ord_1",
          customer_id: "cust_1",
          email: "customer@email.com",
        })),
      };

      const mockContainer = {
        resolve: jest.fn((key: string) => {
          if (key === "notificationModuleService") return mockNotificationService;
          if (key === "orderModuleService") return mockOrderModule;
          return null;
        }),
      } as any;

      await orderDeliveredSupportHandler({
        event: { data: { id: "ord_1", customer_id: "cust_1" }, name: "order.completed" },
        container: mockContainer,
      });

      expect(notificationStore).toHaveLength(1);
      expect(notificationStore[0].recipient).toBe("customer@email.com");
    });

    test("Feedback requests job checks recent completions", async () => {
      const mockQuery = {
        graph: jest.fn().mockResolvedValue({
          data: [
            {
              id: "ord_1",
              display_id: "1001",
              status: "completed",
              created_at: new Date(),
              metadata: { phone: "9999988888" },
            },
          ],
        }),
      };

      const mockNotificationService = {
        send: jest.fn(async (args) => {
          notificationStore.push(args);
          return { success: true };
        }),
      };

      const mockContainer = {
        resolve: jest.fn((key: string) => {
          if (key === "query") return mockQuery;
          if (key === "notificationModuleService") return mockNotificationService;
          return null;
        }),
      } as any;

      await postDeliveryFeedbackJob({ container: mockContainer });

      expect(notificationStore).toHaveLength(1);
      expect(notificationStore[0].recipient).toBe("9999988888");
      expect(notificationStore[0].body).toContain("feedback");
    });
  });
});
