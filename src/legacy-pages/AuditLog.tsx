import { useState, useMemo } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { SectionHeader } from '../components/ui/SectionHeader';
import { useDataState } from '../contexts/DataContext';
import { fmtDate } from '../lib/formatters';
import { Search, UserCircle, Edit3, ArrowRight, ShieldCheck, AlertCircle, RefreshCw, History } from 'lucide-react';
import { verifyAuditChainIntegrity } from '../lib/repositories/auditRepository';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

export default function AuditLog() {
  const { auditLog } = useDataState();
  const [search, setSearch] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    totalEntries: number;
    message: string;
  } | null>(null);

  const filtered = useMemo(() => {
    if (!search) return auditLog;
    const s = search.toLowerCase();
    return auditLog.filter(a => a.agreementid.toLowerCase().includes(s) || a.changedBy.toLowerCase().includes(s));
  }, [auditLog, search]);

  const handleVerifyChain = async () => {
    setIsVerifying(true);
    try {
      const res = await verifyAuditChainIntegrity();
      setVerificationResult(res);
      if (res.valid) {
        toast.success(`Audit chain verified: ${res.totalEntries} records intact.`);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <AppLayout>
      <SectionHeader
        title="Audit Log"
        subtitle="Track all manual data changes, overrides, and cryptographic SHA-256 hash-chains"
        icon={History}
        badge={`${filtered.length.toLocaleString()} entries`}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {verificationResult && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${
                  verificationResult.valid
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-destructive/30 bg-destructive/10 text-destructive'
                }`}
              >
                {verificationResult.valid ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                {verificationResult.valid ? 'Cryptographically Sealed' : 'Tampering Detected'}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerifyChain}
              disabled={isVerifying}
              className="gap-2 h-9 text-xs font-semibold"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
              Verify Chain
            </Button>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search agreement ID or user..."
                className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 font-sans text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        }
      />

      {filtered.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center text-center bg-card border border-border rounded-xl p-8 shadow-xs">
          <Edit3 className="h-8 w-8 text-muted-foreground/40 mb-3" />
          <h3 className="font-heading text-base font-bold text-foreground">No Records</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            No audit entries found. Manual edits and data overrides will appear here in chronological order.
          </p>
        </div>
      ) : (
        <div className="relative ml-3 pl-5 border-l-2 border-border space-y-4">
          {filtered.map(entry => (
            <div key={entry.id} className="relative group">
              <div className="absolute -left-[25px] top-4 h-2.5 w-2.5 rounded-xs border-2 border-card bg-primary transition-transform group-hover:scale-110" />

              <div className="bg-card border border-border rounded-xl p-4 shadow-xs transition-colors hover:border-primary/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                  <div className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4 text-primary" />
                    <span className="font-heading text-sm font-bold text-foreground">{entry.changedBy}</span>
                    <span className="text-xs text-muted-foreground">· via {entry.source}</span>
                  </div>
                  <span className="font-mono font-tabular text-xs text-muted-foreground">{fmtDate(entry.createdAt)}</span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 bg-muted/40 rounded-lg p-3 border border-border/70">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Agreement ID</span>
                    <span className="font-mono font-tabular text-sm font-semibold text-foreground">{entry.agreementid}</span>
                  </div>

                  <div className="hidden sm:block w-px h-8 bg-border" />

                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Field</span>
                    <span className="font-mono text-xs font-bold text-primary uppercase">{entry.field}</span>
                  </div>

                  <div className="hidden sm:block w-px h-8 bg-border" />

                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex-1 min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Old Value</span>
                      <span className="font-mono font-tabular text-sm text-muted-foreground line-through">{entry.oldValue || 'Empty'}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">New Value</span>
                      <span className="font-mono font-tabular text-sm font-bold text-emerald-600 dark:text-emerald-400">{entry.newValue}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
