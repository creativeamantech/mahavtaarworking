// @ts-nocheck
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { useLocation, useNavigate } from '@/lib/router-compat';
import { useAuth } from '@/contexts/AuthContext';
import { VIEWS } from '@/constants/permissions';
import { 
  Home, TrendingUp, MonitorPlay, Target, Search, Waves, 
  Building2, GitFork, MessageSquare, Edit3, UserPlus, 
  CalendarClock, Sliders, History, CreditCard, Layout
} from 'lucide-react';

export interface WorkspaceTab {
  id: string;
  title: string;
  path: string;
  iconName: string;
  closable: boolean;
  pinned?: boolean;
}

export interface TabDirtyState {
  isDirty: boolean;
  count?: number;
  label?: string;
  modifiedAt?: number;
}

interface WorkspaceTabsContextType {
  openTabs: WorkspaceTab[];
  activeTabId: string;
  dirtyTabs: Record<string, TabDirtyState>;
  totalUnsavedLedgers: number;
  setTabDirty: (tabIdOrPath: string, isDirty: boolean, details?: { count?: number; label?: string }) => void;
  clearTabDirty: (tabIdOrPath: string) => void;
  getTabDirty: (tabIdOrPath: string) => TabDirtyState | undefined;
  openTab: (tab: { title: string; path: string; iconName?: string; pinned?: boolean }) => void;
  closeTab: (id: string, e?: React.MouseEvent) => void;
  setActiveTabId: (id: string) => void;
  togglePinTab: (id: string, e?: React.MouseEvent) => void;
  closeOtherTabs: (id: string) => void;
  closeTabsToTheRight: (id: string) => void;
}

export const ROUTE_LOOKUP: Record<string, { title: string; iconName: string; view?: string }> = {
  '/dashboard': { title: 'Admin Strategy', iconName: 'Home', view: VIEWS.DASHBOARD },
  '/exec-dashboard': { title: 'Exec Strategy', iconName: 'TrendingUp', view: VIEWS.EXEC_DASHBOARD },
  '/live-monitoring': { title: 'Live Tracking', iconName: 'MonitorPlay', view: VIEWS.LIVE_MONITORING },
  '/exec-team-perf': { title: 'Team Performance', iconName: 'Target', view: VIEWS.EXEC_TEAM_PERF },
  '/explorer': { title: 'Data Explorer', iconName: 'Search', view: VIEWS.DATA_EXPLORER },
  '/band-explorer': { title: 'Band Analysis', iconName: 'Waves', view: VIEWS.CITY_TEAM_MATRIX },
  '/city-pivot': { title: 'City Ledger', iconName: 'Building2', view: VIEWS.CITY_PIVOT },
  '/team-pivot': { title: 'Team Ledger', iconName: 'GitFork', view: VIEWS.TEAM_PIVOT },
  '/feedbacks': { title: 'Quality & Feedback', iconName: 'MessageSquare', view: VIEWS.FEEDBACKS },
  '/data-entry': { title: 'Data Ingestion', iconName: 'Edit3', view: VIEWS.DATA_ENTRY },
  '/assignment': { title: 'Case Assignment', iconName: 'UserPlus', view: VIEWS.ASSIGNMENT },
  '/attendance': { title: 'Attendance Logs', iconName: 'CalendarClock', view: VIEWS.ATTENDANCE },
  '/settings': { title: 'Settings & Sheets', iconName: 'Sliders', view: VIEWS.SETTINGS },
  '/audit': { title: 'Audit Logs', iconName: 'History', view: VIEWS.AUDIT_LOG },
};

const getHomeTab = (isExec: boolean): WorkspaceTab => {
  return isExec
    ? {
        id: '/exec-dashboard',
        title: 'Exec Strategy',
        path: '/exec-dashboard',
        iconName: 'TrendingUp',
        closable: false,
        pinned: true,
      }
    : {
        id: '/dashboard',
        title: 'Admin Strategy',
        path: '/dashboard',
        iconName: 'Home',
        closable: false,
        pinned: true,
      };
};

const WorkspaceTabsContext = createContext<WorkspaceTabsContextType | undefined>(undefined);

export function WorkspaceTabsProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const isExec = user?.role === 'EXECUTIVE';

  const userStorageKey = `mahavtaar_workspace_tabs_${user?.id || 'guest'}`;

  // Unsaved changes state per tab
  const [dirtyTabs, setDirtyTabs] = useState<Record<string, TabDirtyState>>({});

  // Build initial tabs based on user role and saved state
  const [openTabs, setOpenTabs] = useState<WorkspaceTab[]>(() => {
    const homeTab = getHomeTab(isExec);
    try {
      const saved = localStorage.getItem(userStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasHome = parsed.some(t => t.id === homeTab.id);
          const normalized = parsed.map(t => {
            if (t.id === homeTab.id) {
              return { ...t, closable: false, pinned: true };
            }
            return t;
          });
          return hasHome ? normalized : [homeTab, ...normalized];
        }
      }
    } catch (e) {
      console.warn('Failed to parse workspace tabs from storage', e);
    }
    return [homeTab];
  });

  const [activeTabId, setActiveTabIdState] = useState<string>(() => {
    const current = location.pathname;
    return current && current !== '/' && current !== '/login' ? current : getHomeTab(isExec).id;
  });

  // Track current user ID to reload appropriate tabs when user switches
  const prevUserIdRef = useRef<string | undefined>(user?.id);
  useEffect(() => {
    if (prevUserIdRef.current !== user?.id) {
      prevUserIdRef.current = user?.id;
      const homeTab = getHomeTab(isExec);
      try {
        const saved = localStorage.getItem(userStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const permitted = parsed.filter(t => {
              if (t.id === homeTab.id) return true;
              const routeMeta = ROUTE_LOOKUP[t.path];
              if (routeMeta && routeMeta.view) {
                return hasPermission(routeMeta.view);
              }
              return true;
            });
            const hasHome = permitted.some(t => t.id === homeTab.id);
            setOpenTabs(hasHome ? permitted : [homeTab, ...permitted]);
            return;
          }
        }
      } catch (e) {
        console.warn('Error reading user tabs', e);
      }
      setOpenTabs([homeTab]);
      setDirtyTabs({}); // Reset dirty tabs on user change
    }
  }, [user?.id, isExec, userStorageKey, hasPermission]);

  // Persist open tabs to user-specific localStorage
  useEffect(() => {
    try {
      localStorage.setItem(userStorageKey, JSON.stringify(openTabs));
    } catch (e) {
      console.warn('Failed to save workspace tabs to storage', e);
    }
  }, [openTabs, userStorageKey]);

  // Sync current route with workspace tabs
  useEffect(() => {
    const currentPath = location.pathname;
    if (!currentPath || currentPath === '/' || currentPath === '/login') return;

    setActiveTabIdState(currentPath);

    setOpenTabs(prev => {
      const existing = prev.find(t => t.id === currentPath || t.path === currentPath);
      if (existing) {
        return prev;
      }

      // Determine tab details
      let title = 'Workspace View';
      let iconName = 'Layout';

      if (ROUTE_LOOKUP[currentPath]) {
        title = ROUTE_LOOKUP[currentPath].title;
        iconName = ROUTE_LOOKUP[currentPath].iconName;
      } else if (currentPath.startsWith('/customer/')) {
        const agreementId = decodeURIComponent(currentPath.split('/customer/')[1] || '');
        title = agreementId ? `Case #${agreementId.slice(-6)}` : 'Customer 360';
        iconName = 'CreditCard';
      }

      const homeTab = getHomeTab(isExec);
      const isHome = currentPath === homeTab.path;

      const newTab: WorkspaceTab = {
        id: currentPath,
        title,
        path: currentPath,
        iconName,
        closable: !isHome,
        pinned: isHome,
      };

      return [...prev, newTab];
    });
  }, [location.pathname, isExec]);

  // Unsaved changes management methods
  const setTabDirty = useCallback((tabIdOrPath: string, isDirty: boolean, details?: { count?: number; label?: string }) => {
    setDirtyTabs(prev => {
      if (!isDirty) {
        if (!prev[tabIdOrPath]) return prev;
        const next = { ...prev };
        delete next[tabIdOrPath];
        return next;
      }
      return {
        ...prev,
        [tabIdOrPath]: {
          isDirty: true,
          count: details?.count,
          label: details?.label,
          modifiedAt: Date.now(),
        }
      };
    });
  }, []);

  const clearTabDirty = useCallback((tabIdOrPath: string) => {
    setDirtyTabs(prev => {
      if (!prev[tabIdOrPath]) return prev;
      const next = { ...prev };
      delete next[tabIdOrPath];
      return next;
    });
  }, []);

  const getTabDirty = useCallback((tabIdOrPath: string): TabDirtyState | undefined => {
    return dirtyTabs[tabIdOrPath];
  }, [dirtyTabs]);

  const totalUnsavedLedgers = Object.values(dirtyTabs).filter(t => t.isDirty).length;

  // Keyboard navigation listener (Alt + Left/Right, Alt + 1-9)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

      // Alt + Left Arrow: Previous Tab
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        const currentIndex = openTabs.findIndex(t => t.id === activeTabId || t.path === activeTabId);
        if (currentIndex > 0) {
          const prevTab = openTabs[currentIndex - 1];
          if (prevTab) {
            setActiveTabIdState(prevTab.id);
            navigate(prevTab.path);
          }
        }
      }

      // Alt + Right Arrow: Next Tab
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        const currentIndex = openTabs.findIndex(t => t.id === activeTabId || t.path === activeTabId);
        if (currentIndex >= 0 && currentIndex < openTabs.length - 1) {
          const nextTab = openTabs[currentIndex + 1];
          if (nextTab) {
            setActiveTabIdState(nextTab.id);
            navigate(nextTab.path);
          }
        }
      }

      // Alt + 1 to 9: Direct Tab Jump
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key, 10) - 1;
        if (index < openTabs.length && openTabs[index]) {
          e.preventDefault();
          const target = openTabs[index];
          setActiveTabIdState(target.id);
          navigate(target.path);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openTabs, activeTabId, navigate]);

  const openTab = useCallback(({ title, path, iconName, pinned }: { title: string; path: string; iconName?: string; pinned?: boolean }) => {
    const existing = openTabs.find(t => t.id === path || t.path === path);
    if (!existing) {
      const resolvedIcon = iconName || ROUTE_LOOKUP[path]?.iconName || 'Layout';
      const homeTab = getHomeTab(isExec);
      const isHome = path === homeTab.path;

      const newTab: WorkspaceTab = {
        id: path,
        title,
        path,
        iconName: resolvedIcon,
        closable: !isHome,
        pinned: isHome ? true : !!pinned,
      };
      setOpenTabs(prev => [...prev, newTab]);
    }
    setActiveTabIdState(path);
    navigate(path);
  }, [openTabs, isExec, navigate]);

  const setActiveTabId = useCallback((id: string) => {
    const tab = openTabs.find(t => t.id === id);
    if (tab) {
      setActiveTabIdState(tab.id);
      navigate(tab.path);
    }
  }, [openTabs, navigate]);

  const closeTab = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const homeTab = getHomeTab(isExec);
    const tabToClose = openTabs.find(t => t.id === id);
    if (!tabToClose || !tabToClose.closable || tabToClose.id === homeTab.id) return;

    // Check for unsaved changes before closing
    const dirty = dirtyTabs[id] || dirtyTabs[tabToClose.path];
    if (dirty && dirty.isDirty) {
      const desc = dirty.label ? ` (${dirty.label})` : (dirty.count ? ` (${dirty.count} unsaved changes)` : '');
      const proceed = window.confirm(
        `Warning: You have unsaved changes in "${tabToClose.title}"${desc}.\n\nClosing this tab will discard your current edits. Do you want to close it anyway?`
      );
      if (!proceed) return;

      clearTabDirty(id);
      clearTabDirty(tabToClose.path);
    }

    const currentIndex = openTabs.findIndex(t => t.id === id);
    const filtered = openTabs.filter(t => t.id !== id);

    if (filtered.length === 0) {
      setOpenTabs([homeTab]);
      setActiveTabIdState(homeTab.id);
      navigate(homeTab.path);
      return;
    }

    setOpenTabs(filtered);

    // If closing the currently active tab, activate nearest neighbor
    if (activeTabId === id || activeTabId === tabToClose.path) {
      const targetIndex = currentIndex < filtered.length ? currentIndex : filtered.length - 1;
      const nextTab = filtered[targetIndex] || homeTab;
      setActiveTabIdState(nextTab.id);
      navigate(nextTab.path);
    }
  }, [openTabs, activeTabId, isExec, navigate, dirtyTabs, clearTabDirty]);

  const togglePinTab = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const homeTab = getHomeTab(isExec);
    if (id === homeTab.id) return;

    setOpenTabs(prev => prev.map(t => (t.id === id ? { ...t, pinned: !t.pinned } : t)));
  }, [isExec]);

  const closeOtherTabs = useCallback((id: string) => {
    const homeTab = getHomeTab(isExec);

    // Check if any other closing tab has unsaved changes
    const otherDirty = openTabs.some(t => {
      if (t.id === id || t.pinned || !t.closable || t.id === homeTab.id) return false;
      const d = dirtyTabs[t.id] || dirtyTabs[t.path];
      return d && d.isDirty;
    });

    if (otherDirty) {
      const proceed = window.confirm(
        'Warning: One or more tabs you are about to close contain unsaved changes.\n\nDo you want to discard them and close other tabs?'
      );
      if (!proceed) return;
    }

    const kept = openTabs.filter(t => t.id === id || t.pinned || !t.closable || t.id === homeTab.id);
    setOpenTabs(kept);

    if (!kept.some(t => t.id === activeTabId)) {
      setActiveTabIdState(id);
      const target = kept.find(t => t.id === id) || homeTab;
      navigate(target.path);
    }
  }, [openTabs, activeTabId, isExec, navigate, dirtyTabs]);

  const closeTabsToTheRight = useCallback((id: string) => {
    const homeTab = getHomeTab(isExec);
    const targetIdx = openTabs.findIndex(t => t.id === id);
    if (targetIdx === -1) return;

    // Check if any closing tab to the right has unsaved changes
    const rightDirty = openTabs.some((t, idx) => {
      if (idx <= targetIdx || t.pinned || !t.closable || t.id === homeTab.id) return false;
      const d = dirtyTabs[t.id] || dirtyTabs[t.path];
      return d && d.isDirty;
    });

    if (rightDirty) {
      const proceed = window.confirm(
        'Warning: One or more tabs to the right contain unsaved changes.\n\nDo you want to discard them and close those tabs?'
      );
      if (!proceed) return;
    }

    const kept = openTabs.filter((t, idx) => {
      if (idx <= targetIdx) return true;
      return t.pinned || !t.closable || t.id === homeTab.id;
    });

    setOpenTabs(kept);

    if (!kept.some(t => t.id === activeTabId)) {
      setActiveTabIdState(id);
      const target = kept.find(t => t.id === id) || homeTab;
      navigate(target.path);
    }
  }, [openTabs, activeTabId, isExec, navigate, dirtyTabs]);

  return (
    <WorkspaceTabsContext.Provider value={{
      openTabs,
      activeTabId,
      dirtyTabs,
      totalUnsavedLedgers,
      setTabDirty,
      clearTabDirty,
      getTabDirty,
      openTab,
      closeTab,
      setActiveTabId,
      togglePinTab,
      closeOtherTabs,
      closeTabsToTheRight
    }}>
      {children}
    </WorkspaceTabsContext.Provider>
  );
}

export function useWorkspaceTabs() {
  const context = useContext(WorkspaceTabsContext);
  if (!context) {
    throw new Error('useWorkspaceTabs must be used within a WorkspaceTabsProvider');
  }
  return context;
}

export function renderTabIcon(iconName: string, className = "h-3.5 w-3.5") {
  switch (iconName) {
    case 'Home': return <Home className={className} />;
    case 'TrendingUp': return <TrendingUp className={className} />;
    case 'MonitorPlay': return <MonitorPlay className={className} />;
    case 'Target': return <Target className={className} />;
    case 'Search': return <Search className={className} />;
    case 'Waves': return <Waves className={className} />;
    case 'Building2': return <Building2 className={className} />;
    case 'GitFork': return <GitFork className={className} />;
    case 'MessageSquare': return <MessageSquare className={className} />;
    case 'Edit3': return <Edit3 className={className} />;
    case 'UserPlus': return <UserPlus className={className} />;
    case 'CalendarClock': return <CalendarClock className={className} />;
    case 'Sliders': return <Sliders className={className} />;
    case 'History': return <History className={className} />;
    case 'CreditCard': return <CreditCard className={className} />;
    default: return <Layout className={className} />;
  }
}
