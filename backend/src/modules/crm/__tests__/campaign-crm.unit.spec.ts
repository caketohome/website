import CrmModuleService from "../service";
import { GET as listCampaignsApi, POST as createCampaignApi } from "../../../api/admin/crm/campaigns/route";
import { GET as getCampaignApi, PATCH as updateCampaignApi, DELETE as deleteCampaignApi } from "../../../api/admin/crm/campaigns/[id]/route";
import { CampaignNotFoundError, CampaignValidationError, CampaignArchivedError } from "../errors";

describe("CRM Module - Campaign Foundation Unit Tests", () => {
  let service: any;
  let campaignStore: any[];

  beforeEach(() => {
    campaignStore = [];

    const dependencies = {};
    service = new (CrmModuleService as any)(dependencies, {});

    // Mock MedusaService generated methods
    service.listCampaigns = jest.fn(async (selector: any) => {
      return campaignStore.filter((c) => {
        return Object.entries(selector).every(([k, v]) => c[k] === v);
      });
    });

    service.retrieveCampaign = jest.fn(async (id: string) => {
      const matched = campaignStore.find((c) => c.id === id);
      if (!matched) {
        throw new Error("not found");
      }
      return matched;
    });

    service.createCampaigns = jest.fn(async (data: any[]) => {
      const created = data.map((c, idx) => ({
        id: `crm_camp_${campaignStore.length + idx + 1}`,
        created_at: new Date(),
        updated_at: new Date(),
        ...c,
      }));
      campaignStore.push(...created);
      return created;
    });

    service.updateCampaigns = jest.fn(async (args: any) => {
      const matched = campaignStore.filter((c) => {
        return Object.entries(args.selector).every(([k, v]) => c[k] === v);
      });
      matched.forEach((c) => Object.assign(c, args.data, { updated_at: new Date() }));
      return matched;
    });

    service.deleteCampaigns = jest.fn(async (ids: string[]) => {
      campaignStore = campaignStore.filter((c) => !ids.includes(c.id));
    });
  });

  // 1. Campaign Service CRUD & Validations
  describe("Campaign Service CRUD", () => {
    it("should create a campaign with required fields and defaults", async () => {
      const campaign = await service.createCampaign({
        name: "Welcome Offer",
        campaign_type: "offer",
        description: "Welcome campaign for new users",
      });

      expect(campaign.id).toBeDefined();
      expect(campaign.name).toBe("Welcome Offer");
      expect(campaign.campaign_type).toBe("offer");
      expect(campaign.status).toBe("draft");
      expect(campaignStore).toHaveLength(1);
    });

    it("should validate audience definition successfully", async () => {
      const campaign = await service.createCampaign({
        name: "VIP Loyalty Drive",
        campaign_type: "loyalty",
        audience: {
          rfm_segments: ["Champions", "Loyal"],
          vip_tiers: ["platinum"],
          loyalty_levels: ["gold"],
          is_blacklisted: false,
          has_referred: true,
        },
      });

      expect(campaign.audience).toEqual(expect.objectContaining({
        is_blacklisted: false,
        has_referred: true,
      }));
    });

    it("should throw validation error on empty campaign name", async () => {
      await expect(service.createCampaign({ name: "", campaign_type: "offer" })).rejects.toThrow(CampaignValidationError);
      await expect(service.createCampaign({ name: "   ", campaign_type: "offer" })).rejects.toThrow(CampaignValidationError);
    });

    it("should throw validation error on missing campaign_type", async () => {
      await expect(service.createCampaign({ name: "Discount Drive", campaign_type: "" })).rejects.toThrow(CampaignValidationError);
    });

    it("should throw validation error on invalid audience definition structure", async () => {
      // Not an object
      await expect(service.createCampaign({
        name: "Bad Audience 1",
        campaign_type: "offer",
        audience: "not-an-object",
      })).rejects.toThrow(CampaignValidationError);

      // Invalid key
      await expect(service.createCampaign({
        name: "Bad Audience 2",
        campaign_type: "offer",
        audience: { invalid_key: true },
      })).rejects.toThrow(CampaignValidationError);

      // Wrong type for rfm_segments
      await expect(service.createCampaign({
        name: "Bad Audience 3",
        campaign_type: "offer",
        audience: { rfm_segments: "should-be-array" },
      })).rejects.toThrow(CampaignValidationError);

      // Wrong type for is_blacklisted
      await expect(service.createCampaign({
        name: "Bad Audience 4",
        campaign_type: "offer",
        audience: { is_blacklisted: "should-be-boolean" },
      })).rejects.toThrow(CampaignValidationError);
    });

    it("should throw validation error on duplicate campaign name", async () => {
      await service.createCampaign({ name: "Promo 1", campaign_type: "offer" });
      await expect(service.createCampaign({ name: "Promo 1", campaign_type: "points" })).rejects.toThrow(CampaignValidationError);
    });

    it("should retrieve a campaign by ID", async () => {
      const created = await service.createCampaign({ name: "Active Promo", campaign_type: "offer" });
      const campaign = await service.getCampaign(created.id);
      expect(campaign.name).toBe("Active Promo");
    });

    it("should throw not found error on invalid campaign ID", async () => {
      await expect(service.getCampaign("crm_camp_missing")).rejects.toThrow(CampaignNotFoundError);
    });

    it("should update campaign details successfully", async () => {
      const created = await service.createCampaign({ name: "Summer Promo", campaign_type: "offer" });
      const updated = await service.updateCampaign(created.id, { name: "Winter Promo" });
      expect(updated.name).toBe("Winter Promo");
    });

    it("should throw error on duplicate campaign name during update", async () => {
      const promo1 = await service.createCampaign({ name: "Promo 1", campaign_type: "offer" });
      const promo2 = await service.createCampaign({ name: "Promo 2", campaign_type: "offer" });

      await expect(service.updateCampaign(promo2.id, { name: "Promo 1" })).rejects.toThrow(CampaignValidationError);
    });

    it("should archive a campaign and lock it from further updates", async () => {
      const created = await service.createCampaign({ name: "Flash Sale", campaign_type: "offer" });
      const archived = await service.archiveCampaign(created.id);
      expect(archived.status).toBe("archived");

      // Verify lock: update attempts must throw CampaignArchivedError
      await expect(service.updateCampaign(created.id, { name: "New Flash Sale" })).rejects.toThrow(CampaignArchivedError);
    });

    it("should delete a campaign successfully", async () => {
      const created = await service.createCampaign({ name: "Temporary Promo", campaign_type: "offer" });
      expect(campaignStore).toHaveLength(1);
      await service.deleteCampaign(created.id);
      expect(campaignStore).toHaveLength(0);
    });

    it("should throw not found error when deleting missing campaign", async () => {
      await expect(service.deleteCampaign("crm_camp_missing")).rejects.toThrow(CampaignNotFoundError);
    });
  });

  // 2. API Route Handlers Status Mappings & Authorization
  describe("API Route Handlers", () => {
    let mockReq: any;
    let mockRes: any;

    beforeEach(() => {
      mockReq = {
        params: { id: "crm_camp_1" },
        body: { name: "API Campaign", campaign_type: "offer" },
        filterableFields: {},
        listConfig: {},
        scope: {
          resolve: jest.fn((key: string) => {
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

      await listCampaignsApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await createCampaignApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await getCampaignApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await updateCampaignApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      await deleteCampaignApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("GET /campaigns resolves list", async () => {
      await service.createCampaign({ name: "Promo 1", campaign_type: "offer" });
      await listCampaignsApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ campaigns: expect.any(Array) })
      );
    });

    it("POST /campaigns creates a campaign", async () => {
      await createCampaignApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ campaign: expect.any(Object) })
      );
    });

    it("POST /campaigns maps validation errors to 400", async () => {
      mockReq.body.name = "";
      await createCampaignApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "CAMPAIGN_VALIDATION_FAILED" })
      );
    });

    it("GET /campaigns/:id retrieves campaign and maps 404 on missing ID", async () => {
      mockReq.params.id = "crm_camp_missing";
      await getCampaignApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "CAMPAIGN_NOT_FOUND" })
      );
    });

    it("PATCH /campaigns/:id archives campaign and locks updates mapping to 400", async () => {
      const campaign = await service.createCampaign({ name: "Flash", campaign_type: "offer" });
      mockReq.params.id = campaign.id;

      // 1. Archive the campaign
      mockReq.body = { status: "archived" };
      await updateCampaignApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(campaignStore[0].status).toBe("archived");

      // 2. Attempt update on archived campaign
      mockReq.body = { name: "Updated Name" };
      await updateCampaignApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "CAMPAIGN_ARCHIVED" })
      );
    });

    it("DELETE /campaigns/:id deletes campaign and returns success", async () => {
      const campaign = await service.createCampaign({ name: "Temp", campaign_type: "offer" });
      mockReq.params.id = campaign.id;

      await deleteCampaignApi(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
      expect(campaignStore).toHaveLength(0);
    });
  });
});
