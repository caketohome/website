import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

/**
 * GET /admin/delivery/partners
 * Returns delivery driver partners filtered by branch, status, or search query.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const branchId = (req.query.branch_id || req.query.branch) as string;

  const drivers = [
    {
      id: "drv_101",
      employee_id: "EMP-DRV-0881",
      name: "Suresh Kumar",
      phone: "+91 98123 45678",
      photo_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
      vehicle: "Refrigerated EV Van (KA-01-EQ-9941)",
      branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
      branch_name: "Indiranagar Flagship Kitchen",
      status: "available",
      online: true,
      active_deliveries: 1,
      max_capacity: 3,
      distance_km: 1.2,
      rating: 4.9,
    },
    {
      id: "drv_102",
      employee_id: "EMP-DRV-0882",
      name: "Ramesh Patel",
      phone: "+91 98234 56789",
      photo_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200",
      vehicle: "EV Express Scooter (KA-05-EV-4412)",
      branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
      branch_name: "Indiranagar Flagship Kitchen",
      status: "available",
      online: true,
      active_deliveries: 0,
      max_capacity: 3,
      distance_km: 2.1,
      rating: 4.8,
    },
    {
      id: "drv_103",
      employee_id: "EMP-DRV-0883",
      name: "Vignesh M.",
      phone: "+91 98345 67890",
      photo_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200",
      vehicle: "Refrigerated EV Van (KA-02-EQ-3319)",
      branch_id: "res_02KXYMAHGFPRY1G9TZKEVGAGAT",
      branch_name: "Koramangala Gourmet Bakery",
      status: "available",
      online: true,
      active_deliveries: 1,
      max_capacity: 3,
      distance_km: 1.5,
      rating: 4.95,
    },
    {
      id: "drv_104",
      employee_id: "EMP-DRV-0884",
      name: "Deepak Sharma",
      phone: "+91 98456 78901",
      photo_url: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&q=80&w=200",
      vehicle: "Insulated EV Cargo Van (KA-03-EQ-8812)",
      branch_id: "res_03KXYMAHGFPRY1G9TZKEVGAGAT",
      branch_name: "Whitefield Central Kitchen",
      status: "available",
      online: true,
      active_deliveries: 0,
      max_capacity: 3,
      distance_km: 0.8,
      rating: 4.85,
    },
  ];

  const filtered = branchId
    ? drivers.filter((d) => d.branch_id === branchId || d.branch_name.toLowerCase().includes(branchId.toLowerCase()))
    : drivers;

  return res.status(200).json({ partners: filtered, count: filtered.length });
}
