import { useLocation, useNavigate } from '@/lib/router-compat';
import { ChevronLeft, ChevronRight, Search, UserCircle, LogOut, Bell } from 'lucide-react';
import { useDataState, useDataDispatch } from '@/contexts/DataContext';
import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '../ThemeToggle';
import { AutoSyncBar } from '../sync/AutoSyncBar';
import { AgentNotifications } from '../agent/AgentNotifications';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/exec-dashboard': 'Exec Dashboard',
  '/exec-team-perf': 'Team Overall Perf',
  '/data-entry': 'Data Entry',
  '/explorer': 'Explorer',
  '/assignment': 'Allocation',
  '/city-pivot': 'City Pivot',
  '/team-pivot': 'Team Pivot',
  '/band-explorer': 'Bands',
  '/settings': 'Settings',
  '/audit': 'Audit Log',
  '/live-monitoring': 'Live Monitoring',
  '/feedbacks': 'All Feedback',
  '/attendance': 'Attendance',
};

export function MobileHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  
  const { records } = useDataState();
  const isExplorer = location.pathname === '/explorer';

  

  const title = PAGE_TITLES[location.pathname] || 'CRM';

  return (
    <div className="sticky top-0 z-40 flex flex-col border-b border-border bg-card/95 backdrop-blur md:hidden shadow-sm">
      <div className="flex h-14 items-center justify-between px-3">
        {/* Navigation & Undo/Redo Group */}
        <div className="flex items-center gap-0.5 bg-muted/40 p-1 rounded-lg border border-border/50">
          <button 
            type="button"
            onClick={() => {
              if (window.history.state && window.history.state.idx > 0) {
                navigate(-1);
              } else {
                navigate('/dashboard', { replace: true });
              }
            }} 
            className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground" 
            title="Go Back"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => navigate(1)} className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground" title="Go Forward">
            <ChevronRight className="h-4 w-4" />
          </button>
          
          
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 mx-2">
          <img
            src="/149353-removebg-preview.png"
            alt="Mahavtaar"
            className="h-8 w-8 shrink-0 object-contain"
          />
          <div className="flex min-w-0 flex-col items-start leading-tight">
            <h1 className="truncate text-[11px] font-extrabold tracking-wide text-foreground">Mahavtaar Working</h1>
            <span className="mt-0.5 max-w-full truncate text-[9px] font-semibold text-muted-foreground">{title}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <AutoSyncBar compact userName={user?.name} />
          <ThemeToggle />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center hover:bg-muted p-0.5 rounded-full transition-colors border border-border/50 bg-card">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold shadow-sm">
                  {user?.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
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
              <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer">
                <UserCircle className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout} className="cursor-pointer text-orange-500 focus:text-orange-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span>Lock Session</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
      </div>

      
    </div>
  );
}
