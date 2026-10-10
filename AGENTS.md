# AGENTS.md
- The ported Mahavtaar-Ledger app is local-first and loads only in the browser via `src/components/LegacyApp.tsx` → `LegacyClient.tsx`; its modules touch localStorage/IndexedDB at import time, so never import them from server-evaluated code.
- Legacy code imports router helpers from `@/lib/router-compat`, a shim over TanStack Router; keep it instead of adding react-router-dom.
