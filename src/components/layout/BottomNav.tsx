import { Link, useLocation } from "@/lib/router-compat";
import {
  LayoutDashboard,
  Search,
  CalendarCheck,
  MessageSquare,
  MoreHorizontal,
  Building2,
  Users,
  Activity,
  Settings,
  ClipboardList,
  FileSpreadsheet,
  Database,
  UserCircle,
  Radio,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { VIEWS } from "@/constants/permissions";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../ui/sheet";

const MORE_TABS = [
  {
    label: "Data Entry & Imports",
    icon: FileSpreadsheet,
    path: "/data-entry",
    view: VIEWS.DATA_ENTRY,
  },
  { label: "Case Assignment", icon: Users, path: "/assignment", view: VIEWS.ASSIGNMENT },
  { label: "City Ledger", icon: Building2, path: "/city-pivot", view: VIEWS.CITY_PIVOT },
  { label: "Team Ledger", icon: Users, path: "/team-pivot", view: VIEWS.TEAM_PIVOT },
  { label: "Band Analysis", icon: Activity, path: "/band-explorer", view: VIEWS.CITY_TEAM_MATRIX },
  {
    label: "Executive Performance",
    icon: Activity,
    path: "/exec-team-perf",
    view: VIEWS.EXEC_TEAM_PERF,
  },
  { label: "Live Tracking", icon: Radio, path: "/live-monitoring", view: VIEWS.LIVE_MONITORING },
  { label: "Audit Log", icon: ClipboardList, path: "/audit", view: VIEWS.AUDIT_LOG },
  {
    label: "Connectivity Hub",
    icon: Database,
    path: "/connectivity",
    view: VIEWS.CONNECTIVITY_HUB,
  },
  { label: "Settings", icon: Settings, path: "/settings", view: VIEWS.SETTINGS },
  { label: "Profile", icon: UserCircle, path: "/profile" },
];

export function BottomNav() {
  const location = useLocation();
  const { hasPermission, logout, user } = useAuth();
  const isExecutive = user?.role === "EXECUTIVE";
  const homePath = isExecutive ? "/exec-dashboard" : "/dashboard";
  const homeView = isExecutive ? VIEWS.EXEC_DASHBOARD : VIEWS.DASHBOARD;

  const primaryTabs = [
    { label: "Home", icon: LayoutDashboard, path: homePath, view: homeView },
    { label: "Cases", icon: Search, path: "/explorer", view: VIEWS.DATA_EXPLORER },
    { label: "Attendance", icon: CalendarCheck, path: "/attendance", view: VIEWS.ATTENDANCE },
    { label: "Feedback", icon: MessageSquare, path: "/feedbacks", view: VIEWS.FEEDBACKS },
  ].filter((tab) => hasPermission(tab.view));

  const visibleMore = MORE_TABS.filter((tab) => !tab.view || hasPermission(tab.view));
  const isCaseRoute =
    location.pathname === "/explorer" || location.pathname.startsWith("/customer/");

  return (
    <nav
      aria-label="Primary navigation"
      className="bottom-nav fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-border bg-card/95 backdrop-blur-xl md:hidden"
    >
      {primaryTabs.map((tab) => {
        const active = tab.path === "/explorer" ? isCaseRoute : location.pathname === tab.path;
        return (
          <Link
            key={tab.path}
            to={tab.path}
            aria-current={active ? "page" : undefined}
            className={`mobile-nav-item relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-1.5 transition-colors active:scale-[0.97] ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {active && (
              <span
                aria-hidden="true"
                className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-gradient-to-r from-[#81258c] via-[#0799cf] to-[#55a94f]"
              />
            )}
            <span
              className={`flex h-7 w-9 items-center justify-center rounded-lg transition-colors ${
                active ? "bg-primary/10" : ""
              }`}
            >
              <tab.icon className="h-4.5 w-4.5" strokeWidth={active ? 2.3 : 1.8} />
            </span>
            <span className="text-[10px] font-semibold leading-none whitespace-nowrap">
              {tab.label}
            </span>
          </Link>
        );
      })}
      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            className="mobile-nav-item flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-1.5 text-muted-foreground transition-colors active:scale-[0.97]"
          >
            <span className="flex h-7 w-9 items-center justify-center rounded-lg">
              <MoreHorizontal className="h-4.5 w-4.5" />
            </span>
            <span className="text-[10px] font-semibold leading-none whitespace-nowrap">More</span>
          </button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[82dvh] rounded-t-2xl border-border bg-card px-4 pb-[max(24px,env(safe-area-inset-bottom))] text-foreground"
        >
          <SheetHeader className="pb-3 text-left">
            <SheetTitle className="text-left text-base font-bold">Workspace Tools</SheetTitle>
          </SheetHeader>
          <div className="grid max-h-[65dvh] grid-cols-2 gap-2 overflow-y-auto pb-3">
            {visibleMore.map((tab) => {
              const active = location.pathname === tab.path;
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={`flex min-h-12 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                    active
                      ? "border-primary/35 bg-primary/10 text-primary"
                      : "border-border bg-muted/35 text-foreground hover:bg-muted"
                  }`}
                >
                  <tab.icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 truncate">{tab.label}</span>
                </Link>
              );
            })}
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-2 flex min-h-11 w-full items-center justify-center rounded-xl border border-destructive/25 bg-destructive/5 text-sm font-semibold text-destructive"
          >
            Sign out
          </button>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
