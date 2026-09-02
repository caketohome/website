import { dbQuery, dbTransaction } from "../db";
import { BranchDomain, DeliveryZoneDomain } from "../types/domain";

export class BranchRepository {
  /**
   * Find all active branches and their delivery zones
   */
  static async findAll(): Promise<BranchDomain[]> {
    const [branchesRes, zonesRes] = await Promise.all([
      dbQuery(`SELECT * FROM "branch" WHERE deleted_at IS NULL ORDER BY created_at ASC`),
      dbQuery(`SELECT * FROM "delivery_zone" WHERE deleted_at IS NULL ORDER BY priority DESC`),
    ]);

    const zonesByBranch = new Map<string, DeliveryZoneDomain[]>();
    for (const z of zonesRes.rows || []) {
      const bId = z.branch_id;
      if (!zonesByBranch.has(bId)) {
        zonesByBranch.set(bId, []);
      }
      zonesByBranch.get(bId)!.push({
        id: z.id,
        branch_id: z.branch_id,
        pincode: z.pincode,
        delivery_fee: Number(z.delivery_fee || 0),
        base_fee: Number(z.delivery_fee || 0),
        radius_km: Number(z.radius_km || 10),
        polygon_coordinates: Array.isArray(z.polygon_coordinates) ? z.polygon_coordinates : [],
        priority: z.priority || 10,
        estimated_delivery_minutes: z.estimated_delivery_minutes || 35,
        enabled: z.is_serviceable !== false,
        name: z.pincode ? `Pincode ${z.pincode}` : `Zone ${z.id}`,
      });
    }

    return (branchesRes.rows || []).map((b: any) => {
      const meta = b.metadata || {};
      const branchZones = zonesByBranch.get(b.id) || meta.delivery_zones || [];
      return {
        id: b.id,
        name: b.name,
        code: b.code || b.id,
        phone: b.phone || "+91 98765 43210",
        email: b.email || "store@caketohome.com",
        address: b.address || "Bakery Hub",
        city_id: b.city_id || "city_bbr",
        city: meta.city || "Bengaluru",
        state: meta.state || "Karnataka",
        latitude: typeof b.latitude === "number" ? b.latitude : 8.8932,
        longitude: typeof b.longitude === "number" ? b.longitude : 76.6141,
        is_open: b.is_open !== false,
        is_archived: b.is_active === false,
        status: b.is_active === false ? "archived" : "active",
        operational_status: meta.operational_status || "operational",
        extended_status: meta.extended_status || "open",
        branch_type: meta.branch_type || "main_hub",
        manager_id: meta.manager_id || null,
        manager_account: meta.manager_account || null,
        max_delivery_radius_km: Number(meta.max_delivery_radius_km || 15),
        weekly_schedule: meta.weekly_schedule || {},
        fulfillment_rules: meta.fulfillment_rules || {
          allow_pickup: true,
          allow_delivery: true,
          same_day_cutoff: "18:00",
          express_cutoff: "20:00",
          midnight_cutoff: "21:00",
          prep_time_minutes: 120,
        },
        delivery_zones: branchZones,
        deliverable_areas: meta.deliverable_areas || [meta.city || "Bengaluru"],
        capacity_settings: meta.capacity_settings || {},
        product_availability: meta.product_availability || {},
        created_at: b.created_at,
        updated_at: b.updated_at,
      };
    });
  }

  /**
   * Find branch by ID
   */
  static async findById(id: string): Promise<BranchDomain | null> {
    const branches = await BranchRepository.findAll();
    return branches.find((b) => b.id === id || b.code === id) || null;
  }

  /**
   * Upsert branch and delivery zones to PostgreSQL
   */
  static async save(branch: Partial<BranchDomain>): Promise<void> {
    const id = branch.id || `br_${Date.now()}`;
    const lat = typeof branch.latitude === "number" ? branch.latitude : 8.8932;
    const lng = typeof branch.longitude === "number" ? branch.longitude : 76.6141;

    const metadata = {
      weekly_schedule: branch.weekly_schedule || {},
      fulfillment_rules: branch.fulfillment_rules || {
        allow_pickup: true,
        allow_delivery: true,
        same_day_cutoff: "18:00",
        express_cutoff: "20:00",
        midnight_cutoff: "21:00",
        prep_time_minutes: 120,
      },
      manager_account: branch.manager_account || null,
      manager_id: branch.manager_id || null,
      max_delivery_radius_km: branch.max_delivery_radius_km || 15,
      operational_status: branch.operational_status || "operational",
      extended_status: branch.extended_status || "open",
      branch_type: branch.branch_type || "main_hub",
      city: branch.city || "Bengaluru",
      state: branch.state || "Karnataka",
      deliverable_areas: branch.deliverable_areas || [branch.city || "Bengaluru"],
      capacity_settings: branch.capacity_settings || {},
      product_availability: branch.product_availability || {},
    };

    await dbTransaction(async (client) => {
      await client.query(
        `
        INSERT INTO "branch" (id, name, code, phone, email, address, city_id, latitude, longitude, is_open, is_active, metadata, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          code = EXCLUDED.code,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          address = EXCLUDED.address,
          city_id = EXCLUDED.city_id,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          is_open = EXCLUDED.is_open,
          is_active = EXCLUDED.is_active,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `,
        [
          id,
          branch.name || "Bakery Branch",
          branch.code || id,
          branch.phone || "+91 98765 43210",
          branch.email || "store@caketohome.com",
          branch.address || "Bakery Hub",
          branch.city_id || "city_bbr",
          lat,
          lng,
          branch.is_open !== false,
          branch.is_archived !== true,
          JSON.stringify(metadata),
        ]
      );

      // Upsert delivery zones if present
      if (Array.isArray(branch.delivery_zones)) {
        for (const zone of branch.delivery_zones) {
          const zId = zone.id || `zone_${id}_${zone.pincode || Date.now()}`;
          await client.query(
            `
            INSERT INTO "delivery_zone" (id, branch_id, pincode, delivery_fee, radius_km, polygon_coordinates, priority, estimated_delivery_minutes, is_serviceable, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
              delivery_fee = EXCLUDED.delivery_fee,
              radius_km = EXCLUDED.radius_km,
              polygon_coordinates = EXCLUDED.polygon_coordinates,
              priority = EXCLUDED.priority,
              estimated_delivery_minutes = EXCLUDED.estimated_delivery_minutes,
              is_serviceable = EXCLUDED.is_serviceable,
              updated_at = NOW()
          `,
            [
              zId,
              id,
              zone.pincode || null,
              Number(zone.delivery_fee || zone.base_fee || 0),
              Number(zone.radius_km || 10),
              JSON.stringify(zone.polygon_coordinates || []),
              Number(zone.priority || 10),
              Number(zone.estimated_delivery_minutes || 35),
              zone.enabled !== false,
            ]
          );
        }
      }
    });
  }

  /**
   * Delete / archive branch in PostgreSQL
   */
  static async delete(id: string): Promise<void> {
    await dbQuery(`UPDATE "branch" SET deleted_at = NOW(), is_active = false WHERE id = $1`, [id]);
  }
}
