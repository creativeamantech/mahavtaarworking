// @ts-nocheck
import { useState, useMemo, useCallback, useEffect } from "react";
import { AppLayout } from "../components/layout/AppLayout";
import { UploadStepper } from "../components/ui/UploadStepper";
import { DataTable } from "../components/ui/DataTable";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useDataState, useDataDispatch } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import { useWorkspaceTabs } from "@/contexts/WorkspaceTabsContext";
import { calculateRow } from "../lib/calculations";
import { fmtCur } from "../lib/formatters";
import { toast } from "sonner";
import {
  Search,
  X,
  Download,
  FileSpreadsheet,
  UploadCloud,
  Database,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { LiveGoogleSheetsSource } from "../components/sync/LiveGoogleSheetsSource";

export default function DataEntry() {
  const { records, uploadHistory } = useDataState();
  const { loadMainFile, loadMainSheetSource, loadPaidFile, loadAdditionalFile, loadCorrectedFile, updateRecord } =
    useDataDispatch();
  const { user, isExecutive } = useAuth();
  const [activeInputMode, setActiveInputMode] = useState<"sheets" | "files">("sheets");
  const [search, setSearch] = useState("");
  const [bucketFilter, setBucketFilter] = useState("all");
  const [paidFilter, setPaidFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [conflictFilter, setConflictFilter] = useState("all");
  const [uploadingState, setUploadingState] = useState<Record<string, boolean>>({});
  const { setTabDirty } = useWorkspaceTabs();

  // Track active file uploading or ingestion in workspace tab strip
  useEffect(() => {
    const isBusy = Object.values(uploadingState).some(Boolean);
    if (isBusy) {
      setTabDirty('/data-entry', true, { label: 'File ingestion in progress', count: 1 });
    } else {
      setTabDirty('/data-entry', false);
    }
    return () => {
      setTabDirty('/data-entry', false);
    };
  }, [uploadingState, setTabDirty]);

  const filteredRecords = useMemo(() => {
    let data = records;
    if (isExecutive() && user) data = data.filter((r) => r.executive_name === user.name);
    if (search) {
      const s = search.toLowerCase();
      data = data.filter(
        (r) =>
          r.agreementid.toLowerCase().includes(s) ||
          r.city?.toLowerCase().includes(s) ||
          r.executive_name?.toLowerCase().includes(s),
      );
    }
    if (bucketFilter !== "all") data = data.filter((r) => String(r.bom_bkt) === bucketFilter);
    if (paidFilter !== "all") {
      data = data.filter((r) => {
        const c = calculateRow(r);
        return paidFilter === "paid" ? c.mainPaid : !c.mainPaid;
      });
    }
    if (cityFilter !== "all") data = data.filter((r) => r.city === cityFilter);
    if (conflictFilter !== "all")
      data = data.filter((r) => (conflictFilter === "conflict" ? r.is_conflict : !r.is_conflict));
    return data;
  }, [records, search, bucketFilter, paidFilter, cityFilter, conflictFilter, user, isExecutive]);

  const cities = useMemo(() => [...new Set(records.map((r) => r.city))].sort(), [records]);

  const handleMainUpload = useCallback(
    async (file: File) => {
      setUploadingState((p) => ({ ...p, main: true }));
      await new Promise((r) => setTimeout(r, 50));
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const result = await loadMainFile(
            e.target!.result as ArrayBuffer,
            file.name,
            user?.name || "Unknown",
          );
          const newCount = result?.newCount ?? result.rowCount;
          const updatedCount = result?.updatedCount ?? 0;
          const total = result?.totalRecords ?? "";
          toast.success(
            `Master Data Loaded: ${result.rowCount} records (${newCount} new, ${updatedCount} merged)${total ? ` · Total in ledger: ${total}` : ""}`,
          );
        } catch {
          toast.error("Failed to parse file");
        } finally {
          setUploadingState((p) => ({ ...p, main: false }));
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [loadMainFile, user],
  );

  const handlePaidUpload = useCallback(
    async (file: File) => {
      setUploadingState((p) => ({ ...p, paid: true }));
      await new Promise((r) => setTimeout(r, 50));
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const result = await loadPaidFile(
            e.target!.result as ArrayBuffer,
            file.name,
            user?.name || "Unknown",
          );
          toast.success(`Paid file merged — ${result.matched} records updated`);
        } catch {
          toast.error("Failed to parse paid file");
        } finally {
          setUploadingState((p) => ({ ...p, paid: false }));
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [loadPaidFile, user],
  );

  const handleAdditionalUpload = useCallback(
    async (file: File) => {
      setUploadingState((p) => ({ ...p, add: true }));
      await new Promise((r) => setTimeout(r, 50));
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const result = await loadAdditionalFile(
            e.target!.result as ArrayBuffer,
            file.name,
            user?.name || "Unknown",
          );
          const s = result.stats;
          toast.success(
            <div className="flex flex-col gap-1">
              <span className="font-bold">Additional Collection Merged</span>
              <span className="text-xs">Unique Loans: {s.uniqueLoans}</span>
              <span className="text-xs">Valid Provisional Added: {s.newValidProv}</span>
              <span className="text-xs text-destructive">Conflicts Detected: {s.newConflicts}</span>
              <span className="text-xs text-muted-foreground">
                Already Confirmed: {s.alreadyConfirmed}
              </span>
              <span className="text-xs text-muted-foreground">
                Ignored (Corrected): {s.alreadyCorrected}
              </span>
            </div>,
            { duration: 8000 },
          );
        } catch {
          toast.error("Failed to parse additional file");
        } finally {
          setUploadingState((p) => ({ ...p, add: false }));
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [loadAdditionalFile, user],
  );

  const handleCorrectedUpload = useCallback(
    async (file: File) => {
      setUploadingState((p) => ({ ...p, corr: true }));
      await new Promise((r) => setTimeout(r, 50));
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const result = await loadCorrectedFile(
            e.target!.result as ArrayBuffer,
            file.name,
            user?.name || "Unknown",
          );
          toast.success(`Corrected DAC merged — ${result.matched} records updated`);
        } catch {
          toast.error("Failed to parse corrected DAC file");
        } finally {
          setUploadingState((p) => ({ ...p, corr: false }));
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [loadCorrectedFile, user],
  );

  const handleFieldUpdate = useCallback(
    (agreementid: string, field: string, value: string) => {
      const numVal = parseFloat(value) || 0;
      updateRecord(agreementid, field, numVal, user?.name || "Unknown");
      toast.success(`Saved ✓`);
    },
    [updateRecord, user],
  );

  const exportFilteredData = useCallback(() => {
    if (filteredRecords.length === 0) {
      toast.info("No data to export");
      return;
    }
    const data = filteredRecords.map((r) => {
      const c = calculateRow(r);
      return {
        "Loan ID": r.agreementid,
        "Customer Name": r.customer_name || "",
        City: r.city || "",
        "Executive Name": r.executive_name || "",
        "BOM Bkt": r.bom_bkt,
        "BOM POS": r.bom_pos,
        "Collected Amount": c.total,
        "Confirmed DAC": r.dac || 0,
        "Provisional DAC": r.provisional_dac || 0,
        Status: r.is_conflict ? "Conflict" : c.mainPaid ? "Paid" : "Unpaid",
      };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Export");
    XLSX.writeFile(wb, `DataExport_${new Date().toISOString().split("T")[0]}.xlsx`);
  }, [filteredRecords]);

  const lastMain = uploadHistory.find((u) => u.type === "MAIN_DATA");
  const lastPaid = uploadHistory.find((u) => u.type === "PAID_FILE");
  const lastAdditional = uploadHistory.find((u) => u.type === "ADDITIONAL_COLLECTION_FILE");
  const lastCorrected = uploadHistory.find((u) => u.type === "CORRECTED_DAC_FILE");

  const columns = [
    {
      key: "agreementid",
      label: "Agreement ID",
      width: "120px",
      render: (v: string) => <span className="text-muted-foreground">{v}</span>,
    },
    {
      key: "bom_bkt",
      label: "Bkt",
      width: "40px",
      render: (v: number) => <StatusBadge variant="bucket">{v}</StatusBadge>,
    },
    { key: "executive_name", label: "Executive", width: "100px", hideBelow: "sm" as const },
    { key: "city", label: "City", width: "80px", hideBelow: "sm" as const },
    {
      key: "emi_amt",
      label: "EMI",
      align: "right" as const,
      hideBelow: "md" as const,
      render: (v: number) => fmtCur(v),
    },
    {
      key: "principal_outstanding",
      label: "POS",
      align: "right" as const,
      hideBelow: "lg" as const,
      render: (v: number) => fmtCur(v),
    },
    {
      key: "dac",
      label: "DAC",
      align: "right" as const,
      width: "90px",
      render: (_v: number, row: LoanRecord) => (
        <EditableCell
          value={row.dac || 0}
          source={row.dac_source}
          onSave={(val) => handleFieldUpdate(row.agreementid, "dac", val)}
        />
      ),
    },
    {
      key: "provisional_dac",
      label: "Prov DAC",
      align: "right" as const,
      width: "90px",
      hideBelow: "sm" as const,
      render: (_v: number, row: LoanRecord) => {
        if (!row.provisional_dac && !row.is_conflict)
          return <span className="text-muted-foreground">-</span>;
        return (
          <span
            className={`inline-flex items-center gap-1 rounded bg-muted/50 px-1.5 py-0.5 text-right font-sans text-xs ${row.is_conflict ? "text-destructive font-bold" : "text-info"}`}
          >
            {fmtCur(Number(row.provisional_dac_raw || row.provisional_dac) || 0)}
            {row.is_conflict && (
              <span title={`Conflict with Confirmed DAC (${fmtCur(row.dac || 0)})`}>⚠️</span>
            )}
          </span>
        );
      },
    },
    {
      key: "ecs",
      label: "ECS",
      align: "right" as const,
      width: "90px",
      hideBelow: "sm" as const,
      render: (_v: number, row: LoanRecord) => (
        <EditableCell
          value={row.ecs || 0}
          source={row.ecs_source}
          onSave={(val) => handleFieldUpdate(row.agreementid, "ecs", val)}
        />
      ),
    },
    {
      key: "special",
      label: "Special",
      align: "right" as const,
      width: "90px",
      hideBelow: "sm" as const,
      render: (_v: number, row: LoanRecord) => (
        <EditableCell
          value={row.special || 0}
          source={row.special_source}
          onSave={(val) => handleFieldUpdate(row.agreementid, "special", val)}
        />
      ),
    },
    {
      key: "_total",
      label: "Total",
      align: "right" as const,
      sortable: false,
      render: (_: unknown, row: LoanRecord) => {
        const c = calculateRow(row);
        return (
          <span className={c.total > 0 ? "text-primary" : "text-muted-foreground"}>
            {fmtCur(c.total)}
          </span>
        );
      },
    },
    {
      key: "_emiCount",
      label: "EMI#",
      align: "center" as const,
      sortable: false,
      hideBelow: "sm" as const,
      render: (_: unknown, row: LoanRecord) => {
        const c = calculateRow(row);
        const variant = c.emiCount === 0 ? "unpaid" : c.emiCount === 1 ? "bucket" : "paid";
        return <StatusBadge variant={variant}>{c.emiCount}</StatusBadge>;
      },
    },
    {
      key: "_mainPaid",
      label: "Status",
      sortable: false,
      hideBelow: "sm" as const,
      render: (_: unknown, row: LoanRecord) => {
        const c = calculateRow(row);
        return (
          <StatusBadge variant={c.mainPaid ? "paid" : "unpaid"}>
            {c.mainPaid ? "PAID" : "UNPAID"}
          </StatusBadge>
        );
      },
    },
  ];

  const hasConflicts = records.some((r) => r.is_conflict);

  return (
    <AppLayout>
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div>
          <h1 className="font-sans text-xl font-extrabold tracking-tight">Data Entry</h1>
          <p className="font-sans text-xs text-muted-foreground">
            Upload files & manage payment data
          </p>
        </div>
        <button
          onClick={exportFilteredData}
          className="flex h-9 items-center gap-2 rounded-md bg-primary px-4 font-sans text-xs font-bold text-primary-foreground hover:bg-primary/90"
        >
          <Download className="h-3.5 w-3.5" /> Export Data
        </button>
      </div>

      {/* Mode Switcher & Portfolio Summary Ribbon */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1 p-1 bg-muted/70 rounded-lg w-fit border border-border">
          <button
            type="button"
            onClick={() => setActiveInputMode("sheets")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeInputMode === "sheets"
                ? "bg-card text-foreground shadow-sm border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
            <span>Google Sheets Connect</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveInputMode("files")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeInputMode === "files"
                ? "bg-card text-foreground shadow-sm border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UploadCloud className="h-3.5 w-3.5 text-primary" />
            <span>Upload Files (XLSX / CSV)</span>
          </button>
        </div>

        {/* Live Ledger Portfolio Stats Ribbon */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <Database className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono tabular-nums">{records.length.toLocaleString()}</span> active
            loans
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums text-foreground/90">
            POS{" "}
            {fmtCur(
              records.reduce(
                (acc, r) => acc + (Number(r.principal_outstanding || r.bom_pos) || 0),
                0,
              ),
            )}
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-primary font-medium">Live Google Sheet Source</span>
        </div>
      </div>

      {/* Primary Ingestion View */}
      {activeInputMode === "sheets" ? (
        <LiveGoogleSheetsSource onLoadMaster={loadMainSheetSource} />
      ) : (
        <UploadStepper
          steps={[
            {
              id: "step-1",
              title: "Main Data File",
              optional: false,
              status: uploadingState.main ? "uploading" : lastMain ? "done" : "pending",
              lastUpload: lastMain?.fileName,
              onFileSelect: handleMainUpload,
            },
            {
              id: "step-2",
              title: "Paid File",
              optional: false,
              status: uploadingState.paid ? "uploading" : lastPaid ? "done" : "pending",
              lastUpload: lastPaid?.fileName,
              onFileSelect: handlePaidUpload,
            },
            {
              id: "step-3",
              title: "Additional Collection",
              optional: true,
              status: uploadingState.add ? "uploading" : lastAdditional ? "done" : "pending",
              lastUpload: lastAdditional?.fileName,
              onFileSelect: handleAdditionalUpload,
            },
            {
              id: "step-4",
              title: "Corrected DAC",
              optional: true,
              status: uploadingState.corr ? "uploading" : lastCorrected ? "done" : "pending",
              lastUpload: lastCorrected?.fileName,
              onFileSelect: handleCorrectedUpload,
            },
          ]}
        />
      )}

      {/* Filters */}
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm sm:flex sm:flex-wrap sm:items-center sm:gap-3">
        <div className="relative col-span-2 w-full sm:col-span-1 sm:flex-1 sm:min-w-[200px] sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, city, executive..."
            className="h-9 w-full bg-background border rounded-md px-3 py-1 text-sm focus:border-accent focus:ring-1 focus:ring-accent pl-9 pr-3 font-sans text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>
        <select
          value={bucketFilter}
          onChange={(e) => setBucketFilter(e.target.value)}
          className="h-9 w-full sm:w-auto bg-background border rounded-md px-3 py-1 text-sm focus:border-accent focus:ring-1 focus:ring-accent font-sans text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
        >
          <option value="all">All Buckets</option>
          {[1, 2, 3, 4, 5].map((b, i) => (
            <option key={b} value={b}>
              Bucket {b}
            </option>
          ))}
        </select>
        <select
          value={paidFilter}
          onChange={(e) => setPaidFilter(e.target.value)}
          className="h-9 w-full sm:w-auto bg-background border rounded-md px-3 py-1 text-sm focus:border-accent focus:ring-1 focus:ring-accent font-sans text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
        >
          <option value="all">All Status</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="h-9 w-full sm:w-auto bg-background border rounded-md px-3 py-1 text-sm focus:border-accent focus:ring-1 focus:ring-accent font-sans text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
        >
          <option value="all">All Cities</option>
          {cities.map((c, i) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={conflictFilter}
          onChange={(e) => setConflictFilter(e.target.value)}
          className="h-9 w-full sm:w-auto bg-background border rounded-md px-3 py-1 text-sm focus:border-accent focus:ring-1 focus:ring-accent font-sans text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
        >
          <option value="all">All Items</option>
          <option value="conflict">Conflicted Only</option>
          <option value="clean">Non-Conflicted</option>
        </select>

        {(search ||
          bucketFilter !== "all" ||
          paidFilter !== "all" ||
          cityFilter !== "all" ||
          conflictFilter !== "all") && (
          <button
            onClick={() => {
              setSearch("");
              setBucketFilter("all");
              setPaidFilter("all");
              setCityFilter("all");
              setConflictFilter("all");
            }}
            className="flex h-9 items-center gap-1.5 rounded-md border border-[rgba(255,255,255,0.1)] bg-white/5 px-3 font-sans text-xs text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" /> Reset
          </button>
        )}
        <span className="ml-auto font-sans text-xs text-primary font-bold">
          Showing {filteredRecords.length} of {records.length}
        </span>
      </div>

      {/* Data Table */}
      {/* Android-first loan cards; desktop retains the sortable, paginated table. */}
      <div className="md:hidden space-y-3 pb-4">
        {filteredRecords.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No records found
          </div>
        ) : filteredRecords.map((row) => {
          const calc = calculateRow(row);
          return (
            <article key={row.agreementid} className={`rounded-2xl border bg-card p-4 shadow-sm ${row.is_conflict ? "border-destructive/50" : "border-border"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Agreement ID</p>
                  <p className="truncate text-sm font-extrabold tracking-wide">{row.agreementid}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{row.customer_name || "Customer"}{row.city ? ` · ${row.city}` : ""}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">BKT {row.bom_bkt ?? "—"}</span>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${calc.mainPaid ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{calc.mainPaid ? "PAID" : "UNPAID"}</span>
                </div>
              </div>
              {row.is_conflict && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">Payment conflict detected — review provisional DAC</p>}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-muted/50 p-2">
                  <p className="text-[10px] text-muted-foreground">DAC</p>
                  <EditableCell value={row.dac || 0} source={row.dac_source} onSave={(val) => handleFieldUpdate(row.agreementid, "dac", val)} />
                </div>
                <div className="rounded-xl bg-muted/50 p-2">
                  <p className="text-[10px] text-muted-foreground">ECS</p>
                  <EditableCell value={row.ecs || 0} source={row.ecs_source} onSave={(val) => handleFieldUpdate(row.agreementid, "ecs", val)} />
                </div>
                <div className="rounded-xl bg-muted/50 p-2">
                  <p className="text-[10px] text-muted-foreground">Special</p>
                  <EditableCell value={row.special || 0} source={row.special_source} onSave={(val) => handleFieldUpdate(row.agreementid, "special", val)} />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <div>
                  <p className="text-[10px] text-muted-foreground">Executive · EMI count</p>
                  <p className="text-xs font-semibold">{row.executive_name || "—"} · {calc.emiCount}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Total collection</p>
                  <p className="text-base font-extrabold tabular-nums">{fmtCur(calc.total)}</p>
                  <p className="text-[10px] text-muted-foreground">POS {fmtCur(Number(row.principal_outstanding || row.bom_pos) || 0)}</p>
                </div>
              </div>
              {row.provisional_dac || row.is_conflict ? (
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>Provisional DAC {row.is_conflict ? "· Conflict" : ""}</span>
                  <span className={row.is_conflict ? "font-bold text-destructive" : ""}>{fmtCur(Number(row.provisional_dac_raw || row.provisional_dac) || 0)}</span>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      <div className="hidden md:block">
        <DataTable
          tableId="data-entry-table"
          columns={columns}
          data={filteredRecords}
          rowClassName={(row: import("../types/domain").LoanRecord) => {
            const c = calculateRow(row);
            if (row.is_conflict) return "border-l-2 border-l-destructive bg-destructive/5";
            return c.mainPaid ? "border-l-2 border-l-primary" : "border-l-2 border-border";
          }}
        />
      </div>
    </AppLayout>
  );
}

function EditableCell({
  value,
  source,
  onSave,
}: {
  value: number;
  source?: string;
  onSave: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value || 0));

  const borderClass =
    source === "MANUAL"
      ? "border-primary text-primary"
      : source === "PAID_FILE"
        ? "border-success text-success"
        : source === "CORRECTED"
          ? "border-info text-info"
          : "border-[rgba(255,255,255,0.1)] text-muted-foreground hover:border-primary/50 hover:text-foreground";
  const icon =
    source === "MANUAL" ? "🔒" : source === "PAID_FILE" ? "📁" : source === "CORRECTED" ? "✓" : "";

  if (editing) {
    return (
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          setEditing(false);
          onSave(val);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setEditing(false);
            onSave(val);
          }
        }}
        className="h-6 w-20 rounded border border-primary bg-[rgba(255,255,255,0.05)] px-1 text-right font-sans text-xs text-foreground outline-none shadow-[0_0_10px_rgba(245,158,11,0.15)]"
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`inline-flex cursor-pointer items-center gap-1 rounded border bg-card px-1.5 py-0.5 text-right transition-colors ${borderClass}`}
    >
      {fmtCur(value)} {icon && <span className="text-[9px] opacity-80">{icon}</span>}
    </span>
  );
}
