import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { INTEGRATION_MODULE } from "../../../../modules/integration";
import zod from "zod";

const connectorConfigSchema = zod.object({
  name: zod.string(),
  is_enabled: zod.boolean(),
  test_mode: zod.boolean().optional(),
  sandbox_mode: zod.boolean().optional(),
  credentials: zod.any().optional(),
  config_version: zod.string().optional(),
  schema_version: zod.string().optional(),
  migration_version: zod.string().optional(),
  rollback_version: zod.string().optional(),
});

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const integrationService = req.scope.resolve(INTEGRATION_MODULE) as any;

  try {
    const connectors = await integrationService.listConnectorConfigs();
    return res.status(200).json({ connectors });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const integrationService = req.scope.resolve(INTEGRATION_MODULE) as any;

  try {
    const validated = connectorConfigSchema.parse(req.body);
    const [existing] = await integrationService.listConnectorConfigs({ name: validated.name });

    let connector;
    if (existing) {
      connector = await integrationService.updateConnectorConfigs({
        selector: { id: existing.id },
        data: {
          is_enabled: validated.is_enabled,
          test_mode: validated.test_mode ?? existing.test_mode,
          sandbox_mode: validated.sandbox_mode ?? existing.sandbox_mode,
          credentials: validated.credentials ?? existing.credentials,
          config_version: validated.config_version ?? existing.config_version,
          schema_version: validated.schema_version ?? existing.schema_version,
          migration_version: validated.migration_version ?? existing.migration_version,
          rollback_version: validated.rollback_version ?? existing.rollback_version,
        },
      });
    } else {
      connector = await integrationService.createConnectorConfigs({
        name: validated.name,
        is_enabled: validated.is_enabled,
        test_mode: validated.test_mode ?? true,
        sandbox_mode: validated.sandbox_mode ?? true,
        credentials: validated.credentials ?? null,
        config_version: validated.config_version ?? "1.0.0",
        schema_version: validated.schema_version ?? "1.0.0",
        migration_version: validated.migration_version ?? "1.0.0",
        rollback_version: validated.rollback_version ?? null,
      });
    }

    return res.status(200).json({ connector });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
