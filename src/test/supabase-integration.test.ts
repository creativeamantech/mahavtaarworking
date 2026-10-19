// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { SUPABASE_SQL_SCHEMA } from '@/lib/supabase/sqlGenerator';
import { 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  clearSupabaseConfig, 
  isSupabaseConfigured,
  testSupabaseConnection 
} from '@/lib/supabase/client';

describe('Supabase Cloud Integration', () => {
  beforeEach(() => {
    clearSupabaseConfig();
  });

  it('generates a valid SQL schema containing all required application tables', () => {
    expect(SUPABASE_SQL_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS public.loan_records');
    expect(SUPABASE_SQL_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS public.users');
    expect(SUPABASE_SQL_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS public.customer_feedbacks');
    expect(SUPABASE_SQL_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS public.attendance_logs');
    expect(SUPABASE_SQL_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS public.state_targets');
    expect(SUPABASE_SQL_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS public.audit_log');
    expect(SUPABASE_SQL_SCHEMA).toContain('ENABLE ROW LEVEL SECURITY');
  });

  it('correctly handles unconfigured Supabase state', () => {
    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabaseConfig()).toBeNull();
  });

  it('saves and retrieves Supabase credentials', () => {
    const testUrl = 'https://abcdefghijklm.supabase.co';
    const testKey = 'sample-anon-key-12345';

    saveSupabaseConfig(testUrl, testKey);
    expect(isSupabaseConfigured()).toBe(true);

    const config = getSupabaseConfig();
    expect(config?.url).toBe(testUrl);
    expect(config?.key).toBe(testKey);

    clearSupabaseConfig();
    expect(isSupabaseConfigured()).toBe(false);
  });

  it('fails gracefully when testing connection with empty credentials', async () => {
    const result = await testSupabaseConnection('', '');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Please provide both');
  });
});
