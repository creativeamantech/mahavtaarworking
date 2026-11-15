import { useEffect, useState, useCallback } from "react";
import {
  FileSpreadsheet,
  Search,
  RefreshCw,
  ExternalLink,
  X,
  Check,
  Layers,
  AlertCircle,
} from "lucide-react";
import {
  listDriveSpreadsheets,
  getSpreadsheetMetadata,
  type DriveFileItem,
  type SpreadsheetTabInfo,
} from "@/lib/googleWorkspaceApi";
import { useGoogleWorkspaceAuth } from "@/lib/googleWorkspaceAuth";
import { GoogleSignInButton } from "./GoogleSignInButton";

interface GoogleDriveBrowserModalProps {
  open: boolean;
  onClose: () => void;
  onSelectSheet: (selection: {
    spreadsheetId: string;
    spreadsheetName: string;
    tabTitle: string;
    sheetId: number;
    webViewLink?: string | undefined;
  }) => void;
  title?: string | undefined;
}

export function GoogleDriveBrowserModal({
  open,
  onClose,
  onSelectSheet,
  title = "Browse Google Drive Spreadsheets",
}: GoogleDriveBrowserModalProps) {
  const { isConnected } = useGoogleWorkspaceAuth();
  const [search, setSearch] = useState("");
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<DriveFileItem | null>(null);
  const [tabs, setTabs] = useState<SpreadsheetTabInfo[]>([]);
  const [selectedTab, setSelectedTab] = useState<SpreadsheetTabInfo | null>(null);
  const [loadingTabs, setLoadingTabs] = useState(false);

  const loadFiles = useCallback(async (query = "") => {
    setLoadingFiles(true);
    setError(null);
    try {
      const results = await listDriveSpreadsheets(query);
      setFiles(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Google Drive files.");
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    if (open && isConnected) {
      void loadFiles("");
      setSelectedFile(null);
      setTabs([]);
      setSelectedTab(null);
    }
  }, [open, isConnected, loadFiles]);

  const handleSelectFile = async (file: DriveFileItem) => {
    setSelectedFile(file);
    setTabs([]);
    setSelectedTab(null);
    setLoadingTabs(true);
    setError(null);
    try {
      const meta = await getSpreadsheetMetadata(file.id);
      setTabs(meta.sheets);
      if (meta.sheets.length > 0) {
        setSelectedTab(meta.sheets[0]!);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load spreadsheet tabs.");
    } finally {
      setLoadingTabs(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-sm font-bold text-foreground">{title}</h3>
              <p className="text-[11px] text-muted-foreground">
                Select a Google Sheet and worksheet tab from your Google Drive
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!isConnected ? (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
              <p className="text-sm font-medium text-foreground">
                Sign in with Google to browse your Drive spreadsheets
              </p>
              <GoogleSignInButton onConnected={() => void loadFiles(search)} />
            </div>
          ) : (
            <>
              {/* Search Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void loadFiles(search);
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search spreadsheets in Google Drive..."
                    className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loadingFiles}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingFiles ? "animate-spin" : ""}`} />
                  Search
                </button>
              </form>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Spreadsheets List */}
              <div className="rounded-xl border border-border divide-y divide-border max-h-60 overflow-y-auto">
                {loadingFiles ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    Loading spreadsheets from Google Drive...
                  </div>
                ) : files.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No Google Spreadsheets found matching your query.
                  </div>
                ) : (
                  files.map((file) => {
                    const isSelected = selectedFile?.id === file.id;
                    return (
                      <div
                        key={file.id}
                        onClick={() => void handleSelectFile(file)}
                        className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs cursor-pointer transition-colors ${
                          isSelected ? "bg-primary/10" : "hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">{file.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {file.modifiedTime
                                ? `Updated ${new Date(file.modifiedTime).toLocaleString()}`
                                : file.id}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 text-muted-foreground hover:text-primary"
                              title="Open in Google Drive"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {isSelected && <Check className="h-4 w-4 text-primary" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Tab Picker */}
              {selectedFile && (
                <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    <span>Select Worksheet Tab in &ldquo;{selectedFile.name}&rdquo;</span>
                  </div>
                  {loadingTabs ? (
                    <p className="text-xs text-muted-foreground">Loading tabs...</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {tabs.map((tab) => {
                        const active = selectedTab?.sheetId === tab.sheetId;
                        return (
                          <button
                            key={tab.sheetId}
                            type="button"
                            onClick={() => setSelectedTab(tab)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-card text-foreground hover:bg-muted"
                            }`}
                          >
                            {tab.title}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5 bg-muted/20">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-border bg-card px-4 text-xs font-semibold hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedFile || !selectedTab}
            onClick={() => {
              if (!selectedFile || !selectedTab) return;
              onSelectSheet({
                spreadsheetId: selectedFile.id,
                spreadsheetName: selectedFile.name,
                tabTitle: selectedTab.title,
                sheetId: selectedTab.sheetId,
                webViewLink: selectedFile.webViewLink,
              });
              onClose();
            }}
            className="h-9 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            Use Selected Sheet
          </button>
        </div>
      </div>
    </div>
  );
}
