/**
 * CakeToHome — Supabase Auth Configuration
 * 
 * Central configuration for Supabase Authentication & Database Integration.
 * Strictly avoids exposing secret keys to client bundles.
 */

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
  hasValidConfig: boolean;
  projectRef: string;
  isDevelopment: boolean;
}

function extractProjectRef(url: string): string {
  try {
    const parsed = new URL(url);
    const hostParts = parsed.hostname.split('.');
    if (hostParts.length >= 3 && hostParts[1] === 'supabase') {
      return hostParts[0];
    }
  } catch {}
  return 'unknown';
}

export function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  const isDevelopment = process.env.NODE_ENV !== 'production';

  const hasValidConfig = Boolean(
    url &&
    url.startsWith('https://') &&
    publishableKey &&
    publishableKey.length > 20
  );

  const projectRef = extractProjectRef(url);

  return {
    url,
    publishableKey,
    hasValidConfig,
    projectRef,
    isDevelopment,
  };
}
