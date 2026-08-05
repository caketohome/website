import { CheckServiceabilityInput, ReserveSlotInput, CompleteDeliveryInput } from "./delivery.types";
import { BadRequestError } from "../../core/errors/app-error";

export function validateCheckServiceabilityInput(query: any): CheckServiceabilityInput {
  const pincode = query.pincode ? String(query.pincode).trim() : "";
  if (!pincode || !/^\d{6}$/.test(pincode)) {
    throw new BadRequestError("Query parameter 'pincode' must be an exact 6-digit Indian Postal Pincode.");
  }

  const subtotal = query.subtotal !== undefined ? parseFloat(query.subtotal) : undefined;
  if (subtotal !== undefined && (isNaN(subtotal) || subtotal < 0)) {
    throw new BadRequestError("Query parameter 'subtotal' must be a valid non-negative number.");
  }

  return {
    pincode,
    subtotal,
    isRain: query.isRain === "true" || query.isRain === "1",
    isPeak: query.isPeak === "true" || query.isPeak === "1",
  };
}

export function validateReserveSlotInput(body: any): ReserveSlotInput {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body must be a valid JSON object.");
  }

  const branchId = body.branchId ? String(body.branchId).trim() : "";
  if (!branchId) throw new BadRequestError("Property 'branchId' is required.");

  const date = body.date ? String(body.date).trim() : new Date().toISOString().slice(0, 10);

  const validSlots = [
    "EXPRESS_45MIN",
    "STANDARD_MORNING",
    "STANDARD_AFTERNOON",
    "STANDARD_EVENING",
    "STANDARD_NIGHT",
    "MIDNIGHT",
  ];
  if (!body.slotId || !validSlots.includes(body.slotId)) {
    throw new BadRequestError("Property 'slotId' must be a valid delivery slot identifier.");
  }

  return {
    branchId,
    date,
    slotId: body.slotId,
  };
}

export function validateCompleteDeliveryInput(body: any, jobIdParam?: string): CompleteDeliveryInput {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body must be a valid JSON object.");
  }

  const jobId = jobIdParam || body.jobId ? String(jobIdParam || body.jobId).trim() : "";
  if (!jobId) throw new BadRequestError("Property 'jobId' is required.");

  const photoUrl = body.photoUrl ? String(body.photoUrl).trim() : "";
  if (!photoUrl) throw new BadRequestError("Property 'photoUrl' is required for Proof of Delivery (POD).");

  if (body.otpVerified !== true && body.otpVerified !== "true") {
    throw new BadRequestError("Customer delivery verification OTP must be verified (otpVerified = true).");
  }

  return {
    jobId,
    photoUrl,
    otpVerified: true,
  };
}
