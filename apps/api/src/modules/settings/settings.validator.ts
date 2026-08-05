import { BadRequestError } from "../../core/errors/app-error";

export function validateSettingInput(body: any) {
  if (!body || typeof body.group !== "string" || !body.group.trim()) {
    throw new BadRequestError("Setting group is required.");
  }
  if (typeof body.key !== "string" || !body.key.trim()) {
    throw new BadRequestError("Setting key is required.");
  }
  if (body.value === undefined || body.value === null) {
    throw new BadRequestError("Setting value is required.");
  }
  return {
    group: body.group.trim().toLowerCase(),
    key: body.key.trim().toLowerCase(),
    value: typeof body.value === "object" ? JSON.stringify(body.value) : String(body.value),
    is_json: typeof body.value === "object" || Boolean(body.is_json),
    is_secret: Boolean(body.is_secret),
    description: body.description?.trim(),
  };
}
