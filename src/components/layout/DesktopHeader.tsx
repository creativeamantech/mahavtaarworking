import { ChevronLeft, ChevronRight, Search, UserCircle, Menu, LogOut, Lock } from "lucide-react";
import { useLocation, useNavigate } from "@/lib/router-compat";
import { useDataState } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo, useState, useRef, useEffect } from "react";
import { ThemeToggle } from "../ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AgentNotifications } from "../agent/AgentNotifications";
import { MasterSheetsSyncStatus } from "../sync/MasterSheetsSyncStatus";

const ROUTE_LABELS: Record<string, string> = {
  "/dashboard": "Portfolio Dashboard",
  "/exec-dashboard": "Executive Strategy",
  "/exec-team-perf": "Team Performance",
  "/explorer": "Data Explorer",
  "/data-entry": "Data Ingestion & Entry",
  "/assignment": "Case Assignment",
  "/city-pivot": "City Ledger",
  "/team-pivot": "Team Ledger",
  "/band-explorer": "POS Band Analysis",
  "/attendance": "Attendance Logs",
  "/feedbacks": "Quality & Feedback",
  "/live-monitoring": "Live Field Tracking",
  "/audit": "Audit Logs",
  "/settings": "Settings",
  "/connectivity": "Connectivity Hub",
  "/profile": "My Profile",
};

interface DesktopHeaderProps {
  collapsed?: boolean | undefined;
  setCollapsed?: ((val: boolean | ((prev: boolean) => boolean)) => void) | undefined;
}

export function DesktopHeader({ setCollapsed }: DesktopHeaderProps) {
  const { records } = useDataState();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();

    const matches = [];
    for (const r of records || []) {
      const name = String(
        r.customer_name || r.CUSTOMERNAME || r["Customer Name"] || r.CUSTOMER_NAME || "",
      ).toLowerCase();
      const id = String(
        r.agreementid || r.agreement_no || r.AGREEMENTNO || r.AGREEMENTID || "",
      ).toLowerCase();

      if (name.includes(q) || id.includes(q)) {
        matches.push(r);
        if (matches.length >= 8) break;
      }
    }
    return matches;
  }, [searchQuery, records]);

  const handleSearchSubmit = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      setIsSearchFocused(false);
      navigate("/explorer?q=" + encodeURIComponent(searchQuery.trim()));
      setSearchQuery("");
    }
  };

  const currentTitle =
    ROUTE_LABELS[location.pathname] ||
    (location.pathname.startsWith("/customer/") ? "Customer 360°" : "Workspace");

  const initials =
    user?.name
      ?.split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "MV";

  return (
    <header className="hidden md:block sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border">
      <div className="mv-brand-ribbon" />
      <div className="flex items-center justify-between gap-6 px-4 h-14">
        {/* Zone 1: Navigation & Breadcrumb */}
        <div className="flex items-center gap-3 shrink-0">
          {setCollapsed && (
            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground shrink-0"
              title="Toggle Sidebar"
              aria-label="Toggle Sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}

          <div className="flex items-center gap-0.5 bg-muted/45 p-0.5 rounded-lg border border-border/80">
            <button
              type="button"
              onClick={() => {
                if (window.history.state && window.history.state.idx > 0) {
                  navigate(-1);
                } else {
                  navigate("/dashboard", { replace: true });
                }
              }}
              className="p-1.5 hover:bg-card rounded-md transition-colors text-muted-foreground hover:text-foreground"
              title="Go Back"
              aria-label="Go Back"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => navigate(1)}
              className="p-1.5 hover:bg-card rounded-md transition-colors text-muted-foreground hover:text-foreground"
              title="Go Forward"
              aria-label="Go Forward"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="hidden xl:flex items-center gap-2 text-xs whitespace-nowrap">
            <span className="text-muted-foreground font-medium">Mahavtaar</span>
            <span className="text-muted-foreground/50" aria-hidden="true">
              /
            </span>
            <span className="font-semibold text-foreground">{currentTitle}</span>
          </div>
        </div>

        {/* Zone 2: Center Quick Search */}
        <div className="flex-1 flex justify-center min-w-0">
          <div className="relative w-full max-w-[380px]" ref={searchContainerRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search customer or agreement…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onKeyDown={handleSearchSubmit}
              aria-label="Quick Search Agreements or Customers"
              className="pl-9 pr-14 h-9 bg-muted/45 border border-border rounded-lg text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-card focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all w-full"
            />
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("mahavtaar:open-command-bar"))}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              title="Open Command Palette (⌘K or Ctrl+K)"
            >
              ⌘K
            </button>

            {isSearchFocused && searchQuery.length >= 2 && (
              <div className="absolute top-full mt-2 w-full lg:w-[460px] bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden left-1/2 -translate-x-1/2">
                <div className="px-3 py-2 border-b border-border bg-muted/40 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    Matching Cases
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {searchResults.length} shown
                  </span>
                </div>
                <div className="max-h-[300px] overflow-y-auto divide-y divide-border/70">
                  {searchResults.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      No matches found for "{searchQuery}"
                    </div>
                  ) : (
                    searchResults.map((r, i) => {
                      const id = String(
                        r.agreementid || r.agreement_no || r.AGREEMENTNO || r.AGREEMENTID || "-",
                      );
                      const name = String(
                        r.customer_name ||
                          r.CUSTOMERNAME ||
                          r["Customer Name"] ||
                          r.CUSTOMER_NAME ||
                          "-",
                      );
                      const city = String(r.city || r.City || "-");
                      return (
                        <button
                          key={id + "-" + i}
                          type="button"
                          onClick={() => {
                            setIsSearchFocused(false);
                            navigate("/explorer?q=" + encodeURIComponent(id));
                            setSearchQuery("");
                          }}
                          className="w-full px-3.5 py-2.5 text-left hover:bg-muted/50 cursor-pointer transition-colors flex items-center justify-between gap-3"
                        >
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-xs font-semibold text-foreground truncate">
                              {name}
                            </span>
                            <span className="text-[11px] text-muted-foreground truncate font-mono">
                              {id} · {city}
                            </span>
                          </div>
                          <span className="shrink-0 text-[11px] font-semibold text-primary whitespace-nowrap">
                            Bkt {String(r.bom_bkt ?? "-")}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
                {searchResults.length > 0 && (
                  <button
                    type="button"
                    className="w-full p-2.5 text-center text-xs font-semibold text-primary hover:bg-primary/10 cursor-pointer transition-colors border-t border-border bg-muted/20"
                    onClick={() => {
                      setIsSearchFocused(false);
                      navigate("/explorer?q=" + encodeURIComponent(searchQuery.trim()));
                      setSearchQuery("");
                    }}
                  >
                    Open all results in Data Explorer →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Zone 3: Sync, Theme, Executive Alerts & Account */}
        <div className="flex items-center gap-2.5 shrink-0 justify-end">
          <MasterSheetsSyncStatus />
          <ThemeToggle />
          {user?.role === "EXECUTIVE" && <AgentNotifications />}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 hover:bg-muted/70 py-1 pl-1 pr-2.5 rounded-lg transition-colors border border-border/80 bg-card"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#81258c]/15 via-[#0799cf]/15 to-[#55a94f]/15 text-primary text-xs font-bold border border-primary/20">
                  {initials}
                </div>
                <div className="flex flex-col items-start min-w-0 max-w-[116px]">
                  <span className="text-xs font-semibold text-foreground truncate w-full text-left leading-tight">
                    {user?.name}
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground truncate w-full text-left leading-tight">
                    {user?.role === "ADMIN" ? "Administrator" : user?.role}
                  </span>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Workspace Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer">
                <UserCircle className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={logout}
                className="cursor-pointer text-amber-600 dark:text-amber-400 focus:text-amber-600"
              >
                <Lock className="mr-2 h-4 w-4" />
                <span>Lock Session</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={logout}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
