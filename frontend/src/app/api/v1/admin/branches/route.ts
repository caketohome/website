import { NextRequest, NextResponse } from "next/server";
import { ApiEngine } from "@frontend/lib/api-engine";
import { BranchRepository, CityRepository } from "@frontend/lib/repositories";
import { resolveServerSession } from "@frontend/lib/security/auth-session";

export const dynamic = "force-dynamic";

function requireAdmin(req: NextRequest): NextResponse | null {
  const session = resolveServerSession(req);
  if (!session || !session.userId) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED", message: "Authentication required." }, { status: 401 });
  }
  if (session.role !== "SUPER_ADMIN" && session.role !== "BRANCH_MANAGER") {
    return NextResponse.json({ success: false, error: "FORBIDDEN", message: "Admin or Branch Manager access required." }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    const action = searchParams.get("action");

    if (branchId && action === "analytics") {
      const analytics = ApiEngine.getBranchAnalytics(branchId);
      return NextResponse.json({ analytics, success: true });
    }
    if (branchId && action === "capacity") {
      const capacity = ApiEngine.getBranchCapacity(branchId);
      return NextResponse.json({ capacity, success: true });
    }

    const search = searchParams.get("search") || searchParams.get("q") || undefined;
    const lifecycle = (searchParams.get("lifecycle") as any) || "all";
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;

    const result = await BranchRepository.findWithFilters({
      search,
      lifecycle,
      page,
      limit,
    });
    const cityAreas = ApiEngine.listCityAreasPincodes();

    return NextResponse.json({
      branches: result.branches,
      total: result.total,
      totalCount: result.totalCount,
      activeCount: result.activeCount,
      archivedCount: result.archivedCount,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      cityAreas,
      success: true,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    if (data.type === "archive" || data.type === "archive_branch") {
      const bId = data.id || data.branchId;
      await BranchRepository.delete(bId);
      const res = ApiEngine.archiveBranch(bId);
      return NextResponse.json({ ...res, success: true });
    }

    if (data.type === "restore" || data.type === "restore_branch") {
      const bId = data.id || data.branchId;
      await BranchRepository.restore(bId);
      const res = ApiEngine.restoreBranch(bId);
      return NextResponse.json({ ...res, success: true });
    }

    if (data.type === "delivery_zone") {
      const zone = ApiEngine.saveBranchZone(data.branchId, data.zoneData);
      return NextResponse.json({ zone, success: true });
    }

    if (data.type === "delete_delivery_zone") {
      const deleted = ApiEngine.deleteBranchZone(data.branchId, data.zoneId);
      return NextResponse.json({ success: deleted });
    }

    if (data.type === "move_pincode_zone") {
      const mapping = ApiEngine.movePincodeZone(data.pincode, data.targetBranchId, data.targetZoneId);
      return NextResponse.json({ mapping, success: true });
    }

    if (data.type === "bulk_import_pincodes") {
      const result = ApiEngine.bulkImportPincodes(data.mappingsList || []);
      return NextResponse.json({ ...result, success: true });
    }

    if (data.type === "product_delivery_rules") {
      const product = ApiEngine.setProductDeliveryRules(data.productId, data.rules);
      return NextResponse.json({ product, success: true });
    }

    if (data.type === "product_prep_time") {
      const product = ApiEngine.setProductPrepTime(data.productId, Number(data.prepHours));
      return NextResponse.json({ product, success: true });
    }

    if (data.type === "toggle_online") {
      const updated = ApiEngine.setBranchOnlineOffline(data.branchId, data.isOnline);
      return NextResponse.json({ branch: updated, success: true });
    }

    if (data.type === "pause_orders") {
      const updated = ApiEngine.pauseBranchOrders(data.branchId, Number(data.durationMins));
      return NextResponse.json({ branch: updated, success: true });
    }

    if (data.type === "link_store") {
      const updated = ApiEngine.linkBranchToStore(data.branchId, data.storeId, data.storeName);
      return NextResponse.json({ branch: updated, success: true });
    }

    if (data.type === "sync_store_products") {
      const result = ApiEngine.syncBranchStoreProducts(data.branchId);
      return NextResponse.json({ ...result, success: true });
    }

    if (data.type === "city_area") {
      const area = ApiEngine.saveCityAreaPincodes(data);
      return NextResponse.json({ area, success: true });
    }

    if (data.type === "product_availability") {
      const updated = ApiEngine.setBranchProductAvailability(data.branchId, data.productId, {
        status: data.status,
        reason: data.reason,
        available_again_time: data.available_again_time,
      });
      return NextResponse.json({ availability: updated, success: true });
    }

    if (data.type === "cake_fulfilment") {
      const updated = ApiEngine.setBranchCakeFulfilment(data.branchId, data.productId, data.can_fulfil, data.reason, data.expected_resume);
      return NextResponse.json({ fulfilment: updated, success: true });
    }

    if (data.type === "accessory_stock") {
      const updated = ApiEngine.adjustBranchAccessoryStock(data.branchId, data.accessoryId, Number(data.delta), data.reason);
      return NextResponse.json({ accessoryStock: updated, success: true });
    }

    if (data.type === "capacity_load") {
      const updated = ApiEngine.updateBranchCapacityLoad(data.branchId, Number(data.delta));
      return NextResponse.json({ capacity: updated, success: true });
    }

    if (data.type === "assign_manager") {
      const manager = ApiEngine.assignBranchManager(data.branchId, data.manager);
      return NextResponse.json({ manager, success: true });
    }

    if (data.type === "suspend_manager") {
      const manager = ApiEngine.suspendBranchManager(data.branchId, data.suspend !== false);
      return NextResponse.json({ manager, success: true });
    }

    if (data.type === "force_logout") {
      const loggedOut = ApiEngine.forceLogoutBranchManager(data.branchId);
      return NextResponse.json({ success: loggedOut });
    }

    if (data.type === "transfer_manager") {
      const manager = ApiEngine.transferBranchManager(data.fromBranchId, data.toBranchId);
      return NextResponse.json({ manager, success: true });
    }

    const isNew = !data.id || !ApiEngine.getBranchById(data.id);

    // Server-Side Validation: City & State Integrity
    const reqCityId = data.city_id || (data.city?.toLowerCase() === "kollam" ? "city_klm" : "");
    const reqState = data.state || data.state_id || "";
    if (!data.city && !reqCityId) {
      return NextResponse.json({ error: "City is required. Please select a valid city.", success: false }, { status: 400 });
    }
    if (!reqState) {
      return NextResponse.json({ error: "State is required. Please select a valid state.", success: false }, { status: 400 });
    }
    if (reqCityId) {
      const validation = await CityRepository.validateCityBelongsToState(reqCityId, reqState);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error || "Selected city does not belong to the selected state.", success: false }, { status: 400 });
      }
    }

    const branch = ApiEngine.saveBranch(data);
    await BranchRepository.save(branch);
    const verifiedBranch = await BranchRepository.findById(branch.id);
    return NextResponse.json(
      { branch: verifiedBranch || branch, success: true, message: isNew ? "Branch created successfully" : "Branch saved successfully" },
      { status: isNew ? 201 : 200 }
    );
  } catch (err: any) {
    const isConflict = err.message && (err.message.includes("already exists") || err.message.includes("Duplicate") || err.message.includes("Role conflict"));
    return NextResponse.json({ error: err.message || "Failed to process branch request", success: false }, { status: isConflict ? 409 : 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    if (!data.id) return NextResponse.json({ error: "Branch ID required", success: false }, { status: 400 });

    // Server-Side Validation: City & State Integrity
    const reqCityId = data.city_id || (data.city?.toLowerCase() === "kollam" ? "city_klm" : "");
    const reqState = data.state || data.state_id || "";
    if (!data.city && !reqCityId) {
      return NextResponse.json({ error: "City is required. Please select a valid city.", success: false }, { status: 400 });
    }
    if (!reqState) {
      return NextResponse.json({ error: "State is required. Please select a valid state.", success: false }, { status: 400 });
    }
    if (reqCityId) {
      const validation = await CityRepository.validateCityBelongsToState(reqCityId, reqState);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error || "Selected city does not belong to the selected state.", success: false }, { status: 400 });
      }
    }

    const updated = ApiEngine.saveBranch(data);
    await BranchRepository.save(updated);
    const verifiedBranch = await BranchRepository.findById(updated.id);
    return NextResponse.json({ branch: verifiedBranch || updated, success: true, message: "Branch updated successfully" }, { status: 200 });
  } catch (err: any) {
    const isConflict = err.message && (err.message.includes("already exists") || err.message.includes("Duplicate") || err.message.includes("Role conflict"));
    return NextResponse.json({ error: err.message || "Failed to update branch", success: false }, { status: isConflict ? 409 : 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Branch ID required", success: false }, { status: 400 });
    await BranchRepository.delete(id);
    const res = ApiEngine.archiveBranch(id);
    return NextResponse.json({ ...res, success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete branch", success: false }, { status: 400 });
  }
}
