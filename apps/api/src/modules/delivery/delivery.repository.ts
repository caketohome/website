import { DeliveryMapper } from "./delivery.mapper";
import {
  DeliveryZoneDTO,
  CheckServiceabilityInput,
  ServiceabilityResultDTOv1,
  SlotGridDTOv1,
  ReserveSlotInput,
  SlotReservationDTOv1,
  DriverDTOv1,
  DeliveryJobDTOv1,
  CompleteDeliveryInput,
} from "./delivery.types";
import { DELIVERY_CONSTANTS } from "./delivery.constants";
import { BadRequestError, ConflictError, NotFoundError } from "../../core/errors/app-error";

export class DeliveryRepository {
  private prisma: any;

  private inMemoryZones: any[] = [
    {
      id: "zone_kor_01",
      name: "Koramangala & HSR Layout Express Zone",
      code: "ZONE-BLR-SOUTH-01",
      branchId: "br_koramangala_01",
      servicedPincodes: ["560034", "560095", "560047", "560068"],
      baseDeliveryFee: 49.0,
      freeDeliveryThreshold: 500.0,
      estimatedDeliveryMinutes: 45,
      isExpressAvailable: true,
      isActive: true,
    },
    {
      id: "zone_ind_02",
      name: "Indiranagar & Domlur Premium Zone",
      code: "ZONE-BLR-EAST-02",
      branchId: "br_indiranagar_02",
      servicedPincodes: ["560038", "560008", "560075", "560017"],
      baseDeliveryFee: 49.0,
      freeDeliveryThreshold: 500.0,
      estimatedDeliveryMinutes: 45,
      isExpressAvailable: true,
      isActive: true,
    },
  ];

  private inMemorySlotBookings: Map<string, number> = new Map();
  private activeSlotReservations: Map<string, SlotReservationDTOv1> = new Map();

  private inMemoryDrivers: DriverDTOv1[] = [
    {
      id: "dlp_01_fixed",
      name: "Rahul Kumar (Company Rider)",
      phone: "+919876543210",
      employmentType: "FIXED_SALARY",
      vehicleType: "SCOOTER",
      isCompanyVehicle: true,
      assignedBranchId: "br_koramangala_01",
      isOnline: true,
      activeDeliveriesCount: 0,
      walletBalance: 0.0,
      rating: 4.9,
      deliveriesTodayCount: 18,
    },
    {
      id: "dlp_02_gig",
      name: "Vikram Singh (Gig Partner)",
      phone: "+919876543211",
      employmentType: "PER_DELIVERY",
      vehicleType: "BIKE",
      isCompanyVehicle: false,
      assignedBranchId: "br_koramangala_01",
      isOnline: true,
      activeDeliveriesCount: 0,
      walletBalance: 350.0,
      rating: 4.8,
      deliveriesTodayCount: 8,
    },
  ];

  private inMemoryJobs: Map<string, DeliveryJobDTOv1> = new Map();

  constructor(prismaClient?: any) {
    this.prisma = prismaClient;
  }

  async listDeliveryZones(): Promise<DeliveryZoneDTO[]> {
    if (this.prisma) {
      const rawList = await this.prisma.deliveryZone.findMany({ where: { isActive: true } });
      return rawList.map(DeliveryMapper.toDeliveryZoneDTO);
    }
    return this.inMemoryZones.map(DeliveryMapper.toDeliveryZoneDTO);
  }

  async findDeliveryZoneById(id: string): Promise<DeliveryZoneDTO | null> {
    if (this.prisma) {
      const raw = await this.prisma.deliveryZone.findUnique({ where: { id } });
      return raw ? DeliveryMapper.toDeliveryZoneDTO(raw) : null;
    }
    const found = this.inMemoryZones.find((z) => z.id === id || z.code === id);
    return found ? DeliveryMapper.toDeliveryZoneDTO(found) : null;
  }

  async checkServiceability(input: CheckServiceabilityInput): Promise<ServiceabilityResultDTOv1> {
    const zone = this.inMemoryZones.find((z) => z.isActive && (z.servicedPincodes || []).includes(input.pincode));

    if (!zone) {
      return {
        pincode: input.pincode,
        isServiceable: false,
        estimatedMinutes: 0,
        deliveryFee: 0,
        isFreeDelivery: false,
        isExpressAvailable: false,
      };
    }

    const sub = input.subtotal || 0;
    const isFree = sub >= zone.freeDeliveryThreshold;
    let fee = isFree ? 0.0 : zone.baseDeliveryFee;

    if (input.isRain) fee += DELIVERY_CONSTANTS.SURGE_RAIN_FEE;
    if (input.isPeak) fee += DELIVERY_CONSTANTS.SURGE_PEAK_FEE;

    return {
      pincode: input.pincode,
      isServiceable: true,
      assignedBranchId: zone.branchId,
      deliveryZone: DeliveryMapper.toDeliveryZoneDTO(zone),
      estimatedMinutes: zone.estimatedDeliveryMinutes,
      deliveryFee: Number(fee.toFixed(2)),
      isFreeDelivery: isFree,
      isExpressAvailable: zone.isExpressAvailable,
    };
  }

  async getSlotCapacityGrid(branchId: string, date: string): Promise<SlotGridDTOv1> {
    const baseSlots = [
      { slotId: "EXPRESS_45MIN", name: "Express Delivery (45 Mins)", timeWindow: "Next 45 Mins", additionalFee: 50.0, maxCapacity: 5, cutoffTime: "22:30" },
      { slotId: "STANDARD_MORNING", name: "Morning Delivery", timeWindow: "09:00 AM - 12:00 PM", additionalFee: 0.0, maxCapacity: 10, cutoffTime: "08:00" },
      { slotId: "STANDARD_AFTERNOON", name: "Afternoon Delivery", timeWindow: "12:00 PM - 03:00 PM", additionalFee: 0.0, maxCapacity: 10, cutoffTime: "11:00" },
      { slotId: "STANDARD_EVENING", name: "Evening Delivery", timeWindow: "03:00 PM - 06:00 PM", additionalFee: 0.0, maxCapacity: 10, cutoffTime: "14:00" },
      { slotId: "STANDARD_NIGHT", name: "Night Delivery", timeWindow: "06:00 PM - 09:00 PM", additionalFee: 0.0, maxCapacity: 10, cutoffTime: "17:00" },
      { slotId: "MIDNIGHT", name: "Midnight Cake Surprise", timeWindow: "11:15 PM - 12:00 AM", additionalFee: 99.0, maxCapacity: 4, cutoffTime: "21:00" },
    ];

    const slots = baseSlots.map((s) => {
      const key = `${branchId}_${date}_${s.slotId}`;
      const bookedCount = this.inMemorySlotBookings.get(key) || 0;
      const availableCapacity = Math.max(0, s.maxCapacity - bookedCount);
      return {
        ...s,
        slotId: s.slotId as any,
        bookedCount,
        availableCapacity,
        isAvailable: availableCapacity > 0,
      };
    });

    return { branchId, date, slots };
  }

  async reserveSlot(input: ReserveSlotInput): Promise<SlotReservationDTOv1> {
    const key = `${input.branchId}_${input.date}_${input.slotId}`;
    const currentBooked = this.inMemorySlotBookings.get(key) || 0;
    const maxCapacity = input.slotId === "MIDNIGHT" ? 4 : input.slotId === "EXPRESS_45MIN" ? 5 : 10;

    if (currentBooked >= maxCapacity) {
      throw new ConflictError(`Delivery slot '${input.slotId}' for branch '${input.branchId}' on ${input.date} is fully booked (${currentBooked}/${maxCapacity}).`);
    }

    this.inMemorySlotBookings.set(key, currentBooked + 1);

    const reservationId = `slot_res_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const reservation: SlotReservationDTOv1 = {
      reservationId,
      branchId: input.branchId,
      date: input.date,
      slotId: input.slotId,
      expiresAt,
    };

    this.activeSlotReservations.set(reservationId, reservation);
    return reservation;
  }

  async listDrivers(branchId?: string): Promise<DriverDTOv1[]> {
    let list = [...this.inMemoryDrivers];
    if (branchId) list = list.filter((d) => d.assignedBranchId === branchId);
    return list;
  }

  async createDeliveryJob(orderData: { orderId: string; orderNumber: string; branchId: string; street: string; pincode: string }): Promise<DeliveryJobDTOv1> {
    const jobId = `dlv_${Date.now()}`;
    const eligibleDriver = this.inMemoryDrivers.find((d) => d.isOnline && d.assignedBranchId === orderData.branchId);

    const job: DeliveryJobDTOv1 = {
      id: jobId,
      orderId: orderData.orderId,
      orderNumber: orderData.orderNumber,
      branchId: orderData.branchId,
      driverId: eligibleDriver ? eligibleDriver.id : undefined,
      status: eligibleDriver ? "DRIVER_ASSIGNED" : "READY_FOR_DISPATCH",
      deliveryAddress: { street: orderData.street, pincode: orderData.pincode },
      distanceKm: 3.5,
      estimatedMinutes: 45,
      payoutAmount: 75.0,
      createdAt: new Date().toISOString(),
    };

    if (eligibleDriver) {
      eligibleDriver.activeDeliveriesCount += 1;
    }

    this.inMemoryJobs.set(jobId, job);
    return job;
  }

  async completeDelivery(input: CompleteDeliveryInput): Promise<{ job: DeliveryJobDTOv1; driver: DriverDTOv1 }> {
    const job = this.inMemoryJobs.get(input.jobId);
    if (!job) {
      throw new NotFoundError(`Delivery job '${input.jobId}' not found.`);
    }

    const driver = this.inMemoryDrivers.find((d) => d.id === job.driverId) || this.inMemoryDrivers[0];

    job.status = "DELIVERED";
    job.proofOfDelivery = {
      photoUrl: input.photoUrl,
      otpVerified: true,
      completedAt: new Date().toISOString(),
    };

    driver.activeDeliveriesCount = Math.max(0, driver.activeDeliveriesCount - 1);
    driver.deliveriesTodayCount += 1;

    if (driver.employmentType === "PER_DELIVERY") {
      driver.walletBalance += job.payoutAmount;
    }

    return { job, driver };
  }
}
