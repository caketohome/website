"use client";

/**
 * CakeToHome ERP — Fleet / Delivery Cost Panel (Admin)
 * Phase 3: Vehicle management, manual odometer trip logs, fuel register,
 * drivers overview, and 9 database-backed fleet reports.
 *
 * Rules:
 * - All monetary values formatted properly
 * - Derived distance: distance_km = end_odometer - start_odometer
 * - No fabricated metrics (null displayed as "—")
 * - Session-derived branch isolation via /api/v1/admin/fleet/*
 */

import React, { useState, useEffect, useCallback } from "react";
import type {
  VehicleRow,
  VehicleTripRow,
  FleetFuelRow,
  FleetDriverRow,
  VehicleType,
  OwnershipType,
  TripPurpose,
  VehicleCreateInput,
  TripCreateInput,
  FuelCreateInput,
  DeliveryReportRow,
  DriverReportRow,
  VehicleReportRow,
  KmReportRow,
  FuelReportRow,
  FuelEfficiencyRow,
  CostPerKmRow,
  DriverPerformanceRow,
  DeliveryExceptionRow,
} from "@frontend/lib/types/fleet.types";

type FleetTab = "vehicles" | "trips" | "fuel" | "drivers" | "reports";
type ReportType =
  | "delivery"
  | "driver"
  | "vehicle"
  | "km"
  | "fuel"
  | "fuel-efficiency"
  | "cost-per-km"
  | "driver-performance"
  | "delivery-exceptions";

const VEHICLE_TYPES: VehicleType[] = ["BIKE", "SCOOTER", "VAN", "TRUCK", "OTHER"];
const OWNERSHIP_TYPES: OwnershipType[] = ["OWN", "LEASED", "RENTAL"];
const TRIP_PURPOSES: TripPurpose[] = ["DELIVERY", "PICKUP", "MAINTENANCE", "OTHER"];

export default function FleetPanel() {
  const [tab, setTab] = useState<FleetTab>("vehicles");
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [trips, setTrips] = useState<VehicleTripRow[]>([]);
  const [fuelRecords, setFuelRecords] = useState<FleetFuelRow[]>([]);
  const [drivers, setDrivers] = useState<FleetDriverRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Search & filters
  const [search, setSearch] = useState("");
  const [filterVehicleType, setFilterVehicleType] = useState<string>("");

  // Modals
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showTripModal, setShowTripModal] = useState(false);
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [closingTrip, setClosingTrip] = useState<VehicleTripRow | null>(null);
  const [closeEndOdo, setCloseEndOdo] = useState<string>("");

  // Form states
  const [vehicleForm, setVehicleForm] = useState<Partial<VehicleCreateInput>>({
    registration_no: "",
    vehicle_type: "BIKE",
    make_model: "",
    year: new Date().getFullYear(),
    ownership_type: "OWN",
    current_odometer: 0,
    notes: "",
  });

  const [tripForm, setTripForm] = useState<Partial<TripCreateInput>>({
    vehicle_id: "",
    driver_partner_id: "",
    trip_date: new Date().toISOString().split("T")[0],
    start_odometer: 0,
    end_odometer: null,
    purpose: "DELIVERY",
    notes: "",
  });

  const [fuelForm, setFuelForm] = useState<Partial<FuelCreateInput>>({
    vehicle_id: "",
    driver_partner_id: "",
    fuel_date: new Date().toISOString().split("T")[0],
    quantity_litres: 0,
    rate_per_litre: 0,
    fuel_amount: 0,
    odometer_at_fill: null,
    fuel_station: "",
    invoice_no: "",
    notes: "",
  });

  // Report state
  const [reportType, setReportType] = useState<ReportType>("delivery");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [reportData, setReportData] = useState<any[]>([]);
  const [reportLoading, setReportLoading] = useState(false);

  const showSuccessMsg = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3500); };
  const showErrorMsg = (msg: string) => { setError(msg); setTimeout(() => setError(null), 5000); };

  // ── Loaders ───────────────────────────────────────────────────────────────

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      if (filterVehicleType) p.set("vehicle_type", filterVehicleType);
      p.set("limit", "100");
      const res = await fetch(`/api/v1/admin/fleet/vehicles?${p}`);
      const data = await res.json();
      if (data.success) {
        setVehicles(data.data?.vehicles || []);
      } else {
        showErrorMsg(data.error || "Failed to load vehicles.");
      }
    } catch {
      showErrorMsg("Network error loading vehicles.");
    } finally {
      setLoading(false);
    }
  }, [search, filterVehicleType]);

  const loadTrips = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("limit", "100");
      const res = await fetch(`/api/v1/admin/fleet/trips?${p}`);
      const data = await res.json();
      if (data.success) {
        setTrips(data.data?.trips || []);
      } else {
        showErrorMsg(data.error || "Failed to load trips.");
      }
    } catch {
      showErrorMsg("Network error loading trips.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFuel = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("limit", "100");
      const res = await fetch(`/api/v1/admin/fleet/fuel?${p}`);
      const data = await res.json();
      if (data.success) {
        setFuelRecords(data.data?.fuel_records || []);
      } else {
        showErrorMsg(data.error || "Failed to load fuel records.");
      }
    } catch {
      showErrorMsg("Network error loading fuel records.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDrivers = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/fleet/drivers");
      const data = await res.json();
      if (data.success) {
        setDrivers(data.data || []);
      }
    } catch {}
  }, []);

  const loadReports = useCallback(async () => {
    setReportLoading(true);
    try {
      const p = new URLSearchParams();
      if (reportStartDate) p.set("startDate", reportStartDate);
      if (reportEndDate) p.set("endDate", reportEndDate);
      const res = await fetch(`/api/v1/admin/fleet/reports/${reportType}?${p}`);
      const data = await res.json();
      if (data.success) {
        setReportData(data.data || []);
      } else {
        setReportData([]);
      }
    } catch {
      setReportData([]);
    } finally {
      setReportLoading(false);
    }
  }, [reportType, reportStartDate, reportEndDate]);

  // Initial loads
  useEffect(() => {
    loadDrivers();
    if (tab === "vehicles") loadVehicles();
    else if (tab === "trips") { loadTrips(); loadVehicles(); }
    else if (tab === "fuel") { loadFuel(); loadVehicles(); }
    else if (tab === "drivers") loadDrivers();
    else if (tab === "reports") loadReports();
  }, [tab, loadVehicles, loadTrips, loadFuel, loadDrivers, loadReports]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleForm.registration_no?.trim()) {
      showErrorMsg("Registration number is required.");
      return;
    }
    try {
      const res = await fetch("/api/v1/admin/fleet/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vehicleForm),
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMsg(`Vehicle ${data.data?.registration_no} added.`);
        setShowVehicleModal(false);
        setVehicleForm({
          registration_no: "",
          vehicle_type: "BIKE",
          make_model: "",
          year: new Date().getFullYear(),
          ownership_type: "OWN",
          current_odometer: 0,
          notes: "",
        });
        loadVehicles();
      } else {
        showErrorMsg(data.error || "Failed to create vehicle.");
      }
    } catch {
      showErrorMsg("Network error creating vehicle.");
    }
  };

  const handleDeleteVehicle = async (id: string, reg: string) => {
    if (!confirm(`Are you sure you want to delete vehicle ${reg}?`)) return;
    try {
      const res = await fetch(`/api/v1/admin/fleet/vehicles/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        showSuccessMsg(`Vehicle ${reg} deleted.`);
        loadVehicles();
      } else {
        showErrorMsg(data.error || "Failed to delete vehicle.");
      }
    } catch {
      showErrorMsg("Network error deleting vehicle.");
    }
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripForm.vehicle_id) {
      showErrorMsg("Please select a vehicle.");
      return;
    }
    try {
      const res = await fetch("/api/v1/admin/fleet/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tripForm),
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMsg("Trip logged successfully.");
        setShowTripModal(false);
        setTripForm({
          vehicle_id: "",
          driver_partner_id: "",
          trip_date: new Date().toISOString().split("T")[0],
          start_odometer: 0,
          end_odometer: null,
          purpose: "DELIVERY",
          notes: "",
        });
        loadTrips();
        loadVehicles();
      } else {
        showErrorMsg(data.error || "Failed to log trip.");
      }
    } catch {
      showErrorMsg("Network error logging trip.");
    }
  };

  const handleCloseTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingTrip) return;
    const endOdo = Number(closeEndOdo);
    if (isNaN(endOdo) || endOdo < Number(closingTrip.start_odometer)) {
      showErrorMsg(`End odometer must be >= start odometer (${closingTrip.start_odometer}).`);
      return;
    }
    try {
      const res = await fetch(`/api/v1/admin/fleet/trips/${closingTrip.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ end_odometer: endOdo }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMsg(`Trip closed: ${data.data?.distance_km ?? 0} km recorded.`);
        setClosingTrip(null);
        setCloseEndOdo("");
        loadTrips();
        loadVehicles();
      } else {
        showErrorMsg(data.error || "Failed to close trip.");
      }
    } catch {
      showErrorMsg("Network error closing trip.");
    }
  };

  const handleCreateFuel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fuelForm.vehicle_id) {
      showErrorMsg("Please select a vehicle.");
      return;
    }
    try {
      const res = await fetch("/api/v1/admin/fleet/fuel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fuelForm),
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMsg("Fuel entry saved.");
        setShowFuelModal(false);
        setFuelForm({
          vehicle_id: "",
          driver_partner_id: "",
          fuel_date: new Date().toISOString().split("T")[0],
          quantity_litres: 0,
          rate_per_litre: 0,
          fuel_amount: 0,
          odometer_at_fill: null,
          fuel_station: "",
          invoice_no: "",
          notes: "",
        });
        loadFuel();
      } else {
        showErrorMsg(data.error || "Failed to save fuel entry.");
      }
    } catch {
      showErrorMsg("Network error saving fuel entry.");
    }
  };

  const handleDeleteFuel = async (id: string) => {
    if (!confirm("Are you sure you want to delete this fuel record?")) return;
    try {
      const res = await fetch(`/api/v1/admin/fleet/fuel/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        showSuccessMsg("Fuel record deleted.");
        loadFuel();
      } else {
        showErrorMsg(data.error || "Failed to delete fuel record.");
      }
    } catch {
      showErrorMsg("Network error deleting fuel record.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Fleet & Delivery Logistics</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track branch vehicles, odometer trip logs, fuel consumption, driver operations, and delivery analytics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab === "vehicles" && (
            <button
              onClick={() => setShowVehicleModal(true)}
              className="px-4 py-2 bg-brand-primary hover:bg-brand-navy text-white rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center gap-1.5"
            >
              <span>+</span> Add Vehicle
            </button>
          )}
          {tab === "trips" && (
            <button
              onClick={() => setShowTripModal(true)}
              className="px-4 py-2 bg-brand-primary hover:bg-brand-navy text-white rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center gap-1.5"
            >
              <span>+</span> Log Trip
            </button>
          )}
          {tab === "fuel" && (
            <button
              onClick={() => setShowFuelModal(true)}
              className="px-4 py-2 bg-brand-primary hover:bg-brand-navy text-white rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center gap-1.5"
            >
              <span>+</span> Log Fuel Fill-Up
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-emerald-600 hover:text-emerald-900">×</button>
        </div>
      )}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-900">×</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6">
          {(
            [
              { id: "vehicles", label: "Vehicles" },
              { id: "trips", label: "Trips & Odometer" },
              { id: "fuel", label: "Fuel Register" },
              { id: "drivers", label: "Drivers" },
              { id: "reports", label: "Reports & Analytics" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
                tab === t.id
                  ? "border-brand-primary text-brand-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ─── TAB: VEHICLES ─────────────────────────────────────────────────── */}
      {tab === "vehicles" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search registration, make..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
              <select
                value={filterVehicleType}
                onChange={(e) => setFilterVehicleType(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="">All Types</option>
                {VEHICLE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <span className="text-xs text-gray-500">{vehicles.length} vehicle(s) found</span>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-600 font-semibold">
                <tr>
                  <th className="py-3 px-4 text-left">Registration</th>
                  <th className="py-3 px-4 text-left">Type</th>
                  <th className="py-3 px-4 text-left">Make / Model</th>
                  <th className="py-3 px-4 text-right">Odometer (km)</th>
                  <th className="py-3 px-4 text-center">Ownership</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">Loading vehicles...</td>
                  </tr>
                ) : vehicles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">
                      No vehicles found. Click &quot;Add Vehicle&quot; to register one.
                    </td>
                  </tr>
                ) : (
                  vehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 font-semibold text-gray-900">{v.registration_no}</td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                          {v.vehicle_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{v.make_model || "—"}</td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-gray-800">
                        {Number(v.current_odometer).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center text-xs text-gray-500">{v.ownership_type}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                          v.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                        }`}>
                          {v.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteVehicle(v.id, v.registration_no)}
                          className="text-xs text-rose-600 hover:text-rose-800 transition-colors font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB: TRIPS & ODOMETER ─────────────────────────────────────────── */}
      {tab === "trips" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-600 font-semibold">
                <tr>
                  <th className="py-3 px-4 text-left">Date</th>
                  <th className="py-3 px-4 text-left">Vehicle</th>
                  <th className="py-3 px-4 text-left">Driver</th>
                  <th className="py-3 px-4 text-right">Start Odo</th>
                  <th className="py-3 px-4 text-right">End Odo</th>
                  <th className="py-3 px-4 text-right">Distance (km)</th>
                  <th className="py-3 px-4 text-center">Purpose</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400">Loading trips...</td>
                  </tr>
                ) : trips.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400">
                      No trip records found. Click &quot;Log Trip&quot; to record a vehicle trip.
                    </td>
                  </tr>
                ) : (
                  trips.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 text-gray-700 whitespace-nowrap">{t.trip_date}</td>
                      <td className="py-3 px-4 font-semibold text-gray-900">{t.registration_no || t.vehicle_id}</td>
                      <td className="py-3 px-4 text-gray-600">{t.driver_name || "—"}</td>
                      <td className="py-3 px-4 text-right font-mono text-gray-700">{t.start_odometer}</td>
                      <td className="py-3 px-4 text-right font-mono text-gray-700">{t.end_odometer ?? "—"}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                        {t.distance_km !== null ? `${t.distance_km} km` : "In Progress"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                          {t.purpose}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {t.end_odometer === null && (
                          <button
                            onClick={() => {
                              setClosingTrip(t);
                              setCloseEndOdo(String(t.start_odometer));
                            }}
                            className="text-xs px-2.5 py-1 bg-brand-light text-brand-primary hover:bg-brand-light rounded-md font-medium transition-colors"
                          >
                            Close Trip
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB: FUEL REGISTER ────────────────────────────────────────────── */}
      {tab === "fuel" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-600 font-semibold">
                <tr>
                  <th className="py-3 px-4 text-left">Date</th>
                  <th className="py-3 px-4 text-left">Vehicle</th>
                  <th className="py-3 px-4 text-left">Driver</th>
                  <th className="py-3 px-4 text-right">Quantity (L)</th>
                  <th className="py-3 px-4 text-right">Rate (₹/L)</th>
                  <th className="py-3 px-4 text-right">Total Amount (₹)</th>
                  <th className="py-3 px-4 text-left">Station / Pump</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400">Loading fuel records...</td>
                  </tr>
                ) : fuelRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400">
                      No fuel fill-ups recorded. Click &quot;Log Fuel Fill-Up&quot; to add one.
                    </td>
                  </tr>
                ) : (
                  fuelRecords.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 text-gray-700 whitespace-nowrap">{f.fuel_date}</td>
                      <td className="py-3 px-4 font-semibold text-gray-900">{f.registration_no || f.vehicle_id}</td>
                      <td className="py-3 px-4 text-gray-600">{f.driver_name || "—"}</td>
                      <td className="py-3 px-4 text-right font-mono text-gray-700">{Number(f.quantity_litres).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-mono text-gray-700">₹{Number(f.rate_per_litre).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                        ₹{Number(f.fuel_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{f.fuel_station || "—"}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteFuel(f.id)}
                          className="text-xs text-rose-600 hover:text-rose-800 transition-colors font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB: DRIVERS ──────────────────────────────────────────────────── */}
      {tab === "drivers" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-600 font-semibold">
                <tr>
                  <th className="py-3 px-4 text-left">Driver Name</th>
                  <th className="py-3 px-4 text-left">Phone</th>
                  <th className="py-3 px-4 text-left">Email</th>
                  <th className="py-3 px-4 text-left">License No</th>
                  <th className="py-3 px-4 text-left">Vehicle Info</th>
                  <th className="py-3 px-4 text-right">Deliveries Assigned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {drivers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">
                      No delivery partner records found.
                    </td>
                  </tr>
                ) : (
                  drivers.map((d) => (
                    <tr key={d.partner_id} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {d.first_name} {d.last_name}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{d.phone || "—"}</td>
                      <td className="py-3 px-4 text-gray-600">{d.email || "—"}</td>
                      <td className="py-3 px-4 text-gray-600 font-mono">{d.license_number || "—"}</td>
                      <td className="py-3 px-4 text-gray-600">
                        {d.vehicle_type ? `${d.vehicle_type} (${d.vehicle_number || "—"})` : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-gray-800">
                        {d.assigned_deliveries ?? 0}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB: REPORTS & ANALYTICS ──────────────────────────────────────── */}
      {tab === "reports" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 border border-gray-200 rounded-xl">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-semibold text-gray-500 uppercase">Report:</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white font-medium focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="delivery">1. Delivery Report</option>
                <option value="driver">2. Driver Report</option>
                <option value="vehicle">3. Vehicle Summary</option>
                <option value="km">4. KM Distance Log</option>
                <option value="fuel">5. Fuel Fill-Up Register</option>
                <option value="fuel-efficiency">6. Fuel Efficiency (km/L)</option>
                <option value="cost-per-km">7. Cost per KM (₹/km)</option>
                <option value="driver-performance">8. Driver Performance</option>
                <option value="delivery-exceptions">9. Delivery Exceptions</option>
              </select>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="px-2.5 py-1 border border-gray-300 rounded-lg text-xs"
                />
                <span className="text-gray-400 text-xs">to</span>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="px-2.5 py-1 border border-gray-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <button
              onClick={loadReports}
              disabled={reportLoading}
              className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors"
            >
              {reportLoading ? "Loading..." : "Refresh"}
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {reportLoading ? (
              <div className="py-12 text-center text-gray-400">Querying database reports...</div>
            ) : reportData.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                No report data recorded for the selected criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                {/* 1. Delivery Report */}
                {reportType === "delivery" && (
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-gray-600 font-semibold">
                      <tr>
                        <th className="py-3 px-4 text-left">Delivery ID</th>
                        <th className="py-3 px-4 text-left">Status</th>
                        <th className="py-3 px-4 text-left">Driver</th>
                        <th className="py-3 px-4 text-left">Recipient</th>
                        <th className="py-3 px-4 text-left">Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {reportData.map((r: DeliveryReportRow) => (
                        <tr key={r.delivery_id}>
                          <td className="py-3 px-4 font-mono text-xs">{r.delivery_id}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                              {r.delivery_status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-700">{r.driver_name || "—"}</td>
                          <td className="py-3 px-4 text-gray-700">{r.recipient_name || "—"}</td>
                          <td className="py-3 px-4 text-gray-500 text-xs">{r.recipient_address || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 2. Driver Report */}
                {reportType === "driver" && (
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-gray-600 font-semibold">
                      <tr>
                        <th className="py-3 px-4 text-left">Driver</th>
                        <th className="py-3 px-4 text-right">Assigned</th>
                        <th className="py-3 px-4 text-right">Completed</th>
                        <th className="py-3 px-4 text-right">Failed</th>
                        <th className="py-3 px-4 text-right">Cancelled</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {reportData.map((r: DriverReportRow) => (
                        <tr key={r.partner_id}>
                          <td className="py-3 px-4 font-semibold text-gray-900">{r.driver_name}</td>
                          <td className="py-3 px-4 text-right font-mono">{r.assigned_deliveries}</td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-600 font-medium">{r.completed_deliveries}</td>
                          <td className="py-3 px-4 text-right font-mono text-rose-600 font-medium">{r.failed_deliveries}</td>
                          <td className="py-3 px-4 text-right font-mono text-gray-500">{r.cancelled_deliveries}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 3. Vehicle Report */}
                {reportType === "vehicle" && (
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-gray-600 font-semibold">
                      <tr>
                        <th className="py-3 px-4 text-left">Registration</th>
                        <th className="py-3 px-4 text-left">Type</th>
                        <th className="py-3 px-4 text-right">Total Trips</th>
                        <th className="py-3 px-4 text-right">Total KM</th>
                        <th className="py-3 px-4 text-right">Fuel Litres</th>
                        <th className="py-3 px-4 text-right">Fuel Cost (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {reportData.map((r: VehicleReportRow) => (
                        <tr key={r.vehicle_id}>
                          <td className="py-3 px-4 font-semibold text-gray-900">{r.registration_no}</td>
                          <td className="py-3 px-4 text-gray-600">{r.vehicle_type}</td>
                          <td className="py-3 px-4 text-right font-mono">{r.total_trips}</td>
                          <td className="py-3 px-4 text-right font-mono">{r.total_km ? `${r.total_km} km` : "—"}</td>
                          <td className="py-3 px-4 text-right font-mono">{r.total_fuel_litres ? `${r.total_fuel_litres} L` : "—"}</td>
                          <td className="py-3 px-4 text-right font-mono font-medium text-gray-900">
                            {r.total_fuel_cost ? `₹${Number(r.total_fuel_cost).toFixed(2)}` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 4. KM Distance Log */}
                {reportType === "km" && (
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-gray-600 font-semibold">
                      <tr>
                        <th className="py-3 px-4 text-left">Date</th>
                        <th className="py-3 px-4 text-left">Vehicle</th>
                        <th className="py-3 px-4 text-left">Driver</th>
                        <th className="py-3 px-4 text-right">Distance (km)</th>
                        <th className="py-3 px-4 text-left">Purpose</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {reportData.map((r: KmReportRow, idx: number) => (
                        <tr key={idx}>
                          <td className="py-3 px-4 text-gray-700">{r.trip_date}</td>
                          <td className="py-3 px-4 font-semibold text-gray-900">{r.registration_no}</td>
                          <td className="py-3 px-4 text-gray-600">{r.driver_name || "—"}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                            {r.distance_km !== null ? `${r.distance_km} km` : "—"}
                          </td>
                          <td className="py-3 px-4 text-gray-600">{r.purpose}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 5. Fuel Report */}
                {reportType === "fuel" && (
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-gray-600 font-semibold">
                      <tr>
                        <th className="py-3 px-4 text-left">Date</th>
                        <th className="py-3 px-4 text-left">Vehicle</th>
                        <th className="py-3 px-4 text-left">Driver</th>
                        <th className="py-3 px-4 text-right">Litres</th>
                        <th className="py-3 px-4 text-right">Rate</th>
                        <th className="py-3 px-4 text-right">Amount (₹)</th>
                        <th className="py-3 px-4 text-left">Station</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {reportData.map((r: FuelReportRow, idx: number) => (
                        <tr key={idx}>
                          <td className="py-3 px-4 text-gray-700">{r.fuel_date}</td>
                          <td className="py-3 px-4 font-semibold text-gray-900">{r.registration_no}</td>
                          <td className="py-3 px-4 text-gray-600">{r.driver_name || "—"}</td>
                          <td className="py-3 px-4 text-right font-mono">{r.quantity_litres}</td>
                          <td className="py-3 px-4 text-right font-mono">₹{r.rate_per_litre}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                            ₹{Number(r.fuel_amount).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-gray-600">{r.fuel_station || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 6. Fuel Efficiency */}
                {reportType === "fuel-efficiency" && (
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-gray-600 font-semibold">
                      <tr>
                        <th className="py-3 px-4 text-left">Vehicle</th>
                        <th className="py-3 px-4 text-right">Distance Recorded (km)</th>
                        <th className="py-3 px-4 text-right">Fuel Consumed (L)</th>
                        <th className="py-3 px-4 text-right">Efficiency (km/L)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {reportData.map((r: FuelEfficiencyRow) => (
                        <tr key={r.vehicle_id}>
                          <td className="py-3 px-4 font-semibold text-gray-900">{r.registration_no}</td>
                          <td className="py-3 px-4 text-right font-mono">{r.period_km ? `${r.period_km} km` : "—"}</td>
                          <td className="py-3 px-4 text-right font-mono">{r.period_litres ? `${r.period_litres} L` : "—"}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                            {r.km_per_litre ? `${r.km_per_litre} km/L` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 7. Cost Per KM */}
                {reportType === "cost-per-km" && (
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-gray-600 font-semibold">
                      <tr>
                        <th className="py-3 px-4 text-left">Vehicle</th>
                        <th className="py-3 px-4 text-right">Distance (km)</th>
                        <th className="py-3 px-4 text-right">Fuel Cost (₹)</th>
                        <th className="py-3 px-4 text-right">Cost Per KM (₹/km)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {reportData.map((r: CostPerKmRow) => (
                        <tr key={r.vehicle_id}>
                          <td className="py-3 px-4 font-semibold text-gray-900">{r.registration_no}</td>
                          <td className="py-3 px-4 text-right font-mono">{r.period_km ? `${r.period_km} km` : "—"}</td>
                          <td className="py-3 px-4 text-right font-mono">
                            {r.period_fuel_cost ? `₹${Number(r.period_fuel_cost).toFixed(2)}` : "—"}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                            {r.cost_per_km ? `₹${r.cost_per_km}/km` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 8. Driver Performance */}
                {reportType === "driver-performance" && (
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-gray-600 font-semibold">
                      <tr>
                        <th className="py-3 px-4 text-left">Driver</th>
                        <th className="py-3 px-4 text-right">Assigned</th>
                        <th className="py-3 px-4 text-right">Completed</th>
                        <th className="py-3 px-4 text-right">Failed</th>
                        <th className="py-3 px-4 text-right">Total Trips</th>
                        <th className="py-3 px-4 text-right">Total KM</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {reportData.map((r: DriverPerformanceRow) => (
                        <tr key={r.partner_id}>
                          <td className="py-3 px-4 font-semibold text-gray-900">{r.driver_name}</td>
                          <td className="py-3 px-4 text-right font-mono">{r.assigned_deliveries}</td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-600 font-medium">{r.completed_deliveries}</td>
                          <td className="py-3 px-4 text-right font-mono text-rose-600 font-medium">{r.failed_deliveries}</td>
                          <td className="py-3 px-4 text-right font-mono">{r.total_trips}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                            {r.total_km ? `${r.total_km} km` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 9. Delivery Exceptions */}
                {reportType === "delivery-exceptions" && (
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-gray-600 font-semibold">
                      <tr>
                        <th className="py-3 px-4 text-left">Delivery ID</th>
                        <th className="py-3 px-4 text-left">Exception Type</th>
                        <th className="py-3 px-4 text-left">Delivery Status</th>
                        <th className="py-3 px-4 text-left">Driver</th>
                        <th className="py-3 px-4 text-left">Recipient</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {reportData.map((r: DeliveryExceptionRow) => (
                        <tr key={r.delivery_id}>
                          <td className="py-3 px-4 font-mono text-xs">{r.delivery_id}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-100 text-rose-800">
                              {r.exception_type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-600">{r.delivery_status}</td>
                          <td className="py-3 px-4 text-gray-700">{r.driver_name || "—"}</td>
                          <td className="py-3 px-4 text-gray-700">{r.recipient_name || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD VEHICLE ────────────────────────────────────────────── */}
      {showVehicleModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Add Vehicle</h3>
              <button onClick={() => setShowVehicleModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleCreateVehicle} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Registration No *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MH12AB1234"
                  value={vehicleForm.registration_no}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, registration_no: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase focus:ring-1 focus:ring-brand-primary focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Vehicle Type</label>
                  <select
                    value={vehicleForm.vehicle_type}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_type: e.target.value as VehicleType })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-1 focus:ring-brand-primary focus:outline-none"
                  >
                    {VEHICLE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ownership</label>
                  <select
                    value={vehicleForm.ownership_type}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, ownership_type: e.target.value as OwnershipType })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-1 focus:ring-brand-primary focus:outline-none"
                  >
                    {OWNERSHIP_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Make / Model</label>
                  <input
                    type="text"
                    placeholder="e.g. Honda Activa"
                    value={vehicleForm.make_model ?? ""}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, make_model: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-brand-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Current Odometer (km)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={vehicleForm.current_odometer}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, current_odometer: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-1 focus:ring-brand-primary focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional remarks..."
                  value={vehicleForm.notes ?? ""}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-brand-primary focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVehicleModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-primary hover:bg-brand-navy text-white rounded-lg text-sm font-medium"
                >
                  Save Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: LOG TRIP ──────────────────────────────────────────────── */}
      {showTripModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Log Vehicle Trip</h3>
              <button onClick={() => setShowTripModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleCreateTrip} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Vehicle *</label>
                <select
                  required
                  value={tripForm.vehicle_id}
                  onChange={(e) => {
                    const selVeh = vehicles.find((v) => v.id === e.target.value);
                    setTripForm({
                      ...tripForm,
                      vehicle_id: e.target.value,
                      start_odometer: selVeh ? Number(selVeh.current_odometer) : 0,
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-1 focus:ring-brand-primary focus:outline-none"
                >
                  <option value="">Select vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.registration_no} ({v.vehicle_type}) — Odo: {v.current_odometer}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Driver</label>
                <select
                  value={tripForm.driver_partner_id ?? ""}
                  onChange={(e) => setTripForm({ ...tripForm, driver_partner_id: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-1 focus:ring-brand-primary focus:outline-none"
                >
                  <option value="">Select driver (optional)</option>
                  {drivers.map((d) => (
                    <option key={d.partner_id} value={d.partner_id}>
                      {d.first_name} {d.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Trip Date *</label>
                  <input
                    type="date"
                    required
                    value={tripForm.trip_date}
                    onChange={(e) => setTripForm({ ...tripForm, trip_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-brand-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Purpose</label>
                  <select
                    value={tripForm.purpose}
                    onChange={(e) => setTripForm({ ...tripForm, purpose: e.target.value as TripPurpose })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-1 focus:ring-brand-primary focus:outline-none"
                  >
                    {TRIP_PURPOSES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start Odometer *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.1"
                    value={tripForm.start_odometer}
                    onChange={(e) => setTripForm({ ...tripForm, start_odometer: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-1 focus:ring-brand-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">End Odometer (optional)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="Leave empty if in progress"
                    value={tripForm.end_odometer ?? ""}
                    onChange={(e) =>
                      setTripForm({
                        ...tripForm,
                        end_odometer: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-1 focus:ring-brand-primary focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTripModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-primary hover:bg-brand-navy text-white rounded-lg text-sm font-medium"
                >
                  Save Trip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: CLOSE TRIP ────────────────────────────────────────────── */}
      {closingTrip && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Close Trip</h3>
              <button onClick={() => setClosingTrip(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleCloseTrip} className="space-y-3">
              <p className="text-xs text-gray-600">
                Recording final odometer reading for <strong>{closingTrip.registration_no || "vehicle"}</strong>.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Start Odometer</label>
                <input
                  type="text"
                  disabled
                  value={closingTrip.start_odometer}
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm font-mono text-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Final End Odometer *</label>
                <input
                  type="number"
                  required
                  min={Number(closingTrip.start_odometer)}
                  step="0.1"
                  value={closeEndOdo}
                  onChange={(e) => setCloseEndOdo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-1 focus:ring-brand-primary focus:outline-none"
                />
              </div>
              {Number(closeEndOdo) >= Number(closingTrip.start_odometer) && (
                <div className="p-2.5 bg-brand-light border border-brand-light rounded-lg text-xs text-brand-navy font-medium">
                  Derived Distance: {(Number(closeEndOdo) - Number(closingTrip.start_odometer)).toFixed(2)} km
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setClosingTrip(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-primary hover:bg-brand-navy text-white rounded-lg text-sm font-medium"
                >
                  Confirm & Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: LOG FUEL ──────────────────────────────────────────────── */}
      {showFuelModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Log Fuel Fill-Up</h3>
              <button onClick={() => setShowFuelModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleCreateFuel} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Vehicle *</label>
                <select
                  required
                  value={fuelForm.vehicle_id}
                  onChange={(e) => setFuelForm({ ...fuelForm, vehicle_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-1 focus:ring-brand-primary focus:outline-none"
                >
                  <option value="">Select vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.registration_no} ({v.vehicle_type})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fuel Date *</label>
                  <input
                    type="date"
                    required
                    value={fuelForm.fuel_date}
                    onChange={(e) => setFuelForm({ ...fuelForm, fuel_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-brand-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Driver</label>
                  <select
                    value={fuelForm.driver_partner_id ?? ""}
                    onChange={(e) => setFuelForm({ ...fuelForm, driver_partner_id: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-1 focus:ring-brand-primary focus:outline-none"
                  >
                    <option value="">Select driver</option>
                    {drivers.map((d) => (
                      <option key={d.partner_id} value={d.partner_id}>{d.first_name} {d.last_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Litres *</label>
                  <input
                    type="number"
                    required
                    min="0.1"
                    step="0.01"
                    value={fuelForm.quantity_litres}
                    onChange={(e) => {
                      const qty = Number(e.target.value);
                      const rate = Number(fuelForm.rate_per_litre ?? 0);
                      setFuelForm({
                        ...fuelForm,
                        quantity_litres: qty,
                        fuel_amount: +(qty * rate).toFixed(2),
                      });
                    }}
                    className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-1 focus:ring-brand-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rate (₹/L) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={fuelForm.rate_per_litre}
                    onChange={(e) => {
                      const rate = Number(e.target.value);
                      const qty = Number(fuelForm.quantity_litres ?? 0);
                      setFuelForm({
                        ...fuelForm,
                        rate_per_litre: rate,
                        fuel_amount: +(qty * rate).toFixed(2),
                      });
                    }}
                    className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-1 focus:ring-brand-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Total (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={fuelForm.fuel_amount}
                    onChange={(e) => setFuelForm({ ...fuelForm, fuel_amount: Number(e.target.value) })}
                    className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm font-mono font-bold text-gray-900 focus:ring-1 focus:ring-brand-primary focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fuel Pump / Station</label>
                  <input
                    type="text"
                    placeholder="e.g. Indian Oil HP"
                    value={fuelForm.fuel_station ?? ""}
                    onChange={(e) => setFuelForm({ ...fuelForm, fuel_station: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-brand-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Odometer at Fill</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="e.g. 12450"
                    value={fuelForm.odometer_at_fill ?? ""}
                    onChange={(e) =>
                      setFuelForm({
                        ...fuelForm,
                        odometer_at_fill: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-1 focus:ring-brand-primary focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFuelModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-primary hover:bg-brand-navy text-white rounded-lg text-sm font-medium"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
