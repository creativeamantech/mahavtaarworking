// @ts-nocheck
import React, { useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, RefreshCw, Search } from 'lucide-react';
import { useDataState } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkerPivot } from '@/hooks/useWorkerPivot';
import { fmtCur } from '@/lib/formatters';
import type { MainPerformanceBucket, MainPerformanceMetric } from '@/lib/pivots';

const pct = (value: number) => `${Number(value || 0).toFixed(2)}%`;
const money = (value: number | null) => value == null ? '—' : fmtCur(value);
const empty: MainPerformanceBucket[] = [];

export default function CityMainPerformance({ onBack }: { onBack: () => void }) {
  const { records, targets, isLoading } = useDataState();
  const { user, isExecutive } = useAuth();
  const [bucket, setBucket] = useState('Bucket 1');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const visibleRecords = useMemo(
    () => isExecutive() && user ? records.filter(r => r.executive_name === user.name) : records,
    [records, user, isExecutive],
  );
  const { data, isCalculating } = useWorkerPivot<MainPerformanceBucket[]>('buildMainPerformance', visibleRecords, targets, empty);
  const selected = data.find(b => b.bucket === bucket);
  const cities = useMemo(
    () => (selected?.cities ?? []).filter(c => c.city.toLowerCase().includes(query.trim().toLowerCase())),
    [selected, query],
  );
  const hasTargets = (selected?.cities ?? []).some(c => c.targetPos != null);
  const allExpanded = cities.length > 0 && cities.every(c => expanded.has(c.city));
  const toggle = (city: string) => setExpanded(current => {
    const next = new Set(current);
    if (next.has(city)) next.delete(city); else next.add(city);
    return next;
  });
  const setAll = (open: boolean) => setExpanded(open ? new Set(cities.map(c => c.city)) : new Set());
  const metricCells = (m: MainPerformanceMetric) => [
    money(m.collection), pct(m.mainPercent), pct(m.rollbackPercent),
    m.totalCount.toLocaleString('en-IN'), m.paidCount.toLocaleString('en-IN'),
    m.unpaidCount.toLocaleString('en-IN'), money(m.totalPos), money(m.mainPaidPos),
    ...(hasTargets ? [money(m.targetPos), money(m.neededPos)] : []),
  ];
  const headers = [
    'City / Executive', 'Collection (DAC)', 'Main %', 'Rollback %',
    'Total Count', 'Paid Count', 'Unpaid Count', 'Total POS', 'Main Paid POS',
    ...(hasTargets ? ['Target POS', 'Needed POS'] : []),
  ];
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-border/70">
        <div className="flex items-start gap-3">
          <button
            onClick={onBack}
            className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors"
            aria-label="Back to Bucket Pivot"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Collection Intelligence · City Ledger
            </p>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Main Performance
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              City-wise main and rollback performance with expandable executive totals
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-tabular">
          {(isLoading || isCalculating) && (
            <span className="inline-flex items-center gap-1.5 text-primary font-medium">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Calculating…
            </span>
          )}
          <span>· {visibleRecords.length.toLocaleString('en-IN')} records</span>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary label="Total POS" value={money(selected?.total.totalPos ?? 0)} />
        <Summary label="Main Paid POS" value={money(selected?.total.mainPaidPos ?? 0)} accent="text-emerald-600 dark:text-emerald-400" />
        <Summary label="Main Performance" value={pct(selected?.total.mainPercent ?? 0)} accent="text-primary" />
        <Summary label="Rollback Performance" value={pct(selected?.total.rollbackPercent ?? 0)} />
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Bucket Performance</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Select a bucket to view city totals and expand each city for executive-wise performance.
            </p>
          </div>
          <div className="inline-flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1 border border-border">
            {['Bucket 1', 'Bucket 2', 'Bucket 3', 'Bucket 4', 'Bucket 5'].map(b => (
              <button
                key={b}
                onClick={() => { setBucket(b); setExpanded(new Set()); }}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  bucket === b
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                {b.replace('Bucket ', 'B')}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5 bg-card">
          <div className="relative min-w-[200px] max-w-sm flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search city…"
              className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => setAll(true)} className="rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors">Expand all</button>
            <button onClick={() => setAll(false)} className="rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-colors">Collapse all</button>
          </div>
        </div>
        <div className="overflow-auto max-h-[62vh] scrollbar-thin">
          <table className="w-full min-w-[1120px] border-collapse text-xs">
            <thead className="sticky top-0 z-20 bg-muted/90 text-muted-foreground backdrop-blur-xs">
              <tr>
                {headers.map((h, i) => (
                  <th
                    key={h}
                    className={`whitespace-nowrap border-b border-border px-3 py-2.5 font-semibold uppercase text-[10px] tracking-wider ${
                      i === 0 ? 'sticky left-0 z-30 bg-muted/95 text-left' : 'text-right'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cities.length === 0 ? (
                <tr>
                  <td colSpan={headers.length} className="px-4 py-12 text-center text-muted-foreground">
                    {isLoading || isCalculating ? 'Preparing performance table…' : 'No city records found for this bucket.'}
                  </td>
                </tr>
              ) : cities.map(city => (
                <React.Fragment key={city.city}>
                  <tr className="border-b border-border/70 bg-muted/40 font-semibold text-foreground hover:bg-muted/55 transition-colors">
                    <td className="sticky left-0 bg-muted/75 backdrop-blur-xs px-3 py-2.5">
                      <button onClick={() => toggle(city.city)} className="flex min-h-7 w-full items-center gap-2 text-left">
                        {expanded.has(city.city)
                          ? <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
                          : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <span className="font-semibold">{city.city}</span>
                        <span className="text-[11px] font-normal text-muted-foreground font-tabular">· {city.executives.length}</span>
                      </button>
                    </td>
                    {metricCells(city).map((v, i) => (
                      <td key={i} className="whitespace-nowrap px-3 py-2.5 text-right font-tabular">{v}</td>
                    ))}
                  </tr>
                  {expanded.has(city.city) && city.executives.map(ex => (
                    <tr key={city.city + '-' + ex.executive} className="border-b border-border/40 bg-card hover:bg-muted/30 transition-colors">
                      <td className="sticky left-0 bg-card px-3 py-2 pl-10 text-left font-medium text-muted-foreground">{ex.executive}</td>
                      {metricCells(ex).map((v, i) => (
                        <td key={i} className="whitespace-nowrap px-3 py-2 text-right font-tabular">{v}</td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
            {selected && (
              <tfoot className="sticky bottom-0 z-20 bg-[#1B1E35] font-bold text-white">
                <tr>
                  <td className="sticky left-0 bg-[#1B1E35] px-3 py-3 text-left text-sky-300 uppercase tracking-wider">GRAND TOTAL</td>
                  {metricCells(selected.total).map((v, i) => (
                    <td key={i} className="whitespace-nowrap px-3 py-3 text-right font-tabular">{v}</td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/15 px-4 py-2 text-[11px] text-muted-foreground font-tabular">
          <span>Main % = Main Paid POS ÷ Total POS · Rollback % = Rollback POS ÷ Total POS</span>
          <span>{cities.length} cities · {selected?.total.totalCount ?? 0} cases</span>
        </div>
      </section>
    </div>
  );
}
function Summary({ label, value, accent = 'text-foreground' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="metric-kpi-card">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-base font-bold font-tabular sm:text-lg ${accent}`}>{value}</p>
    </div>
  );
}
