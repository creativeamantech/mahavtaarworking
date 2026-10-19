// @ts-nocheck
import { AdvancedTargetsTab } from '../components/AdvancedTargetsTab';
import { useState, useMemo, useEffect } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { DataTable } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { DEFAULT_PERMISSIONS, VIEWS, Role, User } from '../constants/permissions';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '../components/ui/button';
import { UserFormSheet } from '../components/settings/UserFormSheet';
import { db, backupSystemData, resetSystemData, restoreSystemData } from '../lib/db';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { cn } from '../lib/utils';
import { TargetInput } from '../components/TargetInput';
import { SystemHealthDiagnostics } from '../components/settings/SystemHealthDiagnostics';
import { SpreadsheetManagementTab } from '../components/settings/SpreadsheetManagementTab';
import { SupabaseConnectionTab } from '../components/settings/SupabaseConnectionTab';
import { useSearchParams } from '@/lib/router-compat';
import { Database, Cloud } from 'lucide-react';


function SystemTab() {
  const [isResetting, setIsResetting] = useState(false);
  
  const handleBackup = async () => {
    try {
      await backupSystemData();
      toast.success('System backup downloaded successfully');
    } catch (e) {
      toast.error('Failed to create backup');
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("WARNING: Restoring a backup will overwrite existing local data. Ensure you have made a backup first. Proceed?")) {
      e.target.value = '';
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      await restoreSystemData(buffer);
      toast.success('System restored successfully. Reloading...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to restore backup';
      toast.error(message);
      e.target.value = '';
    }
  };

  const handleReset = async () => {
    if (!confirm("WARNING: This will delete ALL data (users, feedback, records). Type 'RESET' to confirm.")) return;
    try {
      setIsResetting(true);
      await resetSystemData();
      toast.success('System reset successfully');
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      toast.error('Failed to reset system');
      setIsResetting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-card border rounded-lg p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Data Backup & Restore</h3>
          <p className="text-sm text-muted-foreground mb-4">Download a complete JSON backup of all system data or restore from an existing backup file.</p>
          <div className="flex items-center gap-4">
            <Button onClick={handleBackup}>Download Full Backup</Button>
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleRestore}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                title="Restore from JSON Backup"
              />
              <Button variant="outline">Restore Backup</Button>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-900 rounded-lg p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">Danger Zone</h3>
          <p className="text-sm text-muted-foreground mb-4">Permanently wipe all data from this device. This cannot be undone.</p>
          <Button variant="destructive" onClick={handleReset} disabled={isResetting}>
            {isResetting ? 'Resetting...' : 'Factory Reset System'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function UserManagementTab() {
  const { users, user: currentUser, addUser, updateUser, deleteUser } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined);

  const [confirmWipe, setConfirmWipe] = useState(false);
  
  const handleWipeDatabase = async () => {
    if (!confirmWipe) {
      setConfirmWipe(true);
      toast('Click CONFIRM WIPE again to confirm deletion', { duration: 4000 });
      return;
    }
    try {
      await db.delete();
      localStorage.clear();
      window.location.reload();
    } catch (err) {
      toast.error("Failed to wipe database");
      console.error(err);
    }
  };

  const openCreate = () => {
    setEditingUser(undefined);
    setSheetOpen(true);
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setSheetOpen(true);
  };

  const handleSave = async (data: Partial<User>) => {
    const role = (data.role || 'VIEWER') as Role;
    const views = data.permissions?.views && data.permissions.views.length > 0 
      ? data.permissions.views 
      : (DEFAULT_PERMISSIONS[role] || []);

    if (editingUser) {
        await updateUser(editingUser.id, { 
            name: data.name, 
            email: data.email, 
            role: role, 
            permissions: { views },
            assignedExecutiveName: data.assignedExecutiveName,
            maintenanceMode: Boolean((data as Record<string, unknown>).maintenanceMode)
        });
        toast.success('User updated successfully');
    } else {
        await addUser({
            name: data.name!,
            email: data.email!,
            role: role,
            password: data.password || undefined,
            permissions: { views },
            assignedExecutiveName: data.assignedExecutiveName,
        });
        toast.success('User created successfully');
    }
  };

  const handleDelete = async (id: string) => {
    if (id === currentUser?.id) return toast.error("Cannot delete yourself");
    if (!confirm('Delete user?')) return;
    await deleteUser(id);
    toast.success('User deleted');
  };

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: (val: Role) => <StatusBadge variant={val.toLowerCase()}>{val}</StatusBadge> },
    { 
      key: 'assignedExecutiveName', 
      label: 'Data Mapping (FOS)', 
      render: (val: string, row: User) => val ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
          {val}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground italic">Auto-match ({row.name})</span>
      )
    },
    {
      key: 'permissions',
      label: 'Authorized Pages',
      render: (val: { views?: string[] } | undefined) => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
          {val?.views?.length || 0} pages
        </span>
      )
    },
    { key: 'actions', label: 'Actions', render: (_: unknown, row: User) => (
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => openEdit(row)}><Pencil className="w-4 h-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => handleDelete(row.id)} disabled={row.id === currentUser?.id}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2 className="text-lg font-semibold">User Management</h2>
        <div className="flex gap-2">
          <Button variant="destructive" onClick={handleWipeDatabase}>
            {confirmWipe ? 'CONFIRM WIPE' : 'Wipe Database'}
          </Button>
          <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Add User</Button>
        </div>
      </div>
      <DataTable tableId="users-table" columns={columns} data={users} pageSize={20} />
      
      <UserFormSheet 
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        user={editingUser}
        onSave={handleSave}
      />
    </div>
  );
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'spreadsheets' ? 'spreadsheets' : 'spreadsheets'; // default to spreadsheets for easy management
  const [activeTab, setActiveTab] = useState<'spreadsheets' | 'users' | 'targets' | 'diagnostics' | 'system'>(initialTab);
  const { user } = useAuth();

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'spreadsheets' || tabParam === 'users' || tabParam === 'targets' || tabParam === 'diagnostics' || tabParam === 'system') {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'spreadsheets' | 'users' | 'targets' | 'diagnostics' | 'system') => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };
  
  if (user?.role !== 'ADMIN') {
    return (
      <AppLayout title="Settings">
        <div className="p-8 text-center text-muted-foreground">Access denied. Administrator privileges required.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Settings">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage multi-spreadsheet cloud linkages, user credentials, diagnostics, and system targets.</p>
        </div>

        <div className="flex gap-2 border-b overflow-x-auto">
          <button
            onClick={() => handleTabChange('supabase')}
            className={`px-4 py-2 font-semibold text-sm border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'supabase' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <Cloud className="h-4 w-4 text-emerald-500" />
            <span>Supabase Cloud</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30">PostgreSQL</span>
          </button>
          <button
            onClick={() => handleTabChange('spreadsheets')}
            className={`px-4 py-2 font-medium text-sm border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'spreadsheets' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <Database className="h-4 w-4" />
            <span>Spreadsheets</span>
          </button>
          <button
            onClick={() => handleTabChange('users')}
            className={`px-4 py-2 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${activeTab === 'users' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Users
          </button>
          <button
            onClick={() => handleTabChange('targets')}
            className={`px-4 py-2 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${activeTab === 'targets' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Global Targets
          </button>
          <button
            onClick={() => handleTabChange('diagnostics')}
            className={`px-4 py-2 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${activeTab === 'diagnostics' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Diagnostics & Health
          </button>
          <button
            onClick={() => handleTabChange('system')}
            className={`px-4 py-2 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${activeTab === 'system' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            System & Backups
          </button>
        </div>

        <div className="pt-4">
          {activeTab === 'supabase' && <SupabaseConnectionTab />}
          {activeTab === 'spreadsheets' && <SpreadsheetManagementTab />}
          {activeTab === 'users' && <UserManagementTab />}
          {activeTab === 'targets' && <AdvancedTargetsTab />}
          {activeTab === 'diagnostics' && <SystemHealthDiagnostics />}
          {activeTab === 'system' && <SystemTab />}
        </div>
      </div>
    </AppLayout>
  );
}
