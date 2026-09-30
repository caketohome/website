/**
 * CakeToHome ERP — Vehicle Trip Repository (Phase 3)
 * Manual odometer trip records with DB-level and service-level validation.
 *
 * Key rules:
 * - end_odometer >= start_odometer (enforced in DB + here)
 * - distance_km = end_odometer - start_odometer (derived, never trusted from client)
 * - distance must be >= 0
 * - historical odometer is never silently rewritten
 */

import { dbQuery } from "@frontend/lib/db";
import type {
  VehicleTripRow,
  TripCreateInput,
  TripUpdateInput,
  TripListFilters,
  TripListResult,
} from "@frontend/lib/types/fleet.types";

function generateId(): string {
  return "vtrip_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export class VehicleTripRepository {
  static async list(filters: TripListFilters = {}): Promise<TripListResult> {
    try {
      const conditions: string[] = ["1=1"];
      const params: unknown[] = [];
      let pIdx = 1;

      if (filters.branch_id) { conditions.push(`t.branch_id = $${pIdx++}`); params.push(filters.branch_id); }
      if (filters.vehicle_id) { conditions.push(`t.vehicle_id = $${pIdx++}`); params.push(filters.vehicle_id); }
      if (filters.driver_partner_id) { conditions.push(`t.driver_partner_id = $${pIdx++}`); params.push(filters.driver_partner_id); }
      if (filters.purpose) { conditions.push(`t.purpose = $${pIdx++}`); params.push(filters.purpose); }
      if (filters.startDate) { conditions.push(`t.trip_date >= $${pIdx++}`); params.push(filters.startDate); }
      if (filters.endDate)   { conditions.push(`t.trip_date <= $${pIdx++}`); params.push(filters.endDate); }

      const where = "WHERE " + conditions.join(" AND ");
      const limit = Math.min(filters.limit ?? 50, 200);
      const offset = filters.offset ?? 0;

      const countRes = await dbQuery(`SELECT COUNT(*) FROM public.vehicle_trip t ${where}`, params);
      const total = parseInt(countRes.rows[0].count, 10);

      const rows = await dbQuery(
        `SELECT t.*,
                v.registration_no,
                CONCAT(dp.first_name, ' ', dp.last_name) AS driver_name
         FROM public.vehicle_trip t
         LEFT JOIN public.vehicle v ON v.id = t.vehicle_id
         LEFT JOIN public.delivery_partner dp ON dp.id = t.driver_partner_id
         ${where}
         ORDER BY t.trip_date DESC, t.created_at DESC
         LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
        [...params, limit, offset]
      );

      return { trips: rows.rows, total, success: true };
    } catch (e: unknown) {
      return { trips: [], total: 0, success: false, error: (e as Error).message };
    }
  }

  static async findById(id: string, branchId?: string): Promise<{ success: boolean; data?: VehicleTripRow; error?: string }> {
    try {
      const params: unknown[] = [id];
      let where = "WHERE t.id = $1";
      if (branchId) { where += " AND t.branch_id = $2"; params.push(branchId); }

      const res = await dbQuery(
        `SELECT t.*, v.registration_no, CONCAT(dp.first_name,' ',dp.last_name) AS driver_name
         FROM public.vehicle_trip t
         LEFT JOIN public.vehicle v ON v.id = t.vehicle_id
         LEFT JOIN public.delivery_partner dp ON dp.id = t.driver_partner_id
         ${where}`,
        params
      );
      if (res.rows.length === 0) return { success: false, error: "Trip not found." };
      return { success: true, data: res.rows[0] };
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message };
    }
  }

  static async create(input: TripCreateInput, branchId: string, createdBy: string): Promise<{ success: boolean; data?: VehicleTripRow; error?: string }> {
    try {
      // Validate odometer
      if (input.end_odometer !== undefined && input.end_odometer !== null) {
        if (input.end_odometer < input.start_odometer) {
          return { success: false, error: `End odometer (${input.end_odometer}) cannot be less than start odometer (${input.start_odometer}).` };
        }
      }

      // Verify vehicle belongs to this branch
      const veh = await dbQuery(
        "SELECT id FROM public.vehicle WHERE id = $1 AND branch_id = $2 AND deleted_at IS NULL",
        [input.vehicle_id, branchId]
      );
      if (veh.rows.length === 0) return { success: false, error: "Vehicle not found in this branch." };

      // Derive distance_km only from odometer (never trust client)
      let distanceKm: number | null = null;
      if (input.end_odometer !== undefined && input.end_odometer !== null) {
        distanceKm = +(input.end_odometer - input.start_odometer).toFixed(2);
      }

      const id = generateId();
      const res = await dbQuery(
        `INSERT INTO public.vehicle_trip
           (id, branch_id, vehicle_id, driver_partner_id, delivery_id, trip_date, start_odometer, end_odometer, distance_km, purpose, notes, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
         RETURNING *`,
        [
          id, branchId, input.vehicle_id,
          input.driver_partner_id ?? null,
          input.delivery_id ?? null,
          input.trip_date,
          input.start_odometer,
          input.end_odometer ?? null,
          distanceKm,
          input.purpose ?? "DELIVERY",
          input.notes ?? null,
          createdBy,
        ]
      );

      // Update vehicle current_odometer if this is a closing record
      if (input.end_odometer !== undefined && input.end_odometer !== null) {
        await dbQuery(
          "UPDATE public.vehicle SET current_odometer = $1, updated_at = NOW() WHERE id = $2 AND current_odometer < $1",
          [input.end_odometer, input.vehicle_id]
        );
      }

      return { success: true, data: res.rows[0] };
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message };
    }
  }

  /** Close/update a trip — primarily for adding end_odometer */
  static async update(id: string, input: TripUpdateInput, branchId: string): Promise<{ success: boolean; data?: VehicleTripRow; error?: string }> {
    try {
      const existing = await VehicleTripRepository.findById(id, branchId);
      if (!existing.success || !existing.data) return { success: false, error: "Trip not found or access denied." };

      const trip = existing.data;

      // Validate new end_odometer against recorded start
      if (input.end_odometer !== undefined && input.end_odometer !== null) {
        if (input.end_odometer < Number(trip.start_odometer)) {
          return { success: false, error: `End odometer (${input.end_odometer}) cannot be less than start odometer (${trip.start_odometer}).` };
        }
      }

      // Always derive distance_km from odometer (never from client-supplied distance_km)
      let derivedDistance: number | null = null;
      const endOdo = input.end_odometer ?? (trip.end_odometer !== null ? Number(trip.end_odometer) : null);
      if (endOdo !== null) {
        derivedDistance = +(endOdo - Number(trip.start_odometer)).toFixed(2);
      }

      const sets: string[] = [];
      const params: unknown[] = [];
      let pIdx = 1;

      if (input.end_odometer !== undefined) { sets.push(`end_odometer = $${pIdx++}`); params.push(input.end_odometer); }
      sets.push(`distance_km = $${pIdx++}`); params.push(derivedDistance);
      if (input.driver_partner_id !== undefined) { sets.push(`driver_partner_id = $${pIdx++}`); params.push(input.driver_partner_id); }
      if (input.delivery_id !== undefined) { sets.push(`delivery_id = $${pIdx++}`); params.push(input.delivery_id); }
      if (input.purpose !== undefined) { sets.push(`purpose = $${pIdx++}`); params.push(input.purpose); }
      if (input.notes !== undefined) { sets.push(`notes = $${pIdx++}`); params.push(input.notes); }
      sets.push("updated_at = NOW()");

      params.push(id, branchId);
      const res = await dbQuery(
        `UPDATE public.vehicle_trip SET ${sets.join(", ")} WHERE id = $${pIdx} AND branch_id = $${pIdx + 1} RETURNING *`,
        params
      );
      if (res.rows.length === 0) return { success: false, error: "Trip not found." };

      // Update vehicle current_odometer
      if (input.end_odometer !== undefined && input.end_odometer !== null) {
        await dbQuery(
          "UPDATE public.vehicle SET current_odometer = $1, updated_at = NOW() WHERE id = $2 AND current_odometer < $1",
          [input.end_odometer, trip.vehicle_id]
        );
      }

      return { success: true, data: res.rows[0] };
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message };
    }
  }
}
