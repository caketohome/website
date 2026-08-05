export interface BranchDTOv1 {
  id: string;
  name: string;
  code: string;
  address: {
    street: string;
    locality: string;
    city: string;
    pincode: string;
  };
  contactPhone: string;
  managerName: string;
  operatingHours: string;
  servicedPincodes: string[];
  isActive: boolean;
  isCentralKitchen: boolean;
  createdAt: string;
}

export type BranchDTO = BranchDTOv1;

export interface BranchSearchQuery {
  pincode?: string;
  city?: string;
  isActive?: boolean;
}
