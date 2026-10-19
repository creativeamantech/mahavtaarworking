// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  Database, Users, MessageSquare, CalendarClock, Target, 
  ExternalLink, Plus, RefreshCw, CheckCircle2, AlertTriangle, 
  XCircle, Copy, Download, Link2, ShieldCheck, HardDrive, 
  Clock, Info, ChevronRight, Check, Trash2, ArrowUpRight
} from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { useWorkspaceTabs } from '@/contexts/WorkspaceTabsContext';
import { 
  MODULE_DEFINITIONS, 
  ModuleId, 
  LinkedModuleSheet, 
  getLinkedModuleSheets, 
  saveLinkedModuleSheet, 
  unlinkModuleSheet, 
  validateModuleSheet, 
  syncModuleSheet, 
  syncAllLinkedModuleSheets, 
  getCapacityMetrics, 
  downloadModuleTemplateCsv, 
  generateModuleTemplateCsv,
  MAX_SHEET_BYTES
} from '@/lib/multiSpreadsheetManager';
import { 
  getAutoSyncInterval, 
  setAutoSyncInterval, 
  getAutoSyncStatus, 
  subscribeAutoSync, 
  AutoSyncInterval 
} from '@/lib/autoSyncEngine';

const MODULE_ICONS: Record<string, React.ElementType> = {
  Users,
  Database,
  MessageSquare,
  CalendarClock,
  Target,
};

export function SpreadsheetManagementTab() {
  const [linkedSheets, setLinkedSheets] = useState(getLinkedModuleSheets());
  const [autoSyncStatus, setAutoSyncStatus] = useState(getAutoSyncStatus());
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingModules, setSyncingModules] = useState<Record<string, boolean>>({});

  // Link Dialog State
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [activeModuleForModal, setActiveModuleForModal] = useState<ModuleId | null>(null);
  const [inputUrl, setInputUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { setTabDirty } = useWorkspaceTabs();

  // Track unsaved link URL input on /settings tab
  useEffect(() => {
    if (linkModalOpen && inputUrl && inputUrl.trim().length > 0) {
      setTabDirty('/settings', true, { label: 'Unsaved spreadsheet connection', count: 1 });
    }
  }, [linkModalOpen, inputUrl, setTabDirty]);

  // Create in Drive Dialog State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeModuleForCreate, setActiveModuleForCreate] = useState<ModuleId | null>(null);
  const [copiedHeaders, setCopiedHeaders] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setLinkedSheets(getLinkedModuleSheets());
    };
    window.addEventListener('mahavtaar_spreadsheets_changed', handleUpdate);
    window.addEventListener('mahavtaar_data_synced', handleUpdate);

    const unsubSync = subscribeAutoSync((status) => {
      setAutoSyncStatus(status);
    });

    return () => {
      window.removeEventListener('mahavtaar_spreadsheets_changed', handleUpdate);
      window.removeEventListener('mahavtaar_data_synced', handleUpdate);
      unsubSync();
    };
  }, []);

  const moduleIds = Object.keys(MODULE_DEFINITIONS) as ModuleId[];
  const connectedCount = moduleIds.filter((id) => linkedSheets[id] !== null).length;

  const totalCalculatedBytes = moduleIds.reduce((sum, id) => {
    return sum + (linkedSheets[id]?.estimatedSizeBytes || 0);
  }, 0);

  const handleOpenLinkModal = (moduleId: ModuleId) => {
    setActiveModuleForModal(moduleId);
    setInputUrl(linkedSheets[moduleId]?.url || '');
    setValidationResult(null);
    setValidationError(null);
    setLinkModalOpen(true);
  };

  const handleOpenCreateModal = (moduleId: ModuleId) => {
    setActiveModuleForCreate(moduleId);
    setCopiedHeaders(false);
    setInputUrl('');
    setValidationResult(null);
    setValidationError(null);
    setCreateModalOpen(true);
  };

  const handleTestConnection = async () => {
    if (!activeModuleForModal && !activeModuleForCreate) return;
    const moduleId = (activeModuleForModal || activeModuleForCreate)!;

    if (!inputUrl.trim()) {
      setValidationError('Please enter a valid Google Sheet URL or ID.');
      return;
    }

    setIsTesting(true);
    setValidationError(null);
    setValidationResult(null);

    try {
      const result = await validateModuleSheet(moduleId, inputUrl.trim());
      setValidationResult(result);
      if (!result.isValid) {
        toast.warning(
          `Sheet reachable, but missing required headers: ${result.missingRequiredHeaders.join(', ')}`
        );
      } else {
        toast.success(`Google Sheet verified! Found ${result.rowCount} rows.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setValidationError(msg);
      toast.error(msg);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveLink = () => {
    const moduleId = activeModuleForModal || activeModuleForCreate;
    if (!moduleId || !validationResult) return;

    const def = MODULE_DEFINITIONS[moduleId];
    const newSheet: LinkedModuleSheet = {
      moduleId,
      sheetId: validationResult.sheetInfo.sheetId,
      gid: validationResult.sheetInfo.gid,
      url: inputUrl.trim(),
      name: def.name,
      driveViewUrl: validationResult.driveViewUrl,
      connectedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      lastSyncStatus: 'SUCCESS',
      recordCount: validationResult.rowCount,
      estimatedSizeBytes: validationResult.estimatedBytes,
      foundHeaders: validationResult.foundHeaders,
      missingHeaders: validationResult.missingRequiredHeaders,
    };

    saveLinkedModuleSheet(newSheet);
    setLinkedSheets(getLinkedModuleSheets());
    setLinkModalOpen(false);
    setCreateModalOpen(false);
    toast.success(`${def.name} successfully linked to Google Sheet!`);
  };

  const handleUnlink = (moduleId: ModuleId) => {
    const def = MODULE_DEFINITIONS[moduleId];
    if (confirm(`Are you sure you want to unlink the Google Sheet for "${def.name}"?`)) {
      unlinkModuleSheet(moduleId);
      setLinkedSheets(getLinkedModuleSheets());
      toast.info(`Unlinked spreadsheet from ${def.name}`);
    }
  };

  const handleSyncModule = async (moduleId: ModuleId) => {
    const def = MODULE_DEFINITIONS[moduleId];
    setSyncingModules((prev) => ({ ...prev, [moduleId]: true }));
    try {
      const res = await syncModuleSheet(moduleId);
      if (res.error) {
        toast.error(`Sync error for ${def.name}: ${res.error}`);
      } else {
        toast.success(
          `Synced ${def.name}: ${res.rowCount} rows processed (${res.newRows} new, ${res.updatedRows} updated)`
        );
      }
      setLinkedSheets(getLinkedModuleSheets());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to sync ${def.name}: ${msg}`);
    } finally {
      setSyncingModules((prev) => ({ ...prev, [moduleId]: false }));
    }
  };

  const handleSyncAll = async () => {
    if (connectedCount === 0) {
      toast.info('No module spreadsheets linked yet. Connect a sheet first.');
      return;
    }

    setSyncingAll(true);
    try {
      const res = await syncAllLinkedModuleSheets();
      if (res.errors.length > 0) {
        toast.warning(`Synced with notices: ${res.errors.join('; ')}`);
      } else {
        toast.success(
          `All ${res.successfulModules} spreadsheets synced successfully (${res.totalRows} records, ${(res.totalBytes / 1024).toFixed(1)} KB)`
        );
      }
      setLinkedSheets(getLinkedModuleSheets());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Global sync failed';
      toast.error(msg);
    } finally {
      setSyncingAll(false);
    }
  };

  const handleCopyHeaders = (moduleId: ModuleId) => {
    const csv = generateModuleTemplateCsv(moduleId);
    const headersOnly = csv.split('\r\n')[0] || '';
    navigator.clipboard.writeText(headersOnly);
    setCopiedHeaders(true);
    toast.success('Column headers copied to clipboard!');
    setTimeout(() => setCopiedHeaders(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Architecture Overview Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-linear-to-r from-card via-card to-primary/5 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Google 10 MB Limit Protection Architecture</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Multi-Spreadsheet Management Center
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Google Drive blocks single spreadsheets exceeding <strong>10 MB</strong>. Mahavtaar Ledger divides your organization's data across dedicated, linked spreadsheets per module—keeping all files lightweight, fast, and completely immune to quota lockouts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button
              onClick={handleSyncAll}
              disabled={syncingAll || connectedCount === 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncingAll ? 'animate-spin' : ''}`} />
              {syncingAll ? 'Syncing All Sheets...' : 'Sync All Spreadsheets'}
            </Button>
          </div>
        </div>

        {/* Quick Metric Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-border/60">
          <div className="bg-background/60 backdrop-blur rounded-xl p-3 border border-border/80">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Connected Modules</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black tabular-nums text-foreground">{connectedCount}</span>
              <span className="text-xs text-muted-foreground">/ {moduleIds.length} Dedicated Sheets</span>
            </div>
          </div>

          <div className="bg-background/60 backdrop-blur rounded-xl p-3 border border-border/80">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Combined Data Size</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                {(totalCalculatedBytes / 1024).toFixed(1)} KB
              </span>
              <span className="text-xs text-muted-foreground">100% Safe (&lt; 10 MB per sheet)</span>
            </div>
          </div>

          <div className="bg-background/60 backdrop-blur rounded-xl p-3 border border-border/80">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Auto-Sync Timer</span>
            <div className="flex items-center justify-between mt-1">
              <select
                value={String(autoSyncStatus.interval)}
                onChange={(e) => {
                  const val = Number(e.target.value) as AutoSyncInterval;
                  setAutoSyncInterval(val);
                  if (val > 0) toast.success(`Auto-sync set to every ${val} minutes`);
                  else toast.info('Auto-sync disabled');
                }}
                className="text-xs font-semibold bg-transparent border-0 text-foreground cursor-pointer focus:ring-0 p-0"
              >
                <option value="0">Disabled (Manual Only)</option>
                <option value="5">Every 5 minutes</option>
                <option value="15">Every 15 minutes</option>
                <option value="30">Every 30 minutes</option>
                <option value="60">Every 1 hour</option>
              </select>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>

      {/* Module Spreadsheets List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground">
            Dedicated Google Spreadsheets ({moduleIds.length})
          </h3>
          <span className="text-xs text-muted-foreground">
            Click 'Create in Google Drive' for new sheets or 'Link Sheet' to connect existing files
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {moduleIds.map((moduleId) => {
            const def = MODULE_DEFINITIONS[moduleId];
            const linked = linkedSheets[moduleId];
            const IconComponent = MODULE_ICONS[def.iconName] || Database;
            const isSyncing = syncingModules[moduleId];
            const capacity = getCapacityMetrics(linked?.estimatedSizeBytes || 0);

            return (
              <div
                key={moduleId}
                className="rounded-xl border border-border bg-card p-5 transition-all hover:border-border/80 hover:shadow-xs"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Info */}
                  <div className="flex items-start gap-4">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-bold text-foreground">{def.name}</h4>
                        <span className="text-xs text-muted-foreground font-medium">({def.nameHindi})</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground uppercase tracking-wider">
                          {def.category}
                        </span>
                        {linked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" />
                            Connected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <AlertTriangle className="h-3 w-3" />
                            Not Connected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {def.description}
                      </p>

                      {/* Linked Details */}
                      {linked ? (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2 font-mono">
                          <span className="truncate max-w-[260px] text-foreground font-semibold">
                            ID: {linked.sheetId.slice(0, 14)}...
                          </span>
                          <span>•</span>
                          <span className="tabular-nums font-semibold text-foreground">
                            {linked.recordCount.toLocaleString()} rows
                          </span>
                          <span>•</span>
                          <span>
                            Last Synced: {linked.lastSyncedAt ? new Date(linked.lastSyncedAt).toLocaleTimeString() : 'Never'}
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground/80 mt-2 italic">
                          Recommended file name: "{def.driveTemplateTitle}"
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle / Right: Actions & 10 MB Quota Monitor */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:self-center shrink-0">
                    {linked ? (
                      <>
                        {/* 10 MB Capacity Bar */}
                        <div className="min-w-[160px] bg-muted/40 p-2.5 rounded-lg border border-border/60">
                          <div className="flex justify-between items-center text-[10px] font-semibold mb-1">
                            <span className="text-muted-foreground">10 MB Quota</span>
                            <span className="font-mono tabular-nums text-foreground">
                              {capacity.usedFormatted} ({capacity.percent}%)
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${
                                capacity.status === 'CRITICAL'
                                  ? 'bg-destructive'
                                  : capacity.status === 'WARNING'
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.max(2, capacity.percent)}%` }}
                            />
                          </div>
                        </div>

                        {/* Open in Drive Button */}
                        <a
                          href={linked.driveViewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors"
                          title="Open spreadsheet in Google Drive"
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-primary" />
                          <span>Google Drive</span>
                        </a>

                        {/* Sync Now Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSyncModule(moduleId)}
                          disabled={isSyncing}
                          className="text-xs font-semibold"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
                          {isSyncing ? 'Syncing...' : 'Sync'}
                        </Button>

                        {/* Edit Link / Unlink */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenLinkModal(moduleId)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                          title="Change URL"
                        >
                          Edit
                        </Button>

                        <button
                          onClick={() => handleUnlink(moduleId)}
                          className="p-1.5 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                          title="Unlink Sheet"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenCreateModal(moduleId)}
                          className="text-xs font-semibold border-primary/30 hover:bg-primary/5 text-primary"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          Create in Google Drive
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => handleOpenLinkModal(moduleId)}
                          className="text-xs font-semibold"
                        >
                          <Link2 className="h-3.5 w-3.5 mr-1.5" />
                          Link Sheet
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL 1: LINK EXISTING GOOGLE SPREADSHEET */}
      {linkModalOpen && activeModuleForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Link Google Spreadsheet
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {MODULE_DEFINITIONS[activeModuleForModal].name} ({MODULE_DEFINITIONS[activeModuleForModal].nameHindi})
                </p>
              </div>
              <button
                onClick={() => setLinkModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 py-4">
              <div>
                <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-1.5">
                  Google Sheet URL or Sheet ID
                </label>
                <input
                  type="text"
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFM.../edit#gid=0"
                  value={inputUrl}
                  onChange={(e) => {
                    setInputUrl(e.target.value);
                    setValidationResult(null);
                    setValidationError(null);
                  }}
                  className="w-full px-3 py-2 text-xs font-mono bg-background border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="text-[11px] text-muted-foreground mt-1.5 block">
                  Ensure sharing is set to: <strong>"Anyone with the link can view/edit"</strong>.
                </span>
              </div>

              {/* Required Schema Checklist */}
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Required Column Headers
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {MODULE_DEFINITIONS[activeModuleForModal].requiredHeaders.map((h) => (
                    <span
                      key={h}
                      className="px-2 py-0.5 rounded bg-background border border-border text-[11px] font-mono font-medium text-foreground"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </div>

              {/* Test Connection Button */}
              <div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isTesting || !inputUrl.trim()}
                  className="w-full text-xs font-semibold"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isTesting ? 'animate-spin' : ''}`} />
                  {isTesting ? 'Verifying Google Sheet...' : 'Test Connection & Inspect Headers'}
                </Button>
              </div>

              {/* Error Message */}
              {validationError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Verification Failed</span>
                    <span>{validationError}</span>
                  </div>
                </div>
              )}

              {/* Success Result */}
              {validationResult && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Connection Successful!</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                    <div>Rows detected: <strong>{validationResult.rowCount}</strong></div>
                    <div>File Size: <strong>{(validationResult.estimatedBytes / 1024).toFixed(1)} KB</strong></div>
                  </div>
                  {validationResult.missingRequiredHeaders.length > 0 && (
                    <div className="text-amber-600 dark:text-amber-400 font-sans text-xs pt-1">
                      Warning: Missing columns: {validationResult.missingRequiredHeaders.join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="ghost" onClick={() => setLinkModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveLink}
                disabled={!validationResult}
                className="font-semibold"
              >
                Confirm & Link Sheet
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE IN GOOGLE DRIVE */}
      {createModalOpen && activeModuleForCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Create Spreadsheet in Google Drive
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {MODULE_DEFINITIONS[activeModuleForCreate].name} ({MODULE_DEFINITIONS[activeModuleForCreate].nameHindi})
                </p>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 py-4">
              {/* Step 1 */}
              <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-bold items-center justify-center">1</span>
                  <span className="text-xs font-bold text-foreground">Open a Blank Google Sheet</span>
                </div>
                <p className="text-xs text-muted-foreground pl-7">
                  Click the button below to open Google's official new spreadsheet launcher in your Google Drive. Name it: <strong>"{MODULE_DEFINITIONS[activeModuleForCreate].driveTemplateTitle}"</strong>
                </p>
                <div className="pl-7 pt-1">
                  <a
                    href="https://sheets.new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Open sheets.new in Google Drive ↗</span>
                  </a>
                </div>
              </div>

              {/* Step 2 */}
              <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-bold items-center justify-center">2</span>
                  <span className="text-xs font-bold text-foreground">Set Column Headers</span>
                </div>
                <p className="text-xs text-muted-foreground pl-7">
                  Copy the exact required headers to paste into Row 1, or download the pre-formatted starter CSV to import into Google Drive.
                </p>
                <div className="pl-7 pt-1 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyHeaders(activeModuleForCreate)}
                    className="text-xs font-semibold"
                  >
                    {copiedHeaders ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                    {copiedHeaders ? 'Headers Copied!' : 'Copy Column Headers'}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadModuleTemplateCsv(activeModuleForCreate)}
                    className="text-xs font-semibold"
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Download Blank CSV Template
                  </Button>
                </div>
              </div>

              {/* Step 3 */}
              <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-bold items-center justify-center">3</span>
                  <span className="text-xs font-bold text-foreground">Paste Your New Sheet URL & Link</span>
                </div>
                <p className="text-xs text-muted-foreground pl-7">
                  After creating it in Google Drive, set sharing to "Anyone with the link can view", paste the URL here, and click Test & Link.
                </p>
                <div className="pl-7 pt-1 space-y-2">
                  <input
                    type="text"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={inputUrl}
                    onChange={(e) => {
                      setInputUrl(e.target.value);
                      setValidationResult(null);
                      setValidationError(null);
                    }}
                    className="w-full px-3 py-2 text-xs font-mono bg-background border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={isTesting || !inputUrl.trim()}
                    className="w-full text-xs font-semibold"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isTesting ? 'animate-spin' : ''}`} />
                    {isTesting ? 'Testing Link...' : 'Test Connection'}
                  </Button>
                </div>
              </div>

              {/* Validation Result / Error */}
              {validationError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                  <XCircle className="h-4 w-4 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}
              {validationResult && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Sheet verified! Ready to save.</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
                Close
              </Button>
              <Button
                onClick={handleSaveLink}
                disabled={!validationResult}
                className="font-semibold"
              >
                Save & Connect Sheet
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
