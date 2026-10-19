// @ts-nocheck
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_CONFIG_STORAGE_KEY = 'mahavtaar_supabase_config';

export interface SupabaseConfig {
  url: string;
  key: string;
  connectedAt?: string;
  lastTestedAt?: string;
}

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';

/**
 * Retrieves the stored Supabase configuration from localStorage or Vite environment variables.
 */
export function getSupabaseConfig(): SupabaseConfig | null {
  try {
    const raw = localStorage.getItem(SUPABASE_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.url === 'string' && typeof parsed.key === 'string' && parsed.url && parsed.key) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse Supabase config from storage', err);
  }

  // Fallback to Vite environment variables if configured
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
  if (envUrl && envKey) {
    return { url: envUrl, key: envKey };
  }

  return null;
}

/**
 * Saves new Supabase configuration to localStorage and resets cached client.
 */
export function saveSupabaseConfig(url: string, key: string): void {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const cleanKey = key.trim();

  const config: SupabaseConfig = {
    url: cleanUrl,
    key: cleanKey,
    connectedAt: new Date().toISOString(),
  };

  localStorage.setItem(SUPABASE_CONFIG_STORAGE_KEY, JSON.stringify(config));
  cachedClient = null;
  cachedConfigKey = '';

  window.dispatchEvent(new CustomEvent('mahavtaar_supabase_config_changed', { detail: config }));
}

/**
 * Clears stored Supabase configuration.
 */
export function clearSupabaseConfig(): void {
  localStorage.removeItem(SUPABASE_CONFIG_STORAGE_KEY);
  cachedClient = null;
  cachedConfigKey = '';
  window.dispatchEvent(new CustomEvent('mahavtaar_supabase_config_changed', { detail: null }));
}

/**
 * Returns true if Supabase URL and Key are configured.
 */
export function isSupabaseConfigured(): boolean {
  const config = getSupabaseConfig();
  return Boolean(config && config.url && config.key);
}

/**
 * Returns an initialized SupabaseClient instance, or null if unconfigured.
 */
export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config) return null;

  const currentKey = `${config.url}::${config.key}`;
  if (cachedClient && cachedConfigKey === currentKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.url, config.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    cachedConfigKey = currentKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

/**
 * Tests connection to a Supabase project by verifying table access.
 */
export async function testSupabaseConnection(
  targetUrl?: string,
  targetKey?: string
): Promise<{ success: boolean; message: string; tablesFound?: string[]; missingTables?: string[] }> {
  const url = (targetUrl || getSupabaseConfig()?.url || '').trim().replace(/\/+$/, '');
  const key = (targetKey || getSupabaseConfig()?.key || '').trim();

  if (!url || !key) {
    return {
      success: false,
      message: 'Please provide both Supabase Project URL and API Key.',
    };
  }

  try {
    const testClient = createClient(url, key, {
      auth: { persistSession: false },
    });

    // Check if key tables exist and are readable
    const requiredTables = ['loan_records', 'users', 'customer_feedbacks', 'attendance_logs', 'state_targets'];
    const tablesFound: string[] = [];
    const missingTables: string[] = [];

    // Probe loan_records
    const { error: loanErr } = await testClient.from('loan_records').select('agreementid').limit(1);
    if (!loanErr) {
      tablesFound.push('loan_records');
    } else {
      missingTables.push('loan_records');
    }

    // Probe users
    const { error: userErr } = await testClient.from('users').select('id').limit(1);
    if (!userErr) {
      tablesFound.push('users');
    } else {
      missingTables.push('users');
    }

    // Probe customer_feedbacks
    const { error: feedErr } = await testClient.from('customer_feedbacks').select('id').limit(1);
    if (!feedErr) {
      tablesFound.push('customer_feedbacks');
    } else {
      missingTables.push('customer_feedbacks');
    }

    if (missingTables.length > 0 && tablesFound.length === 0) {
      return {
        success: false,
        message: 'Connected to Supabase project, but the required tables do not exist yet. Please run the SQL Schema setup in your Supabase SQL Editor.',
        tablesFound,
        missingTables,
      };
    }

    if (missingTables.length > 0) {
      return {
        success: true,
        message: `Connected! Found tables: ${tablesFound.join(', ')}. Some optional tables are missing (${missingTables.join(', ')}).`,
        tablesFound,
        missingTables,
      };
    }

    return {
      success: true,
      message: `Connection successful! All required tables are present (${tablesFound.join(', ')}).`,
      tablesFound,
      missingTables: [],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Failed to connect to Supabase: ${msg}`,
    };
  }
}
