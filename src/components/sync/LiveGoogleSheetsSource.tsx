import { useState } from "react";
import * as XLSX from "xlsx";
import { Database, FileSpreadsheet, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { fetchMahavtaarWorkspaceSheet } from "@/lib/googleSheets.functions";

type SheetSource = "master" | "collections";

interface Props {
  onLoadMaster: (buffer: ArrayBuffer, sourceName: string) => Promise<{ rowCount?: number } | void>;
}

export function LiveGoogleSheetsSource({ onLoadMaster }: Props) {
  const [loading, setLoading] = useState<SheetSource | null>(null);
  const [collectionCount, setCollectionCount] = useState<number | null>(null);
  const [lastMasterSync, setLastMasterSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSource = async (source: SheetSource) => {
    setLoading(source);
    setError(null);
    try {
      const result = await fetchMahavtaarWorkspaceSheet({ data: { source } });
      if (source === "collections") {
        setCollectionCount(result.rowCount);
        toast.success(`Daily Collection connected: ${result.rowCount.toLocaleString()} rows read.`);
        return;
      }

      const headers = result.values[0].map((value: unknown) => String(value ?? "").trim());
      const rows = result.values.slice(1).map((values: unknown[]) =>
        Object.fromEntries(headers.map((header: string, index: number) => [header, values[index] ?? ""])),
      );
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Data");
      const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
      await onLoadMaster(buffer, result.spreadsheetName);
      setLastMasterSync(new Date().toLocaleString());
      toast.success(`Live Master Allocation loaded: ${result.rowCount.toLocaleString()} rows. No local merge performed.`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to read Google Sheet.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="surface-card mb-6 rounded-xl border p-5 md:p-6">
      <div className="mb-4 flex items-center gap-3 border-b border-border pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Google Workspace — Live Sheets</h3>
          <p className="text-xs text-muted-foreground">Read directly from the linked Drive spreadsheets. No CSV sharing or local database merge.</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Database className="h-4 w-4 text-primary" /> Master Allocation
          </div>
          <p className="mb-3 text-xs text-muted-foreground">Data tab · Live portfolio source</p>
          <button
            type="button"
            onClick={() => void loadSource("master")}
            disabled={loading !== null}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {loading === "master" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {loading === "master" ? "Reading sheet…" : "Load Live Master Data"}
          </button>
          {lastMasterSync && <p className="mt-2 text-[11px] text-muted-foreground">Loaded: {lastMasterSync}</p>}
        </div>

        <div className="rounded-lg border border-border p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <FileSpreadsheet className="h-4 w-4 text-primary" /> Daily Collection
          </div>
          <p className="mb-3 text-xs text-muted-foreground">Collections tab · Operational records</p>
          <button
            type="button"
            onClick={() => void loadSource("collections")}
            disabled={loading !== null}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-semibold text-foreground disabled:opacity-50"
          >
            {loading === "collections" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {loading === "collections" ? "Reading sheet…" : "Refresh Collections Connection"}
          </button>
          {collectionCount !== null && <p className="mt-2 text-[11px] text-muted-foreground">{collectionCount.toLocaleString()} rows read from Drive.</p>}
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5" /> Server-side connector credentials · read-only sheet access
      </p>
    </section>
  );
}
