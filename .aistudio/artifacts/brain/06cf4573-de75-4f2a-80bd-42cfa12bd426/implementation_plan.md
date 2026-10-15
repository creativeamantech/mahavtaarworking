# Advanced User-Friendly Data Explorer & Auto-Sync Engine

Elevate the Mahavtaar Ledger user experience with a modern, high-density Data Explorer grid, lightning-fast multi-attribute customer search with term highlighting, instant view presets, sticky column pinning, and a configurable background auto-sync timer for connected Google Sheets.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following directions were aligned based on your responses:
> - **Primary Priority**: Data Explorer grid and customer search experience.
> - **Google Sheets Automation**: One-click auto sync with a background refresh timer (configurable intervals: 5m, 15m, 30m, 60m, or manual).
> - **Language**: English interface with simplified, intuitive financial terminology and contextual help tooltips.

- **Confirmed Decision 1**: Modernize the Data Explorer with a high-density, spreadsheet-grade layout, sticky key columns (`Agreement ID` & `Customer Name`), and instant search term highlighting.
- **Confirmed Decision 2**: Provide Quick View Presets (e.g., *Collection Action View*, *Financial Reconciliation View*, *Contact & Field View*) to eliminate column clutter.
- **Confirmed Decision 3**: Background Google Sheets Sync Engine with active interval countdown, silent differential merge by `agreementid`, and a non-intrusive status indicator.

---

### 1. Overview & Core Concept

- **What It Does**:
  1. **Advanced Data Explorer**: Re-architects the primary data grid into an institutional financial workbench. Users can search across Loan ID, Borrower Name, City, Phone Number, and Executive Name with instant debounced execution and visual keyword highlighting. Sticky columns ensure loan identity is always in view while scrolling horizontally through 30+ data fields.
  2. **View Presets & Quick Segment Controls**: One-click toggle between customized column sets (Action View, Financials, Contact Info) and rapid segmented status chips (`All`, `Unpaid`, `PTP`, `Dispute/Conflict`, `High POS > ₹1L`).
  3. **Background Auto-Sync Engine**: Enables hands-free synchronization with connected Google Sheets on scheduled intervals (5m / 15m / 30m / 1h) without interrupting current ledger workflows.
- **Target Audience / Persona**: Collection Managers tracking portfolio status, Team Leads assigning cases, and Executive Field Agents looking up borrower details in seconds.
- **Key Value**: Drastically cuts search time from minutes to milliseconds, removes horizontal scrolling friction, and keeps the ledger automatically up to date with live Google Sheets.

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Omni-Search & Term Highlighting**:
   - User types in the omni-search bar (e.g. `delhi 50000`).
   - The grid filters in real time with sub-20ms debounce. Matching text in the table rows (such as city or loan number) is subtly highlighted with high-contrast text markers (`bg-primary/15 text-primary font-medium`).
2. **Sticky Column Pinning & Horizontal Scroll**:
   - When scrolling horizontally through extensive fields (POS, BCC, Penal, DAC, ECS, Allocation Date, Addresses), `Agreement ID` and `Customer Name` remain pinned to the left edge with a subtle border shadow separator.
3. **Quick Column Presets**:
   - User switches between dedicated workbench views:
     - **Default Operations**: Loan ID, Customer, Bucket, Status, POS, Collected DAC, Executive, Action.
     - **Financial Audit**: POS, EMI, BCC Pending, Penal, Approx Foreclosure, ECS, Special.
     - **Field Contact**: Phone, Mailing Address, Alternate Mobile, City, State, Allocation Date.
4. **Interactive Loan Detail Quick Drawer**:
   - Clicking any loan row slides open an ergonomic right drawer displaying the 360-degree loan overview: repayment breakdown, contact details, payment history, and one-click phone dial/note log.
5. **Scheduled Background Auto-Sync Bar**:
   - Located inside the Google Sheets connector and header: shows a subtle sync status countdown (e.g., `Auto-sync: Every 15 min · Next in 08:42`).
   - Includes a manual "Sync Now" button and interval picker dropdown.

#### Visual Identity & Theme (SaaS Dashboard Constitution)
- **Compact Density**: 38px row height with zero text clipping and vertical borders.
- **Tabular Figures**: Monospace numeric styling (`font-mono tabular-nums text-right`) for all POS, EMI, and collected figures.
- **Zero-Pill Metadata**: Status and counts use unboxed typographic labels with clear symbol accents (`·`), avoiding bulbous candy pills.
- **Color Discipline**: Neutral canvas (`#0d111a` dark / `#f8fafc` light) with focused cobalt action points (`#3b82f6`) and green status markers (`#16a34a`).

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Client-Side CSS Sticky Grid vs. Heavy Virtual Table Libraries**
  - *Chosen Approach*: Native CSS `position: sticky; left: 0` pinning combined with TanStack Table virtualization and pagination.
  - *Why*: Ultra-fast rendering with zero external library bloat, seamless touch scroll on mobile devices, and zero layout shift.
  - *Alternatives Considered*: AG-Grid or heavy enterprise plugins (adds significant bundle overhead and breaks local-first reactivity).

- **Decision 2: Tab-Leader Background Timer for Google Sheets Sync**
  - *Chosen Approach*: Web-based timer utilizing `setInterval` with timestamp checking in `localStorage`.
  - *Why*: Reliable in single-page apps without requiring server cron daemons, respecting the browser-only local-first rule in `AGENTS.md`.

- **Decision 3: Non-Blocking Differential Merging**
  - *Chosen Approach*: Background auto-sync performs differential comparison; if incoming rows have no changes, the UI avoids unnecessary re-renders. A quiet toast notification informs the user only when new loans or payments arrive.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DATA EXPLORER WORKBENCH                         │
│  ┌─────────────────────────────┐   ┌────────────────────────────────┐  │
│  │ Multi-Term Omni Search Bar  │   │ Quick Segment Filters          │  │
│  │ (Debounced + Term Highlight)│   │ [All] [Unpaid] [PTP] [Conflict]│  │
│  └──────────────┬──────────────┘   └───────────────┬────────────────┘  │
│                 │                                  │                   │
│                 ▼                                  ▼                   │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ High-Density Interactive Grid (Sticky ID & Customer Columns)     │  │
│  │ [Column Presets: Operations · Financial · Contact & Field]       │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
└─────────────────────────────────┼──────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   BACKGROUND GOOGLE SHEETS AUTO-SYNC                   │
│  ┌──────────────────────────────┐   ┌───────────────────────────────┐  │
│  │ Background Sync Scheduler    │──►│ Live Differential Fetcher     │  │
│  │ (5m / 15m / 30m / 60m / Off) │   │ (Checks GID CSV & ETag)       │  │
│  └──────────────────────────────┘   └───────────────┬───────────────┘  │
│                                                     ▼                  │
│                                     ┌───────────────────────────────┐  │
│                                     │ mergeMainIntoRecords() Engine │  │
│                                     │ (IndexedDB bulkPut + Journal) │  │
│                                     └───────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

#### Key Components to Build & Enhance:
1. **`src/components/explorer/EnhancedDataGrid.tsx`**:
   - Sticky pinned columns for Agreement ID and Customer Name.
   - Live query term highlighter wrapping matching text in `<mark>` tags.
   - Column visibility preset switcher (Operations, Financial, Contact).
   - Quick export of currently filtered views directly to Excel/CSV.
2. **`src/components/explorer/QuickFilterPills.tsx`**:
   - Clean segmented status buttons for Bucket (1-5), Paid/Unpaid, Conflict, and POS range.
3. **`src/components/sync/AutoSyncScheduler.tsx`**:
   - Manages auto-sync intervals (5m, 15m, 30m, 1h).
   - Displays real-time countdown timer and active sync status.
   - Executes silent background fetch of saved Google Sheets into `DataContext`.
