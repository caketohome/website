import { NextRequest, NextResponse } from "next/server";
import { ApiEngine } from "@frontend/lib/api-engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
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

    const branches = ApiEngine.listBranches({ includeArchived: true });
    const cityAreas = ApiEngine.listCityAreasPincodes();
    return NextResponse.json({ branches, cityAreas, success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    if (data.type === "archive" || data.type === "archive_branch") {
      const res = ApiEngine.archiveBranch(data.id || data.branchId);
      return NextResponse.json({ ...res });
    }

    if (data.type === "restore" || data.type === "restore_branch") {
      const res = ApiEngine.restoreBranch(data.id || data.branchId);
      return NextResponse.json({ ...res });
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
    const branch = ApiEngine.saveBranch(data);
    return NextResponse.json({ branch, success: true, message: isNew ? "Branch created successfully" : "Branch saved successfully" }, { status: isNew ? 201 : 200 });
  } catch (err: any) {
    const isConflict = err.message && (err.message.includes("already exists") || err.message.includes("Duplicate") || err.message.includes("Role conflict"));
    return NextResponse.json({ error: err.message || "Failed to process branch request", success: false }, { status: isConflict ? 409 : 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    if (!data.id) return NextResponse.json({ error: "Branch ID required", success: false }, { status: 400 });
    const updated = ApiEngine.saveBranch(data);
    return NextResponse.json({ branch: updated, success: true, message: "Branch updated successfully" }, { status: 200 });
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
    const res = ApiEngine.archiveBranch(id);
    return NextResponse.json({ ...res });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete branch", success: false }, { status: 400 });
  }
}
