import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useDataDispatch } from "@/contexts/DataContext";
import {
  fetchMahavtaarWorkspaceSheet,
  getWorkspaceConnectorStatus,
} from "@/lib/googleSheets.functions";
import { useGoogleWorkspaceAuth } from "@/lib/googleWorkspaceAuth";
import {
  APPROVED_WORKSPACE_SHEETS,
  discoverCurrentMonthMasterCandidates,
  readGoogleSheet,
} from "@/lib/googleWorkspaceApi";
import { extractSheetInfo, fetchGoogleSheetCsv } from "@/lib/googleSheets";
import {
  getCurrentPeriodTarget,
  getSavedSelectedMasterSheet,
  saveSelectedMasterSheet,
  type MasterMatchType,
} from "@/lib/masterAllocationMatcher";
import {
  getMasterSyncMeta,
  isMasterSyncInFlight,
  MASTER_SYNC_EVENT,
  saveMasterSyncMeta,
  setMasterSyncInFlight,
  sheetValuesToXlsxBuffer,
  subscribeMasterSyncInFlight,
  type MasterSyncMeta,
} from "@/lib/masterSyncStore";

export function useMasterSheetsSync() {
  const { loadMainSheetSource } = useDataDispatch();
  const checkConnectorStatus = useServerFn(getWorkspaceConnectorStatus);
  const fetchViaConnector = useServerFn(fetchMahavtaarWorkspaceSheet);
  const { isConnected, signIn } = useGoogleWorkspaceAuth();

  const [meta, setMeta] = useState<MasterSyncMeta>(() => getMasterSyncMeta());
  const [isSyncing, setIsSyncing] = useState<boolean>(() => isMasterSyncInFlight());
  const [lovableConfigured, setLovableConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    const syncLocal = () => setMeta(getMasterSyncMeta());
    window.addEventListener(MASTER_SYNC_EVENT, syncLocal);
    window.addEventListener("storage", syncLocal);
    const unsubInFlight = subscribeMasterSyncInFlight(setIsSyncing);

    return () => {
      window.removeEventListener(MASTER_SYNC_EVENT, syncLocal);
      window.removeEventListener("storage", syncLocal);
      unsubInFlight();
    };
  }, []);

  useEffect(() => {
    let active = true;
    void checkConnectorStatus()
      .then((res) => {
        if (active) setLovableConfigured(res.lovableConfigured);
      })
      .catch(() => {
        if (active) setLovableConfigured(false);
      });
    return () => {
      active = false;
    };
  }, [checkConnectorStatus]);

  const forceRefreshMaster = useCallback(
    async (options: { overrideSpreadsheetId?: string | undefined; silent?: boolean } = {}) => {
      if (isMasterSyncInFlight()) return;
      setMasterSyncInFlight(true);
      const periodLabel = getCurrentPeriodTarget().periodLabel;

      const recordSuccess = (payload: {
        spreadsheetId: string;
        spreadsheetName: string;
        sheetTitle: string;
        rowCount: number;
        matchType: MasterMatchType;
        webViewLink?: string | undefined;
      }) => {
        const now = new Date().toISOString();
        saveSelectedMasterSheet({
          spreadsheetId: payload.spreadsheetId,
          spreadsheetName: payload.spreadsheetName,
          sheetTitle: payload.sheetTitle,
          periodLabel,
          matchType: payload.matchType,
          webViewLink: payload.webViewLink,
          rowCount: payload.rowCount,
          selectedAt: now,
        });
        saveMasterSyncMeta({
          lastSyncedAt: now,
          spreadsheetId: payload.spreadsheetId,
          spreadsheetName: payload.spreadsheetName,
          sheetTitle: payload.sheetTitle,
          periodLabel,
          rowCount: payload.rowCount,
          lastError: null,
        });
      };

      try {
        const saved = getSavedSelectedMasterSheet();
        const isConnectorActive =
          lovableConfigured !== null
            ? lovableConfigured
            : await checkConnectorStatus()
                .then((r) => {
                  setLovableConfigured(r.lovableConfigured);
                  return r.lovableConfigured;
                })
                .catch(() => false);

        // 1. Lovable server-side connector path
        if (isConnectorActive) {
          const result = await fetchViaConnector({
            data: {
              source: "master",
              ...(options.overrideSpreadsheetId
                ? { spreadsheetId: options.overrideSpreadsheetId }
                : saved?.spreadsheetId
                  ? { spreadsheetId: saved.spreadsheetId }
                  : {}),
            },
          });
          const buffer = sheetValuesToXlsxBuffer(result.values, result.sheetTitle);
          const loaded = await loadMainSheetSource(buffer, result.spreadsheetName);
          const rowCount = loaded?.rowCount ?? result.rowCount;
          recordSuccess({
            spreadsheetId: result.spreadsheetId,
            spreadsheetName: result.spreadsheetName,
            sheetTitle: result.sheetTitle,
            rowCount,
            matchType: result.matchType,
            webViewLink: result.webViewLink || undefined,
          });
          if (!options.silent) {
            toast.success(
              `Master Allocation refreshed: ${result.spreadsheetName} (${rowCount.toLocaleString()} rows)`,
            );
          }
          return;
        }

        // 2. Client-side Google OAuth session
        if (isConnected) {
          const discovery = await discoverCurrentMonthMasterCandidates(new Date());
          const targetId =
            options.overrideSpreadsheetId || saved?.spreadsheetId || discovery.selected.id;
          const result = await readGoogleSheet(targetId, { preferredTab: "Data" });
          const loaded = await loadMainSheetSource(result.buffer, result.spreadsheetTitle);
          const rowCount = loaded?.rowCount ?? result.rowCount;
          recordSuccess({
            spreadsheetId: result.spreadsheetId,
            spreadsheetName: result.spreadsheetTitle,
            sheetTitle: result.sheetTitle,
            rowCount,
            matchType: options.overrideSpreadsheetId ? "PINNED_DEFAULT" : discovery.matchType,
            webViewLink: result.webViewLink,
          });
          if (!options.silent) {
            toast.success(
              `Master Allocation refreshed: ${result.spreadsheetTitle} (${rowCount.toLocaleString()} rows)`,
            );
          }
          return;
        }

        // 3. Public CSV fallback before requesting interactive Google Sign-In
        const fallbackId =
          options.overrideSpreadsheetId ||
          saved?.spreadsheetId ||
          APPROVED_WORKSPACE_SHEETS.master.id;
        const info = extractSheetInfo(fallbackId);
        if (info) {
          try {
            const { buffer } = await fetchGoogleSheetCsv(info);
            const fallbackName = saved?.spreadsheetName || APPROVED_WORKSPACE_SHEETS.master.name;
            const loaded = await loadMainSheetSource(buffer, fallbackName);
            const rowCount = loaded?.rowCount ?? 0;
            recordSuccess({
              spreadsheetId: fallbackId,
              spreadsheetName: fallbackName,
              sheetTitle: "Data",
              rowCount,
              matchType: "PINNED_DEFAULT",
            });
            if (!options.silent) {
              toast.success(
                `Master Allocation refreshed: ${fallbackName} (${rowCount.toLocaleString()} rows)`,
              );
            }
            return;
          } catch {
            // Private sheet -> proceed to interactive Google Sign-In
          }
        }

        if (options.silent) return;

        await signIn();
        const discovery = await discoverCurrentMonthMasterCandidates(new Date());
        const targetId = options.overrideSpreadsheetId || discovery.selected.id;
        const result = await readGoogleSheet(targetId, { preferredTab: "Data" });
        const loaded = await loadMainSheetSource(result.buffer, result.spreadsheetTitle);
        const rowCount = loaded?.rowCount ?? result.rowCount;
        recordSuccess({
          spreadsheetId: result.spreadsheetId,
          spreadsheetName: result.spreadsheetTitle,
          sheetTitle: result.sheetTitle,
          rowCount,
          matchType: discovery.matchType,
          webViewLink: result.webViewLink,
        });
        toast.success(
          `Master Allocation refreshed: ${result.spreadsheetTitle} (${rowCount.toLocaleString()} rows)`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to refresh Master Allocation.";
        saveMasterSyncMeta({ lastError: msg });
        if (!options.silent) {
          toast.error(msg);
        }
      } finally {
        setMasterSyncInFlight(false);
      }
    },
    [
      checkConnectorStatus,
      fetchViaConnector,
      isConnected,
      loadMainSheetSource,
      lovableConfigured,
      signIn,
    ],
  );

  return {
    meta,
    isSyncing,
    lovableConfigured,
    forceRefreshMaster,
  };
}
