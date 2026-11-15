import { useState } from "react";
import {
  Database,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Upload,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useGoogleWorkspaceAuth } from "@/lib/googleWorkspaceAuth";
import {
  APPROVED_WORKSPACE_SHEETS,
  readGoogleSheet,
  createGoogleSpreadsheet,
} from "@/lib/googleWorkspaceApi";
import type { LoanRecord } from "@/types/domain";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { GoogleDriveBrowserModal } from "./GoogleDriveBrowserModal";
import { GoogleActionConfirmModal } from "./GoogleActionConfirmModal";

type LoadingAction = "master" | "collections" | "custom" | "export" | null;

interface Props {
  onLoadMaster: (buffer: ArrayBuffer, sourceName: string) => Promise<{ rowCount?: number } | void>;
  records?: LoanRecord[] | undefined;
}

export function LiveGoogleSheetsSource({ onLoadMaster, records = [] }: Props) {
  const { googleUser, needsAuth, isConnected, signIn } = useGoogleWorkspaceAuth();
  const [loading, setLoading] = useState<LoadingAction>(null);
  const [collectionCount, setCollectionCount] = useState<number | null>(null);
  const [collectionUrl, setCollectionUrl] = useState<string | null>(null);
  const [lastMasterSync, setLastMasterSync] = useState<string | null>(null);
  const [lastMasterTitle, setLastMasterTitle] = useState<string | null>(null);
  const [lastExportUrl, setLastExportUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [driveBrowserOpen, setDriveBrowserOpen] = useState(false);
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);

  const ensureSignedIn = async (): Promise<boolean> => {
    if (isConnected) return true;
    try {
      await signIn();
      toast.success("Connected to Google Drive & Sheets");
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google Sign-In was cancelled or failed.";
      setError(msg);
      toast.error(msg);
      return false;
    }
  };

  const loadApprovedSource = async (source: "master" | "collections") => {
    setError(null);
    const ok = await ensureSignedIn();
    if (!ok) return;

    setLoading(source);
    try {
      const target = APPROVED_WORKSPACE_SHEETS[source];
      const result = await readGoogleSheet(target.id, { preferredTab: target.preferredTab });

      if (source === "collections") {
        setCollectionCount(result.rowCount);
        setCollectionUrl(
          result.webViewLink || `https://docs.google.com/spreadsheets/d/${target.id}/edit`,
        );
        toast.success(
          `Daily Collection connected (${result.sheetTitle}): ${result.rowCount.toLocaleString()} rows read.`,
        );
        return;
      }

      await onLoadMaster(result.buffer, result.spreadsheetTitle);
      setLastMasterSync(new Date().toLocaleString());
      setLastMasterTitle(`${result.spreadsheetTitle} · ${result.sheetTitle}`);
      toast.success(
        `Live Master Allocation loaded (${result.rowCount.toLocaleString()} rows). No local merge performed.`,
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to read Google Sheet.";
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
    setError(null);
    setLoading("custom");
    try {
      const result = await readGoogleSheet(selection.spreadsheetId, {
        preferredTab: selection.tabTitle,
        gid: String(selection.sheetId),
      });
      const label = `${result.spreadsheetTitle} (${result.sheetTitle})`;
      await onLoadMaster(result.buffer, label);
      setLastMasterSync(new Date().toLocaleString());
      setLastMasterTitle(label);
      toast.success(`Loaded ${result.rowCount.toLocaleString()} rows from "${label}".`);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Unable to load selected Drive sheet.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(null);
    }
  };

  const exportTitle = `Mahavtaar Portfolio Snapshot - ${new Date().toISOString().slice(0, 10)}`;

  const handleConfirmExportToDrive = async () => {
    setError(null);
    const ok = await ensureSignedIn();
    if (!ok) {
      setExportConfirmOpen(false);
      return;
    }

    setLoading("export");
    try {
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

  return (
    <section className="surface-card mb-6 rounded-xl border p-5 md:p-6">
      <div className="mb-4 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Google Workspace — Drive &amp; Live Sheets
            </h3>
            <p className="text-xs text-muted-foreground">
              Read directly from your Google Drive spreadsheets or export snapshots via OAuth.
            </p>
          </div>
        </div>

        <GoogleSignInButton />
      </div>

      {needsAuth && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-900 dark:text-amber-200">
          Sign in with Google above to connect your Google Drive spreadsheets and read/write live
          data.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Database className="h-4 w-4 text-primary" /> Master Allocation
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            {lastMasterTitle || "Data tab · Live portfolio source"}
          </p>
          <button
            type="button"
            onClick={() => void loadApprovedSource("master")}
            disabled={loading !== null}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading === "master" ? "animate-spin" : ""}`} />
            {loading === "master" ? "Reading sheet…" : "Load Live Master Data"}
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
            onClick={() => void loadApprovedSource("collections")}
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
          {loading === "custom" ? "Loading Drive Sheet…" : "Browse Any Sheet in Google Drive"}
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
        {isConnected && googleUser
          ? `Connected as ${googleUser.email || googleUser.displayName || "Google User"} · Direct Drive & Sheets OAuth`
          : "Client-side Google OAuth · In-memory token session · Drive & Sheets APIs"}
      </p>

      <GoogleDriveBrowserModal
        open={driveBrowserOpen}
        onClose={() => setDriveBrowserOpen(false)}
        onSelectSheet={(sel) => void handleLoadFromDriveSelection(sel)}
        title="Select Master Spreadsheet from Google Drive"
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
