// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import {
  FileSpreadsheet,
  Link2,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Database,
  Trash2,
  Clock,
  ExternalLink,
  ChevronDown,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  extractSheetInfo,
  previewGoogleSheet,
  getSavedSheets,
  saveSheetPreset,
  removeSheetPreset,
  type SheetPreviewResult,
  type SavedSheetPreset,
} from "../../lib/googleSheets";
import { toast } from "sonner";

interface GoogleSheetsConnectorProps {
  onImport: (
    buffer: ArrayBuffer,
    sourceTitle: string,
    type: "MAIN_DATA" | "PAID_FILE" | "ADDITIONAL_COLLECTION_FILE" | "CORRECTED_DAC_FILE",
  ) => Promise<{
    rowCount?: number;
    newCount?: number;
    updatedCount?: number;
    totalRecords?: number;
    matched?: number;
  } | void>;
  currentUser?: string;
  defaultType?: "MAIN_DATA" | "PAID_FILE" | "ADDITIONAL_COLLECTION_FILE" | "CORRECTED_DAC_FILE";
  className?: string;
}

export function GoogleSheetsConnector({
  onImport,
  currentUser = "User",
  defaultType = "MAIN_DATA",
  className = "",
}: GoogleSheetsConnectorProps) {
  const [urlInput, setUrlInput] = useState("");
  const [sheetNickname, setSheetNickname] = useState("");
  const [targetType, setTargetType] = useState<
    "MAIN_DATA" | "PAID_FILE" | "ADDITIONAL_COLLECTION_FILE" | "CORRECTED_DAC_FILE"
  >(defaultType);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [preview, setPreview] = useState<SheetPreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [savedSheets, setSavedSheets] = useState<SavedSheetPreset[]>([]);
  const [activeSyncingId, setActiveSyncingId] = useState<string | null>(null);

  // Load saved presets on mount
  useEffect(() => {
    setSavedSheets(getSavedSheets());
  }, []);

  const handleFetchPreview = async () => {
    if (!urlInput.trim()) {
      toast.error("Please enter a Google Sheet URL or Sheet ID");
      return;
    }

    setPreview(null);
    setPreviewError(null);
    setIsLoadingPreview(true);

    try {
      const result = await previewGoogleSheet(urlInput.trim());
      setPreview(result);
      if (!sheetNickname) {
        setSheetNickname(`Google Sheet (${result.sheetId.slice(0, 8)}...)`);
      }
      toast.success(`Connected! Found ${result.rowCount} rows.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect to Google Sheet";
      setPreviewError(msg);
      toast.error(msg, { duration: 6000 });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!preview) return;
    setIsImporting(true);

    const displayName = sheetNickname.trim() || `GoogleSheet_${preview.sheetId.slice(0, 8)}`;

    try {
      const result = await onImport(preview.buffer, displayName, targetType);

      // Save or update preset
      const saved = saveSheetPreset({
        name: displayName,
        url: urlInput.trim(),
        sheetId: preview.sheetId,
        gid: preview.gid,
        type: targetType,
        lastSyncedAt: new Date().toISOString(),
        lastRecordCount: preview.rowCount,
      });

      setSavedSheets(getSavedSheets());

      // Success feedback
      if (targetType === "MAIN_DATA") {
        const newCount = result?.newCount ?? preview.rowCount;
        const updatedCount = result?.updatedCount ?? 0;
        const total = result?.totalRecords ?? "";
        toast.success(
          `Master Data Merged: ${newCount} added, ${updatedCount} updated${total ? ` (${total} total active)` : ""}`,
        );
      } else {
        toast.success(`${displayName} successfully merged into ledger!`);
      }

      // Reset input form
      setPreview(null);
      setUrlInput("");
      setSheetNickname("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed";
      toast.error(`Import failed: ${msg}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleSyncPreset = async (preset: SavedSheetPreset) => {
    setActiveSyncingId(preset.id);
    try {
      const result = await previewGoogleSheet(preset.url);
      await onImport(result.buffer, preset.name, preset.type);

      saveSheetPreset({
        ...preset,
        lastSyncedAt: new Date().toISOString(),
        lastRecordCount: result.rowCount,
      });

      setSavedSheets(getSavedSheets());
      toast.success(`"${preset.name}" synced: ${result.rowCount} rows merged!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      toast.error(`Sync error for "${preset.name}": ${msg}`);
    } finally {
      setActiveSyncingId(null);
    }
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeSheetPreset(id);
    setSavedSheets(getSavedSheets());
    toast.info("Saved connection removed");
  };

  const typeLabels: Record<string, string> = {
    MAIN_DATA: "1. Master Loan Data (Auto-Merge)",
    PAID_FILE: "2. Paid Collection File",
    ADDITIONAL_COLLECTION_FILE: "3. Additional Collection (Provisional)",
    CORRECTED_DAC_FILE: "4. Corrected DAC File",
  };

  return (
    <div className={`surface-card border rounded-xl p-5 md:p-6 mb-6 ${className}`}>
      {/* Header section with zero-pill metadata */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border mb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground tracking-tight">
                Google Sheets Direct Connect
              </h3>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Live Sync & Merge
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Paste any Google Sheet URL to import or merge records by Agreement ID without manual
              file downloads.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground self-start sm:self-auto">
          <span>Local-first Dexie</span>
          <span aria-hidden="true">·</span>
          <span>Zero Server Storage</span>
        </div>
      </div>

      {/* Main Input Grid */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
          {/* URL Input */}
          <div className="lg:col-span-6 space-y-1.5">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
              Google Sheet URL or Sheet ID
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleFetchPreview();
                }}
                disabled={isLoadingPreview || isImporting}
                className="w-full h-10 px-3 pr-24 text-xs font-mono bg-background border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground/60 transition-colors"
              />
              <button
                type="button"
                onClick={handleFetchPreview}
                disabled={isLoadingPreview || isImporting || !urlInput.trim()}
                className="absolute right-1 top-1 bottom-1 px-3 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                {isLoadingPreview ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Fetching...</span>
                  </>
                ) : (
                  <>
                    <span>Fetch Sheet</span>
                    <ArrowRight className="h-3 w-3" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Dataset Type Selector */}
          <div className="lg:col-span-3 space-y-1.5">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              Dataset Destination
            </label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as any)}
              disabled={isLoadingPreview || isImporting}
              className="w-full h-10 px-3 text-xs bg-background border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground transition-colors"
            >
              <option value="MAIN_DATA">Master Data (Auto-Merge)</option>
              <option value="PAID_FILE">Paid Collection File</option>
              <option value="ADDITIONAL_COLLECTION_FILE">Additional Collection</option>
              <option value="CORRECTED_DAC_FILE">Corrected DAC</option>
            </select>
          </div>

          {/* Optional Sheet Label / Nickname */}
          <div className="lg:col-span-3 space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Friendly Name / Tag{" "}
              <span className="text-muted-foreground font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. North Zone Master"
              value={sheetNickname}
              onChange={(e) => setSheetNickname(e.target.value)}
              disabled={isLoadingPreview || isImporting}
              className="w-full h-10 px-3 text-xs bg-background border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground/60 transition-colors"
            ></input>
          </div>
        </div>

        {/* Permission Help Alert when error occurs */}
        {previewError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3.5 text-xs text-destructive space-y-1.5 animate-in fade-in">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Google Sheet Connection Notice</span>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">{previewError}</p>
            <div className="pt-1 text-[11px] text-muted-foreground flex flex-wrap items-center gap-1">
              <span>Quick fix:</span>
              <span className="font-semibold text-foreground">
                Open Google Sheet → Click "Share" (top-right) → General Access: "Anyone with the
                link can view".
              </span>
            </div>
          </div>
        )}

        {/* Preview and Confirm Section */}
        {preview && (
          <div className="rounded-xl border border-primary/20 bg-primary/[0.02] p-4 space-y-3.5 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-foreground">
                      Sheet Ready for Import
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-xs font-mono font-medium text-primary tabular-nums">
                      {preview.rowCount.toLocaleString()} rows detected
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      Target: {typeLabels[targetType]}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate max-w-md mt-0.5">
                    Sheet ID: {preview.sheetId} · GID: {preview.gid}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  disabled={isImporting}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={isImporting}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Merging into Ledger...</span>
                    </>
                  ) : (
                    <>
                      <Database className="h-3.5 w-3.5" />
                      <span>Import & Merge Records</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Column Schema Mapping & Sample Data */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">
                  Detected Columns ({preview.columns.length}):
                </span>
                {preview.hasAgreementId ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 text-[11px]">
                    <CheckCircle2 className="h-3 w-3" /> Agreement ID matched
                  </span>
                ) : (
                  <span className="text-amber-500 font-medium flex items-center gap-1 text-[11px]">
                    <AlertCircle className="h-3 w-3" /> Agreement ID column not auto-detected
                  </span>
                )}
              </div>

              {/* Badges of detected headers */}
              <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto py-1">
                {preview.columns.map((col, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 text-[11px] font-mono bg-muted text-muted-foreground rounded border border-border/80"
                  >
                    {col}
                  </span>
                ))}
              </div>

              {/* Sample Row Preview Table */}
              {preview.sampleRows.length > 0 && (
                <div className="mt-2 border border-border/80 rounded-lg overflow-x-auto bg-card/60">
                  <table className="w-full text-[11px] font-mono">
                    <thead className="bg-muted/60 text-muted-foreground border-b border-border/80">
                      <tr>
                        {preview.columns.slice(0, 6).map((col, i) => (
                          <th
                            key={i}
                            className="text-left px-3 py-1.5 font-medium whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {preview.sampleRows.slice(0, 3).map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-muted/30">
                          {preview.columns.slice(0, 6).map((col, cIdx) => (
                            <td
                              key={cIdx}
                              className="px-3 py-1.5 whitespace-nowrap text-foreground/80 truncate max-w-[160px]"
                            >
                              {String(row[col] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Saved Sheets Presets Section */}
        {savedSheets.length > 0 && (
          <div className="pt-3 border-t border-border mt-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Saved Sheet Presets ({savedSheets.length})
              </span>
              <span className="text-[11px] text-muted-foreground">
                One-click sync to refresh ledger with newest sheet updates
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {savedSheets.map((preset) => {
                const isSyncing = activeSyncingId === preset.id;
                return (
                  <div
                    key={preset.id}
                    className="group border border-border hover:border-primary/40 rounded-lg p-3 bg-card hover:bg-card/80 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground truncate max-w-[160px]">
                          {preset.name}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleDeletePreset(preset.id, e)}
                          title="Remove saved sheet"
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                        <span>{typeLabels[preset.type]?.split(".")[1]?.trim() || preset.type}</span>
                        {preset.lastRecordCount !== undefined && (
                          <>
                            <span>·</span>
                            <span className="font-mono tabular-nums">
                              {preset.lastRecordCount} rows
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground font-mono">
                        {preset.lastSyncedAt
                          ? new Date(preset.lastSyncedAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Not synced"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSyncPreset(preset)}
                        disabled={isSyncing || isImporting}
                        className="px-2.5 py-1 font-medium bg-primary/10 hover:bg-primary/20 text-primary rounded text-[11px] flex items-center gap-1 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
                        <span>{isSyncing ? "Syncing..." : "Sync Now"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
