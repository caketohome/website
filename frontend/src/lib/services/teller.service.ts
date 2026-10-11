/**
 * CakeToHome ERP — Teller Domain Service
 * Phase C3: Teller & Session Domain Services + Repositories
 *
 * Enforces business rules and authorization for Teller counter configuration:
 * 1. Single active teller assignment per user across company.
 * 2. Scoped branch access control and server-side RBAC validation.
 * 3. Atomic activation / deactivation guards.
 */

import { dbTransaction } from "../db";
import type { PoolClient } from "pg";
import { TellerRepository } from "../repositories/teller.repository";
import { TellerSessionRepository } from "../repositories/teller-session.repository";
import { hasEffectivePermission } from "../staff-access-control";
import {
  TellerRow,
  CreateTellerParams,
  UpdateTellerParams,
  AuthenticatedActor,
  TellerDomainError,
} from "../types/teller.types";

export class TellerService {
  /**
   * Validates actor authorization for branch operations.
   */
  private static validateBranchAccess(actor: AuthenticatedActor, branchId: string): void {
    if (actor.role === "SUPER_ADMIN") return;
    if (actor.branchId && actor.branchId !== branchId) {
      throw new TellerDomainError(
        "UNAUTHORIZED_BRANCH",
        `Actor does not have access to branch '${branchId}'. Authorized branch is '${actor.branchId}'.`
      );
    }
  }

  /**
   * Creates a new teller counter station.
   * Requires: TELLER.MANAGE.
   */
  static async createTeller(
    params: CreateTellerParams,
    actor: AuthenticatedActor,
    client?: PoolClient
  ): Promise<TellerRow> {
    if (!hasEffectivePermission(actor, "TELLER.MANAGE")) {
      throw new TellerDomainError(
        "PERMISSION_DENIED",
        "Actor does not possess TELLER.MANAGE permission required to configure tellers."
      );
    }
    this.validateBranchAccess(actor, params.branch_id);

    const execute = async (txClient: PoolClient) => {
      // If requested status is ACTIVE, verify user has no active assignment company-wide
      const requestedStatus = params.status || "ACTIVE";
      if (requestedStatus === "ACTIVE") {
        const existingActive = await TellerRepository.findActiveByUserId(
          params.user_id,
          txClient,
          true
        );
        if (existingActive) {
          throw new TellerDomainError(
            "TELLER_DUPLICATE_ACTIVE_USER",
            `User '${params.user_id}' already has an active teller assignment (${existingActive.code}) at branch '${existingActive.branch_id}'.`
          );
        }
      }

      return TellerRepository.create(
        {
          ...params,
          created_by: actor.userId,
        },
        txClient
      );
    };

    if (client) {
      return execute(client);
    }
    return dbTransaction(execute);
  }

  /**
   * Activates an inactive teller record.
   * Requires: TELLER.MANAGE.
   */
  static async activateTeller(
    id: string,
    actor: AuthenticatedActor,
    client?: PoolClient
  ): Promise<TellerRow> {
    if (!hasEffectivePermission(actor, "TELLER.MANAGE")) {
      throw new TellerDomainError(
        "PERMISSION_DENIED",
        "Actor does not possess TELLER.MANAGE permission required to activate tellers."
      );
    }

    const execute = async (txClient: PoolClient) => {
      const existing = await TellerRepository.findById(id, txClient, true);
      if (!existing) {
        throw new TellerDomainError("TELLER_NOT_FOUND", `Teller '${id}' not found.`);
      }
      this.validateBranchAccess(actor, existing.branch_id);

      if (existing.status === "ACTIVE") {
        return existing; // Idempotent no-op
      }

      // Check if user already has an active assignment elsewhere
      const currentActive = await TellerRepository.findActiveByUserId(
        existing.user_id,
        txClient,
        true
      );
      if (currentActive && currentActive.id !== id) {
        throw new TellerDomainError(
          "TELLER_DUPLICATE_ACTIVE_USER",
          `User '${existing.user_id}' already has an active teller assignment (${currentActive.code}) at branch '${currentActive.branch_id}'. Deactivate it first.`
        );
      }

      return TellerRepository.activate(id, actor.userId, txClient);
    };

    if (client) {
      return execute(client);
    }
    return dbTransaction(execute);
  }

  /**
   * Deactivates an active teller record.
   * Requires: TELLER.MANAGE.
   * Invariant: cannot deactivate a teller that has an ongoing active session.
   */
  static async deactivateTeller(
    id: string,
    actor: AuthenticatedActor,
    client?: PoolClient
  ): Promise<TellerRow> {
    if (!hasEffectivePermission(actor, "TELLER.MANAGE")) {
      throw new TellerDomainError(
        "PERMISSION_DENIED",
        "Actor does not possess TELLER.MANAGE permission required to deactivate tellers."
      );
    }

    const execute = async (txClient: PoolClient) => {
      const existing = await TellerRepository.findById(id, txClient, true);
      if (!existing) {
        throw new TellerDomainError("TELLER_NOT_FOUND", `Teller '${id}' not found.`);
      }
      this.validateBranchAccess(actor, existing.branch_id);

      if (existing.status === "INACTIVE") {
        return existing; // Idempotent no-op
      }

      // Ensure teller has no active session in OPEN, CLOSING, or PENDING_VERIFICATION
      const activeSession = await TellerSessionRepository.findActiveByTellerId(
        id,
        txClient,
        true
      );
      if (activeSession) {
        throw new TellerDomainError(
          "ACTIVE_SESSION_EXISTS",
          `Cannot deactivate teller '${existing.code}': session '${activeSession.id}' is currently ${activeSession.status}.`
        );
      }

      return TellerRepository.deactivate(id, actor.userId, txClient);
    };

    if (client) {
      return execute(client);
    }
    return dbTransaction(execute);
  }

  /**
   * Retrieves active teller record for user.
   * Allowed if actor is querying self OR actor has TELLER.VIEW.
   */
  static async getActiveTellerForUser(
    userId: string,
    actor: AuthenticatedActor,
    client?: PoolClient
  ): Promise<TellerRow | null> {
    if (actor.userId !== userId && !hasEffectivePermission(actor, "TELLER.VIEW")) {
      throw new TellerDomainError(
        "PERMISSION_DENIED",
        "Actor does not possess TELLER.VIEW permission to query another user's teller identity."
      );
    }
    return TellerRepository.findActiveByUserId(userId, client);
  }

  /**
   * Lists all tellers in a branch.
   * Requires: TELLER.VIEW.
   */
  static async listBranchTellers(
    branchId: string,
    actor: AuthenticatedActor,
    client?: PoolClient
  ): Promise<TellerRow[]> {
    if (!hasEffectivePermission(actor, "TELLER.VIEW")) {
      throw new TellerDomainError(
        "PERMISSION_DENIED",
        "Actor does not possess TELLER.VIEW permission."
      );
    }
    this.validateBranchAccess(actor, branchId);
    return TellerRepository.listByBranch(branchId, client);
  }

  /**
   * Retrieves a teller by ID.
   * Requires: TELLER.VIEW.
   */
  static async getTellerById(
    id: string,
    actor: AuthenticatedActor,
    client?: PoolClient
  ): Promise<TellerRow> {
    if (!hasEffectivePermission(actor, "TELLER.VIEW")) {
      throw new TellerDomainError(
        "PERMISSION_DENIED",
        "Actor does not possess TELLER.VIEW permission."
      );
    }
    const teller = await TellerRepository.findById(id, client);
    if (!teller) {
      throw new TellerDomainError("TELLER_NOT_FOUND", `Teller '${id}' not found.`);
    }
    this.validateBranchAccess(actor, teller.branch_id);
    return teller;
  }

  /**
   * Updates an existing teller's name or status.
   * Requires: TELLER.MANAGE.
   */
  static async updateTeller(
    id: string,
    params: UpdateTellerParams,
    actor: AuthenticatedActor,
    client?: PoolClient
  ): Promise<TellerRow> {
    if (!hasEffectivePermission(actor, "TELLER.MANAGE")) {
      throw new TellerDomainError(
        "PERMISSION_DENIED",
        "Actor does not possess TELLER.MANAGE permission."
      );
    }
    const existing = await TellerRepository.findById(id, client);
    if (!existing) {
      throw new TellerDomainError("TELLER_NOT_FOUND", `Teller '${id}' not found.`);
    }
    this.validateBranchAccess(actor, existing.branch_id);

    if (params.status && params.status !== existing.status) {
      if (params.status === "ACTIVE") {
        return this.activateTeller(id, actor, client);
      } else {
        return this.deactivateTeller(id, actor, client);
      }
    }

    return TellerRepository.update(id, { ...params, updated_by: actor.userId }, client);
  }

  /**
   * Lists tellers matching optional branch, status, or userId.
   * Requires: TELLER.VIEW.
   */
  static async listTellers(
    filters: { branchId?: string; status?: string; userId?: string },
    actor: AuthenticatedActor,
    client?: PoolClient
  ): Promise<TellerRow[]> {
    if (!hasEffectivePermission(actor, "TELLER.VIEW")) {
      throw new TellerDomainError(
        "PERMISSION_DENIED",
        "Actor does not possess TELLER.VIEW permission."
      );
    }
    let targetBranchId = filters.branchId;
    if (actor.role !== "SUPER_ADMIN" && actor.branchId) {
      if (targetBranchId && targetBranchId !== actor.branchId) {
        throw new TellerDomainError(
          "UNAUTHORIZED_BRANCH",
          `Actor does not have access to branch '${targetBranchId}'. Authorized branch is '${actor.branchId}'.`
        );
      }
      targetBranchId = actor.branchId;
    }
    return TellerRepository.listTellers({ ...filters, branchId: targetBranchId }, client);
  }
}
