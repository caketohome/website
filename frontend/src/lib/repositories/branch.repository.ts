import { dbQuery, dbTransaction } from "../db";
import { BranchDomain, DeliveryZoneDomain } from "../types/domain";
import { resolveStateInfo } from "./city.repository";

export interface BranchFilterOptions {
  search?: string;
  q?: string;
  lifecycle?: "active" | "archived" | "all";
  page?: number;
  limit?: number;
}

export interface PaginatedBranches {
  branches: BranchDomain[];
  total: number;
  totalCount: number;
  activeCount: number;
  archivedCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class BranchRepository {
  /**
   * Helper to map a raw PostgreSQL row to BranchDomain
   */
  private static mapRowToDomain(b: any, zonesByBranch: Map<string, DeliveryZoneDomain[]>): BranchDomain {
    const meta = b.metadata || {};
    const branchZones = zonesByBranch.get(b.id) || meta.delivery_zones || [];
    const rawCityName = meta.city || b.city_name || (b.city_id === "city_klm" ? "Kollam" : "Bengaluru");
    const rawStateName = meta.state || b.city_state || (b.city_id === "city_klm" ? "Kerala" : "Karnataka");
    const matchedState = resolveStateInfo(rawStateName);
    const stateId = meta.state_id || matchedState?.id || (rawStateName.toLowerCase().includes("kerala") ? "state_kl" : "state_ka");
    const stateCode = matchedState?.code || (rawStateName.toLowerCase().includes("kerala") ? "KL" : "KA");
    const rawCityId = b.city_id || (rawCityName.toLowerCase() === "kollam" ? "city_klm" : "city_bbr");
    const pincode = meta.pincode || (Array.isArray(branchZones[0]?.pincodes) ? branchZones[0].pincodes[0] : branchZones[0]?.pincode) || (b.id === "br_kollam_central" ? "691001" : "");
    const isArchived = b.deleted_at !== null || b.is_active === false || meta.is_archived === true || meta.status === "archived";

    return {
      id: b.id,
      name: b.name,
      code: b.code || b.id,
      phone: b.phone || "+91 98765 43210",
      email: b.email || "store@caketohome.com",
      address: b.address || "Bakery Hub",
      city_id: rawCityId,
      city: rawCityName,
      state: rawStateName,
      state_id: stateId,
      state_code: stateCode,
      pincode: pincode,
      formatted_address: meta.formatted_address || b.address || "",
      latitude: typeof b.latitude === "number" ? b.latitude : 8.8932,
      longitude: typeof b.longitude === "number" ? b.longitude : 76.6141,
      is_open: b.is_open !== false,
      is_archived: isArchived,
      status: isArchived ? "archived" : "active",
      operational_status: meta.operational_status || "operational",
      extended_status: meta.extended_status || "open",
      branch_type: meta.branch_type || "main_hub",
      manager_id: meta.manager_id || null,
      manager_account: meta.manager_account || (meta.manager_name ? { name: meta.manager_name, phone: b.phone, email: b.email } : null),
      manager_name: meta.manager_name || meta.manager_account?.name || "",
      max_delivery_radius_km: Number(meta.max_delivery_radius_km || 15),
      weekly_schedule: meta.weekly_schedule || {},
      fulfillment_rules: meta.fulfillment_rules || {
        allow_pickup: true,
        allow_delivery: true,
        same_day_cutoff: "18:00",
        express_cutoff: "20:00",
        prep_time_minutes: 120,
      },
      delivery_zones: branchZones,
      deliverable_areas: meta.deliverable_areas || [rawCityName],
      capacity_settings: meta.capacity_settings || {},
      product_availability: meta.product_availability || {},
      created_at: b.created_at,
      updated_at: b.updated_at,
    };
  }

  /**
   * Find branches with server-side multi-field parameterized search, lifecycle filtering, and pagination.
   * Phase 8.2 Zero N+1 query optimization: 1 query for branches + 1 batch query for delivery zones.
   */
  static async findWithFilters(options: BranchFilterOptions = {}): Promise<PaginatedBranches> {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 50));
    const offset = (page - 1) * limit;
    const lifecycle = options.lifecycle || "active";
    const trimmedSearch = (options.search || options.q || "").trim();

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Search filter across authoritative columns & metadata
    let countWhere = "";
    if (trimmedSearch) {
      const searchParam = `%${trimmedSearch.toLowerCase()}%`;
      params.push(searchParam);
      const searchClause = `(
        LOWER(b.name) LIKE $${paramIndex}
        OR LOWER(b.code) LIKE $${paramIndex}
        OR LOWER(b.address) LIKE $${paramIndex}
        OR LOWER(COALESCE(b.metadata->>'formatted_address', '')) LIKE $${paramIndex}
        OR LOWER(COALESCE(b.metadata->>'address', '')) LIKE $${paramIndex}
        OR LOWER(COALESCE(c.name, '')) LIKE $${paramIndex}
        OR LOWER(COALESCE(b.metadata->>'city', '')) LIKE $${paramIndex}
        OR LOWER(COALESCE(c.state, '')) LIKE $${paramIndex}
        OR LOWER(COALESCE(b.metadata->>'state', '')) LIKE $${paramIndex}
        OR LOWER(COALESCE(b.metadata->>'pincode', '')) LIKE $${paramIndex}
        OR LOWER(COALESCE(b.metadata->>'manager_name', '')) LIKE $${paramIndex}
        OR LOWER(COALESCE(b.metadata->'manager_account'->>'name', '')) LIKE $${paramIndex}
        OR LOWER(COALESCE(b.phone, '')) LIKE $${paramIndex}
        OR LOWER(COALESCE(b.metadata->>'phone', '')) LIKE $${paramIndex}
        OR LOWER(COALESCE(b.metadata->>'manager_phone', '')) LIKE $${paramIndex}
        OR LOWER(COALESCE(b.metadata->'manager_account'->>'phone', '')) LIKE $${paramIndex}
        OR EXISTS (
          SELECT 1 FROM "delivery_zone" dz 
          WHERE dz.branch_id = b.id 
          AND dz.deleted_at IS NULL 
          AND LOWER(COALESCE(dz.pincode, '')) LIKE $${paramIndex}
        )
      )`;
      conditions.push(searchClause);
      countWhere = `WHERE ${searchClause}`;
      paramIndex++;
    }

    // 1. Get counts across Active / Archived / Total matching the search query (single efficient DB query)
    const countQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE b.deleted_at IS NULL) as active_count,
        COUNT(*) FILTER (WHERE b.deleted_at IS NOT NULL) as archived_count,
        COUNT(*) as total_count
      FROM "branch" b
      LEFT JOIN "city" c ON b.city_id = c.id
      ${countWhere}
    `;
    const countRes = await dbQuery(countQuery, trimmedSearch ? [params[0]] : []);
    const counts = countRes.rows[0] || { active_count: 0, archived_count: 0, total_count: 0 };
    const activeCount = Number(counts.active_count || 0);
    const archivedCount = Number(counts.archived_count || 0);
    const totalCount = Number(counts.total_count || 0);

    // Lifecycle filter for the paginated slice
    if (lifecycle === "active") {
      conditions.push(`b.deleted_at IS NULL`);
    } else if (lifecycle === "archived") {
      conditions.push(`b.deleted_at IS NOT NULL`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const total = lifecycle === "active" ? activeCount : lifecycle === "archived" ? archivedCount : totalCount;

    // 2. Fetch paginated branch rows
    const queryParams = [...params, limit, offset];
    const limitPlaceholder = `$${paramIndex}`;
    const offsetPlaceholder = `$${paramIndex + 1}`;

    const dataQuery = `
      SELECT b.*, c.name as city_name, c.state as city_state
      FROM "branch" b
      LEFT JOIN "city" c ON b.city_id = c.id
      ${whereClause}
      ORDER BY b.created_at ASC
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
    `;

    const branchesRes = await dbQuery(dataQuery, queryParams);
    const branchRows = branchesRes.rows || [];

    // 3. Batch query for delivery zones (Zero N+1)
    const branchIds = branchRows.map((b: any) => b.id);
    const zonesByBranch = new Map<string, DeliveryZoneDomain[]>();

    if (branchIds.length > 0) {
      const zonesRes = await dbQuery(
        `SELECT * FROM "delivery_zone" WHERE deleted_at IS NULL AND branch_id = ANY($1) ORDER BY priority DESC`,
        [branchIds]
      );
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
    }

    const branches = branchRows.map((b: any) => BranchRepository.mapRowToDomain(b, zonesByBranch));
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      branches,
      total,
      totalCount,
      activeCount,
      archivedCount,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Find all branches and their delivery zones (backward compatibility wrapper)
   */
  static async findAll(options?: BranchFilterOptions): Promise<BranchDomain[]> {
    const result = await BranchRepository.findWithFilters({
      limit: 500,
      lifecycle: "all",
      ...options,
    });
    return result.branches;
  }

  /**
   * Find all active branches (convenience wrapper)
   */
  static async findActive(): Promise<BranchDomain[]> {
    return BranchRepository.findAll({ lifecycle: "active" });
  }

  /**
   * Find branch by ID or Code
   */
  static async findById(id: string): Promise<BranchDomain | null> {
    const [branchRes, zonesRes] = await Promise.all([
      dbQuery(
        `
        SELECT b.*, c.name as city_name, c.state as city_state
        FROM "branch" b
        LEFT JOIN "city" c ON b.city_id = c.id
        WHERE b.id = $1 OR b.code = $1 OR b.id = $1 || '_01' OR b.id LIKE $1 || '%'
        ORDER BY CASE WHEN b.id = $1 THEN 1 WHEN b.id = $1 || '_01' THEN 2 ELSE 3 END
        LIMIT 1
      `,
        [id]
      ),
      dbQuery(
        `
        SELECT * FROM "delivery_zone" 
        WHERE (branch_id = $1 OR branch_id = $1 || '_01' OR branch_id IN (SELECT id FROM "branch" WHERE code = $1 OR id = $1 OR id = $1 || '_01' OR id LIKE $1 || '%')) 
        AND deleted_at IS NULL 
        ORDER BY priority DESC
      `,
        [id]
      ),
    ]);

    if (!branchRes.rows || branchRes.rows.length === 0) {
      return null;
    }

    const zonesByBranch = new Map<string, DeliveryZoneDomain[]>();
    const bRow = branchRes.rows[0];
    zonesByBranch.set(
      bRow.id,
      (zonesRes.rows || []).map((z: any) => ({
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
      }))
    );

    return BranchRepository.mapRowToDomain(bRow, zonesByBranch);
  }

  /**
   * Find branch serving a given pincode directly from PostgreSQL
   */
  static async findByPincode(pincode: string): Promise<BranchDomain | null> {
    const cleanPin = (pincode || "").trim();
    if (!cleanPin) return null;

    const res = await dbQuery(
      `
      SELECT b.id
      FROM "branch" b
      LEFT JOIN "delivery_zone" dz ON dz.branch_id = b.id AND dz.deleted_at IS NULL
      WHERE b.deleted_at IS NULL 
        AND (
          dz.pincode = $1 
          OR b.metadata->>'pincode' = $1
          OR b.address LIKE '%' || $1 || '%'
        )
      LIMIT 1
      `,
      [cleanPin]
    );

    if (res.rows && res.rows.length > 0) {
      return BranchRepository.findById(res.rows[0].id);
    }
    return null;
  }

  /**
   * Upsert branch and delivery zones to PostgreSQL
   */
  static async save(branch: Partial<BranchDomain>): Promise<void> {
    const id = branch.id || `br_${Date.now()}`;
    const lat = typeof branch.latitude === "number" ? branch.latitude : 8.8932;
    const lng = typeof branch.longitude === "number" ? branch.longitude : 76.6141;

    const rawCityName = (branch.city || "Bengaluru").trim();
    const rawStateName = (branch.state || "Karnataka").trim();
    const matchedState = resolveStateInfo(rawStateName);
    const stateId = branch.state_id || matchedState?.id || "state_ka";
    const stateCode = matchedState?.code || "KA";
    // Numeric GST state code (e.g. Kerala = "32") — must match gst_registration.state_code / GSTIN prefix.
    const gstStateCode = matchedState?.gst_state_code || "";
    const cityId = branch.city_id || (rawCityName.toLowerCase() === "kollam" ? "city_klm" : "city_bbr");
    const pincode = (branch.pincode || "").trim();

    const metadata = {
      weekly_schedule: branch.weekly_schedule || {},
      fulfillment_rules: branch.fulfillment_rules || {
        allow_pickup: true,
        allow_delivery: true,
        same_day_cutoff: "18:00",
        express_cutoff: "20:00",
        prep_time_minutes: 120,
      },
      manager_account: branch.manager_account || null,
      manager_id: branch.manager_id || null,
      manager_name: branch.manager_name || branch.manager_account?.name || null,
      max_delivery_radius_km: branch.max_delivery_radius_km || 15,
      operational_status: branch.operational_status || "operational",
      extended_status: branch.extended_status || "open",
      branch_type: branch.branch_type || "main_hub",
      city: rawCityName,
      city_id: cityId,
      state: rawStateName,
      state_id: stateId,
      state_code: stateCode,
      gst_state_code: gstStateCode,
      pincode: pincode,
      formatted_address: branch.formatted_address || branch.address || "",
      deliverable_areas: branch.deliverable_areas || [rawCityName],
      capacity_settings: branch.capacity_settings || {},
      product_availability: branch.product_availability || {},
    };

    const shopId = (branch as any).shop_id || "res_01KXYMAHGFPRY1G9TZKEVGAGAT";

    await dbTransaction(async (client) => {
      await client.query(
        `
        INSERT INTO "branch" (id, name, code, phone, email, address, city_id, latitude, longitude, is_open, shop_id, metadata,
                              company_id, gst_registration_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                (SELECT id FROM public.company WHERE is_active = true ORDER BY created_at ASC LIMIT 1),
                (SELECT id FROM public.gst_registration WHERE is_active = true AND state_code = $13 ORDER BY created_at ASC LIMIT 1),
                NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          company_id = COALESCE("branch".company_id, EXCLUDED.company_id),
          gst_registration_id = COALESCE(EXCLUDED.gst_registration_id, "branch".gst_registration_id),
          name = EXCLUDED.name,
          code = EXCLUDED.code,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          address = EXCLUDED.address,
          city_id = EXCLUDED.city_id,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          is_open = EXCLUDED.is_open,
          shop_id = EXCLUDED.shop_id,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `,
        [
          id,
          branch.name || "Bakery Branch",
          branch.code || id,
          branch.phone || null,
          branch.email || null,
          branch.address || "Bakery Hub",
          cityId,
          lat,
          lng,
          branch.is_open !== false,
          shopId,
          JSON.stringify(metadata),
          gstStateCode,
        ]
      );

      // Upsert delivery zones if present in 1 batch query (N queries -> 1 query)
      if (Array.isArray(branch.delivery_zones) && branch.delivery_zones.length > 0) {
        const values: any[] = [];
        const valuePlaceholders: string[] = [];

        branch.delivery_zones.forEach((zone, index) => {
          const zoneAny = zone as any;
          const zonePincode = zone.pincode || (zoneAny.pincodes && zoneAny.pincodes[0]) || pincode || "560038";
          const zId = zone.id || `zone_${id}_${zonePincode}_${index}`;
          const offset = index * 11;
          valuePlaceholders.push(
            `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, NOW(), NOW())`
          );
          values.push(
            zId,
            zonePincode,
            id,
            Number(zone.delivery_fee || zone.base_fee || 0),
            zone.enabled !== false,
            JSON.stringify(zone.polygon_coordinates || []),
            Number(zone.radius_km || 10),
            lat,
            lng,
            Number(zone.priority || 10),
            Number(zone.estimated_delivery_minutes || 35)
          );
        });

        await client.query(
          `
          INSERT INTO "delivery_zone" (id, pincode, branch_id, delivery_fee, is_serviceable, polygon_coordinates, radius_km, center_latitude, center_longitude, priority, estimated_delivery_minutes, created_at, updated_at)
          VALUES ${valuePlaceholders.join(", ")}
          ON CONFLICT (id) DO UPDATE SET
            delivery_fee = EXCLUDED.delivery_fee,
            is_serviceable = EXCLUDED.is_serviceable,
            polygon_coordinates = EXCLUDED.polygon_coordinates,
            radius_km = EXCLUDED.radius_km,
            center_latitude = EXCLUDED.center_latitude,
            center_longitude = EXCLUDED.center_longitude,
            priority = EXCLUDED.priority,
            estimated_delivery_minutes = EXCLUDED.estimated_delivery_minutes,
            updated_at = NOW()
          `,
          values
        );
      }
    });
  }

  /**
   * Delete / archive branch in PostgreSQL
   */
  static async delete(id: string): Promise<void> {
    await dbQuery(`UPDATE "branch" SET deleted_at = NOW(), is_open = false WHERE id = $1`, [id]);
  }

  /**
   * Restore archived branch in PostgreSQL
   */
  static async restore(id: string): Promise<void> {
    await dbQuery(`UPDATE "branch" SET deleted_at = NULL, is_open = true WHERE id = $1`, [id]);
  }
}
