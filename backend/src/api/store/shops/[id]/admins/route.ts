import {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  MedusaError,
  remoteQueryObjectFromString,
} from "@medusajs/utils";
import zod from "zod";
import { createUserWorkflow } from "../../../../../workflows/user/workflows/create-user";
import { SHOP_MODULE } from "../../../../../modules/shop";

const schema = zod
  .object({
    email: zod.string().email(),
    first_name: zod.string().optional(),
    last_name: zod.string().optional(),
  })
  .required({ email: true });

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const authIdentityId = req.auth_context.auth_identity_id;
  const shopId = req.params.id;

  const validatedBody = schema.parse(req.body) as {
    email: string;
    first_name: string;
    last_name: string;
  };

  const { result, errors } = await createUserWorkflow(req.scope).run({
    input: {
      user: {
        ...validatedBody,
        actor_type: "shop",
        shop_id: shopId,
      },
      auth_identity_id: authIdentityId,
    },
    throwOnError: false,
  });

  if (Array.isArray(errors) && errors[0]) {
    throw errors[0].error;
  }

  res.status(201).json({ user: result });
};

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const shopId = req.params.id;

  if (!shopId) {
    return MedusaError.Types.NOT_FOUND, "Shop not found";
  }

  const remoteQuery = req.scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY) as any;

  const shopAdminsQuery = remoteQueryObjectFromString({
    entryPoint: "shop_manager",
    fields: ["id", "email", "first_name", "last_name"],
    filters: {
      shop_id: shopId,
    },
  });

  const shopAdmins = await remoteQuery(shopAdminsQuery);

  return res.status(200).json({ shop_managers: shopAdmins });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const shopId = req.params.id;
  const adminId = req.params.adminId;

  if (!shopId || !adminId) {
    return MedusaError.Types.INVALID_DATA;
  }

  const shopModuleService = req.scope.resolve(SHOP_MODULE) as any;

  await shopModuleService.deleteShopManagers(adminId);

  return res.status(200).json({ message: "Admin deleted" });
}
