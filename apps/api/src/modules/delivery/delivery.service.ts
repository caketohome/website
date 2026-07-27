/**
 * CakeToHome Core API - Fleet Delivery & Dual-Model Compensation Engine (Feature 9 Enhanced)
 * Manages Fixed-Salary Company Riders vs Per-Delivery Gig Partners, Configurable Dispatch Rules,
 * Multi-Factor Payout Formulas, Milestone Incentive Engine, Monthly Payroll Generator, and Outbox Events.
 */

import { OutboxPublisherService } from "../../core/events/outbox-publisher.service.ts";

export type RiderEmploymentType = "FIXED_SALARY" | "PER_DELIVERY";

export interface DriverDto {
  id: string;
  name: string;
  phone: string;
  employmentType: RiderEmploymentType;
  vehicleType: "BIKE" | "SCOOTER" | "VAN";
  isCompanyVehicle: boolean;
  vehicleNumber?: string;
  assignedBranchId: string;
  isOnline: boolean;
  activeDeliveriesCount: number;
  walletBalance: string;
  monthlySalary?: string;
  currentGps: { lat: number; lng: number };
  rating: number;
  deliveriesTodayCount: number;
}

export type DeliveryStatus =
  | "READY_FOR_DISPATCH"
  | "DRIVER_ASSIGNED"
  | "DRIVER_ACCEPTED"
  | "PICKED_UP"
  | "EN_ROUTE"
  | "ARRIVED"
  | "DELIVERED"
  | "FAILED_DELIVERY";

export interface ProofOfDeliveryDto {
  photoUrl: string;
  otpVerified: boolean;
  gpsCoordinates: { lat: number; lng: number };
  completedAt: string;
}

export interface PayoutBreakdownDto {
  basePay: string;
  distancePay: string;
  peakBonus: string;
  rainBonus: string;
  totalPayout: string;
}

export interface DeliveryJobDto {
  id: string;
  orderId: string;
  orderNumber: string;
  branchId: string;
  driverId?: string;
  status: DeliveryStatus;
  deliveryAddress: { street: string; pincode: string; lat: number; lng: number };
  distanceKm: number;
  estimatedMinutes: number;
  payoutBreakdown: PayoutBreakdownDto;
  proofOfDelivery?: ProofOfDeliveryDto;
  createdAt: string;
}

export interface MonthlyPayrollStatementDto {
  driverId: string;
  driverName: string;
  month: string;
  baseSalary: string;
  milestoneIncentives: string;
  netPayableSalary: string;
  totalDeliveriesCompleted: number;
}

export class DeliveryService {
  private drivers: Map<string, DriverDto> = new Map();
  private jobs: Map<string, DeliveryJobDto> = new Map();
  private payrollStatements: MonthlyPayrollStatementDto[] = [];

  constructor() {
    const rahul: DriverDto = {
      id: "dlp_01_fixed",
      name: "Rahul Kumar (Fixed)",
      phone: "9876543210",
      employmentType: "FIXED_SALARY",
      vehicleType: "SCOOTER",
      isCompanyVehicle: true,
      vehicleNumber: "KA-01-1234",
      assignedBranchId: "br_koramangala",
      isOnline: true,
      activeDeliveriesCount: 0,
      walletBalance: "0.00",
      monthlySalary: "22000.00",
      currentGps: { lat: 12.9352, lng: 77.6245 },
      rating: 4.9,
      deliveriesTodayCount: 24,
    };

    const vikram: DriverDto = {
      id: "dlp_02_gig",
      name: "Vikram Singh (Gig)",
      phone: "9876543211",
      employmentType: "PER_DELIVERY",
      vehicleType: "BIKE",
      isCompanyVehicle: false,
      vehicleNumber: "KA-05-9988",
      assignedBranchId: "br_koramangala",
      isOnline: true,
      activeDeliveriesCount: 0,
      walletBalance: "240.00",
      currentGps: { lat: 12.9355, lng: 77.6250 },
      rating: 4.8,
      deliveriesTodayCount: 10,
    };

    this.drivers.set(rahul.id, rahul);
    this.drivers.set(vikram.id, vikram);
  }

  async resolvePincodeETA(pincode: string): Promise<{ estimatedMinutes: number; deliveryFee: string }> {
    const isExpressPincode = pincode === "560038" || pincode === "560034";
    return {
      estimatedMinutes: isExpressPincode ? 45 : 60,
      deliveryFee: isExpressPincode ? "49.00" : "79.00",
    };
  }

  async createDeliveryJob(orderData: { orderId: string; orderNumber: string; branchId: string; address: { street: string; pincode: string; lat: number; lng: number }; isRain?: boolean; isPeak?: boolean }): Promise<DeliveryJobDto> {
    const jobId = `dlv_${Date.now()}`;
    const distanceKm = 3.5;

    const basePayNum = 40.0;
    const distancePayNum = distanceKm * 10.0;
    const peakBonusNum = orderData.isPeak ? 20.0 : 0.0;
    const rainBonusNum = orderData.isRain ? 15.0 : 0.0;
    const totalPayoutNum = basePayNum + distancePayNum + peakBonusNum + rainBonusNum;

    const payoutBreakdown: PayoutBreakdownDto = {
      basePay: basePayNum.toFixed(2),
      distancePay: distancePayNum.toFixed(2),
      peakBonus: peakBonusNum.toFixed(2),
      rainBonus: rainBonusNum.toFixed(2),
      totalPayout: totalPayoutNum.toFixed(2),
    };

    const job: DeliveryJobDto = {
      id: jobId,
      orderId: orderData.orderId,
      orderNumber: orderData.orderNumber,
      branchId: orderData.branchId,
      status: "READY_FOR_DISPATCH",
      deliveryAddress: orderData.address,
      distanceKm,
      estimatedMinutes: 45,
      payoutBreakdown,
      createdAt: new Date().toISOString(),
    };

    this.jobs.set(jobId, job);
    return job;
  }

  async autoAssignDriver(jobId: string, preference: "PREFER_COMPANY_RIDERS_FIRST" | "PREFER_GIG_RIDERS_FIRST" = "PREFER_COMPANY_RIDERS_FIRST"): Promise<{ job: DeliveryJobDto; driver: DriverDto; outboxEvent: any }> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error("Delivery job not found");

    let eligibleDrivers = Array.from(this.drivers.values()).filter((d) => d.isOnline && d.assignedBranchId === job.branchId && d.activeDeliveriesCount < 3);

    if (eligibleDrivers.length === 0) {
      throw new Error("No active delivery drivers available for automatic assignment");
    }

    if (preference === "PREFER_COMPANY_RIDERS_FIRST") {
      eligibleDrivers.sort((a, b) => {
        if (a.employmentType === "FIXED_SALARY" && b.employmentType !== "FIXED_SALARY") return -1;
        if (a.employmentType !== "FIXED_SALARY" && b.employmentType === "FIXED_SALARY") return 1;
        return a.activeDeliveriesCount - b.activeDeliveriesCount;
      });
    } else if (preference === "PREFER_GIG_RIDERS_FIRST") {
      eligibleDrivers.sort((a, b) => {
        if (a.employmentType === "PER_DELIVERY" && b.employmentType !== "PER_DELIVERY") return -1;
        if (a.employmentType !== "PER_DELIVERY" && b.employmentType === "PER_DELIVERY") return 1;
        return a.activeDeliveriesCount - b.activeDeliveriesCount;
      });
    } else {
      eligibleDrivers.sort((a, b) => a.activeDeliveriesCount - b.activeDeliveriesCount);
    }

    const assignedDriver = eligibleDrivers[0];
    job.driverId = assignedDriver.id;
    job.status = "DRIVER_ASSIGNED";
    assignedDriver.activeDeliveriesCount += 1;

    const outboxEvent = OutboxPublisherService.createOutboxRecord({
      eventType: "DriverAssigned",
      aggregateId: jobId,
      payload: { jobId, orderId: job.orderId, driverId: assignedDriver.id, employmentType: assignedDriver.employmentType },
    });

    return { job, driver: assignedDriver, outboxEvent };
  }

  async updateDeliveryStatus(jobId: string, status: DeliveryStatus, gpsUpdate?: { lat: number; lng: number }): Promise<{ job: DeliveryJobDto; outboxEvent: any }> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error("Delivery job not found");

    job.status = status;

    if (gpsUpdate && job.driverId) {
      const driver = this.drivers.get(job.driverId);
      if (driver) driver.currentGps = gpsUpdate;
    }

    const outboxEvent = OutboxPublisherService.createOutboxRecord({
      eventType: `DeliveryStatus_${status}`,
      aggregateId: jobId,
      payload: { jobId, orderId: job.orderId, status },
    });

    return { job, outboxEvent };
  }

  async completeDeliveryWithProof(jobId: string, pod: { photoUrl: string; otpVerified: boolean; gps: { lat: number; lng: number } }): Promise<{ job: DeliveryJobDto; driver: DriverDto; outboxEvent: any }> {
    const job = this.jobs.get(jobId);
    if (!job || !job.driverId) throw new Error("Delivery job or assigned driver not found");

    const driver = this.drivers.get(job.driverId)!;

    if (!pod.otpVerified) {
      throw new Error("Customer delivery verification OTP must be verified before completing delivery");
    }

    job.status = "DELIVERED";
    job.proofOfDelivery = {
      photoUrl: pod.photoUrl,
      otpVerified: pod.otpVerified,
      gpsCoordinates: pod.gps,
      completedAt: new Date().toISOString(),
    };

    driver.activeDeliveriesCount = Math.max(0, driver.activeDeliveriesCount - 1);
    driver.deliveriesTodayCount += 1;

    let addedWalletCredit = 0;
    if (driver.employmentType === "PER_DELIVERY") {
      addedWalletCredit = parseFloat(job.payoutBreakdown.totalPayout);
    } else if (driver.employmentType === "FIXED_SALARY" && driver.deliveriesTodayCount >= 25) {
      addedWalletCredit = 10.0;
    }

    const newBal = parseFloat(driver.walletBalance) + addedWalletCredit;
    driver.walletBalance = newBal.toFixed(2);

    const outboxEvent = OutboxPublisherService.createOutboxRecord({
      eventType: "DeliveryCompleted",
      aggregateId: jobId,
      payload: { jobId, orderId: job.orderId, driverId: driver.id, employmentType: driver.employmentType, creditedAmount: addedWalletCredit.toFixed(2) },
    });

    return { job, driver, outboxEvent };
  }

  async generateMonthlyPayroll(driverId: string, monthStr: string = "2026-07"): Promise<MonthlyPayrollStatementDto> {
    const driver = this.drivers.get(driverId);
    if (!driver || driver.employmentType !== "FIXED_SALARY") {
      throw new Error("Monthly payroll generation is only applicable for FIXED_SALARY company riders");
    }

    const baseSalary = driver.monthlySalary || "22000.00";
    const milestoneIncentives = driver.walletBalance;
    const netPayableSalary = (parseFloat(baseSalary) + parseFloat(milestoneIncentives)).toFixed(2);

    const statement: MonthlyPayrollStatementDto = {
      driverId: driver.id,
      driverName: driver.name,
      month: monthStr,
      baseSalary,
      milestoneIncentives,
      netPayableSalary,
      totalDeliveriesCompleted: driver.deliveriesTodayCount,
    };

    this.payrollStatements.push(statement);
    return statement;
  }
}
