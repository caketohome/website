/**
 * CakeToHome ERP — Vehicle Repository (Phase 3)
 * Branch-scoped vehicle CRUD with odometer tracking.
 */

import { dbQuery, dbTransaction } from "@frontend/lib/db";
import type {
  VehicleRow,
  VehicleCreateInput,
  VehicleUpdateInput,
  VehicleListFilters,
  VehicleListResult,
} from "@frontend/lib/types/fleet.types";

function generateId(): string {
  return "veh_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export class VehicleRepository {
  /** List vehicles with optional branch scope and filters */
  static async list(filters: VehicleListFilters = {}): Promise<VehicleListResult> {
    try {
      const conditions: string[] = ["v.deleted_at IS NULL"];
      const params: unknown[] = [];
      let pIdx = 1;

      if (filters.branch_id) {
        conditions.push(`v.branch_id = $${pIdx++}`);
        params.push(filters.branch_id);
      }
      if (filters.is_active !== undefined) {
        conditions.push(`v.is_active = $${pIdx++}`);
        params.push(filters.is_active);
      }
      if (filters.vehicle_type) {
        conditions.push(`v.vehicle_type = $${pIdx++}`);
        params.push(filters.vehicle_type);
      }
      if (filters.search) {
        conditions.push(`(v.registration_no ILIKE $${pIdx} OR v.make_model ILIKE $${pIdx})`);
        params.push(`%${filters.search}%`);
        pIdx++;
      }

      const where = "WHERE " + conditions.join(" AND ");
      const limit = Math.min(filters.limit ?? 50, 200);
      const offset = filters.offset ?? 0;

      const countRes = await dbQuery(
        `SELECT COUNT(*) FROM public.vehicle v ${where}`,
        params
      );
      const total = parseInt(countRes.rows[0].count, 10);

      const rows = await dbQuery(
        `SELECT v.*, b.name AS branch_name
         FROM public.vehicle v
         LEFT JOIN public.branch b ON b.id = v.branch_id
         ${where}
         ORDER BY v.created_at DESC
         LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
        [...params, limit, offset]
      );

      return { vehicles: rows.rows, total, success: true };
    } catch (e: unknown) {
      return { vehicles: [], total: 0, success: false, error: (e as Error).message };
    }
  }

  /** Get single vehicle by ID with optional branch scope */
  static async findById(id: string, branchId?: string): Promise<{ success: boolean; data?: VehicleRow; error?: string }> {
    try {
      const params: unknown[] = [id];
      let where = "WHERE v.id = $1 AND v.deleted_at IS NULL";
      if (branchId) {
        where += " AND v.branch_id = $2";
        params.push(branchId);
      }
      const res = await dbQuery(
        `SELECT v.*, b.name AS branch_name FROM public.vehicle v LEFT JOIN public.branch b ON b.id = v.branch_id ${where}`,
        params
      );
      if (res.rows.length === 0) return { success: false, error: "Vehicle not found." };
      return { success: true, data: res.rows[0] };
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message };
    }
  }

  /** Create vehicle */
  static async create(input: VehicleCreateInput, branchId: string, createdBy: string): Promise<{ success: boolean; data?: VehicleRow; error?: string }> {
    try {
      // Check registration uniqueness within branch
      const dup = await dbQuery(
        "SELECT id FROM public.vehicle WHERE registration_no = $1 AND branch_id = $2 AND deleted_at IS NULL",
        [input.registration_no.toUpperCase().trim(), branchId]
      );
      if (dup.rows.length > 0) return { success: false, error: `Vehicle ${input.registration_no} already exists in this branch.` };

      const id = generateId();
      const res = await dbQuery(
        `INSERT INTO public.vehicle (id, branch_id, registration_no, vehicle_type, make_model, year, is_active, current_odometer, ownership_type, notes, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
         RETURNING *`,
        [
          id, branchId,
          input.registration_no.toUpperCase().trim(),
          input.vehicle_type ?? "BIKE",
          input.make_model ?? null,
          input.year ?? null,
          input.is_active ?? true,
          input.current_odometer ?? 0,
          input.ownership_type ?? "OWN",
          input.notes ?? null,
          createdBy,
        ]
      );
      return { success: true, data: res.rows[0] };
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message };
    }
  }

  /** Update vehicle (branch-scoped) */
  static async update(id: string, input: VehicleUpdateInput, branchId: string): Promise<{ success: boolean; data?: VehicleRow; error?: string }> {
    try {
      const existing = await VehicleRepository.findById(id, branchId);
      if (!existing.success) return { success: false, error: "Vehicle not found or access denied." };

      const sets: string[] = [];
      const params: unknown[] = [];
      let pIdx = 1;

      if (input.registration_no !== undefined) { sets.push(`registration_no = $${pIdx++}`); params.push(input.registration_no.toUpperCase().trim()); }
      if (input.vehicle_type !== undefined) { sets.push(`vehicle_type = $${pIdx++}`); params.push(input.vehicle_type); }
      if (input.make_model !== undefined) { sets.push(`make_model = $${pIdx++}`); params.push(input.make_model); }
      if (input.year !== undefined) { sets.push(`year = $${pIdx++}`); params.push(input.year); }
      if (input.is_active !== undefined) { sets.push(`is_active = $${pIdx++}`); params.push(input.is_active); }
      if (input.current_odometer !== undefined) { sets.push(`current_odometer = $${pIdx++}`); params.push(input.current_odometer); }
      if (input.ownership_type !== undefined) { sets.push(`ownership_type = $${pIdx++}`); params.push(input.ownership_type); }
      if (input.notes !== undefined) { sets.push(`notes = $${pIdx++}`); params.push(input.notes); }

      if (sets.length === 0) return { success: false, error: "No fields to update." };
      sets.push(`updated_at = NOW()`);

      params.push(id, branchId);
      const res = await dbQuery(
        `UPDATE public.vehicle SET ${sets.join(", ")} WHERE id = $${pIdx} AND branch_id = $${pIdx + 1} AND deleted_at IS NULL RETURNING *`,
        params
      );
      if (res.rows.length === 0) return { success: false, error: "Vehicle not found or access denied." };
      return { success: true, data: res.rows[0] };
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message };
    }
  }

  /** Soft delete vehicle (branch-scoped) */
  static async softDelete(id: string, branchId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check no active trips
      const trips = await dbQuery(
        "SELECT COUNT(*) FROM public.vehicle_trip WHERE vehicle_id = $1 AND end_odometer IS NULL",
        [id]
      );
      if (parseInt(trips.rows[0].count, 10) > 0) {
        return { success: false, error: "Vehicle has open trips. Close all trips before deleting." };
      }
      const res = await dbQuery(
        "UPDATE public.vehicle SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND branch_id = $2 AND deleted_at IS NULL",
        [id, branchId]
      );
      if (res.rowCount === 0) return { success: false, error: "Vehicle not found or access denied." };
      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message };
    }
  }
}
