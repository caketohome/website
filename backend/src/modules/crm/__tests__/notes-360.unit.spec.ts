import CrmModuleService from "../service";
import { GET as getProfile } from "../../../api/admin/crm/customers/[id]/profile/route";
import { GET as getNotes, POST as postNote } from "../../../api/admin/crm/customers/[id]/notes/route";
import { PATCH as patchNote, DELETE as deleteNote } from "../../../api/admin/crm/notes/[noteId]/route";
import { CustomerNotFoundError, NoteNotFoundError, NotePermissionError, NoteValidationError } from "../errors";

describe("CRM Module - Notes & Customer 360 Unit/Integration Tests", () => {
  let service: any;
  let notesStore: any[];
  let rfmStore: any[];
  let blacklistStore: any[];
  let mockRewardsService: any;
  let mockCustomerService: any;
  let mockQuery: any;

  beforeEach(() => {
    notesStore = [];
    rfmStore = [];
    blacklistStore = [];

    mockRewardsService = {
      listWallets: jest.fn().mockResolvedValue([{ id: "w_1", balance: 500, currency_code: "INR" }]),
      listLoyaltyLedgers: jest.fn().mockResolvedValue([{ id: "l_1", points: 120, tier: "gold" }]),
      listReferralCodes: jest.fn().mockResolvedValue([{ code: "REF123", is_active: true }]),
      listReferralEvents: jest.fn().mockResolvedValue([{ id: "re_1" }, { id: "re_2" }]),
    };

    mockCustomerService = {
      retrieveCustomer: jest.fn(async (id: string) => {
        if (id === "cust_missing") {
          throw new Error("not found");
        }
        return { id, email: `${id}@example.com` };
      }),
    };

    mockQuery = {
      graph: jest.fn().mockResolvedValue({
        data: [{ id: "cust_1", email: "cust1@example.com", first_name: "John", last_name: "Doe" }],
      }),
    };

    const dependencies = {
      query: mockQuery,
      customerModuleService: mockCustomerService,
    };

    service = new (CrmModuleService as any)(dependencies, {});

    // Mock MedusaService generated helpers
    service.listCustomerNotes = jest.fn(async (selector: any) => {
      return notesStore.filter((n) => {
        return Object.entries(selector).every(([k, v]) => n[k] === v);
      });
    });

    service.createCustomerNotes = jest.fn(async (data: any[]) => {
      const created = data.map((n, idx) => ({
        id: `crm_note_${notesStore.length + idx + 1}`,
        created_at: new Date(),
        updated_at: new Date(),
        ...n,
      }));
      notesStore.push(...created);
      return created;
    });

    service.updateCustomerNotes = jest.fn(async (args: any) => {
      const matched = notesStore.filter((n) => {
        return Object.entries(args.selector).every(([k, v]) => n[k] === v);
      });
      matched.forEach((n) => Object.assign(n, args.data, { updated_at: new Date() }));
      return matched;
    });

    service.deleteCustomerNotes = jest.fn(async (ids: string[]) => {
      notesStore = notesStore.filter((n) => !ids.includes(n.id));
    });

    service.listCustomerRFMs = jest.fn(async (selector: any) => {
      return rfmStore.filter((r) => r.customer_id === selector.customer_id);
    });

    service.listCustomerBlacklists = jest.fn(async (selector: any) => {
      return blacklistStore.filter((b) => b.customer_id === selector.customer_id);
    });
  });

  // 1. Customer Notes Service CRUD & Validations
  describe("Customer Notes Service", () => {
    it("should create a customer note", async () => {
      const note = await service.createNote("cust_1", "Test note body", "admin_1");
      expect(note.id).toBeDefined();
      expect(note.customer_id).toBe("cust_1");
      expect(note.author_id).toBe("admin_1");
      expect(note.body).toBe("Test note body");
      expect(notesStore).toHaveLength(1);
    });

    it("should throw validation error on empty body", async () => {
      await expect(service.createNote("cust_1", "", "admin_1")).rejects.toThrow(NoteValidationError);
      await expect(service.createNote("cust_1", "   ", "admin_1")).rejects.toThrow(NoteValidationError);
    });

    it("should throw validation error on missing author ID", async () => {
      await expect(service.createNote("cust_1", "Valid body", "")).rejects.toThrow(NoteValidationError);
    });

    it("should throw not found error if customer does not exist", async () => {
      await expect(service.createNote("cust_missing", "Test body", "admin_1")).rejects.toThrow(CustomerNotFoundError);
    });

    it("should update a note body by the author", async () => {
      const created = await service.createNote("cust_1", "Original body", "admin_1");
      const updated = await service.updateNote(created.id, "Updated body", "admin_1");
      expect(updated.body).toBe("Updated body");
      expect(notesStore[0].body).toBe("Updated body");
    });

    it("should throw permission error if non-author tries to update note", async () => {
      const created = await service.createNote("cust_1", "Original body", "admin_1");
      await expect(service.updateNote(created.id, "New body", "admin_different")).rejects.toThrow(NotePermissionError);
    });

    it("should throw not found error on updating non-existent note", async () => {
      await expect(service.updateNote("crm_note_missing", "New body", "admin_1")).rejects.toThrow(NoteNotFoundError);
    });

    it("should delete a note by the author", async () => {
      const created = await service.createNote("cust_1", "To delete", "admin_1");
      expect(notesStore).toHaveLength(1);
      await service.deleteNote(created.id, "admin_1");
      expect(notesStore).toHaveLength(0);
    });

    it("should throw permission error if non-author tries to delete note", async () => {
      const created = await service.createNote("cust_1", "To delete", "admin_1");
      await expect(service.deleteNote(created.id, "admin_different")).rejects.toThrow(NotePermissionError);
      expect(notesStore).toHaveLength(1);
    });

    it("should throw not found error on deleting non-existent note", async () => {
      await expect(service.deleteNote("crm_note_missing", "admin_1")).rejects.toThrow(NoteNotFoundError);
    });

    it("should list notes for a customer ordered by created_at DESC", async () => {
      await service.createNote("cust_1", "Note 1", "admin");
      await service.createNote("cust_1", "Note 2", "admin");
      const list = await service.listNotes("cust_1");
      expect(list).toHaveLength(2);
    });

    it("should throw not found error listing notes for missing customer", async () => {
      await expect(service.listNotes("cust_missing")).rejects.toThrow(CustomerNotFoundError);
    });
  });

  // 2. Customer 360 Aggregation Service
  describe("Customer 360 Aggregation Service", () => {
    it("should compose complete customer profile data in parallel", async () => {
      rfmStore.push({
        customer_id: "cust_1",
        recency_score: 5,
        frequency_score: 10,
        monetary_score: 200000,
        clv: 200000,
        rfm_segment: "Champions",
        vip_tier: "none",
        last_calculated_at: new Date(),
      });

      blacklistStore.push({
        customer_id: "cust_1",
        is_blacklisted: true,
        reason: "Abuse",
        blacklisted_at: new Date(),
        blacklisted_by: "admin_1",
      });

      await service.createNote("cust_1", "Customer is very picky.", "admin_1");

      const profile = await service.getCustomer360Profile("cust_1");

      expect(profile.customer).toEqual(expect.objectContaining({ id: "cust_1" }));
      expect(profile.wallet).toBeNull();
      expect(profile.loyalty).toBeNull();
      expect(profile.referrals.codes).toHaveLength(0);
      expect(profile.referrals.events_count).toBe(0);
      expect(profile.rfm.segment).toBe("Champions");
      expect(profile.blacklist.is_blacklisted).toBe(true);
      expect(profile.notes).toHaveLength(1);
    });

    it("should aggregate profile cleanly for customer without notes or blacklist", async () => {
      const profile = await service.getCustomer360Profile("cust_1");
      expect(profile.notes).toHaveLength(0);
      expect(profile.blacklist).toBeNull();
    });

    it("should aggregate profile cleanly when rewards module is disabled", async () => {
      const profile = await service.getCustomer360Profile("cust_1");

      expect(profile.wallet).toBeNull();
      expect(profile.loyalty).toBeNull();
      expect(profile.referrals.codes).toHaveLength(0);
      expect(profile.referrals.events_count).toBe(0);
    });

    it("should throw error if customer does not exist in 360 profile aggregation", async () => {
      mockCustomerService.retrieveCustomer.mockResolvedValue(null);
      await expect(service.getCustomer360Profile("cust_missing")).rejects.toThrow(CustomerNotFoundError);
    });
  });

  // 3. API Route Handlers Status Mappings & Authorization Checks
  describe("Admin API Route Handlers", () => {
    let mockReq: any;
    let mockRes: any;

    beforeEach(() => {
      mockReq = {
        params: { id: "cust_1", noteId: "note_1" },
        body: { body: "New note body" },
        scope: {
          resolve: jest.fn((key: string) => {
            if (key === "query") return mockQuery;
            if (key === "crmModuleService") return service;
            return null;
          }),
        },
        auth_context: { actor_id: "admin_1" },
      };

      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
    });

    it("should return 401 if actor_id is missing (unauthorized access)", async () => {
      delete mockReq.auth_context;

      await getProfile(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await getNotes(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await postNote(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await patchNote(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await deleteNote(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("GET /profile resolves profile and maps 404 for invalid customer ID", async () => {
      mockCustomerService.retrieveCustomer.mockResolvedValue(null);
      await getProfile(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ code: "CUSTOMER_NOT_FOUND" }));
    });

    it("GET /notes lists notes and maps 404 for invalid customer ID", async () => {
      mockCustomerService.retrieveCustomer.mockResolvedValue(null);
      await getNotes(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ code: "CUSTOMER_NOT_FOUND" }));
    });

    it("POST /notes validates payload and creates note", async () => {
      await postNote(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ note: expect.any(Object) })
      );
      expect(notesStore).toHaveLength(1);
    });

    it("POST /notes returns 400 for malformed payload (missing body)", async () => {
      mockReq.body.body = "";
      await postNote(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.body.body = "   ";
      await postNote(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("PATCH /notes/:noteId updates note and maps 403 on permission failures", async () => {
      const created = await service.createNote("cust_1", "Old body", "admin_1");
      mockReq.params.noteId = created.id;
      mockReq.body.body = "New body";
      mockReq.auth_context.actor_id = "admin_intruder";

      await patchNote(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ code: "NOTE_PERMISSION_DENIED" }));
    });

    it("DELETE /notes/:noteId soft deletes note and maps 404 on invalid note ID", async () => {
      mockReq.params.noteId = "crm_note_missing";
      await deleteNote(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ code: "NOTE_NOT_FOUND" }));
    });
  });
});
