import { BranchSearchQuery } from "./branches.types";
import { BadRequestError } from "../../core/errors/app-error";

export function validateBranchSearchQuery(query: any): BranchSearchQuery {
  let pincode: string | undefined = undefined;
  if (query.pincode) {
    pincode = String(query.pincode).trim();
    if (!/^\d{6}$/.test(pincode)) {
      throw new BadRequestError("Indian Postal Pincode must be exactly 6 digits.");
    }
  }

  return {
    pincode,
    city: query.city ? String(query.city).trim() : undefined,
    isActive: query.isActive === "false" ? false : true,
  };
}
