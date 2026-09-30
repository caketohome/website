/**
 * CakeToHome ERP — Fleet Fuel Repository (Phase 3)
 * Fuel fill-up records with optional Expense module linkage.
 *
 * All monetary values use NUMERIC(14,2).
 * fuel_amount = quantity_litres × rate_per_litre (server validated ±₹0.50).
 * No fabricated fuel prices or averages.
 */

import { dbQuery } from "@frontend/lib/db";
import type {
  FleetFuelRow,
  FuelCreateInput,
  FuelUpdateInput,
  FuelListFilters,
  FuelListResult,
} from "@frontend/lib/types/fleet.types";

function generateId(): string {
  return "fuel_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export class FleetFuelRepository {
  static async list(filters: FuelListFilters = {}): Promise<FuelListResult> {
    try {
      const conditions: string[] = ["f.deleted_at IS NULL"];
      const params: unknown[] = [];
      let pIdx = 1;

      if (filters.branch_id) { conditions.push(`f.branch_id = $${pIdx++}`); params.push(filters.branch_id); }
      if (filters.vehicle_id) { conditions.push(`f.vehicle_id = $${pIdx++}`); params.push(filters.vehicle_id); }
      if (filters.driver_partner_id) { conditions.push(`f.driver_partner_id = $${pIdx++}`); params.push(filters.driver_partner_id); }
      if (filters.startDate) { conditions.push(`f.fuel_date >= $${pIdx++}`); params.push(filters.startDate); }
      if (filters.endDate)   { conditions.push(`f.fuel_date <= $${pIdx++}`); params.push(filters.endDate); }

      const where = "WHERE " + conditions.join(" AND ");
      const limit = Math.min(filters.limit ?? 50, 200);
      const offset = filters.offset ?? 0;

      const countRes = await dbQuery(`SELECT COUNT(*) FROM public.fleet_fuel f ${where}`, params);
      const total = parseInt(countRes.rows[0].count, 10);

      const rows = await dbQuery(
        `SELECT f.*,
                v.registration_no,
                CONCAT(dp.first_name,' ',dp.last_name) AS driver_name
         FROM public.fleet_fuel f
         LEFT JOIN public.vehicle v ON v.id = f.vehicle_id
         LEFT JOIN public.delivery_partner dp ON dp.id = f.driver_partner_id
         ${where}
         ORDER BY f.fuel_date DESC, f.created_at DESC
         LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
        [...params, limit, offset]
      );

      return { fuel_records: rows.rows, total, success: true };
    } catch (e: unknown) {
      return { fuel_records: [], total: 0, success: false, error: (e as Error).message };
    }
  }

  static async findById(id: string, branchId?: string): Promise<{ success: boolean; data?: FleetFuelRow; error?: string }> {
    try {
      const params: unknown[] = [id];
      let where = "WHERE f.id = $1 AND f.deleted_at IS NULL";
      if (branchId) { where += " AND f.branch_id = $2"; params.push(branchId); }

      const res = await dbQuery(
        `SELECT f.*, v.registration_no, CONCAT(dp.first_name,' ',dp.last_name) AS driver_name
         FROM public.fleet_fuel f
         LEFT JOIN public.vehicle v ON v.id = f.vehicle_id
         LEFT JOIN public.delivery_partner dp ON dp.id = f.driver_partner_id
         ${where}`,
        params
      );
      if (res.rows.length === 0) return { success: false, error: "Fuel record not found." };
      return { success: true, data: res.rows[0] };
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message };
    }
  }

  static async create(input: FuelCreateInput, branchId: string, createdBy: string): Promise<{ success: boolean; data?: FleetFuelRow; error?: string }> {
    try {
      // Server-side fuel_amount validation: qty × rate ≈ amount (±₹0.50)
      const expected = +(Number(input.quantity_litres) * Number(input.rate_per_litre)).toFixed(2);
      if (Math.abs(expected - Number(input.fuel_amount)) > 0.5) {
        return {
          success: false,
          error: `Fuel amount mismatch: ${input.quantity_litres}L × ₹${input.rate_per_litre}/L = ₹${expected} but supplied ₹${input.fuel_amount}.`,
        };
      }

      // Verify vehicle belongs to branch
      const veh = await dbQuery(
        "SELECT id FROM public.vehicle WHERE id = $1 AND branch_id = $2 AND deleted_at IS NULL",
        [input.vehicle_id, branchId]
      );
      if (veh.rows.length === 0) return { success: false, error: "Vehicle not found in this branch." };

      const id = generateId();
      const res = await dbQuery(
        `INSERT INTO public.fleet_fuel
           (id, branch_id, vehicle_id, driver_partner_id, expense_id, fuel_date, quantity_litres, rate_per_litre, fuel_amount, odometer_at_fill, fuel_station, invoice_no, notes, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW())
         RETURNING *`,
        [
          id, branchId, input.vehicle_id,
          input.driver_partner_id ?? null,
          input.expense_id ?? null,
          input.fuel_date,
          input.quantity_litres,
          input.rate_per_litre,
          input.fuel_amount,
          input.odometer_at_fill ?? null,
          input.fuel_station ?? null,
          input.invoice_no ?? null,
          input.notes ?? null,
          createdBy,
        ]
      );
      return { success: true, data: res.rows[0] };
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message };
    }
  }

  static async update(id: string, input: FuelUpdateInput, branchId: string): Promise<{ success: boolean; data?: FleetFuelRow; error?: string }> {
    try {
      const existing = await FleetFuelRepository.findById(id, branchId);
      if (!existing.success || !existing.data) return { success: false, error: "Fuel record not found or access denied." };

      // Re-validate amount if any component changed
      const qty = input.quantity_litres ?? Number(existing.data.quantity_litres);
      const rate = input.rate_per_litre ?? Number(existing.data.rate_per_litre);
      const amount = input.fuel_amount ?? Number(existing.data.fuel_amount);
      const expected = +(qty * rate).toFixed(2);
      if (Math.abs(expected - amount) > 0.5) {
        return { success: false, error: `Fuel amount mismatch: ${qty}L × ₹${rate}/L = ₹${expected} but supplied ₹${amount}.` };
      }

      const sets: string[] = [];
      const params: unknown[] = [];
      let pIdx = 1;

      if (input.quantity_litres !== undefined) { sets.push(`quantity_litres = $${pIdx++}`); params.push(input.quantity_litres); }
      if (input.rate_per_litre !== undefined)  { sets.push(`rate_per_litre = $${pIdx++}`);  params.push(input.rate_per_litre); }
      if (input.fuel_amount !== undefined)     { sets.push(`fuel_amount = $${pIdx++}`);     params.push(input.fuel_amount); }
      if (input.odometer_at_fill !== undefined){ sets.push(`odometer_at_fill = $${pIdx++}`);params.push(input.odometer_at_fill); }
      if (input.fuel_station !== undefined)    { sets.push(`fuel_station = $${pIdx++}`);    params.push(input.fuel_station); }
      if (input.invoice_no !== undefined)      { sets.push(`invoice_no = $${pIdx++}`);      params.push(input.invoice_no); }
      if (input.notes !== undefined)           { sets.push(`notes = $${pIdx++}`);           params.push(input.notes); }
      if (sets.length === 0) return { success: false, error: "No fields to update." };
      sets.push("updated_at = NOW()");

      params.push(id, branchId);
      const res = await dbQuery(
        `UPDATE public.fleet_fuel SET ${sets.join(", ")} WHERE id = $${pIdx} AND branch_id = $${pIdx + 1} AND deleted_at IS NULL RETURNING *`,
        params
      );
      if (res.rows.length === 0) return { success: false, error: "Fuel record not found." };
      return { success: true, data: res.rows[0] };
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message };
    }
  }

  static async softDelete(id: string, branchId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await dbQuery(
        "UPDATE public.fleet_fuel SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND branch_id = $2 AND deleted_at IS NULL",
        [id, branchId]
      );
      if (res.rowCount === 0) return { success: false, error: "Fuel record not found or access denied." };
      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message };
    }
  }
}
