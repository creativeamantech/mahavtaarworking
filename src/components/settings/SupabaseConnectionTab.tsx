// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  Database, Cloud, Key, CheckCircle2, AlertTriangle, XCircle, 
  RefreshCw, Copy, Check, ExternalLink, ArrowRight, ShieldCheck, 
  UploadCloud, DownloadCloud, Terminal, HardDrive, Info, Eye, EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  clearSupabaseConfig, 
  testSupabaseConnection,
  isSupabaseConfigured,
  SupabaseConfig
} from '@/lib/supabase/client';
import { SUPABASE_SQL_SCHEMA } from '@/lib/supabase/sqlGenerator';
import { 
  migrateAllToSupabase, 
  pullLatestFromSupabaseToLocal, 
  MigrationProgress 
} from '@/lib/supabase/migrator';
import { db } from '@/lib/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export function SupabaseConnectionTab() {
  const [config, setConfig] = useState<SupabaseConfig | null>(getSupabaseConfig());
  const [urlInput, setUrlInput] = useState(config?.url || '');
  const [keyInput, setKeyInput] = useState(config?.key || '');
  const [showKey, setShowKey] = useState(false);

  // Testing & Status
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    tablesFound?: string[];
    missingTables?: string[];
  } | null>(null);

  // Local Counts
  const [localStats, setLocalStats] = useState({
    loans: 0,
    users: 0,
    feedbacks: 0,
    attendance: 0,
    targets: 0,
  });

  // Schema Modal
  const [schemaModalOpen, setSchemaModalOpen] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);

  // Migration State
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);

  // Pull Sync State
  const [isPulling, setIsPulling] = useState(false);

  const refreshLocalStats = async () => {
    try {
      const [loans, users, feedbacks, attendance, targets] = await Promise.all([
        db.loan_records.count(),
        db.users.count(),
        db.customer_feedbacks.count(),
        db.attendance_logs.count(),
        db.state_targets.count(),
      ]);
      setLocalStats({ loans, users, feedbacks, attendance, targets });
    } catch (e) {
      console.warn('Failed to load local stats', e);
    }
  };

  useEffect(() => {
    refreshLocalStats();

    const handleConfigChange = () => {
      const updated = getSupabaseConfig();
      setConfig(updated);
      setUrlInput(updated?.url || '');
      setKeyInput(updated?.key || '');
    };

    window.addEventListener('mahavtaar_supabase_config_changed', handleConfigChange);
    return () => window.removeEventListener('mahavtaar_supabase_config_changed', handleConfigChange);
  }, []);

  const handleTestConnection = async (overrideUrl?: string, overrideKey?: string) => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testSupabaseConnection(overrideUrl || urlInput, overrideKey || keyInput);
      setTestResult(result);
      if (result.success) {
        toast.success('Connected to Supabase successfully!');
      } else {
        toast.error(result.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({ success: false, message: msg });
      toast.error('Connection test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = () => {
    if (!urlInput.trim() || !keyInput.trim()) {
      toast.error('Please enter both Supabase Project URL and API Key.');
      return;
    }

    try {
      new URL(urlInput.trim());
    } catch {
      toast.error('Invalid Supabase Project URL format. Must start with https://');
      return;
    }

    saveSupabaseConfig(urlInput.trim(), keyInput.trim());
    toast.success('Supabase configuration saved.');
    handleTestConnection(urlInput.trim(), keyInput.trim());
  };

  const handleDisconnect = () => {
    if (confirm('Disconnect from Supabase? The app will continue using local IndexedDB.')) {
      clearSupabaseConfig();
      setUrlInput('');
      setKeyInput('');
      setTestResult(null);
      toast.info('Disconnected from Supabase.');
    }
  };

  const handleCopySchema = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSchema(true);
    toast.success('SQL schema script copied to clipboard!');
    setTimeout(() => setCopiedSchema(false), 2500);
  };

  const handleRunMigration = async () => {
    if (!isSupabaseConfigured()) {
      toast.error('Please connect and save your Supabase configuration first.');
      return;
    }

    if (!confirm(`Ready to migrate all local records (${localStats.loans.toLocaleString()} cases, ${localStats.users} users) to Supabase?`)) {
      return;
    }

    setIsMigrating(true);
    try {
      const result = await migrateAllToSupabase((progress) => {
        setMigrationProgress(progress);
      });

      toast.success(
        `Migration complete! Successfully migrated ${result.loansCount.toLocaleString()} cases and ${result.usersCount} users to Supabase.`
      );
      await refreshLocalStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Migration failed: ${msg}`);
      setMigrationProgress((prev) => prev ? { ...prev, stage: 'ERROR', error: msg } : null);
    } finally {
      setIsMigrating(false);
    }
  };

  const handlePullFromSupabase = async () => {
    if (!isSupabaseConfigured()) {
      toast.error('Please configure Supabase first.');
      return;
    }

    setIsPulling(true);
    try {
      const res = await pullLatestFromSupabaseToLocal((msg) => {
        toast.info(msg, { duration: 1500 });
      });
      toast.success(`Synchronized ${res.loanCount} records from Supabase into local cache.`);
      await refreshLocalStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Sync error: ${msg}`);
    } finally {
      setIsPulling(false);
    }
  };

  const isConnected = isSupabaseConfigured() && testResult?.success;

  return (
    <div className="space-y-6">
      {/* Top Banner & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border bg-card/60 backdrop-blur shadow-xs gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl ${isConnected ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-primary/10 text-primary'}`}>
            <Database className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-foreground">Supabase Cloud Database</h3>
              {isConnected ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Connected & Hybrid Active
                </span>
              ) : (
                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  Local Mode (Not Connected)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Connect external Supabase PostgreSQL to replace Google Sheets and centralize multi-device portfolio data.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSchemaModalOpen(true)}
            className="text-xs gap-1.5"
          >
            <Terminal className="h-3.5 w-3.5 text-primary" />
            <span>SQL Schema Script</span>
          </Button>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted text-foreground transition-colors"
          >
            <span>Supabase Dashboard</span>
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Connection Setup & Configuration */}
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" />
                <span>Supabase Project Credentials</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Obtain your Project URL and Anon API Key from your <strong>Supabase Dashboard &rarr; Project Settings &rarr; API</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Project URL
                </label>
                <Input
                  type="text"
                  placeholder="https://xyzcompany.supabase.co"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    API Key (Anon / Public or Service Role)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    <span>{showKey ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <Input
                  type={showKey ? 'text' : 'password'}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              {/* Test Connection Output */}
              {testResult && (
                <div className={`p-3 rounded-lg text-xs border ${
                  testResult.success 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300' 
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                }`}>
                  <div className="flex items-start gap-2">
                    {testResult.success ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">{testResult.message}</p>
                      {testResult.missingTables && testResult.missingTables.length > 0 && (
                        <p className="text-[11px] mt-1 opacity-90">
                          Missing: {testResult.missingTables.join(', ')}. Use the SQL Schema Script above to create them.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Button
                  onClick={handleSaveConfig}
                  className="text-xs"
                >
                  Save Credentials
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleTestConnection()}
                  disabled={isTesting || !urlInput.trim() || !keyInput.trim()}
                  className="text-xs gap-1.5"
                >
                  {isTesting ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  )}
                  <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                </Button>

                {isSupabaseConfigured() && (
                  <Button
                    variant="ghost"
                    onClick={handleDisconnect}
                    className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 ml-auto"
                  >
                    Disconnect
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Setup Guide Instructions */}
          <Card className="bg-muted/20 border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                3-Step Setup Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <div className="flex gap-2.5 items-start">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-[11px]">
                  1
                </span>
                <div>
                  <strong className="text-foreground">Create Tables in Supabase:</strong> Click <em>"SQL Schema Script"</em> above, copy the SQL, paste it into your <strong>Supabase SQL Editor</strong>, and click <strong>Run</strong>.
                </div>
              </div>

              <div className="flex gap-2.5 items-start">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-[11px]">
                  2
                </span>
                <div>
                  <strong className="text-foreground">Connect Credentials:</strong> Enter your Supabase Project URL and API Key in the form above and click <strong>Save & Test</strong>.
                </div>
              </div>

              <div className="flex gap-2.5 items-start">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-[11px]">
                  3
                </span>
                <div>
                  <strong className="text-foreground">Migrate Local Records:</strong> Click <em>"Migrate All Data to Supabase"</em> to automatically upload all existing loan records, feedback, attendance, and users.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Migration & Synchronization */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Migration Card */}
          <Card className="border-primary/20 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <UploadCloud className="h-4 w-4 text-primary" />
                <span>Data Migration Engine</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Upload your local IndexedDB records into your Supabase database in structured chunks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Local Counts Summary */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                  <span className="text-muted-foreground text-[11px] block">Loan Accounts</span>
                  <span className="text-sm font-bold text-foreground">{localStats.loans.toLocaleString()}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                  <span className="text-muted-foreground text-[11px] block">Users & Team</span>
                  <span className="text-sm font-bold text-foreground">{localStats.users.toLocaleString()}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                  <span className="text-muted-foreground text-[11px] block">Feedbacks & PTPs</span>
                  <span className="text-sm font-bold text-foreground">{localStats.feedbacks.toLocaleString()}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                  <span className="text-muted-foreground text-[11px] block">Attendance Logs</span>
                  <span className="text-sm font-bold text-foreground">{localStats.attendance.toLocaleString()}</span>
                </div>
              </div>

              {/* Live Migration Progress Bar */}
              {migrationProgress && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-foreground">
                    <span className="truncate max-w-[200px]">{migrationProgress.statusText}</span>
                    <span>{migrationProgress.percentage}%</span>
                  </div>
                  <div className="w-full bg-border/60 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        migrationProgress.stage === 'ERROR' ? 'bg-rose-500' : 'bg-primary'
                      }`}
                      style={{ width: `${migrationProgress.percentage}%` }}
                    />
                  </div>
                  {migrationProgress.error && (
                    <p className="text-rose-500 text-[11px] font-medium">{migrationProgress.error}</p>
                  )}
                </div>
              )}

              {/* Migration Action Button */}
              <Button
                onClick={handleRunMigration}
                disabled={isMigrating || !isSupabaseConfigured()}
                className="w-full text-xs font-semibold gap-2"
              >
                {isMigrating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <UploadCloud className="h-4 w-4" />
                )}
                <span>{isMigrating ? 'Migrating Records...' : 'Migrate All Data to Supabase'}</span>
              </Button>

              <div className="pt-2 border-t border-border">
                <Button
                  variant="outline"
                  onClick={handlePullFromSupabase}
                  disabled={isPulling || !isSupabaseConfigured()}
                  className="w-full text-xs gap-2"
                >
                  <DownloadCloud className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{isPulling ? 'Syncing...' : 'Pull Latest Cloud Records to Local Cache'}</span>
                </Button>
              </div>

            </CardContent>
          </Card>

          {/* Benefits Info Box */}
          <div className="p-4 rounded-xl border border-border/70 bg-card text-xs space-y-2">
            <h4 className="font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Hybrid Mode Advantages</span>
            </h4>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              With Supabase integrated, all your loan updates and customer dispositions sync directly to a high-speed PostgreSQL cloud database, accessible simultaneously across devices, while maintaining local cache speed.
            </p>
          </div>

        </div>

      </div>

      {/* SQL Schema Script Dialog */}
      <Dialog open={schemaModalOpen} onOpenChange={setSchemaModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Terminal className="h-5 w-5 text-primary" />
              <span>Supabase SQL Schema Script</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Execute this SQL script in your Supabase Project &rarr; SQL Editor to set up all tables, indexes, and Row Level Security policies.
            </DialogDescription>
          </DialogHeader>

          <div className="relative flex-1 min-h-[300px] overflow-hidden rounded-lg border border-border bg-muted/60 font-mono text-[11px]">
            <pre className="p-4 overflow-y-auto max-h-[50vh] text-foreground leading-relaxed">
              {SUPABASE_SQL_SCHEMA}
            </pre>

            <Button
              size="sm"
              onClick={handleCopySchema}
              className="absolute top-3 right-3 shadow-md gap-1.5 text-xs"
            >
              {copiedSchema ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedSchema ? 'Copied!' : 'Copy Script'}</span>
            </Button>
          </div>

          <div className="flex justify-between items-center pt-2">
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <span>Go to Supabase SQL Editor</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <Button variant="outline" size="sm" onClick={() => setSchemaModalOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
