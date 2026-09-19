/**
 * CakeToHome Canonical Cart Event Bus
 * Synchronizes client-side cart state, badge counter, and drawer visibility across components.
 */

export type CartEventHandler = (data?: any) => void;

class CartEventBus {
  private listeners: Map<string, Set<CartEventHandler>> = new Map();

  on(event: string, handler: CartEventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    let domListener: ((e: any) => void) | null = null;
    if (typeof window !== "undefined") {
      domListener = (e: CustomEvent) => {
        try {
          handler(e.detail);
        } catch (err) {
          console.error(`Error in DOM cart event handler for "${event}":`, err);
        }
      };
      window.addEventListener(`cth:${event}`, domListener as EventListener);
    }

    return () => {
      this.listeners.get(event)?.delete(handler);
      if (domListener && typeof window !== "undefined") {
        window.removeEventListener(`cth:${event}`, domListener as EventListener);
      }
    };
  }

  emit(event: string, data?: any): void {
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent(`cth:${event}`, { detail: data }));
      } catch {}
    }

    const set = this.listeners.get(event);
    if (set) {
      set.forEach((handler) => {
        try {
          handler(data);
        } catch (err) {
          console.error(`Error in cart event handler for "${event}":`, err);
        }
      });
    }
  }

  emitCartUpdated(cart: any): void {
    this.emit("cart:updated", cart);
  }

  onCartUpdated(handler: (cart: any) => void): () => void {
    return this.on("cart:updated", handler);
  }

  emitOpenCart(): void {
    this.emit("cart:open");
  }

  onOpenCart(handler: () => void): () => void {
    return this.on("cart:open", handler);
  }

  emitCartError(error: string): void {
    this.emit("cart:error", error);
  }

  onCartError(handler: (error: string) => void): () => void {
    return this.on("cart:error", handler);
  }
}

// Global cross-bundle singleton instance
const globalRef = (typeof window !== "undefined" ? window : globalThis) as any;
export const cartBus: CartEventBus = globalRef.__CTH_CART_EVENT_BUS__ || (globalRef.__CTH_CART_EVENT_BUS__ = new CartEventBus());
