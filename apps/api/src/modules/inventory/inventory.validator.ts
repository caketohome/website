import { ReserveStockInput, ReleaseReservationInput, ConfirmSaleInput } from "./inventory.types";
import { BadRequestError } from "../../core/errors/app-error";

export function validateReserveStockInput(body: any): ReserveStockInput {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body must be a valid JSON object.");
  }

  const branchId = body.branchId ? String(body.branchId).trim() : "";
  if (!branchId) throw new BadRequestError("Property 'branchId' is required.");

  const variantId = body.variantId ? String(body.variantId).trim() : "";
  if (!variantId) throw new BadRequestError("Property 'variantId' is required.");

  const quantity = parseInt(body.quantity || 1, 10);
  if (isNaN(quantity) || quantity < 1) throw new BadRequestError("Reservation quantity must be a positive integer.");

  return {
    branchId,
    variantId,
    quantity,
    expectedVersion: body.expectedVersion !== undefined ? parseInt(body.expectedVersion, 10) : undefined,
  };
}

export function validateReleaseReservationInput(body: any): ReleaseReservationInput {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body must be a valid JSON object.");
  }
  const reservationId = body.reservationId ? String(body.reservationId).trim() : "";
  if (!reservationId) throw new BadRequestError("Property 'reservationId' is required.");
  return { reservationId };
}

export function validateConfirmSaleInput(body: any): ConfirmSaleInput {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body must be a valid JSON object.");
  }
  const reservationId = body.reservationId ? String(body.reservationId).trim() : "";
  if (!reservationId) throw new BadRequestError("Property 'reservationId' is required.");
  return { reservationId };
}
