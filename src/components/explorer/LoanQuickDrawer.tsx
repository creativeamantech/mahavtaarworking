// @ts-nocheck
import { 
  Phone, 
  MapPin, 
  ExternalLink, 
  Calendar, 
  Copy, 
  Check, 
  ShieldCheck, 
  IndianRupee 
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from '@/lib/router-compat';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../ui/sheet';
import { fmtCur } from '@/lib/formatters';
import { calculateRow } from '@/lib/calculations';
import { BucketBadge } from './BucketBadge';
import { StatusBadge } from './StatusBadge';
import { LoanRecord } from '@/types/domain';
import { toast } from 'sonner';

interface LoanQuickDrawerProps {
  record: LoanRecord | null;
  isOpen: boolean;
  onClose: () => void;
  addressKey: string | null;
  contactKey: string | null;
}

export function LoanQuickDrawer({
  record,
  isOpen,
  onClose,
  addressKey,
  contactKey,
}: LoanQuickDrawerProps) {
  const navigate = useNavigate();
  const [copiedId, setCopiedId] = useState(false);

  if (!record) return null;

  const aggrId = record.agreementid || record.agreement_no || record.AGREEMENTNO || record.AGREEMENTID || '-';
  const customerName = record.customer_name || record.CUSTOMERNAME || record['Customer Name'] || record.CUSTOMER_NAME || record.customername || 'Unknown Customer';
  const pos = Number(record.principal_outstanding) || 0;
  const emi = Number(record.emi_amt) || 0;
  const dac = Number(record.dac ?? record.DAC) || 0;
  const ecs = Number(record.ecs ?? record.ECS) || 0;
  const c = calculateRow(record);
  const isPaid = c.mainPaid === 1;
  const isPartial = !isPaid && (c.totalCleared > 0 || dac > 0);

  const phone = contactKey && record[contactKey] ? String(record[contactKey]).trim() : null;
  const address = addressKey && record[addressKey] ? String(record[addressKey]).trim() : null;
  const city = record.city || record.City || '-';
  const state = record.state || record.State || '-';
  const executive = record.executive_name || record['Executive Name'] || 'Unassigned';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    toast.success(`Copied "${text}" to clipboard`);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleOpenFullProfile = () => {
    onClose();
    navigate(`/customer/${aggrId}`);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col bg-card border-l border-border">
        {/* Header */}
        <SheetHeader className="p-5 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                {aggrId}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(aggrId)}
                className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                title="Copy Agreement ID"
              >
                {copiedId ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <BucketBadge bkt={record.bom_bkt} />
              <StatusBadge isPaid={isPaid} isPartial={isPartial} />
            </div>
          </div>
          <SheetTitle className="text-base font-bold text-foreground truncate text-left">
            {customerName}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground text-left">
            {city}, {state} &bull; Executive: <span className="font-semibold text-foreground">{executive}</span>
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Financial Summary Grid */}
          <div className="bg-muted/30 border border-border rounded-xl p-3.5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <IndianRupee className="h-3.5 w-3.5 text-primary" /> Key Financial Figures
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card border border-border/60 p-2.5 rounded-lg">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">POS Outstanding</span>
                <div className="text-sm font-bold font-mono text-foreground mt-0.5">{fmtCur(pos)}</div>
              </div>
              <div className="bg-card border border-border/60 p-2.5 rounded-lg">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">EMI Amount</span>
                <div className="text-sm font-bold font-mono text-foreground mt-0.5">{fmtCur(emi)}</div>
              </div>
              <div className="bg-card border border-border/60 p-2.5 rounded-lg">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">DAC Collected</span>
                <div className="text-sm font-bold font-mono text-sky-600 dark:text-sky-400 mt-0.5">{fmtCur(dac)}</div>
              </div>
              <div className="bg-card border border-border/60 p-2.5 rounded-lg">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">ECS Cleared</span>
                <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">{fmtCur(ecs)}</div>
              </div>
            </div>

            {pos > 0 && dac > 0 && (
              <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Recovery Rate</span>
                <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                  {((dac / pos) * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {/* Contact & Location Details */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-primary" /> Contact & Location
            </h4>
            
            {phone ? (
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Primary Phone</span>
                    <span className="text-xs font-mono font-bold text-foreground">{phone}</span>
                  </div>
                </div>
                <a
                  href={`tel:${phone}`}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Phone className="h-3 w-3" /> Call
                </a>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground italic p-2 border border-dashed rounded-lg">
                No phone number available
              </div>
            )}

            {address && (
              <div className="p-3 rounded-xl border border-border bg-card flex items-start gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Mailing Address</span>
                  <p className="text-xs text-foreground mt-0.5 leading-relaxed">{address}</p>
                  <span className="text-[11px] text-muted-foreground mt-1 inline-block">
                    {city}, {state}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Allocation & Security */}
          <div className="space-y-2 p-3 bg-muted/20 border border-border rounded-xl text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Assigned Executive</span>
              <span className="font-semibold text-foreground">{executive}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Bucket Category</span>
              <span className="font-bold text-foreground">Bucket {record.bom_bkt || '-'}</span>
            </div>
            {record.allocation_date && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Allocation Date</span>
                <span className="font-mono text-muted-foreground">{String(record.allocation_date)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-card flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors"
          >
            Close Preview
          </button>
          <button
            type="button"
            onClick={handleOpenFullProfile}
            className="flex-1 px-3 py-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <span>Full Profile</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
