import { Injectable } from "@nestjs/common";

export const CANONICAL_ROLES = [
  "CUSTOMER",
  "STORE_MANAGER",
  "SUPER_ADMIN",
  "BRANCH_MANAGER",
  "CHEF",
  "DISPATCHER",
  "DELIVERY_PARTNER",
  "AUDITOR",
] as const;

export const GRANULAR_PERMISSIONS = [
  "orders.read",
  "orders.create",
  "orders.update",
  "orders.cancel",
  "payments.initiate",
  "payments.verify",
  "payments.refund",
  "inventory.read",
  "inventory.adjust",
  "kitchen.kot.read",
  "kitchen.kot.update",
  "delivery.dispatch",
  "delivery.complete",
  "accounting.audit",
  "system.configure",
] as const;

@Injectable()
export class RolesService {
  getRoles() {
    return {
      roles: CANONICAL_ROLES,
      count: CANONICAL_ROLES.length,
    };
  }

  getPermissions() {
    return {
      permissions: GRANULAR_PERMISSIONS,
      count: GRANULAR_PERMISSIONS.length,
    };
  }

  getUserRoleAssignment(userId: string) {
    return {
      userId,
      role: "CUSTOMER",
      permissions: ["orders.read", "orders.create", "payments.initiate"],
    };
  }
}

