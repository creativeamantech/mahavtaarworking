import { useState, useEffect } from "react";
import { Link, useLocation } from "@/lib/router-compat";
import { useAuth } from "@/contexts/AuthContext";
import { VIEWS } from "@/constants/permissions";
import {
  Home,
  Edit3,
  UserPlus,
  TrendingUp,
  Target,
  Search,
  Building2,
  GitFork,
  Waves,
  MonitorPlay,
  MessageSquare,
  CalendarClock,
  Sliders,
  History,
  PanelLeftClose,
  PanelLeftOpen,
  Database,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { MahavtaarLogoMark } from "@/components/MahavtaarLogo3D";

const NAV_GROUPS = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", icon: Home, path: "/dashboard", view: VIEWS.DASHBOARD },
      {
        label: "Executive Strategy",
        icon: TrendingUp,
        path: "/exec-dashboard",
        view: VIEWS.EXEC_DASHBOARD,
      },
      {
        label: "Live Tracking",
        icon: MonitorPlay,
        path: "/live-monitoring",
        view: VIEWS.LIVE_MONITORING,
      },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Data Explorer", icon: Search, path: "/explorer", view: VIEWS.DATA_EXPLORER },
      { label: "Data Ingestion", icon: Edit3, path: "/data-entry", view: VIEWS.DATA_ENTRY },
      { label: "Case Assignment", icon: UserPlus, path: "/assignment", view: VIEWS.ASSIGNMENT },
    ],
  },
  {
    title: "Ledgers & Analytics",
    items: [
      { label: "City Ledger", icon: Building2, path: "/city-pivot", view: VIEWS.CITY_PIVOT },
      { label: "Team Ledger", icon: GitFork, path: "/team-pivot", view: VIEWS.TEAM_PIVOT },
      { label: "Band Analysis", icon: Waves, path: "/band-explorer", view: VIEWS.CITY_TEAM_MATRIX },
      {
        label: "Team Performance",
        icon: Target,
        path: "/exec-team-perf",
        view: VIEWS.EXEC_TEAM_PERF,
      },
    ],
  },
  {
    title: "Field & Quality",
    items: [
      { label: "Attendance Logs", icon: CalendarClock, path: "/attendance", view: VIEWS.ATTENDANCE },
      {
        label: "Quality & Feedback",
        icon: MessageSquare,
        path: "/feedbacks",
        view: VIEWS.FEEDBACKS,
      },
      { label: "Audit Logs", icon: History, path: "/audit", view: VIEWS.AUDIT_LOG },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Settings", icon: Sliders, path: "/settings", view: VIEWS.SETTINGS },
      {
        label: "Connectivity Hub",
        icon: Database,
        path: "/connectivity",
        view: VIEWS.CONNECTIVITY_HUB,
      },
    ],
  },
];

export function AppSidebar({
  collapsed,
  setCollapsed,
  setMobileOpen,
}: {
  collapsed: boolean;
  setCollapsed: (c: boolean | ((prev: boolean) => boolean)) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}) {
  const { hasPermission } = useAuth();
  const location = useLocation();

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Overview: true,
    Operations: true,
    "Ledgers & Analytics": true,
  });

  useEffect(() => {
    const currentGroup = NAV_GROUPS.find((g) => g.items.some((i) => i.path === location.pathname));
    if (currentGroup) {
      setExpandedGroups((prev) => ({ ...prev, [currentGroup.title]: true }));
    }
  }, [location.pathname]);

  const toggleGroup = (title: string) => {
    if (collapsed) {
      setCollapsed(false);
      setExpandedGroups((prev) => ({ ...prev, [title]: true }));
    } else {
      setExpandedGroups((prev) => ({ ...prev, [title]: !prev[title] }));
    }
  };

  return (
    <aside
      aria-label="Workspace sidebar"
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-card text-foreground transition-all duration-200 ease-out ${
        collapsed ? "w-[72px]" : "w-[260px]"
      }`}
    >
      <div className="mv-brand-ribbon shrink-0" />

      {/* Brand Mark Header */}
      <div className="flex h-16 shrink-0 items-center border-b border-border/80 bg-card">
        <Link
          to="/dashboard"
          className={`flex items-center gap-3 w-full transition-all duration-150 ${
            collapsed ? "justify-center px-0" : "px-5"
          }`}
        >
          <MahavtaarLogoMark
            className="h-9 w-9 shrink-0 object-contain transition-transform duration-150 hover:scale-105"
            alt="Mahavtaar Enterprises"
          />
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-heading text-base font-extrabold tracking-tight text-foreground leading-none truncate">
                Mahavtaar
              </span>
              <span className="mt-1 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase truncate">
                Working Ledger
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Quick Search Button inside Expanded Sidebar */}
      {!collapsed && (
        <div className="px-3.5 pt-3 pb-1 shrink-0">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("mahavtaar:open-command-bar"))}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-muted/45 px-3 py-2 text-xs text-muted-foreground hover:border-primary/40 hover:bg-muted/75 hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-2 truncate">
              <Search className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate font-medium">Jump to page or case…</span>
            </span>
            <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground shrink-0">
              ⌘K
            </kbd>
          </button>
        </div>
      )}

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 scrollbar-thin flex flex-col gap-1.5">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => hasPermission(item.view));
          if (visibleItems.length === 0) return null;

          const isExpanded = Boolean(expandedGroups[group.title]);
          const hasActiveChild = visibleItems.some((i) => i.path === location.pathname);

          return (
            <div key={group.title} className="px-3 flex flex-col gap-0.5">
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.title)}
                  aria-expanded={isExpanded}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 mt-1.5 rounded-md text-[11px] font-semibold tracking-wide transition-colors ${
                    hasActiveChild
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <span className="truncate">{group.title}</span>
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 opacity-60 shrink-0" />
                  )}
                </button>
              ) : (
                <div className="mx-auto my-2 h-px w-6 bg-border" />
              )}

              <div
                className={`flex flex-col gap-0.5 overflow-hidden transition-all duration-200 ${
                  !collapsed && !isExpanded ? "max-h-0 opacity-0" : "max-h-[520px] opacity-100"
                }`}
              >
                {visibleItems.map((item) => {
                  const active = location.pathname === item.path;
                  return (
                    <Tooltip key={item.path} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Link
                          to={item.path}
                          onClick={() => setMobileOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={`group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-150 ${
                            active
                              ? "bg-primary/10 text-primary font-semibold"
                              : "font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                          } ${collapsed ? "justify-center px-0" : ""}`}
                        >
                          {active && !collapsed && (
                            <span
                              aria-hidden="true"
                              className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-gradient-to-b from-[#81258c] via-[#0799cf] to-[#55a94f]"
                            />
                          )}
                          <item.icon
                            className={`h-[17px] w-[17px] shrink-0 transition-transform duration-150 ${
                              active ? "text-primary" : "group-hover:text-foreground"
                            }`}
                          />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </Link>
                      </TooltipTrigger>
                      {collapsed && (
                        <TooltipContent
                          side="right"
                          sideOffset={10}
                          className="font-semibold text-xs bg-popover text-popover-foreground border-border"
                        >
                          {item.label}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Collapse Toggle Footer */}
      <div className="mt-auto shrink-0 border-t border-border/80 bg-muted/20 p-2.5">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex w-full items-center gap-2 rounded-lg py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${
            collapsed ? "justify-center" : "justify-start px-3"
          }`}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4" />
              <span>Collapse Menu</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
