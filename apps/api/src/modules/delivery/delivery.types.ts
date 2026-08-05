export interface DeliveryZoneDTOv1 {
  id: string;
  name: string;
  code: string;
  branchId: string;
  servicedPincodes: string[];
  baseDeliveryFee: number;
  freeDeliveryThreshold: number;
  estimatedDeliveryMinutes: number;
  isExpressAvailable: boolean;
  isActive: boolean;
}

export type DeliveryZoneDTO = DeliveryZoneDTOv1;

export interface CheckServiceabilityInput {
  pincode: string;
  subtotal?: number;
  isRain?: boolean;
  isPeak?: boolean;
}

export interface ServiceabilityResultDTOv1 {
  pincode: string;
  isServiceable: boolean;
  assignedBranchId?: string;
  deliveryZone?: DeliveryZoneDTOv1;
  estimatedMinutes: number;
  deliveryFee: number;
  isFreeDelivery: boolean;
  isExpressAvailable: boolean;
}

export interface SlotGridItemDTOv1 {
  slotId: "EXPRESS_45MIN" | "STANDARD_MORNING" | "STANDARD_AFTERNOON" | "STANDARD_EVENING" | "STANDARD_NIGHT" | "MIDNIGHT";
  name: string;
  timeWindow: string;
  additionalFee: number;
  maxCapacity: number;
  bookedCount: number;
  availableCapacity: number;
  isAvailable: boolean;
  cutoffTime: string;
}

export interface SlotGridDTOv1 {
  branchId: string;
  date: string;
  slots: SlotGridItemDTOv1[];
}

export interface ReserveSlotInput {
  branchId: string;
  date: string;
  slotId: "EXPRESS_45MIN" | "STANDARD_MORNING" | "STANDARD_AFTERNOON" | "STANDARD_EVENING" | "STANDARD_NIGHT" | "MIDNIGHT";
}

export interface SlotReservationDTOv1 {
  reservationId: string;
  branchId: string;
  date: string;
  slotId: string;
  expiresAt: string;
}

export type RiderEmploymentType = "FIXED_SALARY" | "PER_DELIVERY";

export interface DriverDTOv1 {
  id: string;
  name: string;
  phone: string;
  employmentType: RiderEmploymentType;
  vehicleType: "BIKE" | "SCOOTER" | "VAN";
  isCompanyVehicle: boolean;
  assignedBranchId: string;
  isOnline: boolean;
  activeDeliveriesCount: number;
  walletBalance: number;
  rating: number;
  deliveriesTodayCount: number;
}

export interface DeliveryJobDTOv1 {
  id: string;
  orderId: string;
  orderNumber: string;
  branchId: string;
  driverId?: string;
  status: "READY_FOR_DISPATCH" | "DRIVER_ASSIGNED" | "PICKED_UP" | "EN_ROUTE" | "DELIVERED" | "FAILED";
  deliveryAddress: { street: string; pincode: string };
  distanceKm: number;
  estimatedMinutes: number;
  payoutAmount: number;
  proofOfDelivery?: {
    photoUrl: string;
    otpVerified: boolean;
    completedAt: string;
  };
  createdAt: string;
}

export interface CompleteDeliveryInput {
  jobId: string;
  photoUrl: string;
  otpVerified: boolean;
}
