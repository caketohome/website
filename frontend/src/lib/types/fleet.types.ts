/**
 * CakeToHome ERP — Fleet / Delivery Cost Types (Phase 3)
 *
 * Boundaries:
 * - No accounting entries
 * - No cake inventory changes
 * - No fabricated metrics (null/unavailable when data missing)
 * - No pincode-based scope
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type VehicleType = "BIKE" | "SCOOTER" | "VAN" | "TRUCK" | "OTHER";
export type OwnershipType = "OWN" | "LEASED" | "RENTAL";
export type TripPurpose = "DELIVERY" | "PICKUP" | "MAINTENANCE" | "OTHER";

// ─── Vehicle ──────────────────────────────────────────────────────────────────

export interface VehicleRow {
  id: string;
  branch_id: string;
  registration_no: string;
  vehicle_type: VehicleType;
  make_model: string | null;
  year: number | null;
  is_active: boolean;
  current_odometer: string; // NUMERIC returned as string
  ownership_type: OwnershipType;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // joined
  branch_name?: string;
}

export interface VehicleCreateInput {
  branch_id?: string; // resolved from session for branch managers
  registration_no: string;
  vehicle_type: VehicleType;
  make_model?: string | null;
  year?: number | null;
  is_active?: boolean;
  current_odometer?: number;
  ownership_type?: OwnershipType;
  notes?: string | null;
}

export interface VehicleUpdateInput {
  registration_no?: string;
  vehicle_type?: VehicleType;
  make_model?: string | null;
  year?: number | null;
  is_active?: boolean;
  current_odometer?: number;
  ownership_type?: OwnershipType;
  notes?: string | null;
}

export interface VehicleListFilters {
  branch_id?: string;
  is_active?: boolean;
  vehicle_type?: VehicleType;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface VehicleListResult {
  vehicles: VehicleRow[];
  total: number;
  success: boolean;
  error?: string;
}

// ─── Driver (delivery_partner + driver_profile join) ─────────────────────────

export interface FleetDriverRow {
  partner_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  branch_id: string | null;
  license_number: string | null;
  vehicle_type: string | null;
  vehicle_number: string | null;
  is_verified: boolean | null;
  created_at: string;
  // computed from delivery_delivery_partner
  assigned_deliveries?: number;
}

// ─── Vehicle Trip ─────────────────────────────────────────────────────────────

export interface VehicleTripRow {
  id: string;
  branch_id: string;
  vehicle_id: string;
  driver_partner_id: string | null;
  delivery_id: string | null;
  trip_date: string;
  start_odometer: string;
  end_odometer: string | null;
  distance_km: string | null;
  purpose: TripPurpose;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  registration_no?: string;
  driver_name?: string;
}

export interface TripCreateInput {
  branch_id?: string;
  vehicle_id: string;
  driver_partner_id?: string | null;
  delivery_id?: string | null;
  trip_date: string;
  start_odometer: number;
  end_odometer?: number | null;
  purpose?: TripPurpose;
  notes?: string | null;
}

export interface TripUpdateInput {
  end_odometer?: number | null;
  distance_km?: number | null;
  driver_partner_id?: string | null;
  delivery_id?: string | null;
  purpose?: TripPurpose;
  notes?: string | null;
}

export interface TripListFilters {
  branch_id?: string;
  vehicle_id?: string;
  driver_partner_id?: string;
  startDate?: string;
  endDate?: string;
  purpose?: TripPurpose;
  limit?: number;
  offset?: number;
}

export interface TripListResult {
  trips: VehicleTripRow[];
  total: number;
  success: boolean;
  error?: string;
}

// ─── Fleet Fuel ───────────────────────────────────────────────────────────────

export interface FleetFuelRow {
  id: string;
  branch_id: string;
  vehicle_id: string;
  driver_partner_id: string | null;
  expense_id: string | null;
  fuel_date: string;
  quantity_litres: string;
  rate_per_litre: string;
  fuel_amount: string;
  odometer_at_fill: string | null;
  fuel_station: string | null;
  invoice_no: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // joined
  registration_no?: string;
  driver_name?: string;
}

export interface FuelCreateInput {
  branch_id?: string;
  vehicle_id: string;
  driver_partner_id?: string | null;
  expense_id?: string | null;
  fuel_date: string;
  quantity_litres: number;
  rate_per_litre: number;
  fuel_amount: number;
  odometer_at_fill?: number | null;
  fuel_station?: string | null;
  invoice_no?: string | null;
  notes?: string | null;
}

export interface FuelUpdateInput {
  quantity_litres?: number;
  rate_per_litre?: number;
  fuel_amount?: number;
  odometer_at_fill?: number | null;
  fuel_station?: string | null;
  invoice_no?: string | null;
  notes?: string | null;
}

export interface FuelListFilters {
  branch_id?: string;
  vehicle_id?: string;
  driver_partner_id?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface FuelListResult {
  fuel_records: FleetFuelRow[];
  total: number;
  success: boolean;
  error?: string;
}

// ─── Report Filters ───────────────────────────────────────────────────────────

export interface FleetReportFilters {
  branch_id?: string;
  vehicle_id?: string;
  driver_partner_id?: string;
  startDate?: string;
  endDate?: string;
}

// ─── Report Row Types ─────────────────────────────────────────────────────────

export interface DeliveryReportRow {
  delivery_id: string;
  delivery_status: string;
  delivery_date: string | null;
  scheduled_delivery_at: string | null;
  delivered_at: string | null;
  driver_name: string | null;
  recipient_name: string | null;
  recipient_address: string | null;
}

export interface DriverReportRow {
  partner_id: string;
  driver_name: string;
  branch_id: string | null;
  assigned_deliveries: number;
  completed_deliveries: number;
  failed_deliveries: number;
  cancelled_deliveries: number;
  // null when timestamps absent
  avg_duration_minutes: number | null;
}

export interface VehicleReportRow {
  vehicle_id: string;
  registration_no: string;
  vehicle_type: string;
  branch_id: string;
  total_trips: number;
  total_km: string | null;      // null if no closed trips
  total_fuel_litres: string | null;
  total_fuel_cost: string | null;
}

export interface KmReportRow {
  trip_date: string;
  vehicle_id: string;
  registration_no: string;
  driver_name: string | null;
  distance_km: string | null;
  purpose: string;
}

export interface FuelReportRow {
  fuel_date: string;
  vehicle_id: string;
  registration_no: string;
  driver_name: string | null;
  quantity_litres: string;
  rate_per_litre: string;
  fuel_amount: string;
  fuel_station: string | null;
}

export interface FuelEfficiencyRow {
  vehicle_id: string;
  registration_no: string;
  period_km: string | null;
  period_litres: string | null;
  km_per_litre: string | null;  // null if either missing
}

export interface CostPerKmRow {
  vehicle_id: string;
  registration_no: string;
  period_km: string | null;
  period_fuel_cost: string | null;
  cost_per_km: string | null;   // null if either missing
}

export interface DriverPerformanceRow {
  partner_id: string;
  driver_name: string;
  assigned_deliveries: number;
  completed_deliveries: number;
  failed_deliveries: number;
  cancelled_deliveries: number;
  total_km: string | null;
  total_trips: number;
  // NOT fabricated: no rating, no score, no percentage
}

export interface DeliveryExceptionRow {
  delivery_id: string;
  delivery_status: string;
  exception_type: string;  // FAILED | CANCELLED | UNASSIGNED | NO_DRIVER
  delivery_date: string | null;
  driver_name: string | null;
  recipient_name: string | null;
  recipient_address: string | null;
}
