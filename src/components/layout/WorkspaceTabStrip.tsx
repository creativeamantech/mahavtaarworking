// @ts-nocheck
import React, { useState, useRef, useEffect } from "react";
import { useWorkspaceTabs, renderTabIcon } from "@/contexts/WorkspaceTabsContext";
import { useAuth } from "@/contexts/AuthContext";
import { VIEWS } from "@/constants/permissions";
import {
  X,
  Plus,
  Pin,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Check,
  ArrowRightToLine,
  AlertCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ViewMeta {
  path: string;
  title: string;
  iconName: string;
  view: string;
  category:
    | "Executive Hub"
    | "Portfolio & Strategy"
    | "Analytics & Reports"
    | "Operations & Admin";
}

const ALL_VIEWS: ViewMeta[] = [
  {
    path: "/exec-dashboard",
    title: "Exec Strategy",
    iconName: "TrendingUp",
    view: VIEWS.EXEC_DASHBOARD,
    category: "Executive Hub",
  },
  {
    path: "/exec-team-perf",
    title: "Team Performance",
    iconName: "Target",
    view: VIEWS.EXEC_TEAM_PERF,
    category: "Executive Hub",
  },
  {
    path: "/live-monitoring",
    title: "Live Tracking",
    iconName: "MonitorPlay",
    view: VIEWS.LIVE_MONITORING,
    category: "Executive Hub",
  },
  {
    path: "/dashboard",
    title: "Portfolio Dashboard",
    iconName: "Home",
    view: VIEWS.DASHBOARD,
    category: "Portfolio & Strategy",
  },
  {
    path: "/explorer",
    title: "Data Explorer",
    iconName: "Search",
    view: VIEWS.DATA_EXPLORER,
    category: "Portfolio & Strategy",
  },
  {
    path: "/feedbacks",
    title: "Quality & Feedback",
    iconName: "MessageSquare",
    view: VIEWS.FEEDBACKS,
    category: "Portfolio & Strategy",
  },
  {
    path: "/city-pivot",
    title: "City Ledger",
    iconName: "Building2",
    view: VIEWS.CITY_PIVOT,
    category: "Analytics & Reports",
  },
  {
    path: "/team-pivot",
    title: "Team Ledger",
    iconName: "GitFork",
    view: VIEWS.TEAM_PIVOT,
    category: "Analytics & Reports",
  },
  {
    path: "/band-explorer",
    title: "Band Analysis",
    iconName: "Waves",
    view: VIEWS.CITY_TEAM_MATRIX,
    category: "Analytics & Reports",
  },
  {
    path: "/data-entry",
    title: "Data Ingestion",
    iconName: "Edit3",
    view: VIEWS.DATA_ENTRY,
    category: "Operations & Admin",
  },
  {
    path: "/assignment",
    title: "Case Assignment",
    iconName: "UserPlus",
    view: VIEWS.ASSIGNMENT,
    category: "Operations & Admin",
  },
  {
    path: "/attendance",
    title: "Attendance Logs",
    iconName: "CalendarClock",
    view: VIEWS.ATTENDANCE,
    category: "Operations & Admin",
  },
  {
    path: "/settings",
    title: "Settings & Sheets",
    iconName: "Sliders",
    view: VIEWS.SETTINGS,
    category: "Operations & Admin",
  },
  {
    path: "/audit",
    title: "Audit Logs",
    iconName: "History",
    view: VIEWS.AUDIT_LOG,
    category: "Operations & Admin",
  },
];

export function WorkspaceTabStrip() {
  const {
    openTabs,
    activeTabId,
    dirtyTabs,
    totalUnsavedLedgers,
    setActiveTabId,
    closeTab,
    openTab,
    togglePinTab,
    closeOtherTabs,
    closeTabsToTheRight,
    clearTabDirty,
  } = useWorkspaceTabs();

  const { hasPermission } = useAuth();
  const tabsScrollRef = useRef<HTMLDivElement | null>(null);
  const activeTabElRef = useRef<HTMLDivElement | null>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const permittedViews = ALL_VIEWS.filter((v) => hasPermission(v.view));

  const checkScroll = () => {
    const el = tabsScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [openTabs]);

  useEffect(() => {
    if (activeTabElRef.current) {
      activeTabElRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
    checkScroll();
  }, [activeTabId]);

  const scrollTabs = (direction: "left" | "right") => {
    if (!tabsScrollRef.current) return;
    const offset = direction === "left" ? -200 : 200;
    tabsScrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    setTimeout(checkScroll, 250);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!tabsScrollRef.current) return;
    if (Math.abs(e.deltaX) > 0) return;
    if (e.deltaY !== 0) {
      tabsScrollRef.current.scrollLeft += e.deltaY;
      checkScroll();
    }
  };

  const categories = [
    "Executive Hub",
    "Portfolio & Strategy",
    "Analytics & Reports",
    "Operations & Admin",
  ] as const;

  return (
    <div className="hidden md:flex items-center gap-1 px-3 bg-muted/35 border-b border-border h-10 select-none text-xs font-medium relative group/tabstrip">
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollTabs("left")}
          className="z-10 p-1 rounded bg-card text-muted-foreground hover:text-foreground border border-border shrink-0 mr-1"
          title="Scroll Left"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      )}

      <div
        ref={tabsScrollRef}
        onWheel={handleWheel}
        onScroll={checkScroll}
        className="flex items-end gap-1 max-w-full overflow-x-auto scrollbar-none scroll-smooth h-full pt-1"
      >
        {openTabs.map((tab) => {
          const isActive = activeTabId === tab.id || activeTabId === tab.path;
          const tabDirty = dirtyTabs[tab.id] || dirtyTabs[tab.path];
          const isDirty = !!tabDirty?.isDirty;

          const tabTooltip = isDirty
            ? `Unsaved changes · ${tab.title}${tabDirty.label ? ` (${tabDirty.label})` : ""}${tabDirty.count ? ` · ${tabDirty.count} pending` : ""}`
            : tab.pinned
              ? `${tab.title} (Pinned)`
              : tab.title;

          return (
            <div
              key={tab.id}
              ref={isActive ? activeTabElRef : null}
              onClick={() => setActiveTabId(tab.id)}
              onMouseDown={(e) => {
                if (e.button === 1 && tab.closable) {
                  e.preventDefault();
                  closeTab(tab.id, e);
                }
              }}
              title={tabTooltip}
              className={`group/tab relative flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-t-lg transition-colors duration-150 cursor-pointer border-t border-x shrink-0 ${
                isActive
                  ? "bg-card text-foreground border-border font-semibold"
                  : "bg-transparent text-muted-foreground border-transparent hover:bg-muted/70 hover:text-foreground"
              }`}
            >
              {isActive && (
                <div
                  className={`absolute top-0 left-0 right-0 h-[2.5px] rounded-t-lg ${
                    isDirty
                      ? "bg-amber-500"
                      : "bg-gradient-to-r from-[#81258c] via-[#0799cf] to-[#55a94f]"
                  }`}
                />
              )}

              {tab.pinned && (
                <Pin
                  onClick={(e) => togglePinTab(tab.id, e)}
                  className="h-2.5 w-2.5 text-primary rotate-45 shrink-0 hover:scale-125 transition-transform"
                  title="Pinned tab (Click to toggle)"
                />
              )}

              <span
                className={`shrink-0 ${
                  isActive
                    ? isDirty
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-primary"
                    : "text-muted-foreground group-hover/tab:text-foreground"
                }`}
              >
                {renderTabIcon(tab.iconName)}
              </span>

              <span className="truncate max-w-[130px] lg:max-w-[170px] tracking-tight flex items-center gap-1 whitespace-nowrap">
                <span>{tab.title}</span>
              </span>

              {isDirty && (
                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 font-mono whitespace-nowrap">
                  · {tabDirty.count || 1} unsaved
                </span>
              )}

              <div
                className="flex items-center ml-0.5 gap-0.5 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="p-0.5 rounded opacity-0 group-hover/tab:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground transition-opacity"
                      title="Tab Options"
                    >
                      <MoreVertical className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52 text-xs">
                    {isDirty && (
                      <>
                        <div className="px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 rounded-sm mb-1 flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span className="truncate">
                            {tabDirty.label || `${tabDirty.count || 1} unsaved change(s)`}
                          </span>
                        </div>
                        <DropdownMenuItem
                          onClick={() => clearTabDirty(tab.id)}
                          className="cursor-pointer gap-2 text-muted-foreground hover:text-foreground text-[11px]"
                        >
                          <span>Mark as Saved</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}

                    <DropdownMenuItem
                      onClick={() => togglePinTab(tab.id)}
                      className="cursor-pointer gap-2"
                    >
                      <Pin className="h-3.5 w-3.5" />
                      <span>{tab.pinned ? "Unpin Tab" : "Pin Tab"}</span>
                    </DropdownMenuItem>

                    {tab.closable && (
                      <DropdownMenuItem
                        onClick={() => closeTab(tab.id)}
                        className={`cursor-pointer gap-2 ${
                          isDirty
                            ? "text-amber-600 dark:text-amber-400 font-semibold"
                            : "text-destructive focus:text-destructive"
                        }`}
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>{isDirty ? "Discard & Close Tab" : "Close Tab"}</span>
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onClick={() => closeOtherTabs(tab.id)}
                      className="cursor-pointer gap-2"
                    >
                      <span>Close Other Tabs</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => closeTabsToTheRight(tab.id)}
                      className="cursor-pointer gap-2"
                    >
                      <ArrowRightToLine className="h-3.5 w-3.5" />
                      <span>Close to the Right</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {tab.closable && (
                  <button
                    type="button"
                    onClick={(e) => closeTab(tab.id, e)}
                    title={
                      isDirty
                        ? "Tab has unsaved changes. Click to close"
                        : "Close tab (Middle click also closes)"
                    }
                    className={`p-0.5 rounded transition-colors shrink-0 ${
                      isActive
                        ? isDirty
                          ? "text-amber-600 hover:bg-amber-500/15"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        : isDirty
                          ? "opacity-80 text-amber-600 hover:bg-amber-500/15"
                          : "opacity-0 group-hover/tab:opacity-100 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollTabs("right")}
          className="z-10 p-1 rounded bg-card text-muted-foreground hover:text-foreground border border-border shrink-0 ml-1"
          title="Scroll Right"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-card transition-colors shrink-0 ml-1 border border-border/70 hover:border-border whitespace-nowrap"
            title="Open New Tab (Alt + 1..9 to jump)"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden xl:inline text-[11px] font-semibold">New Tab</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 max-h-[75vh] overflow-y-auto">
          <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
            <span>Open Workspace View</span>
            <span className="text-[10px] font-mono text-muted-foreground/80">Alt+1..9</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {categories.map((cat) => {
            const catViews = permittedViews.filter((v) => v.category === cat);
            if (catViews.length === 0) return null;

            return (
              <React.Fragment key={cat}>
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground bg-muted/40 rounded-xs my-0.5">
                  {cat}
                </div>
                {catViews.map((view) => {
                  const isOpen = openTabs.some((t) => t.id === view.path || t.path === view.path);
                  const viewDirty = dirtyTabs[view.path]?.isDirty;

                  return (
                    <DropdownMenuItem
                      key={view.path}
                      onClick={() =>
                        openTab({ title: view.title, path: view.path, iconName: view.iconName })
                      }
                      className="cursor-pointer text-xs flex items-center justify-between py-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-primary">
                          {renderTabIcon(view.iconName, "h-4 w-4")}
                        </span>
                        <span>{view.title}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        {viewDirty && (
                          <span className="font-medium text-amber-600 dark:text-amber-400">
                            Unsaved
                          </span>
                        )}
                        {isOpen && (
                          <span className="flex items-center font-medium text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3 w-3 mr-0.5" /> Open
                          </span>
                        )}
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </React.Fragment>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-2.5 shrink-0 pl-2">
        {totalUnsavedLedgers > 0 && (
          <span
            className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap"
            title={`${totalUnsavedLedgers} ledger${totalUnsavedLedgers > 1 ? "s have" : " has"} unsaved changes`}
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{totalUnsavedLedgers} unsaved</span>
          </span>
        )}

        {openTabs.length > 1 && (
          <button
            type="button"
            onClick={() => closeOtherTabs(activeTabId)}
            className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-card transition-colors font-medium whitespace-nowrap"
            title="Close all unpinned tabs except current"
          >
            Close Others
          </button>
        )}
      </div>
    </div>
  );
}
