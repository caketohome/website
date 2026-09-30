/**
 * CakeToHome ERP — Fleet Service (Phase 3)
 * Business logic and branch-isolation enforcement for Fleet / Delivery Cost.
 *
 * Rules:
 * - branchId ALWAYS resolved from session (never client body for non-superadmin)
 * - Derived distance: distance_km = end_odometer - start_odometer
 * - Server validates fuel amounts: qty × rate ≈ amount (±₹0.50)
 * - No accounting journal entries
 * - No cake inventory changes
 * - No fabricated metrics (null when data missing)
 * - Returns database-backed data only
 */

import { VehicleRepository } from "../repositories/vehicle.repository";
import { VehicleTripRepository } from "../repositories/vehicle-trip.repository";
import { FleetFuelRepository } from "../repositories/fleet-fuel.repository";
import { FleetReportRepository } from "../repositories/fleet-report.repository";
import { dbQuery } from "../db";
import type {
  VehicleRow,
  VehicleCreateInput,
  VehicleUpdateInput,
  VehicleListFilters,
  VehicleListResult,
  VehicleTripRow,
  TripCreateInput,
  TripUpdateInput,
  TripListFilters,
  TripListResult,
  FleetFuelRow,
  FuelCreateInput,
  FuelUpdateInput,
  FuelListFilters,
  FuelListResult,
  FleetDriverRow,
  FleetReportFilters,
  DeliveryReportRow,
  DriverReportRow,
  VehicleReportRow,
  KmReportRow,
  FuelReportRow,
  FuelEfficiencyRow,
  CostPerKmRow,
  DriverPerformanceRow,
  DeliveryExceptionRow,
} from "../types/fleet.types";

export interface FleetApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class FleetService {
  // ─── VEHICLES ─────────────────────────────────────────────────────────────

  static async listVehicles(filters: VehicleListFilters): Promise<FleetApiResponse<VehicleListResult>> {
    const result = await VehicleRepository.list(filters);
    return { success: result.success, data: result, error: result.error };
  }

  static async getVehicle(id: string, branchId?: string): Promise<FleetApiResponse<VehicleRow>> {
    return VehicleRepository.findById(id, branchId);
  }

  static async createVehicle(
    input: VehicleCreateInput,
    branchId: string,
    createdBy: string
  ): Promise<FleetApiResponse<VehicleRow>> {
    if (!branchId) return { success: false, error: "Branch context is required." };
    if (!input.registration_no?.trim()) return { success: false, error: "Registration number is required." };
    if (input.current_odometer !== undefined && Number(input.current_odometer) < 0) {
      return { success: false, error: "Current odometer cannot be negative." };
    }
    return VehicleRepository.create(input, branchId, createdBy);
  }

  static async updateVehicle(
    id: string,
    input: VehicleUpdateInput,
    branchId: string
  ): Promise<FleetApiResponse<VehicleRow>> {
    if (!branchId) return { success: false, error: "Branch context is required." };
    if (input.current_odometer !== undefined && Number(input.current_odometer) < 0) {
      return { success: false, error: "Current odometer cannot be negative." };
    }
    return VehicleRepository.update(id, input, branchId);
  }

  static async deleteVehicle(id: string, branchId: string): Promise<FleetApiResponse<{ deleted: boolean }>> {
    if (!branchId) return { success: false, error: "Branch context is required." };
    const res = await VehicleRepository.softDelete(id, branchId);
    if (!res.success) return { success: false, error: res.error };
    return { success: true, data: { deleted: true } };
  }

  // ─── TRIPS & ODOMETER ────────────────────────────────────────────────────

  static async listTrips(filters: TripListFilters): Promise<FleetApiResponse<TripListResult>> {
    const result = await VehicleTripRepository.list(filters);
    return { success: result.success, data: result, error: result.error };
  }

  static async getTrip(id: string, branchId?: string): Promise<FleetApiResponse<VehicleTripRow>> {
    return VehicleTripRepository.findById(id, branchId);
  }

  static async createTrip(
    input: TripCreateInput,
    branchId: string,
    createdBy: string
  ): Promise<FleetApiResponse<VehicleTripRow>> {
    if (!branchId) return { success: false, error: "Branch context is required." };
    if (!input.vehicle_id?.trim()) return { success: false, error: "Vehicle is required." };
    if (!input.trip_date) return { success: false, error: "Trip date is required." };
    if (input.start_odometer === undefined || Number(input.start_odometer) < 0) {
      return { success: false, error: "Valid start odometer reading is required." };
    }
    if (input.end_odometer !== undefined && input.end_odometer !== null) {
      if (Number(input.end_odometer) < Number(input.start_odometer)) {
        return {
          success: false,
          error: `End odometer (${input.end_odometer}) cannot be less than start odometer (${input.start_odometer}).`,
        };
      }
    }
    return VehicleTripRepository.create(input, branchId, createdBy);
  }

  static async updateTrip(
    id: string,
    input: TripUpdateInput,
    branchId: string
  ): Promise<FleetApiResponse<VehicleTripRow>> {
    if (!branchId) return { success: false, error: "Branch context is required." };
    return VehicleTripRepository.update(id, input, branchId);
  }

  // ─── FLEET FUEL ───────────────────────────────────────────────────────────

  static async listFuel(filters: FuelListFilters): Promise<FleetApiResponse<FuelListResult>> {
    const result = await FleetFuelRepository.list(filters);
    return { success: result.success, data: result, error: result.error };
  }

  static async getFuel(id: string, branchId?: string): Promise<FleetApiResponse<FleetFuelRow>> {
    return FleetFuelRepository.findById(id, branchId);
  }

  static async createFuel(
    input: FuelCreateInput,
    branchId: string,
    createdBy: string
  ): Promise<FleetApiResponse<FleetFuelRow>> {
    if (!branchId) return { success: false, error: "Branch context is required." };
    if (!input.vehicle_id?.trim()) return { success: false, error: "Vehicle is required." };
    if (!input.fuel_date) return { success: false, error: "Fuel date is required." };
    if (!input.quantity_litres || Number(input.quantity_litres) <= 0) {
      return { success: false, error: "Quantity in litres must be greater than 0." };
    }
    if (!input.rate_per_litre || Number(input.rate_per_litre) <= 0) {
      return { success: false, error: "Rate per litre must be greater than 0." };
    }
    if (!input.fuel_amount || Number(input.fuel_amount) <= 0) {
      return { success: false, error: "Fuel amount must be greater than 0." };
    }

    // Verify rate * qty ≈ amount
    const expected = +(Number(input.quantity_litres) * Number(input.rate_per_litre)).toFixed(2);
    if (Math.abs(expected - Number(input.fuel_amount)) > 0.5) {
      return {
        success: false,
        error: `Fuel amount mismatch: ${input.quantity_litres}L × ₹${input.rate_per_litre}/L = ₹${expected} but entered ₹${input.fuel_amount}.`,
      };
    }

    return FleetFuelRepository.create(input, branchId, createdBy);
  }

  static async updateFuel(
    id: string,
    input: FuelUpdateInput,
    branchId: string
  ): Promise<FleetApiResponse<FleetFuelRow>> {
    if (!branchId) return { success: false, error: "Branch context is required." };
    return FleetFuelRepository.update(id, input, branchId);
  }

  static async deleteFuel(id: string, branchId: string): Promise<FleetApiResponse<{ deleted: boolean }>> {
    if (!branchId) return { success: false, error: "Branch context is required." };
    const res = await FleetFuelRepository.softDelete(id, branchId);
    if (!res.success) return { success: false, error: res.error };
    return { success: true, data: { deleted: true } };
  }

  // ─── DRIVERS (DELIVERY PARTNER READ-ONLY VIEW) ───────────────────────────

  static async listDrivers(branchId?: string): Promise<FleetApiResponse<FleetDriverRow[]>> {
    try {
      const conditions: string[] = ["dp.deleted_at IS NULL"];
      const params: unknown[] = [];
      let pIdx = 1;

      if (branchId) {
        // If driver has branch assigned, match it; otherwise show all if unassigned
        conditions.push(`(prof.branch_id IS NULL OR prof.branch_id = $${pIdx++})`);
        params.push(branchId);
      }

      const where = "WHERE " + conditions.join(" AND ");
      const res = await dbQuery(
        `SELECT
           dp.id AS partner_id,
           dp.first_name,
           dp.last_name,
           dp.phone,
           dp.email,
           prof.branch_id,
           prof.license_number,
           prof.vehicle_type,
           prof.vehicle_number,
           prof.is_verified,
           dp.created_at,
           COUNT(ddp.delivery_id) AS assigned_deliveries
         FROM public.delivery_partner dp
         LEFT JOIN public.driver_profile prof ON prof.partner_id = dp.id AND prof.deleted_at IS NULL
         LEFT JOIN public.delivery_delivery_partner ddp ON ddp.delivery_partner_id = dp.id AND ddp.deleted_at IS NULL
         ${where}
         GROUP BY dp.id, dp.first_name, dp.last_name, dp.phone, dp.email,
                  prof.branch_id, prof.license_number, prof.vehicle_type, prof.vehicle_number, prof.is_verified, dp.created_at
         ORDER BY dp.first_name ASC`,
        params
      );

      const drivers: FleetDriverRow[] = res.rows.map((r: any) => ({
        ...r,
        assigned_deliveries: parseInt(r.assigned_deliveries, 10),
      }));

      return { success: true, data: drivers };
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message };
    }
  }

  // ─── 9 FLEET REPORTS ──────────────────────────────────────────────────────

  static async getDeliveryReport(filters: FleetReportFilters): Promise<FleetApiResponse<DeliveryReportRow[]>> {
    const data = await FleetReportRepository.getDeliveryReport(filters);
    return { success: true, data };
  }

  static async getDriverReport(filters: FleetReportFilters): Promise<FleetApiResponse<DriverReportRow[]>> {
    const data = await FleetReportRepository.getDriverReport(filters);
    return { success: true, data };
  }

  static async getVehicleReport(filters: FleetReportFilters): Promise<FleetApiResponse<VehicleReportRow[]>> {
    const data = await FleetReportRepository.getVehicleReport(filters);
    return { success: true, data };
  }

  static async getKmReport(filters: FleetReportFilters): Promise<FleetApiResponse<KmReportRow[]>> {
    const data = await FleetReportRepository.getKmReport(filters);
    return { success: true, data };
  }

  static async getFuelReport(filters: FleetReportFilters): Promise<FleetApiResponse<FuelReportRow[]>> {
    const data = await FleetReportRepository.getFuelReport(filters);
    return { success: true, data };
  }

  static async getFuelEfficiency(filters: FleetReportFilters): Promise<FleetApiResponse<FuelEfficiencyRow[]>> {
    const data = await FleetReportRepository.getFuelEfficiency(filters);
    return { success: true, data };
  }

  static async getCostPerKm(filters: FleetReportFilters): Promise<FleetApiResponse<CostPerKmRow[]>> {
    const data = await FleetReportRepository.getCostPerKm(filters);
    return { success: true, data };
  }

  static async getDriverPerformance(filters: FleetReportFilters): Promise<FleetApiResponse<DriverPerformanceRow[]>> {
    const data = await FleetReportRepository.getDriverPerformance(filters);
    return { success: true, data };
  }

  static async getDeliveryExceptions(filters: FleetReportFilters): Promise<FleetApiResponse<DeliveryExceptionRow[]>> {
    const data = await FleetReportRepository.getDeliveryExceptions(filters);
    return { success: true, data };
  }
}
