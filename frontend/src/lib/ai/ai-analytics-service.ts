/**
 * CakeToHome AI Analytics & Unanswered Query Telemetry Service
 */

export interface AiConversationLog {
  id: string;
  sessionId: string;
  customerId?: string;
  cityId?: string;
  messagesCount: number;
  toolsUsed: string[];
  converted: boolean;
  cartValue?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiUnansweredQuery {
  id: string;
  query: string;
  intent: string;
  cityId?: string;
  frequency: number;
  lastSeen: string;
  resolved: boolean;
}

export class AiAnalyticsService {
  private static conversations: Map<string, AiConversationLog> = new Map();
  private static unansweredQueries: Map<string, AiUnansweredQuery> = new Map();
  private static toolCallCounts: Map<string, number> = new Map();
  private static events: Array<{ type: string; details: any; timestamp: string }> = [];

  public static logConversationMessage(
    conversationId: string,
    sessionId: string,
    toolNames: string[],
    cityId?: string,
    customerId?: string
  ): void {
    let conv = this.conversations.get(conversationId);
    if (!conv) {
      conv = {
        id: conversationId,
        sessionId,
        customerId,
        cityId,
        messagesCount: 0,
        toolsUsed: [],
        converted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.conversations.set(conversationId, conv);
    }

    conv.messagesCount += 1;
    conv.updatedAt = new Date().toISOString();

    for (const t of toolNames) {
      if (!conv.toolsUsed.includes(t)) conv.toolsUsed.push(t);
      this.toolCallCounts.set(t, (this.toolCallCounts.get(t) || 0) + 1);
    }
  }

  public static logUnansweredQuery(query: string, intent: string, cityId?: string): void {
    const key = query.toLowerCase().trim();
    if (!key) return;

    const existing = this.unansweredQueries.get(key);
    if (existing) {
      existing.frequency += 1;
      existing.lastSeen = new Date().toISOString();
    } else {
      this.unansweredQueries.set(key, {
        id: `unans_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        query,
        intent,
        cityId,
        frequency: 1,
        lastSeen: new Date().toISOString(),
        resolved: false,
      });
    }
  }

  public static trackEvent(type: string, details: any): void {
    this.events.push({
      type,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  public static getAnalyticsSummary() {
    const convList = Array.from(this.conversations.values());
    const totalConversations = convList.length;
    const convertedConversations = convList.filter((c) => c.converted).length;

    const toolUsage: Record<string, number> = {};
    for (const [k, v] of this.toolCallCounts.entries()) {
      toolUsage[k] = v;
    }

    return {
      totalConversations,
      uniqueSessions: new Set(convList.map((c) => c.sessionId)).size,
      conversionRate: totalConversations > 0 ? ((convertedConversations / totalConversations) * 100).toFixed(1) + "%" : "0%",
      toolUsage,
      unansweredCount: this.unansweredQueries.size,
      recentEventsCount: this.events.length,
    };
  }

  public static getUnansweredQueries(): AiUnansweredQuery[] {
    return Array.from(this.unansweredQueries.values()).sort((a, b) => b.frequency - a.frequency);
  }
}
