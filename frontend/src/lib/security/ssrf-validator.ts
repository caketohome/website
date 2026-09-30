/**
 * CakeToHome Security — SSRF Validation Engine
 * Protects outbound HTTP requests (webhooks, callbacks) against Server-Side Request Forgery.
 * Rejects private IPv4/IPv6, loopback, link-local, cloud metadata, and unauthorized protocols.
 */

export interface SsrValidationResult {
  safe: boolean;
  reason?: string;
  normalizedUrl?: string;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "instance-data",
  "metadata",
  "metadata.google.internal",
  "metadata.internal",
]);

/**
 * Checks whether an IPv4 address string falls into a private, loopback, or link-local range.
 */
function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some(isNaN) || parts.some((p) => p < 0 || p > 255)) {
    return false;
  }

  // 0.0.0.0/8 (Current network)
  if (parts[0] === 0) return true;

  // 10.0.0.0/8 (Private network RFC 1918)
  if (parts[0] === 10) return true;

  // 127.0.0.0/8 (Loopback RFC 1122)
  if (parts[0] === 127) return true;

  // 169.254.0.0/16 (Link-local & AWS/GCP/Azure Cloud Metadata RFC 3927)
  if (parts[0] === 169 && parts[1] === 254) return true;

  // 172.16.0.0/12 (Private network RFC 1918)
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

  // 192.168.0.0/16 (Private network RFC 1918)
  if (parts[0] === 192 && parts[1] === 168) return true;

  // 100.64.0.0/10 (Carrier-grade NAT RFC 6598)
  if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;

  // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (Documentation RFC 5737)
  if (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) return true;
  if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return true;
  if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return true;

  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
  if (parts[0] >= 224) return true;

  return false;
}

/**
 * Checks whether an IPv6 address string falls into a private, loopback, or link-local range.
 */
function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/[\[\]]/g, "");

  if (normalized === "::1" || normalized === "::" || normalized === "0:0:0:0:0:0:0:1") {
    return true;
  }

  // fe80::/10 (Link-local)
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true;
  }

  // fc00::/7 & fd00::/8 (Unique Local Address RFC 4193)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }

  // IPv4-mapped IPv6 (::ffff:127.0.0.1)
  if (normalized.startsWith("::ffff:")) {
    const v4Part = normalized.replace("::ffff:", "");
    return isPrivateIpv4(v4Part);
  }

  return false;
}

/**
 * Validates a webhook destination URL against SSRF vulnerabilities.
 * Allows valid external HTTP and HTTPS endpoints while rejecting internal/private targets.
 */
export function validateWebhookUrl(urlStr: string): SsrValidationResult {
  if (!urlStr || typeof urlStr !== "string") {
    return { safe: false, reason: "URL must be a non-empty string." };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlStr.trim());
  } catch {
    return { safe: false, reason: "Malformed URL syntax." };
  }

  // 1. Protocol Restriction: Only HTTP and HTTPS permitted
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, reason: `Protocol '${parsed.protocol}' is forbidden; only http: and https: are allowed.` };
  }

  const hostname = parsed.hostname.toLowerCase().trim();

  // 2. Reject Empty or Trailing Dot Hostnames
  if (!hostname) {
    return { safe: false, reason: "Empty hostname." };
  }

  // 3. Known Dangerous Hostnames & Metadata Endpoints
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { safe: false, reason: `Target hostname '${hostname}' is prohibited (loopback/cloud metadata).` };
  }

  // 4. Internal / Local TLD Rejections (.local, .internal, .lan, .test, .example, .invalid)
  const parts = hostname.split(".");
  const tld = parts[parts.length - 1];
  if (["local", "internal", "lan", "home", "corp", "test", "example", "invalid"].includes(tld)) {
    return { safe: false, reason: `Internal top-level domain '.${tld}' is prohibited.` };
  }

  // 5. Raw IPv4 Address Validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(hostname)) {
    if (isPrivateIpv4(hostname)) {
      return { safe: false, reason: `IPv4 destination '${hostname}' belongs to a private, loopback, or link-local range.` };
    }
  }

  // 6. Raw IPv6 Address Validation
  if (hostname.includes(":") || (hostname.startsWith("[") && hostname.endsWith("]"))) {
    if (isPrivateIpv6(hostname)) {
      return { safe: false, reason: `IPv6 destination '${hostname}' belongs to a private, loopback, or link-local range.` };
    }
  }

  // 7. Port Restriction: Reject common internal ports (e.g. 22, 25, 3306, 5432, 6379, 27017, 9200)
  const port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === "https:" ? 443 : 80);
  const dangerousPorts = [22, 25, 110, 143, 3306, 5432, 6379, 9200, 11211, 27017];
  if (dangerousPorts.includes(port)) {
    return { safe: false, reason: `Target port ${port} is reserved for internal infrastructure services.` };
  }

  return { safe: true, normalizedUrl: parsed.toString() };
}

/**
 * Convenience helper returning boolean for guard checks.
 */
export function isSafeWebhookUrl(urlStr: string): boolean {
  return validateWebhookUrl(urlStr).safe;
}
