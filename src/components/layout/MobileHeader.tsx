import { useLocation, useNavigate } from "@/lib/router-compat";
import { ChevronLeft, ChevronRight, Search, UserCircle, LogOut, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "../ThemeToggle";
import { MasterSheetsSyncStatus } from "../sync/MasterSheetsSyncStatus";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/exec-dashboard": "Exec Strategy",
  "/exec-team-perf": "Team Performance",
  "/data-entry": "Data Entry",
  "/explorer": "Explorer",
  "/assignment": "Assignment",
  "/city-pivot": "City Ledger",
  "/team-pivot": "Team Ledger",
  "/band-explorer": "Band Analysis",
  "/settings": "Settings",
  "/audit": "Audit Log",
  "/live-monitoring": "Live Tracking",
  "/feedbacks": "All Feedback",
  "/attendance": "Attendance",
  "/connectivity": "Connectivity",
  "/profile": "Profile",
};

export function MobileHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const title =
    PAGE_TITLES[location.pathname] ||
    (location.pathname.startsWith("/customer/") ? "Customer 360°" : "Workspace");

  const initials =
    user?.name
      ?.split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "MV";

  return (
    <header className="sticky top-0 z-40 flex flex-col border-b border-border bg-card/95 backdrop-blur-md md:hidden">
      <div className="mv-brand-ribbon" />
      <div className="flex h-13 items-center justify-between gap-2 px-3">
        <div className="flex items-center gap-0.5 bg-muted/45 p-0.5 rounded-lg border border-border/80 shrink-0">
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
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => navigate(1)}
            className="p-1.5 hover:bg-card rounded-md transition-colors text-muted-foreground hover:text-foreground"
            title="Go Forward"
            aria-label="Go Forward"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center leading-tight">
          <span className="font-heading text-xs font-extrabold tracking-tight text-foreground truncate max-w-full">
            Mahavtaar
          </span>
          <span className="max-w-full truncate text-[10px] font-medium text-muted-foreground">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <MasterSheetsSyncStatus compact />
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("mahavtaar:open-command-bar"))}
            className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Quick Search"
            title="Quick Search"
          >
            <Search className="h-4 w-4" />
          </button>
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center hover:bg-muted p-0.5 rounded-lg transition-colors border border-border/80 bg-card"
                aria-label="Account menu"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#81258c]/15 via-[#0799cf]/15 to-[#55a94f]/15 text-primary text-xs font-bold">
                  {initials}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-bold">{user?.name}</span>
                  <span className="text-xs text-muted-foreground">{user?.role}</span>
                </div>
              </DropdownMenuLabel>
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
