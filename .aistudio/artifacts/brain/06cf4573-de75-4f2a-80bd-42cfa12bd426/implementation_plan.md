# Supabase Cloud Database Integration & Hybrid Architecture Plan

## 1. Overview & Architectural Goals

The user has selected:
- **Database Target**: External Supabase project connected via **Project URL** and **API Key (anon / service role)**.
- **Architecture**: **Hybrid Online + Local Offline Cache** (Supabase acts as the centralized cloud source of truth, while local IndexedDB provides instant sub-15ms performance and offline resilience).
- **Data Migration**: **Automated migration** of all existing loan records, user accounts, customer feedback, attendance logs, and targets from local IndexedDB into Supabase.

---

## 2. Architecture & Data Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         MAHAVTAAR HYBRID ENGINE                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [User Action / UI Components]                                           │
│         │                                                                │
│         ▼                                                                │
│  [Unified Data Repository Layer] (src/lib/repositories)                  │
│         │                                                                │
│    ┌────┴─────────────────────────────┐                                  │
│    ▼                                  ▼                                  │
│  [Local Cache: IndexedDB]        [Cloud Source of Truth: Supabase]      │
│  • Instant UI queries (<15ms)    • Central PostgreSQL Database           │
│  • Offline access & storage      • Multi-user cross-device sync          │
│  • Optimistic local writes       • Row-Level Security (RLS)              │
│    │                                  ▲                                  │
│    └──────────── Bidirectional ───────┘                                  │
│                 Sync & Queue                                             │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema Design (Supabase PostgreSQL)

We will provide a complete, copy-paste-ready SQL migration script that can be run directly in the Supabase SQL Editor:

1. **`loan_records`**:
   - `agreementid` (TEXT PRIMARY KEY)
   - `customer_name` (TEXT)
   - `city` (TEXT), `state` (TEXT)
   - `bom_bkt` (TEXT)
   - `principal_outstanding` (NUMERIC), `amount` (NUMERIC)
   - `executive_name` (TEXT)
   - `raw_data` (JSONB for dynamic custom columns)
   - `updated_at` (TIMESTAMPTZ DEFAULT now())
   - Indexes: `CREATE INDEX idx_loans_city_bkt ON loan_records (city, bom_bkt);`, `CREATE INDEX idx_loans_exec ON loan_records (executive_name);`

2. **`users`**:
   - `id` (TEXT PRIMARY KEY)
   - `email` (TEXT UNIQUE), `name` (TEXT), `role` (TEXT)
   - `password_hash` (TEXT), `salt` (TEXT), `iterations` (INTEGER)
   - `permissions` (JSONB)
   - `assigned_executive_name` (TEXT)

3. **`customer_feedbacks`**:
   - `id` (TEXT PRIMARY KEY), `agreementid` (TEXT REFERENCES loan_records(agreementid))
   - `agent_id` (TEXT), `agent_name` (TEXT)
   - `availability` (TEXT), `status` (TEXT), `standard_feedback` (TEXT), `detailed_feedback` (TEXT)
   - `amount_paid` (NUMERIC), `ptp_date` (TEXT)
   - `created_at` (TIMESTAMPTZ DEFAULT now())

4. **`attendance_logs`**:
   - `id` (TEXT PRIMARY KEY), `user_id` (TEXT), `user_name` (TEXT), `date` (TEXT)
   - `login_time` (TEXT), `logout_time` (TEXT), `break_duration` (INTEGER)

5. **`state_targets`**:
   - `key` (TEXT PRIMARY KEY), `pct` (NUMERIC), `updated_by` (TEXT), `updated_at` (TIMESTAMPTZ)

---

## 4. Implementation Steps

### Phase 1: Client Setup & Configuration UI
1. **Dependencies**:
   - Install `@supabase/supabase-js`.
2. **Configuration Storage**:
   - Create `src/lib/supabase/client.ts` to instantiate the Supabase client safely with fallback detection (configured vs unconfigured).
   - Support environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) as well as in-app browser configuration via Settings.
3. **Settings UI (`SupabaseConnectionTab.tsx`)**:
   - Add a dedicated "Supabase Cloud" tab in `/settings`:
     - Inputs for Project URL and API Key (Anon / Service).
     - "Test Connection" button with ping validation.
     - "Generate SQL Schema" modal (copy-pasteable SQL script for Supabase SQL Editor).
     - Live connection status badge.

### Phase 2: Automated Data Migration Engine
1. **Migration Utility (`src/lib/supabase/migrator.ts`)**:
   - Reads existing records from local Dexie IndexedDB.
   - Batch uploads records to Supabase in chunks of 500–1,000 rows to prevent payload timeout.
   - Migrates `users`, `loan_records`, `customer_feedbacks`, `attendance_logs`, and `state_targets`.
2. **Interactive Migration UI**:
   - Step-by-step migration runner in Settings showing progress bars, record counts (e.g. `12,450 / 50,000 records migrated`), error logs, and verification checks.

### Phase 3: Hybrid Sync & Repository Integration
1. **Hybrid Data Adapter (`src/lib/repositories/loanRepository.ts` & `DataContext.tsx`)**:
   - On write: Optimistically updates local IndexedDB immediately, then asynchronously pushes the mutation to Supabase.
   - On load / sync: Pulls latest updates from Supabase and reconciles with local cache.
   - Offline queue: If network is offline, mutations are queued in Dexie `sync_journal` and automatically flushed when connection is restored.

---

## 5. Verification & Testing Plan

1. **Connection & Schema Verification**:
   - Test connecting to Supabase with valid and invalid credentials.
   - Verify error messages for network errors or uncreated tables.
2. **Data Migration Accuracy**:
   - Run migration on a test dataset and verify row counts match between IndexedDB and Supabase.
3. **Offline & Online Resilience**:
   - Disconnect network: verify application remains fully usable, records can be searched, and feedback logged.
   - Reconnect network: verify queued changes automatically sync to Supabase.
4. **Automated Test Suite**:
   - Add unit tests in `src/test/supabase-integration.test.ts` to test client initialization, offline fallback, and batch chunking.
