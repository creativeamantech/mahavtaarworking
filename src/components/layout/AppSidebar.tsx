import React, { useState, useEffect } from 'react';
import { Link, useLocation } from '@/lib/router-compat';
import { useAuth } from '@/contexts/AuthContext';
import { VIEWS } from '@/constants/permissions';
import { 
  Home, Edit3, UserPlus, TrendingUp, Target, 
  Search, Building2, GitFork, Waves, 
  MonitorPlay, MessageSquare, CalendarClock, 
  Sliders, History, LogOut, PanelLeftClose, PanelLeftOpen, Database,
  ChevronDown, ChevronRight
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

const NAV_GROUPS = [
  { title: 'Overview', items: [
    { label: 'Dashboard', icon: Home, path: '/dashboard', view: VIEWS.DASHBOARD },
    { label: 'Executive Dashboard', icon: TrendingUp, path: '/exec-dashboard', view: VIEWS.EXEC_DASHBOARD },
  ]},
  { title: 'Operations', items: [
    { label: 'Data Explorer', icon: Search, path: '/explorer', view: VIEWS.DATA_EXPLORER },
    { label: 'Data Entry & Imports', icon: Edit3, path: '/data-entry', view: VIEWS.DATA_ENTRY },
    { label: 'Case Assignment', icon: UserPlus, path: '/assignment', view: VIEWS.ASSIGNMENT },
  ]},
  { title: 'Analytics', items: [
    { label: 'City Pivot', icon: Building2, path: '/city-pivot', view: VIEWS.CITY_PIVOT },
    { label: 'Team Pivot', icon: GitFork, path: '/team-pivot', view: VIEWS.TEAM_PIVOT },
    { label: 'Band Explorer', icon: Waves, path: '/band-explorer', view: VIEWS.CITY_TEAM_MATRIX },
    { label: 'Executive Team Performance', icon: Target, path: '/exec-team-perf', view: VIEWS.EXEC_TEAM_PERF },
  ]},
  { title: 'Field & Quality', items: [
    { label: 'Attendance', icon: CalendarClock, path: '/attendance', view: VIEWS.ATTENDANCE },
    { label: 'All Feedbacks', icon: MessageSquare, path: '/feedbacks', view: VIEWS.FEEDBACKS },
    { label: 'Live Monitoring', icon: MonitorPlay, path: '/live-monitoring', view: VIEWS.LIVE_MONITORING },
    { label: 'Audit Log', icon: History, path: '/audit', view: VIEWS.AUDIT_LOG },
  ]},
  { title: 'System', items: [
    { label: 'Settings', icon: Sliders, path: '/settings', view: VIEWS.SETTINGS },
    { label: 'Connectivity Hub', icon: Database, path: '/connectivity', view: VIEWS.CONNECTIVITY_HUB },
  ]},
];

const ADMIN_CONTROL_PATHS = new Set([
  '/dashboard', '/live-monitoring', '/explorer', '/band-explorer',
  '/city-pivot', '/team-pivot', '/feedbacks', '/data-entry',
  '/assignment', '/attendance', '/settings', '/audit', '/connectivity',
]);

const ADMIN_NAV_GROUP = {
  title: 'Admin Controls',
  items: [
    { label: 'Admin Dashboard', icon: Home, path: '/dashboard', view: VIEWS.DASHBOARD },
    { label: 'Live Tracking', icon: MonitorPlay, path: '/live-monitoring', view: VIEWS.LIVE_MONITORING },
    { label: 'Data Explorer', icon: Search, path: '/explorer', view: VIEWS.DATA_EXPLORER },
    { label: 'Band Analysis', icon: Waves, path: '/band-explorer', view: VIEWS.CITY_TEAM_MATRIX },
    { label: 'City Ledger', icon: Building2, path: '/city-pivot', view: VIEWS.CITY_PIVOT },
    { label: 'Team Ledger', icon: GitFork, path: '/team-pivot', view: VIEWS.TEAM_PIVOT },
    { label: 'Quality & Feedback', icon: MessageSquare, path: '/feedbacks', view: VIEWS.FEEDBACKS },
    { label: 'Data Ingestion', icon: Edit3, path: '/data-entry', view: VIEWS.DATA_ENTRY },
    { label: 'Case Assignment', icon: UserPlus, path: '/assignment', view: VIEWS.ASSIGNMENT },
    { label: 'Attendance Logs', icon: CalendarClock, path: '/attendance', view: VIEWS.ATTENDANCE },
    { label: 'System Settings', icon: Sliders, path: '/settings', view: VIEWS.SETTINGS },
    { label: 'Audit Logs', icon: History, path: '/audit', view: VIEWS.AUDIT_LOG },
    { label: 'Workspace Connection', icon: Database, path: '/connectivity', view: VIEWS.CONNECTIVITY_HUB },
  ],
};

export function AppSidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: { collapsed: boolean, setCollapsed: (c: boolean | ((prev: boolean) => boolean)) => void, mobileOpen: boolean, setMobileOpen: (v: boolean) => void }) {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  
  // Track expanded state for groups
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Auto-expand group containing active route on mount
  useEffect(() => {
    const currentGroup = NAV_GROUPS.find(g => g.items.some(i => i.path === location.pathname));
    if (currentGroup) {
      setExpandedGroups(prev => ({ ...prev, [currentGroup.title]: true }));
    }
  }, [location.pathname]);

  const toggleGroup = (title: string) => {
    if (collapsed) {
      // If clicking a group icon while collapsed, auto-expand the sidebar and open the group
      setCollapsed(false);
      setExpandedGroups(prev => ({ ...prev, [title]: true }));
    } else {
      setExpandedGroups(prev => ({ ...prev, [title]: !prev[title] }));
    }
  };

  return (
    <aside className={`fixed left-0 top-0 z-40 flex h-screen flex-col bg-card/95 backdrop-blur-md text-foreground transition-all duration-300 ease-in-out ${collapsed ? 'w-[72px]' : 'w-[260px]'}`}>
      {/* Header / Logo */}
      <div className="flex h-[72px] shrink-0 items-center justify-center bg-muted/30 transition-all duration-300 border-b border-border">
        <div className={`flex items-center gap-3 transition-all duration-300 ${collapsed ? 'px-0 justify-center' : 'px-6 w-full'}`}>
          <img
            src="/149353-removebg-preview.png"
            alt="Mahavtaar"
            className="h-10 w-10 shrink-0 object-contain"
          />
          {!collapsed && (
            <div className="flex flex-col animate-in fade-in zoom-in duration-300">
              <h1 className="font-heading text-lg font-black tracking-tight text-foreground leading-tight">Mahavtaar</h1>
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-primary/80">Enterprise</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-thin scrollbar-thumb-white/10 flex flex-col gap-2">
        {(user?.role === 'ADMIN' ? [ADMIN_NAV_GROUP, ...NAV_GROUPS] : NAV_GROUPS).map((group, idx) => {
          
          const visibleItems = group.items.filter(item => hasPermission(item.view) && !(user?.role === 'ADMIN' && group !== ADMIN_NAV_GROUP && ADMIN_CONTROL_PATHS.has(item.path)));
          if (visibleItems.length === 0) return null;
          
          const isExpanded = expandedGroups[group.title];
          const hasActiveChild = visibleItems.some(i => i.path === location.pathname);

          return (
            <div key={group.title} className="px-3 flex flex-col gap-0.5">
              {!collapsed ? (
                <button 
                  onClick={() => toggleGroup(group.title)}
                  className={`w-full flex items-center justify-between px-3 py-2 mt-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${hasActiveChild ? 'text-primary' : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted'}`}
                >
                  {group.title}
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5 opacity-70" /> : <ChevronRight className="w-3.5 h-3.5 opacity-70" />}
                </button>
              ) : (
                <div className="mx-auto mt-4 mb-2 h-px w-6 bg-white/10" />
              )}
              
              {/* Items */}
              <div className={`flex flex-col gap-0.5 overflow-hidden transition-all duration-200 ${!collapsed && !isExpanded ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'}`}>
                {visibleItems.map(item => {
                  const active = location.pathname === item.path;
                  return (
                    <Tooltip key={item.path} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Link
                          to={item.path}
                          onClick={() => setMobileOpen(false)}
                          className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 overflow-hidden ${
                            active 
                              ? 'bg-primary/15 text-primary' 
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {active && (
                            <div className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                          )}
                          <item.icon className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 ${active ? 'text-primary' : 'group-hover:scale-110'}`} />
                          <span className={`truncate transition-all duration-300 ${collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                            {item.label}
                          </span>
                        </Link>
                      </TooltipTrigger>
                      {collapsed && (
                        <TooltipContent side="right" sideOffset={10} className="font-semibold text-xs bg-popover text-foreground border-border">
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

      {/* Footer */}
      <div className="mt-auto shrink-0 bg-muted/30 p-3 transition-all duration-300 border-t border-border">
        {/* Toggle Button */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className={`flex w-full items-center gap-2 rounded-lg py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground/70 transition-all duration-200 hover:bg-muted hover:text-foreground ${collapsed ? 'justify-center' : 'justify-start px-3'}`}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /> <span>Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}
