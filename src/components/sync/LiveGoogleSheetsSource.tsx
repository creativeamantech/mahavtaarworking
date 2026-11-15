import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Database,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Upload,
  ExternalLink,
  CalendarCheck2,
  Server,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchMahavtaarWorkspaceSheet,
  getWorkspaceConnectorStatus,
  listMasterAllocationsFromConnector,
} from "@/lib/googleSheets.functions";
import { useGoogleWorkspaceAuth } from "@/lib/googleWorkspaceAuth";
import {
  APPROVED_WORKSPACE_SHEETS,
  createGoogleSpreadsheet,
  discoverCurrentMonthMasterCandidates,
  readGoogleSheet,
} from "@/lib/googleWorkspaceApi";
import { extractSheetInfo, fetchGoogleSheetCsv } from "@/lib/googleSheets";
import {
  getCurrentPeriodTarget,
  getSavedSelectedMasterSheet,
  saveSelectedMasterSheet,
  type DriveSpreadsheetCandidate,
  type MasterMatchType,
  type SelectedMasterSheetRecord,
} from "@/lib/masterAllocationMatcher";
import {
  getMasterSyncMeta,
  isMasterSyncInFlight,
  MASTER_SYNC_EVENT,
  saveMasterSyncMeta,
  setMasterSyncInFlight,
  sheetValuesToXlsxBuffer,
  subscribeMasterSyncInFlight,
} from "@/lib/masterSyncStore";
import type { LoanRecord } from "@/types/domain";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { GoogleDriveBrowserModal } from "./GoogleDriveBrowserModal";
import { GoogleActionConfirmModal } from "./GoogleActionConfirmModal";

type LoadingAction = "master" | "collections" | "custom" | "export" | null;

interface Props {
  onLoadMaster: (buffer: ArrayBuffer, sourceName: string) => Promise<{ rowCount?: number } | void>;
  records?: LoanRecord[] | undefined;
  totalRecordCount?: number | undefined;
}

export function LiveGoogleSheetsSource({ onLoadMaster, records = [], totalRecordCount }: Props) {
  const checkConnectorStatus = useServerFn(getWorkspaceConnectorStatus);
  const fetchViaConnector = useServerFn(fetchMahavtaarWorkspaceSheet);
  const listViaConnector = useServerFn(listMasterAllocationsFromConnector);

  const { googleUser, isConnected, signIn } = useGoogleWorkspaceAuth();
  const [connectorConfigured, setConnectorConfigured] = useState<boolean | null>(null);

  const currentPeriod = useMemo(() => getCurrentPeriodTarget(new Date()), []);
  const [selectedMaster, setSelectedMaster] = useState<SelectedMasterSheetRecord | null>(() =>
    getSavedSelectedMasterSheet(),
  );
  const [candidates, setCandidates] = useState<DriveSpreadsheetCandidate[]>([]);
  const [loading, setLoading] = useState<LoadingAction>(null);
  const [globalMasterSyncing, setGlobalMasterSyncing] = useState<boolean>(() =>
    isMasterSyncInFlight(),
  );
  const [collectionCount, setCollectionCount] = useState<number | null>(null);
  const [collectionUrl, setCollectionUrl] = useState<string | null>(null);
  const [lastMasterSync, setLastMasterSync] = useState<string | null>(() => {
    const initial = getMasterSyncMeta().lastSyncedAt;
    return initial ? new Date(initial).toLocaleString() : null;
  });
  const [lastExportUrl, setLastExportUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [driveBrowserOpen, setDriveBrowserOpen] = useState(false);
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
  const autoSyncedRef = useRef(false);

  useEffect(() => {
    const handleSyncUpdated = () => {
      const meta = getMasterSyncMeta();
      setLastMasterSync(meta.lastSyncedAt ? new Date(meta.lastSyncedAt).toLocaleString() : null);
      setError(meta.lastError);
    };
    const handleMasterSelected = () => {
      const saved = getSavedSelectedMasterSheet();
      if (saved) setSelectedMaster(saved);
    };
    window.addEventListener(MASTER_SYNC_EVENT, handleSyncUpdated);
    window.addEventListener("mahavtaar_master_sheet_selected", handleMasterSelected);
    window.addEventListener("storage", handleSyncUpdated);
    window.addEventListener("storage", handleMasterSelected);
    const unsubInFlight = subscribeMasterSyncInFlight(setGlobalMasterSyncing);

    return () => {
      window.removeEventListener(MASTER_SYNC_EVENT, handleSyncUpdated);
      window.removeEventListener("mahavtaar_master_sheet_selected", handleMasterSelected);
      window.removeEventListener("storage", handleSyncUpdated);
      window.removeEventListener("storage", handleMasterSelected);
      unsubInFlight();
    };
  }, []);

  const persistSelectedMaster = useCallback(
    (
      meta: {
        spreadsheetId: string;
        spreadsheetName: string;
        sheetTitle: string;
        matchType: MasterMatchType;
        webViewLink?: string | undefined;
        rowCount?: number | undefined;
      },
      options: { markSynced?: boolean } = {},
    ) => {
      const nowIso = new Date().toISOString();
      const record: SelectedMasterSheetRecord = {
        spreadsheetId: meta.spreadsheetId,
        spreadsheetName: meta.spreadsheetName,
        sheetTitle: meta.sheetTitle,
        periodLabel: currentPeriod.periodLabel,
        matchType: meta.matchType,
        webViewLink: meta.webViewLink,
        rowCount: meta.rowCount,
        selectedAt: nowIso,
      };
      saveSelectedMasterSheet(record);
      setSelectedMaster(record);
      if (options.markSynced) {
        saveMasterSyncMeta({
          lastSyncedAt: nowIso,
          spreadsheetId: meta.spreadsheetId,
          spreadsheetName: meta.spreadsheetName,
          sheetTitle: meta.sheetTitle,
          periodLabel: currentPeriod.periodLabel,
          rowCount: meta.rowCount ?? null,
          lastError: null,
        });
        setLastMasterSync(new Date(nowIso).toLocaleString());
      } else {
        saveMasterSyncMeta({
          spreadsheetId: meta.spreadsheetId,
          spreadsheetName: meta.spreadsheetName,
          sheetTitle: meta.sheetTitle,
          periodLabel: currentPeriod.periodLabel,
        });
      }
    },
    [currentPeriod.periodLabel],
  );

  // Load current month/year Master Allocation using Lovable connector first, else OAuth/public
  const loadCurrentMasterAllocation = useCallback(
    async (opts: { overrideSpreadsheetId?: string | undefined; silent?: boolean } = {}) => {
      if (isMasterSyncInFlight()) return;
      setError(null);
      setLoading("master");
      setMasterSyncInFlight(true);
      try {
        // 1. Lovable server-side connector path (no Google Sign-In required)
        if (connectorConfigured) {
          const result = await fetchViaConnector({
            data: {
              source: "master",
              ...(opts.overrideSpreadsheetId ? { spreadsheetId: opts.overrideSpreadsheetId } : {}),
            },
          });
          if (Array.isArray(result.candidates) && result.candidates.length > 0) {
            setCandidates(result.candidates);
          }
          const buffer = sheetValuesToXlsxBuffer(result.values, result.sheetTitle);
          const loaded = await onLoadMaster(buffer, result.spreadsheetName);
          const rowCount = loaded?.rowCount ?? result.rowCount;
          persistSelectedMaster(
            {
              spreadsheetId: result.spreadsheetId,
              spreadsheetName: result.spreadsheetName,
              sheetTitle: result.sheetTitle,
              matchType: result.matchType,
              webViewLink: result.webViewLink || undefined,
              rowCount,
            },
            { markSynced: true },
          );
          if (!opts.silent) {
            toast.success(
              `Master Allocation loaded: ${result.spreadsheetName} (${rowCount.toLocaleString()} rows)`,
            );
          }
          return;
        }

        // 2. Client OAuth path (when Lovable server connector is unavailable in this runtime)
        if (isConnected) {
          const discovery = await discoverCurrentMonthMasterCandidates(new Date());
          setCandidates(discovery.candidates);
          const targetId = opts.overrideSpreadsheetId || discovery.selected.id;
          const result = await readGoogleSheet(targetId, { preferredTab: "Data" });
          const loaded = await onLoadMaster(result.buffer, result.spreadsheetTitle);
          const rowCount = loaded?.rowCount ?? result.rowCount;
          persistSelectedMaster(
            {
              spreadsheetId: result.spreadsheetId,
              spreadsheetName: result.spreadsheetTitle,
              sheetTitle: result.sheetTitle,
              matchType: opts.overrideSpreadsheetId ? "PINNED_DEFAULT" : discovery.matchType,
              webViewLink: result.webViewLink,
              rowCount,
            },
            { markSynced: true },
          );
          if (!opts.silent) {
            toast.success(
              `Master Allocation loaded: ${result.spreadsheetTitle} (${rowCount.toLocaleString()} rows)`,
            );
          }
          return;
        }

        // 3. Public-link fallback before asking for Google Sign-In
        const targetId =
          opts.overrideSpreadsheetId ||
          selectedMaster?.spreadsheetId ||
          APPROVED_WORKSPACE_SHEETS.master.id;
        const info = extractSheetInfo(targetId);
        if (info) {
          try {
            const { buffer } = await fetchGoogleSheetCsv(info);
            const fallbackName =
              selectedMaster?.spreadsheetName || APPROVED_WORKSPACE_SHEETS.master.name;
            const loaded = await onLoadMaster(buffer, fallbackName);
            persistSelectedMaster(
              {
                spreadsheetId: targetId,
                spreadsheetName: fallbackName,
                sheetTitle: "Data",
                matchType: "PINNED_DEFAULT",
                rowCount: loaded?.rowCount,
              },
              { markSynced: true },
            );
            if (!opts.silent) {
              toast.success(`Master Allocation loaded: ${fallbackName}`);
            }
            return;
          } catch {
            // Fall through to OAuth sign-in prompt if sheet is private
          }
        }

        if (!opts.silent) {
          await signIn();
          const discovery = await discoverCurrentMonthMasterCandidates(new Date());
          setCandidates(discovery.candidates);
          const result = await readGoogleSheet(
            opts.overrideSpreadsheetId || discovery.selected.id,
            {
              preferredTab: "Data",
            },
          );
          const loaded = await onLoadMaster(result.buffer, result.spreadsheetTitle);
          const rowCount = loaded?.rowCount ?? result.rowCount;
          persistSelectedMaster(
            {
              spreadsheetId: result.spreadsheetId,
              spreadsheetName: result.spreadsheetTitle,
              sheetTitle: result.sheetTitle,
              matchType: discovery.matchType,
              webViewLink: result.webViewLink,
              rowCount,
            },
            { markSynced: true },
          );
          toast.success(
            `Master Allocation loaded: ${result.spreadsheetTitle} (${rowCount.toLocaleString()} rows)`,
          );
        }
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : "Unable to load Master Allocation.";
        if (!opts.silent) {
          setError(message);
          saveMasterSyncMeta({ lastError: message });
          toast.error(message);
        }
      } finally {
        setLoading(null);
        setMasterSyncInFlight(false);
      }
    },
    [
      connectorConfigured,
      fetchViaConnector,
      isConnected,
      onLoadMaster,
      persistSelectedMaster,
      selectedMaster?.spreadsheetId,
      selectedMaster?.spreadsheetName,
      signIn,
    ],
  );

  // Detect Lovable server connector on mount
  useEffect(() => {
    let active = true;
    void checkConnectorStatus()
      .then((res) => {
        if (!active) return;
        setConnectorConfigured(res.lovableConfigured);
        if (res.lovableConfigured) {
          void listViaConnector()
            .then((discovery) => {
              if (!active) return;
              setCandidates(discovery.candidates);
              // Keep current month/year Master Allocation selected
              const saved = getSavedSelectedMasterSheet();
              if (!saved || saved.periodLabel !== discovery.period.periodLabel) {
                persistSelectedMaster({
                  spreadsheetId: discovery.selected.id,
                  spreadsheetName: discovery.selected.name,
                  sheetTitle: "Data",
                  matchType: discovery.matchType,
                  webViewLink: discovery.selected.webViewLink || undefined,
                });
              }
            })
            .catch(() => {
              // Admin session may not be active yet or Drive list skipped
            });
        }
      })
      .catch(() => {
        if (active) setConnectorConfigured(false);
      });
    return () => {
      active = false;
    };
  }, [checkConnectorStatus, listViaConnector, persistSelectedMaster]);

  // Auto-discover & keep Current Month/Year Master Allocation selected when Google OAuth is connected
  useEffect(() => {
    if (!isConnected || connectorConfigured) return;
    let active = true;
    void discoverCurrentMonthMasterCandidates(new Date())
      .then((discovery) => {
        if (!active) return;
        setCandidates(discovery.candidates);
        const saved = getSavedSelectedMasterSheet();
        if (!saved || saved.periodLabel !== discovery.period.periodLabel) {
          persistSelectedMaster({
            spreadsheetId: discovery.selected.id,
            spreadsheetName: discovery.selected.name,
            sheetTitle: "Data",
            matchType: discovery.matchType,
            webViewLink: discovery.selected.webViewLink || undefined,
          });
        }
      })
      .catch(() => {
        // Ignore silent discovery failure
      });
    return () => {
      active = false;
    };
  }, [isConnected, connectorConfigured, persistSelectedMaster]);

  // Auto-load Master Data once if portfolio is currently empty and a live source is ready
  const effectiveCount = totalRecordCount ?? records.length;
  useEffect(() => {
    if (autoSyncedRef.current || effectiveCount > 0) return;
    if (connectorConfigured === true || isConnected) {
      autoSyncedRef.current = true;
      void loadCurrentMasterAllocation({
        overrideSpreadsheetId: selectedMaster?.spreadsheetId,
        silent: true,
      });
    }
  }, [
    connectorConfigured,
    isConnected,
    effectiveCount,
    loadCurrentMasterAllocation,
    selectedMaster?.spreadsheetId,
  ]);

  const loadCollectionsSource = async () => {
    setError(null);
    setLoading("collections");
    try {
      if (connectorConfigured) {
        const result = await fetchViaConnector({ data: { source: "collections" } });
        setCollectionCount(result.rowCount);
        setCollectionUrl(
          result.webViewLink ||
            `https://docs.google.com/spreadsheets/d/${result.spreadsheetId}/edit`,
        );
        toast.success(
          `Daily Collection connected (${result.sheetTitle}): ${result.rowCount.toLocaleString()} rows read.`,
        );
        return;
      }

      if (!isConnected) {
        await signIn();
      }
      const target = APPROVED_WORKSPACE_SHEETS.collections;
      const result = await readGoogleSheet(target.id, { preferredTab: target.preferredTab });
      setCollectionCount(result.rowCount);
      setCollectionUrl(
        result.webViewLink || `https://docs.google.com/spreadsheets/d/${target.id}/edit`,
      );
      toast.success(
        `Daily Collection connected (${result.sheetTitle}): ${result.rowCount.toLocaleString()} rows read.`,
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to read Daily Collection.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(null);
    }
  };

  const handleLoadFromDriveSelection = async (selection: {
    spreadsheetId: string;
    spreadsheetName: string;
    tabTitle: string;
    sheetId: number;
    webViewLink?: string | undefined;
  }) => {
    if (isMasterSyncInFlight()) return;
    setError(null);
    setLoading("custom");
    setMasterSyncInFlight(true);
    try {
      const result = await readGoogleSheet(selection.spreadsheetId, {
        preferredTab: selection.tabTitle,
        gid: String(selection.sheetId),
      });
      const loaded = await onLoadMaster(result.buffer, result.spreadsheetTitle);
      const rowCount = loaded?.rowCount ?? result.rowCount;
      persistSelectedMaster(
        {
          spreadsheetId: result.spreadsheetId,
          spreadsheetName: result.spreadsheetTitle,
          sheetTitle: result.sheetTitle,
          matchType: "PINNED_DEFAULT",
          webViewLink: result.webViewLink || selection.webViewLink,
          rowCount,
        },
        { markSynced: true },
      );
      toast.success(
        `Selected & loaded "${result.spreadsheetTitle}" (${rowCount.toLocaleString()} rows).`,
      );
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Unable to load selected Drive sheet.";
      setError(message);
      saveMasterSyncMeta({ lastError: message });
      toast.error(message);
    } finally {
      setLoading(null);
      setMasterSyncInFlight(false);
    }
  };

  const exportTitle = `Mahavtaar Portfolio Snapshot - ${new Date().toISOString().slice(0, 10)}`;

  const handleConfirmExportToDrive = async () => {
    setError(null);
    setLoading("export");
    try {
      if (!isConnected) {
        await signIn();
      }
      const headers = [
        "AGREEMENTID",
        "CUSTOMER_NAME",
        "CITY",
        "STATE",
        "BOM_BKT",
        "EXECUTIVE_NAME",
        "BOM_POS",
        "PRINCIPAL_OUTSTANDING",
        "PAID_STATUS",
        "PROVISIONAL_DAC",
        "FEEDBACK",
        "UPDATED_AT",
      ];
      const rows: (string | number | boolean | null)[][] = records
        .slice(0, 5000)
        .map((r) => [
          String(r.agreementid ?? ""),
          String(r.customer_name ?? ""),
          String(r.city ?? ""),
          String(r.state ?? ""),
          String(r.bom_bkt ?? ""),
          String(r.executive_name ?? ""),
          Number(r["bom_pos"] || 0),
          Number(r.principal_outstanding || r["bom_pos"] || 0),
          String(r["paid_status"] ?? ""),
          Number(r.provisional_dac || 0),
          String(r["feedback"] ?? ""),
          String(r.updated_at ?? ""),
        ]);

      const created = await createGoogleSpreadsheet({
        title: exportTitle,
        sheetTitle: "Data",
        rows: [headers, ...rows],
      });

      setLastExportUrl(created.spreadsheetUrl);
      setExportConfirmOpen(false);
      toast.success(
        `Created Google Sheet "${created.title}" with ${rows.length.toLocaleString()} rows in Google Drive.`,
      );
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Failed to create Google Sheet in Drive.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(null);
    }
  };

  const displayMasterName =
    selectedMaster?.spreadsheetName || APPROVED_WORKSPACE_SHEETS.master.name;
  const displayMasterUrl =
    selectedMaster?.webViewLink ||
    `https://docs.google.com/spreadsheets/d/${selectedMaster?.spreadsheetId || APPROVED_WORKSPACE_SHEETS.master.id}/edit`;

  return (
    <section className="surface-card mb-6 rounded-xl border p-5 md:p-6">
      <div className="mb-4 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Google Drive &amp; Sheets — Live Master Data
            </h3>
            <p className="text-xs text-muted-foreground">
              Auto-selects the {currentPeriod.periodLabel} Master Allocation spreadsheet for the
              current month &amp; year.
            </p>
          </div>
        </div>

        {/* Never ask for Google Sign-In when Lovable's server connector is already connected */}
        {connectorConfigured === true ? (
          <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <Server className="h-3.5 w-3.5" />
            <span>Connected via Lovable Google Connectors</span>
          </div>
        ) : connectorConfigured === false ? (
          <GoogleSignInButton compact />
        ) : (
          <span className="text-xs text-muted-foreground">Checking Workspace connection…</span>
        )}
      </div>

      {/* Selected Current-Period Master Data Banner */}
      <div className="mb-4 rounded-xl border border-primary/25 bg-primary/5 p-3.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                <CalendarCheck2 className="h-4 w-4 shrink-0" />
                Active Master Allocation ({currentPeriod.periodLabel})
              </span>
              {selectedMaster?.matchType === "EXACT_CURRENT_PERIOD" && (
                <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  Current Month Matched
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-foreground font-semibold">
              <span className="truncate">{displayMasterName}</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                · Tab: {selectedMaster?.sheetTitle || "Data"}
              </span>
              <a
                href={displayMasterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                Open in Drive <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {candidates.length > 1 && (
            <select
              aria-label="Select Master Allocation spreadsheet"
              value={selectedMaster?.spreadsheetId || APPROVED_WORKSPACE_SHEETS.master.id}
              onChange={(e) => {
                const chosenId = e.target.value;
                void loadCurrentMasterAllocation({ overrideSpreadsheetId: chosenId });
              }}
              className="h-8 max-w-xs rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground"
            >
              {candidates.map((file) => (
                <option key={file.id} value={file.id}>
                  {file.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {connectorConfigured === false && !isConnected && (
        <div className="mb-4 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
          Lovable server connectors are not active in this preview server. Connect Google once above
          if your Drive sheets are private so the app can read {currentPeriod.periodLabel} Master
          Allocation live.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Database className="h-4 w-4 text-primary" /> Master Allocation (
            {currentPeriod.periodLabel})
          </div>
          <p className="mb-3 truncate text-xs text-muted-foreground">
            {displayMasterName} · Master Data
          </p>
          <button
            type="button"
            onClick={() =>
              void loadCurrentMasterAllocation({
                overrideSpreadsheetId: selectedMaster?.spreadsheetId,
              })
            }
            disabled={loading !== null || globalMasterSyncing}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading === "master" || globalMasterSyncing ? "animate-spin" : ""}`}
            />
            {loading === "master" || globalMasterSyncing
              ? "Reading Master Sheet…"
              : `Load ${currentPeriod.monthShort} ${currentPeriod.year} Master Data`}
          </button>
          {lastMasterSync && (
            <p className="mt-2 text-[11px] text-muted-foreground">Loaded: {lastMasterSync}</p>
          )}
        </div>

        <div className="rounded-lg border border-border p-4">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <FileSpreadsheet className="h-4 w-4 text-primary" /> Daily Collection
            </span>
            {collectionUrl && (
              <a
                href={collectionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                Open <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Collections tab · Operational records
          </p>
          <button
            type="button"
            onClick={() => void loadCollectionsSource()}
            disabled={loading !== null}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-semibold text-foreground hover:bg-muted/40 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading === "collections" ? "animate-spin" : ""}`}
            />
            {loading === "collections" ? "Reading sheet…" : "Refresh Collections Connection"}
          </button>
          {collectionCount !== null && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {collectionCount.toLocaleString()} rows read from Google Drive.
            </p>
          )}
        </div>
      </div>

      {/* Drive Browser & Snapshot Export Actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => setDriveBrowserOpen(true)}
          disabled={loading !== null}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3.5 text-xs font-semibold text-foreground hover:bg-muted/50 disabled:opacity-50"
        >
          <FolderOpen className="h-3.5 w-3.5 text-primary" />
          {loading === "custom" ? "Loading Drive Sheet…" : "Browse Another Sheet in Drive"}
        </button>

        {records.length > 0 && (
          <button
            type="button"
            onClick={() => setExportConfirmOpen(true)}
            disabled={loading !== null}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3.5 text-xs font-semibold text-primary hover:bg-primary/15 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            Save Portfolio Snapshot ({Math.min(records.length, 5000).toLocaleString()} rows) to
            Drive
          </button>
        )}

        {lastExportUrl && (
          <a
            href={lastExportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
          >
            Open Exported Sheet <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
        {connectorConfigured
          ? `Lovable Drive & Sheets connector active · ${currentPeriod.periodLabel} Master Allocation kept selected`
          : isConnected && googleUser
            ? `Connected as ${googleUser.email || googleUser.displayName || "Google User"} · ${currentPeriod.periodLabel} Master Allocation selected`
            : `Selected Master Data: ${displayMasterName}`}
      </p>

      <GoogleDriveBrowserModal
        open={driveBrowserOpen}
        onClose={() => setDriveBrowserOpen(false)}
        onSelectSheet={(sel) => void handleLoadFromDriveSelection(sel)}
        title="Select Master Allocation Spreadsheet from Google Drive"
      />

      <GoogleActionConfirmModal
        open={exportConfirmOpen}
        title="Create New Spreadsheet in Google Drive?"
        description="This will create a new Google Spreadsheet in your Google Drive and write the current portfolio records."
        details={[
          `Title: ${exportTitle}`,
          "Worksheet tab: Data",
          `Rows to write: ${Math.min(records.length, 5000).toLocaleString()} records`,
        ]}
        confirmLabel="Create in Google Drive"
        isSubmitting={loading === "export"}
        onConfirm={() => void handleConfirmExportToDrive()}
        onCancel={() => setExportConfirmOpen(false)}
      />
    </section>
  );
}
