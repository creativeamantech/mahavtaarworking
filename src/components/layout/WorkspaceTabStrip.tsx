// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { useWorkspaceTabs, renderTabIcon } from '@/contexts/WorkspaceTabsContext';
import { useAuth } from '@/contexts/AuthContext';
import { VIEWS } from '@/constants/permissions';
import { 
  X, Plus, Pin, ChevronLeft, ChevronRight, 
  MoreVertical, Check, ArrowRightToLine, AlertCircle
} from 'lucide-react';
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
  category: 'Executive Hub' | 'Portfolio & Strategy' | 'Analytics & Reports' | 'Operations & Admin';
}

const ALL_VIEWS: ViewMeta[] = [
  // Executive Hub
  { path: '/exec-dashboard', title: 'Exec Strategy', iconName: 'TrendingUp', view: VIEWS.EXEC_DASHBOARD, category: 'Executive Hub' },
  { path: '/exec-team-perf', title: 'Team Performance', iconName: 'Target', view: VIEWS.EXEC_TEAM_PERF, category: 'Executive Hub' },
  { path: '/live-monitoring', title: 'Live Tracking', iconName: 'MonitorPlay', view: VIEWS.LIVE_MONITORING, category: 'Executive Hub' },
  
  // Portfolio & Strategy
  { path: '/dashboard', title: 'Admin Strategy', iconName: 'Home', view: VIEWS.DASHBOARD, category: 'Portfolio & Strategy' },
  { path: '/explorer', title: 'Data Explorer', iconName: 'Search', view: VIEWS.DATA_EXPLORER, category: 'Portfolio & Strategy' },
  { path: '/feedbacks', title: 'Quality & Feedback', iconName: 'MessageSquare', view: VIEWS.FEEDBACKS, category: 'Portfolio & Strategy' },
  
  // Analytics & Reports
  { path: '/city-pivot', title: 'City Ledger', iconName: 'Building2', view: VIEWS.CITY_PIVOT, category: 'Analytics & Reports' },
  { path: '/team-pivot', title: 'Team Ledger', iconName: 'GitFork', view: VIEWS.TEAM_PIVOT, category: 'Analytics & Reports' },
  { path: '/band-explorer', title: 'Band Analysis', iconName: 'Waves', view: VIEWS.CITY_TEAM_MATRIX, category: 'Analytics & Reports' },
  
  // Operations & Admin
  { path: '/data-entry', title: 'Data Ingestion', iconName: 'Edit3', view: VIEWS.DATA_ENTRY, category: 'Operations & Admin' },
  { path: '/assignment', title: 'Case Assignment', iconName: 'UserPlus', view: VIEWS.ASSIGNMENT, category: 'Operations & Admin' },
  { path: '/attendance', title: 'Attendance Logs', iconName: 'CalendarClock', view: VIEWS.ATTENDANCE, category: 'Operations & Admin' },
  { path: '/settings', title: 'Settings & Sheets', iconName: 'Sliders', view: VIEWS.SETTINGS, category: 'Operations & Admin' },
  { path: '/audit', title: 'Audit Logs', iconName: 'History', view: VIEWS.AUDIT_LOG, category: 'Operations & Admin' },
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
    clearTabDirty
  } = useWorkspaceTabs();
  
  const { hasPermission } = useAuth();
  const tabsScrollRef = useRef<HTMLDivElement | null>(null);
  const activeTabElRef = useRef<HTMLDivElement | null>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Filter views permitted for current user
  const permittedViews = ALL_VIEWS.filter(v => hasPermission(v.view));

  // Check scroll capability
  const checkScroll = () => {
    const el = tabsScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [openTabs]);

  // Scroll active tab into view smoothly
  useEffect(() => {
    if (activeTabElRef.current) {
      activeTabElRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
    checkScroll();
  }, [activeTabId]);

  // Scroll buttons
  const scrollTabs = (direction: 'left' | 'right') => {
    if (!tabsScrollRef.current) return;
    const offset = direction === 'left' ? -200 : 200;
    tabsScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    setTimeout(checkScroll, 250);
  };

  // Mouse wheel horizontal scroll over tabs
  const handleWheel = (e: React.WheelEvent) => {
    if (!tabsScrollRef.current) return;
    if (Math.abs(e.deltaX) > 0) return; // native horizontal scroll
    if (e.deltaY !== 0) {
      tabsScrollRef.current.scrollLeft += e.deltaY;
      checkScroll();
    }
  };

  const categories = ['Executive Hub', 'Portfolio & Strategy', 'Analytics & Reports', 'Operations & Admin'] as const;

  return (
    <div className="hidden md:flex items-center gap-1 px-2.5 bg-muted/40 border-b border-border/80 h-9.5 select-none text-xs font-medium relative group/tabstrip">
      
      {/* Scroll Left Button */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollTabs('left')}
          className="z-10 p-1 rounded-sm bg-background/90 text-muted-foreground hover:text-foreground shadow-xs border border-border/50 shrink-0 mr-1"
          title="Scroll Left"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Tabs Container */}
      <div 
        ref={tabsScrollRef}
        onWheel={handleWheel}
        onScroll={checkScroll}
        className="flex items-center gap-1.5 max-w-full overflow-x-auto scrollbar-none scroll-smooth py-0.5"
      >
        {openTabs.map((tab) => {
          const isActive = activeTabId === tab.id || activeTabId === tab.path;
          const tabDirty = dirtyTabs[tab.id] || dirtyTabs[tab.path];
          const isDirty = !!tabDirty?.isDirty;

          const tabTooltip = isDirty
            ? `● [UNSAVED CHANGES] ${tab.title}${tabDirty.label ? ` (${tabDirty.label})` : ''}${tabDirty.count ? ` - ${tabDirty.count} unsaved` : ''}`
            : tab.pinned ? `${tab.title} (Pinned)` : tab.title;

          return (
            <div
              key={tab.id}
              ref={isActive ? activeTabElRef : null}
              onClick={() => setActiveTabId(tab.id)}
              onMouseDown={(e) => {
                // Middle click closes tab
                if (e.button === 1 && tab.closable) {
                  e.preventDefault();
                  closeTab(tab.id, e);
                }
              }}
              title={tabTooltip}
              className={`group/tab relative flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-t-md transition-all duration-150 cursor-pointer border-t border-x shrink-0 ${
                isActive
                  ? isDirty 
                    ? 'bg-card text-foreground border-border shadow-xs font-semibold'
                    : 'bg-card text-primary border-border shadow-xs font-semibold'
                  : 'bg-transparent text-muted-foreground border-transparent hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {/* Active Accent Top Line (amber if unsaved, primary if clean) */}
              {isActive && (
                <div className={`absolute top-0 left-0 right-0 h-[2.5px] rounded-t-md ${
                  isDirty ? 'bg-amber-500 shadow-xs' : 'bg-primary'
                }`} />
              )}

              {/* Pin Indicator */}
              {tab.pinned && (
                <Pin 
                  onClick={(e) => togglePinTab(tab.id, e)}
                  className="h-2.5 w-2.5 text-primary rotate-45 shrink-0 hover:scale-125 transition-transform" 
                  title="Pinned tab (Click to toggle)"
                />
              )}

              {/* Tab Icon */}
              <span className={`shrink-0 ${
                isActive 
                  ? (isDirty ? 'text-amber-600 dark:text-amber-400' : 'text-primary') 
                  : 'text-muted-foreground group-hover/tab:text-foreground'
              }`}>
                {renderTabIcon(tab.iconName)}
              </span>

              {/* Tab Title */}
              <span className="truncate max-w-[125px] lg:max-w-[165px] tracking-tight flex items-center gap-1">
                <span>{tab.title}</span>
                {isDirty && (
                  <span className="text-amber-500 font-bold leading-none select-none" title="Unsaved changes">•</span>
                )}
              </span>

              {/* Unsaved Changes Indicator Dot / Badge */}
              {isDirty && (
                <div 
                  className="flex items-center gap-1 shrink-0 ml-0.5" 
                  title={`Unsaved changes in this ledger${tabDirty.label ? `: ${tabDirty.label}` : ''}${tabDirty.count ? ` (${tabDirty.count} pending)` : ''}`}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-80"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 shadow-xs"></span>
                  </span>
                  {typeof tabDirty.count === 'number' && tabDirty.count > 0 && (
                    <span className="text-[9px] font-bold px-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      {tabDirty.count}
                    </span>
                  )}
                </div>
              )}

              {/* Tab Action Menu / Close */}
              <div className="flex items-center ml-0.5 gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                {/* Tab Context Dropdown */}
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
                          <span className="truncate">{tabDirty.label || `${tabDirty.count || 1} unsaved change(s)`}</span>
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
                      <span>{tab.pinned ? 'Unpin Tab' : 'Pin Tab'}</span>
                    </DropdownMenuItem>
                    
                    {tab.closable && (
                      <DropdownMenuItem 
                        onClick={() => closeTab(tab.id)}
                        className={`cursor-pointer gap-2 ${isDirty ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-rose-500 hover:text-rose-600 focus:text-rose-600'}`}
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>{isDirty ? 'Discard & Close Tab' : 'Close Tab'}</span>
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

                {/* Direct Close Button */}
                {tab.closable && (
                  <button
                    type="button"
                    onClick={(e) => closeTab(tab.id, e)}
                    title={isDirty ? "Tab has unsaved changes. Click to close (will prompt confirmation)" : "Close tab (Middle click also closes)"}
                    className={`p-0.5 rounded transition-colors shrink-0 ${
                      isActive
                        ? isDirty
                          ? 'text-amber-600 hover:bg-amber-500/20 hover:text-amber-700'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        : isDirty
                          ? 'opacity-80 text-amber-600 hover:bg-amber-500/20 hover:text-amber-700'
                          : 'opacity-0 group-hover/tab:opacity-100 text-muted-foreground hover:bg-card hover:text-foreground'
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

      {/* Scroll Right Button */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollTabs('right')}
          className="z-10 p-1 rounded-sm bg-background/90 text-muted-foreground hover:text-foreground shadow-xs border border-border/50 shrink-0 ml-1"
          title="Scroll Right"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}

      {/* New Tab Dropdown Launcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 ml-1 border border-border/40 hover:border-border"
            title="Open New Tab (Alt + 1..9 to jump)"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden xl:inline text-[11px] font-semibold">New Tab</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 max-h-[75vh] overflow-y-auto">
          <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Open Workspace View</span>
            <span className="text-[10px] font-normal text-muted-foreground/80">Alt+1..9</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {categories.map((cat) => {
            const catViews = permittedViews.filter(v => v.category === cat);
            if (catViews.length === 0) return null;

            return (
              <React.Fragment key={cat}>
                <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/30 rounded-xs my-0.5">
                  {cat}
                </div>
                {catViews.map((view) => {
                  const isOpen = openTabs.some(t => t.id === view.path || t.path === view.path);
                  const viewDirty = dirtyTabs[view.path]?.isDirty;

                  return (
                    <DropdownMenuItem
                      key={view.path}
                      onClick={() => openTab({ title: view.title, path: view.path, iconName: view.iconName })}
                      className="cursor-pointer text-xs flex items-center justify-between py-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-primary">{renderTabIcon(view.iconName, "h-4 w-4")}</span>
                        <span>{view.title}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {viewDirty && (
                          <span className="flex items-center text-[10px] font-medium text-amber-700 bg-amber-500/15 dark:text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-500/30">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mr-1 animate-pulse" />
                            Unsaved
                          </span>
                        )}
                        {isOpen && (
                          <span className="flex items-center text-[10px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
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

      {/* Global Right Actions: Unsaved Ledgers Summary & Close Others */}
      <div className="ml-auto flex items-center gap-2 shrink-0 pl-2">
        {/* Unsaved Changes Global Indicator Pill */}
        {totalUnsavedLedgers > 0 && (
          <div 
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 text-[11px] font-semibold animate-in fade-in select-none shadow-xs"
            title={`${totalUnsavedLedgers} ledger${totalUnsavedLedgers > 1 ? 's have' : ' has'} unsaved changes`}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
            </span>
            <span>{totalUnsavedLedgers} Unsaved</span>
          </div>
        )}

        {openTabs.length > 1 && (
          <button
            type="button"
            onClick={() => closeOtherTabs(activeTabId)}
            className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-muted transition-colors font-medium"
            title="Close all unpinned tabs except current"
          >
            Close Others
          </button>
        )}
      </div>
    </div>
  );
}
