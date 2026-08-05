export class SettingsRepository {
  private prisma: any;
  private inMemoryStore: Map<string, any> = new Map();

  constructor(prismaClient?: any) {
    this.prisma = prismaClient;
  }

  private makeStoreKey(group: string, key: string): string {
    return `${group.toLowerCase()}:${key.toLowerCase()}`;
  }

  async getSetting(group: string, key: string) {
    const storeKey = this.makeStoreKey(group, key);
    if (this.prisma) {
      return this.prisma.setting.findUnique({
        where: { group_key: { group, key } },
      });
    }
    return this.inMemoryStore.get(storeKey) || null;
  }

  async listSettingsByGroup(group: string) {
    if (this.prisma) {
      return this.prisma.setting.findMany({ where: { group } });
    }
    const results: any[] = [];
    const prefix = `${group.toLowerCase()}:`;
    for (const [k, v] of this.inMemoryStore.entries()) {
      if (k.startsWith(prefix)) {
        results.push(v);
      }
    }
    return results;
  }

  async upsertSetting(data: {
    group: string;
    key: string;
    value: string;
    is_json?: boolean;
    is_secret?: boolean;
    description?: string;
  }) {
    const storeKey = this.makeStoreKey(data.group, data.key);
    if (this.prisma) {
      return this.prisma.setting.upsert({
        where: { group_key: { group: data.group, key: data.key } },
        update: data,
        create: data,
      });
    }
    const record = { id: `set_${Date.now()}`, ...data };
    this.inMemoryStore.set(storeKey, record);
    return record;
  }
}
