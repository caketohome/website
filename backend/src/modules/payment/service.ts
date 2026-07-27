import { MedusaService } from "@medusajs/utils";
import { PaymentTransaction, PaymentAuditTrail } from "./models";

export interface PaymentProvider {
  initiatePayment(amount: number, currency: string, orderId: string): Promise<Record<string, unknown>>;
  capturePayment(transactionId: string): Promise<boolean>;
  refundPayment(transactionId: string, amount: number): Promise<boolean>;
}

export class CodPaymentProvider implements PaymentProvider {
  async initiatePayment(amount: number, currency: string, orderId: string): Promise<Record<string, unknown>> {
    return { status: "pending", redirect_url: null, transaction_ref: `cod_${orderId}_${Date.now()}` };
  }
  async capturePayment(transactionId: string): Promise<boolean> {
    return true;
  }
  async refundPayment(transactionId: string, amount: number): Promise<boolean> {
    return true;
  }
}

export class MockPaymentProvider implements PaymentProvider {
  async initiatePayment(amount: number, currency: string, orderId: string): Promise<Record<string, unknown>> {
    return { status: "authorized", redirect_url: "https://mockgateway.com/pay", transaction_ref: `mock_${orderId}_${Date.now()}` };
  }
  async capturePayment(transactionId: string): Promise<boolean> {
    return true;
  }
  async refundPayment(transactionId: string, amount: number): Promise<boolean> {
    return true;
  }
}

class PaymentModuleService extends MedusaService({
  PaymentTransaction,
  PaymentAuditTrail,
}) {
  private providers: Map<string, PaymentProvider> = new Map();
  private locks?: Map<string, Promise<void>>;

  private async acquireLock(key: string): Promise<() => void> {
    if (!this.locks) {
      this.locks = new Map();
    }
    let resolveLock: () => void = () => {};
    const newLock = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    
    const existingLock = this.locks.get(key) || Promise.resolve();
    this.locks.set(key, newLock);
    
    await existingLock;
    return () => {
      resolveLock();
      if (this.locks?.get(key) === newLock) {
        this.locks.delete(key);
      }
    };
  }

  constructor(...args: any[]) {
    super(...args);
    // Register default core adapters
    this.providers.set("cod", new CodPaymentProvider());
    this.providers.set("test_mode", new MockPaymentProvider());
  }

  registerProvider(name: string, provider: PaymentProvider) {
    this.providers.set(name, provider);
  }

  getProvider(name: string): PaymentProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Payment provider "${name}" is not registered.`);
    }
    return provider;
  }

  async initiatePaymentSession(params: {
    amount: number;
    currency: string;
    orderId: string;
    branchId: string;
    customerId: string;
    provider: string;
    idempotencyKey?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<any> {
    const lockKey = params.idempotencyKey ? `idem:${params.idempotencyKey}` : null;
    const release = lockKey ? await this.acquireLock(lockKey) : null;
    try {
      // 1. Idempotency validation
      if (params.idempotencyKey) {
        const [existing] = await this.listPaymentTransactions({
          idempotency_key: params.idempotencyKey,
        });
        if (existing) {
          return existing;
        }
      }

      const adapter = this.getProvider(params.provider);
      const result = await adapter.initiatePayment(params.amount, params.currency, params.orderId);

      const transaction = await this.createPaymentTransactions({
        company_id: "default_company",
        branch_id: params.branchId,
        order_id: params.orderId,
        customer_id: params.customerId,
        amount: params.amount,
        currency: params.currency,
        idempotency_key: params.idempotencyKey ?? null,
        status: (result.status as string) || "pending",
        provider: params.provider,
        provider_ref: (result.transaction_ref as string) || null,
      });

    await this.createPaymentAuditTrails({
      transaction_id: transaction.id,
      action: "payment_initiated",
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      payload: JSON.stringify({ params, result }),
    });

    return transaction;
    } finally {
      if (release) release();
    }
  }

  async capturePaymentSession(params: {
    transactionId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<any> {
    const lockKey = `capture:${params.transactionId}`;
    const release = await this.acquireLock(lockKey);
    try {
      const [txn] = await this.listPaymentTransactions({ id: params.transactionId });
      if (!txn) {
        throw new Error(`Payment transaction "${params.transactionId}" not found.`);
      }

      if (txn.status === "captured") {
        return txn; // Already captured (Idempotent success)
      }

      const adapter = this.getProvider(txn.provider);
      const success = await adapter.capturePayment(txn.id);

      if (!success) {
        throw new Error("Failed to capture payment with provider adapter.");
      }

      const updated = await this.updatePaymentTransactions({
        selector: { id: txn.id },
        data: {
          status: "captured",
          settlement_status: "settled",
        },
      });

      await this.createPaymentAuditTrails({
        transaction_id: txn.id,
        action: "payment_captured",
        ip_address: params.ipAddress ?? null,
        user_agent: params.userAgent ?? null,
        payload: JSON.stringify({ success }),
      });

      return updated;
    } finally {
      release();
    }
  }

  async refundPaymentSession(params: {
    transactionId: string;
    amount: number;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<any> {
    const lockKey = `refund:${params.transactionId}`;
    const release = await this.acquireLock(lockKey);
    try {
      const [txn] = await this.listPaymentTransactions({ id: params.transactionId });
      if (!txn) {
        throw new Error(`Payment transaction "${params.transactionId}" not found.`);
      }

      if (txn.status === "refunded") {
        return txn; // Already fully refunded (Idempotent success)
      }

      const adapter = this.getProvider(txn.provider);
      const success = await adapter.refundPayment(txn.id, params.amount);

      if (!success) {
        throw new Error("Failed to process refund with provider adapter.");
      }

      const nextStatus = params.amount >= txn.amount ? "refunded" : "partially_refunded";
      const updated = await this.updatePaymentTransactions({
        selector: { id: txn.id },
        data: {
          status: nextStatus,
        },
      });

      await this.createPaymentAuditTrails({
        transaction_id: txn.id,
        action: "payment_refunded",
        ip_address: params.ipAddress ?? null,
        user_agent: params.userAgent ?? null,
        payload: JSON.stringify({ success, amount: params.amount }),
      });

      return updated;
    } finally {
      release();
    }
  }
}

export default PaymentModuleService;
