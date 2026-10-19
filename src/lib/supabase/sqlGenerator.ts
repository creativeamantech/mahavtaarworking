/**
 * Supabase PostgreSQL Database Schema Generator for Mahavtaar Ledger
 * Generates all required SQL tables, indexes, constraints, and Row Level Security (RLS) policies.
 */

export const SUPABASE_SQL_SCHEMA = `-- ==============================================================================
-- MAHAVTAAR ENTERPRISES LEDGER - SUPABASE POSTGRESQL SCHEMA
-- Run this script in your Supabase Project -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Enable UUID Extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Loan Records Table (Core Portfolio Data)
CREATE TABLE IF NOT EXISTS public.loan_records (
    agreementid TEXT PRIMARY KEY,
    customer_name TEXT,
    city TEXT,
    state TEXT,
    bom_bkt TEXT,
    principal_outstanding NUMERIC DEFAULT 0,
    amount NUMERIC DEFAULT 0,
    executive_name TEXT,
    contact_number TEXT,
    is_conflict BOOLEAN DEFAULT FALSE,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Fast Query Indexes for Pivots, Filters, and Executive allocations
CREATE INDEX IF NOT EXISTS idx_loan_records_city_bkt ON public.loan_records (city, bom_bkt);
CREATE INDEX IF NOT EXISTS idx_loan_records_state_bkt ON public.loan_records (state, bom_bkt);
CREATE INDEX IF NOT EXISTS idx_loan_records_executive ON public.loan_records (executive_name);
CREATE INDEX IF NOT EXISTS idx_loan_records_bom_bkt ON public.loan_records (bom_bkt);
CREATE INDEX IF NOT EXISTS idx_loan_records_updated_at ON public.loan_records (updated_at);

-- 3. System Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'VIEWER',
    password_hash TEXT,
    salt TEXT,
    iterations INTEGER DEFAULT 100000,
    permissions JSONB DEFAULT '{"views": []}'::jsonb,
    assigned_executive_name TEXT,
    maintenance_mode BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Customer Feedback & Dispositions Table
CREATE TABLE IF NOT EXISTS public.customer_feedbacks (
    id TEXT PRIMARY KEY,
    agreementid TEXT NOT NULL REFERENCES public.loan_records(agreementid) ON DELETE CASCADE,
    contact_number TEXT,
    availability TEXT NOT NULL,
    status TEXT NOT NULL,
    standard_feedback TEXT,
    detailed_feedback TEXT,
    amount_paid NUMERIC DEFAULT 0,
    payment_mode TEXT,
    ptp_date TEXT,
    agent_id TEXT,
    agent_name TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedbacks_agreementid ON public.customer_feedbacks (agreementid);
CREATE INDEX IF NOT EXISTS idx_feedbacks_agent_id ON public.customer_feedbacks (agent_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at ON public.customer_feedbacks (created_at);

-- 5. Attendance & Punch Logs Table
CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    date TEXT NOT NULL,
    login_time TEXT NOT NULL,
    logout_time TEXT,
    break_duration INTEGER DEFAULT 0,
    current_break_start TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance_logs (user_id, date);

-- 6. State & City Recovery Targets Table
CREATE TABLE IF NOT EXISTS public.state_targets (
    key TEXT PRIMARY KEY,
    pct NUMERIC NOT NULL,
    target_date TEXT,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 7. Audit Log Table
CREATE TABLE IF NOT EXISTS public.audit_log (
    id TEXT PRIMARY KEY,
    agreementid TEXT,
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_agreementid ON public.audit_log (agreementid);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log (created_at);

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.loan_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.state_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 9. Open Access Policies for Authenticated Application Clients (anon & service_role)
DROP POLICY IF EXISTS "Allow anon read loan_records" ON public.loan_records;
CREATE POLICY "Allow anon read loan_records" ON public.loan_records FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon write loan_records" ON public.loan_records;
CREATE POLICY "Allow anon write loan_records" ON public.loan_records FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read users" ON public.users;
CREATE POLICY "Allow anon read users" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon write users" ON public.users;
CREATE POLICY "Allow anon write users" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read feedbacks" ON public.customer_feedbacks;
CREATE POLICY "Allow anon read feedbacks" ON public.customer_feedbacks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon write feedbacks" ON public.customer_feedbacks;
CREATE POLICY "Allow anon write feedbacks" ON public.customer_feedbacks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read attendance" ON public.attendance_logs;
CREATE POLICY "Allow anon read attendance" ON public.attendance_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon write attendance" ON public.attendance_logs;
CREATE POLICY "Allow anon write attendance" ON public.attendance_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read targets" ON public.state_targets;
CREATE POLICY "Allow anon read targets" ON public.state_targets FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon write targets" ON public.state_targets;
CREATE POLICY "Allow anon write targets" ON public.state_targets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read audit_log" ON public.audit_log;
CREATE POLICY "Allow anon read audit_log" ON public.audit_log FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon write audit_log" ON public.audit_log;
CREATE POLICY "Allow anon write audit_log" ON public.audit_log FOR ALL USING (true) WITH CHECK (true);
`;
