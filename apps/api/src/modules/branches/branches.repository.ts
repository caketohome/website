import { BranchMapper } from "./branches.mapper";
import { BranchDTO, BranchSearchQuery } from "./branches.types";

export class BranchRepository {
  private prisma: any;

  private inMemoryBranches: any[] = [
    {
      id: "br_koramangala_01",
      name: "CakeToHome Central Kitchen & Flagship - Koramangala",
      code: "CTH-KOR-01",
      address: {
        street: "80 Feet Main Road, 4th Block",
        locality: "Koramangala",
        city: "Bengaluru",
        pincode: "560034",
      },
      contactPhone: "+919876543210",
      managerName: "Executive Chef Suresh Nair",
      operatingHours: "07:00 AM - 11:59 PM",
      servicedPincodes: ["560034", "560095", "560047", "560038", "560068"],
      isActive: true,
      isCentralKitchen: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "br_indiranagar_02",
      name: "CakeToHome Gourmet Studio - Indiranagar",
      code: "CTH-IND-02",
      address: {
        street: "100 Feet Road, 12th Main",
        locality: "Indiranagar",
        city: "Bengaluru",
        pincode: "560038",
      },
      contactPhone: "+919876543211",
      managerName: "Pastry Master Ananya Rao",
      operatingHours: "08:00 AM - 11:30 PM",
      servicedPincodes: ["560038", "560008", "560075", "560017"],
      isActive: true,
      isCentralKitchen: false,
      createdAt: "2026-01-05T00:00:00.000Z",
    },
    {
      id: "br_whitefield_03",
      name: "CakeToHome Express Hub - Whitefield ITPL",
      code: "CTH-WHI-03",
      address: {
        street: "Main Road, Near ITPL Gate 2",
        locality: "Whitefield",
        city: "Bengaluru",
        pincode: "560066",
      },
      contactPhone: "+919876543212",
      managerName: "Chef Rajesh Kumar",
      operatingHours: "08:00 AM - 11:00 PM",
      servicedPincodes: ["560066", "560048", "560037", "560067"],
      isActive: true,
      isCentralKitchen: false,
      createdAt: "2026-01-10T00:00:00.000Z",
    },
  ];

  constructor(prismaClient?: any) {
    this.prisma = prismaClient;
  }

  async listBranches(query: BranchSearchQuery): Promise<BranchDTO[]> {
    if (this.prisma) {
      const where: any = {};
      if (query.isActive !== undefined) where.isActive = query.isActive;
      if (query.city) where.city = query.city;
      const rawList = await this.prisma.branch.findMany({ where });
      return rawList.map(BranchMapper.toBranchDTO);
    }

    let filtered = [...this.inMemoryBranches];
    if (query.isActive !== undefined) {
      filtered = filtered.filter((b) => b.isActive === query.isActive);
    }
    if (query.city) {
      const c = query.city.toLowerCase();
      filtered = filtered.filter((b) => b.address.city.toLowerCase().includes(c));
    }
    if (query.pincode) {
      filtered = filtered.filter((b) => (b.servicedPincodes || []).includes(query.pincode));
    }

    return filtered.map(BranchMapper.toBranchDTO);
  }

  async findServiceableBranch(pincode: string): Promise<BranchDTO | null> {
    if (this.prisma) {
      const raw = await this.prisma.branch.findFirst({
        where: { servicedPincodes: { has: pincode }, isActive: true },
      });
      return raw ? BranchMapper.toBranchDTO(raw) : null;
    }

    const found = this.inMemoryBranches.find((b) => b.isActive && (b.servicedPincodes || []).includes(pincode));
    return found ? BranchMapper.toBranchDTO(found) : BranchMapper.toBranchDTO(this.inMemoryBranches[0]);
  }

  async findBranchById(id: string): Promise<BranchDTO | null> {
    if (this.prisma) {
      const raw = await this.prisma.branch.findUnique({ where: { id } });
      return raw ? BranchMapper.toBranchDTO(raw) : null;
    }

    const found = this.inMemoryBranches.find((b) => b.id === id || b.code === id);
    return found ? BranchMapper.toBranchDTO(found) : null;
  }
}
