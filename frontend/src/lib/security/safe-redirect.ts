/**
 * Only same-site paths are allowed as "go back to" targets.
 * Rejects //host, /\host and hidden tabs/newlines (browsers strip them, turning "/<tab>/host" into //host).
 */
export function safeInternalPath(raw: unknown): string | undefined {
  const v = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  if (typeof v !== "string" || !v.startsWith("/")) return undefined;
  if (/[\x00-\x1f\x7f\\]/.test(v)) return undefined;
  if (v.startsWith("//")) return undefined;
  return v;
}
