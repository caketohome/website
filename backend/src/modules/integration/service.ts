import { MedusaService } from "@medusajs/utils";
import { ConnectorConfig } from "./models";

export interface Connector {
  readonly name: string;
  validateCredentials(credentials: any): Promise<boolean>;
  healthCheck(): Promise<boolean>;
  sendEvent(event: string, payload: any): Promise<boolean>;
}

class IntegrationModuleService extends MedusaService({
  ConnectorConfig,
}) {
  private connectors: Map<string, Connector> = new Map();

  registerConnector(name: string, connector: Connector) {
    this.connectors.set(name, connector);
  }

  getConnector(name: string): Connector {
    const connector = this.connectors.get(name);
    if (!connector) {
      throw new Error(`Connector "${name}" is not registered in Universal Integration Hub.`);
    }
    return connector;
  }

  async validateConnector(name: string): Promise<boolean> {
    const [cfg] = await this.listConnectorConfigs({ name });
    if (!cfg) {
      throw new Error(`Configuration for connector "${name}" not found.`);
    }
    const adapter = this.getConnector(name);
    return adapter.validateCredentials(cfg.credentials);
  }

  async checkConnectorHealth(name: string): Promise<boolean> {
    const [cfg] = await this.listConnectorConfigs({ name });
    if (!cfg) {
      throw new Error(`Configuration for connector "${name}" not found.`);
    }
    const adapter = this.getConnector(name);
    let isHealthy = false;
    try {
      isHealthy = await adapter.healthCheck();
    } catch {
      isHealthy = false;
    }

    await this.updateConnectorConfigs({
      selector: { id: cfg.id },
      data: {
        health_status: isHealthy ? "healthy" : "unhealthy",
        last_health_check: new Date(),
      },
    });

    return isHealthy;
  }

  async triggerConnectorEvent(name: string, event: string, payload: any): Promise<boolean> {
    const [cfg] = await this.listConnectorConfigs({ name });
    if (!cfg || !cfg.is_enabled) {
      return false; // Skip if disabled
    }
    const adapter = this.getConnector(name);
    return adapter.sendEvent(event, payload);
  }
}

export default IntegrationModuleService;
