/**
 * CakeToHome Central Authentication & Logout Service
 * 
 * Provides an authoritative, unified logout mechanism for all user roles:
 * - SUPER_ADMIN
 * - BRANCH_MANAGER / SHOP_MANAGER
 * - DELIVERY_PARTNER
 * - CUSTOMER
 */

export const AUTH_COOKIES = [
  "_cth_jwt",
  "_medusa_jwt",
  "_cth_role",
  "_cth_user_id",
  "_cth_phone",
  "_cth_branch_id",
  "_cth_shop_id",
  "_cth_partner_id",
  "_cth_cart_id",
  "_medusa_cart_id",
] as const;

export const AUTH_STORAGE_KEYS = [
  "_cth_jwt",
  "_cth_role",
  "_cth_user",
  "_cth_phone",
  "_cth_user_id",
  "_cth_branch_id",
  "_cth_shop_id",
  "_cth_partner_id",
  "cth_auth_user",
  "medusa_auth_token",
] as const;

export interface AuthLogoutOptions {
  redirectUrl?: string;
  skipApi?: boolean;
  reason?: "user_initiated" | "session_expired" | "multi_tab_sync" | "unauthorized";
}

let isLoggingOutInProgress = false;

/**
 * Clear all authentication cookies in the browser across all potential paths
 */
export function clearClientAuthCookies(): void {
  if (typeof document === "undefined") return;

  const paths = ["/", "/dashboard", "/account", "/dashboard/shop", "/dashboard/delivery-partner"];
  const expires = "expires=Thu, 01 Jan 1970 00:00:00 UTC;";

  AUTH_COOKIES.forEach((cookieName) => {
    paths.forEach((path) => {
      document.cookie = `${cookieName}=; ${expires} path=${path};`;
      document.cookie = `${cookieName}=; ${expires} path=${path}; SameSite=Lax;`;
    });
  });
}

/**
 * Clear all authentication data from localStorage and sessionStorage
 */
export function clearClientAuthStorage(): void {
  if (typeof window === "undefined") return;

  try {
    AUTH_STORAGE_KEYS.forEach((key) => {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    });
  } catch {
    // Ignore storage access errors in private browsing modes
  }
}

/**
 * Broadcast logout event to other browser tabs
 */
export function broadcastMultiTabLogout(): void {
  if (typeof window === "undefined") return;

  try {
    // 1. Broadcast via localStorage storage event
    window.localStorage.setItem("_cth_logout_event", String(Date.now()));
    window.localStorage.removeItem("_cth_logout_event");

    // 2. Broadcast via BroadcastChannel if available
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel("cth_auth_channel");
      channel.postMessage({ type: "LOGOUT", timestamp: Date.now() });
      channel.close();
    }
  } catch {
    // Ignore broadcast errors
  }
}

/**
 * Listen for logout events initiated in other tabs
 */
export function initMultiTabLogoutListener(onLogout?: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === "_cth_logout_event" && e.newValue) {
      clearClientAuthCookies();
      clearClientAuthStorage();
      if (onLogout) {
        onLogout();
      } else {
        window.location.href = "/login?reason=multi_tab_logout";
      }
    }
  };

  window.addEventListener("storage", handleStorageEvent);

  let channel: BroadcastChannel | null = null;
  if ("BroadcastChannel" in window) {
    try {
      channel = new BroadcastChannel("cth_auth_channel");
      channel.onmessage = (event) => {
        if (event.data?.type === "LOGOUT") {
          clearClientAuthCookies();
          clearClientAuthStorage();
          if (onLogout) {
            onLogout();
          } else {
            window.location.href = "/login?reason=multi_tab_logout";
          }
        }
      };
    } catch {
      // Fallback to storage events
    }
  }

  return () => {
    window.removeEventListener("storage", handleStorageEvent);
    if (channel) channel.close();
  };
}

/**
 * Authoritative Central Logout Service
 * 
 * Flow:
 * 1. Prevents duplicate / concurrent logout requests (double-click protection).
 * 2. Informs the server to invalidate session and expire cookies via POST /api/auth/logout.
 * 3. Clears all client-side auth cookies across paths.
 * 4. Clears all client-side auth storage (localStorage, sessionStorage).
 * 5. Broadcasts logout to other open tabs.
 * 6. Cleanly redirects the user to the public /login page (never leaving them stuck).
 */
export async function authLogout(options: AuthLogoutOptions = {}): Promise<void> {
  const { redirectUrl = "/login", skipApi = false, reason = "user_initiated" } = options;

  if (isLoggingOutInProgress) {
    return;
  }

  isLoggingOutInProgress = true;

  try {
    if (!skipApi && typeof fetch !== "undefined") {
      // Call server logout endpoint with short timeout so network lags never hang the UI
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
          signal: controller.signal,
          cache: "no-store",
        });
      } catch {
        // Fallback: Also attempt /api/v1/auth/logout
        try {
          await fetch("/api/v1/auth/logout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
            signal: controller.signal,
            cache: "no-store",
          });
        } catch {
          // If server fails or times out, proceed to client cleanup anyway
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }
  } finally {
    // Authoritative client-side purge (guaranteed to execute even if server/network fails)
    clearClientAuthCookies();
    clearClientAuthStorage();
    broadcastMultiTabLogout();

    isLoggingOutInProgress = false;

    // Redirect to public login entry point
    if (typeof window !== "undefined") {
      window.location.href = redirectUrl;
    }
  }
}

/**
 * Helper to check if client has an active auth cookie
 */
export function hasClientAuthSession(): boolean {
  if (typeof document === "undefined") return false;
  const cookieStr = document.cookie || "";
  return (
    cookieStr.includes("_cth_jwt=") ||
    cookieStr.includes("_medusa_jwt=") ||
    cookieStr.includes("_cth_role=") ||
    cookieStr.includes("_cth_user_id=") ||
    cookieStr.includes("_cth_phone=")
  );
}

/**
 * Helper to get currently active client role
 */
export function getClientAuthRole(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/_cth_role=([^;]+)/);
  return match ? decodeURIComponent(match[1]).toUpperCase() : null;
}
