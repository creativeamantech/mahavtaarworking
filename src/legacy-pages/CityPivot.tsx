// @ts-nocheck
import React, { useState, useMemo } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { useDataState } from '../contexts/DataContext';
import { useNavigate } from '@/lib/router-compat';
import { useAuth } from '../contexts/AuthContext';
import { useWorkerPivot } from '../hooks/useWorkerPivot';
import { fmtCur, fmtPct, pctColor } from '../lib/formatters';
import { exportBucketCityPivot } from '../lib/exporter';
import { BucketCityPivotRow } from '../lib/pivots';
import {
  Download,
  Search,
  ArrowUp,
  ArrowDown,
  X,
  Plus,
  Building2,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react';
import { Checkbox } from '../components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { HeatBar } from '../components/ui/HeatBar';
import { PivotColumn, PivotDensity } from '../components/ui/EnterprisePivotTable';
import { LoanRecord } from '../types/domain';

type BucketCityPivotItem = BucketCityPivotRow & { globalRank: number };

export default function CityPivot() {
  const navigate = useNavigate();
  const { records, targets, isLoading, globalBucket } = useDataState();
  const { user, isExecutive } = useAuth();

  const [filterText, setFilterText] = useState('');
  const [sortSearch, setSortSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [density, setDensity] = useState<PivotDensity>('comfortable');

  const navigateToExplorer = (filters: { city?: string; bucket?: string; paid?: string }) => {
    const params = new URLSearchParams();
    if (globalBucket !== 'ALL') params.set('bucket', globalBucket);
    if (filters.bucket) params.set('bucket', filters.bucket);
    if (filters.city) params.set('city', filters.city);
    if (filters.paid) params.set('paid', filters.paid);
    navigate(`/explorer?${params.toString()}`);
  };

  const filtered = useMemo(() => {
    if (isExecutive() && user) return records.filter(r => r.executive_name === user.name);
    return records;
  }, [records, user, isExecutive]);

  // Build raw pivot using Web Worker Offloading
  const { data: rawCityData, isCalculating: isPivoting } = useWorkerPivot<BucketCityPivotRow[]>('buildBucketCityPivot', filtered, targets, []);

  // Compute global rank
  const cityTotalsForRank = useMemo(() => {
    const map: Record<string, { totalPOS: number; paidPOS: number; count: number }> = {};
    rawCityData.forEach((d) => {
      if (!map[d.city]) map[d.city] = { totalPOS: 0, paidPOS: 0, count: 0 };
      map[d.city].totalPOS += (Number(d.totalPOS) || 0);
      map[d.city].paidPOS += (Number(d.paidPOS) || 0);
      map[d.city].count += (Number(d.count) || 0);
    });
    return Object.entries(map)
      .map(([city, s]) => ({ city, count: s.count }))
      .sort((a, b) => b.count - a.count)
      .reduce((acc, cur, idx) => { acc[cur.city] = idx + 1; return acc; }, {} as Record<string, number>);
  }, [rawCityData]);

  // Filtered & sorted data
  const cityData: BucketCityPivotItem[] = useMemo(() => {
    let data: BucketCityPivotItem[] = rawCityData.map((d) => ({
      ...d,
      globalRank: cityTotalsForRank[d.city] ?? 999,
    }));

    if (filterText) {
      data = data.filter((d) => d.city.toLowerCase().includes(filterText.toLowerCase()));
    }

    if (sortConfig.length > 0) {
      data.sort((a, b) => {
        for (const sort of sortConfig) {
          const recA = a as unknown as Record<string, unknown>;
          const recB = b as unknown as Record<string, unknown>;
          let valA = recA[sort.key];
          let valB = recB[sort.key];

          if (sort.key === 'pct') {
            valA = a.totalPOS ? a.paidPOS / a.totalPOS : 0;
            valB = b.totalPOS ? b.paidPOS / b.totalPOS : 0;
          }

          const numA = Number(valA);
          const numB = Number(valB);
          let comp = 0;
          if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '' && typeof valA !== 'boolean' && typeof valB !== 'boolean') {
            comp = sort.direction === 'asc' ? numA - numB : numB - numA;
          } else {
            const strA = String(valA || '').toLowerCase();
            const strB = String(valB || '').toLowerCase();
            comp = sort.direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
          }
          if (comp !== 0) return comp;
        }
        return 0;
      });
    } else {
      // Default sort by globalRank so cities appear serial wise
      data.sort((a, b) => {
        const rankA = typeof a.globalRank === 'number' ? a.globalRank : 999;
        const rankB = typeof b.globalRank === 'number' ? b.globalRank : 999;
        return rankA - rankB;
      });
    }

    return data;
  }, [rawCityData, filterText, sortConfig, cityTotalsForRank]);

  // Group by bucket
  const grouped = useMemo(() => {
    const map: Record<string, BucketCityPivotItem[]> = {};
    cityData.forEach((item) => {
      const b = String(item.bkt || '-');
      if (!map[b]) map[b] = [];
      map[b].push(item);
    });
    return Object.entries(map).sort(([a], [b]) => {
      const na = Number(a); const nb = Number(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }, [cityData]);

  // Grand totals
  const grandTotal = useMemo(() => {
    return rawCityData.reduce(
      (acc, cur) => ({
        collection: acc.collection + (cur.collection || 0),
        count: acc.count + (cur.count || 0),
        paid: acc.paid + (cur.paid || 0),
        totalPOS: acc.totalPOS + (cur.totalPOS || 0),
        paidPOS: acc.paidPOS + (cur.paidPOS || 0),
        target: acc.target + (cur.target || 0),
        dailyRequiredPOS: acc.dailyRequiredPOS + (cur.dailyRequiredPOS || 0),
      }),
      { collection: 0, count: 0, paid: 0, totalPOS: 0, paidPOS: 0, target: 0, dailyRequiredPOS: 0 }
    );
  }, [rawCityData]);

  const grandPct = grandTotal.totalPOS ? grandTotal.paidPOS / grandTotal.totalPOS : 0;

  const toggleSort = (key: string) => {
    setSortConfig(prev => {
      const exists = prev.find(s => s.key === key);
      if (!exists) return [...prev, { key, direction: 'asc' }];
      if (exists.direction === 'asc') return prev.map(s => s.key === key ? { ...s, direction: 'desc' } : s);
      return prev.filter(s => s.key !== key);
    });
  };

  const toggleBucket = (bkt: string) => {
    setCollapsed(prev => ({ ...prev, [bkt]: !prev[bkt] }));
  };

  // Shared single source of truth for column definitions and fixed proportion metrics
  const columns: PivotColumn[] = useMemo(() => [
    { key: 'globalRank', label: '#', align: 'center', width: 45, minWidth: 45 },
    { key: 'city', label: 'City', align: 'left', width: 150, minWidth: 150 },
    { key: 'collection', label: 'Collection (DAC)', align: 'right', width: 110, minWidth: 110 },
    { key: 'count', label: 'Total Count', align: 'right', width: 90, minWidth: 90 },
    { key: 'paid', label: 'Paid Count', align: 'right', width: 90, minWidth: 90 },
    { key: 'totalPOS', label: 'Total POS', align: 'right', width: 110, minWidth: 110 },
    { key: 'paidPOS', label: 'Paid POS', align: 'right', width: 110, minWidth: 110 },
    { key: 'target', label: 'Target Needed', align: 'right', width: 110, minWidth: 110 },
    { key: 'pct', label: 'Recovery %', align: 'right', width: 100, minWidth: 100 },
  ], []);

  const cellPadding = {
    compact: 'px-2.5 py-1.5 text-[11px]',
    comfortable: 'px-3 py-2 text-xs',
    detailed: 'px-3.5 py-2.5 text-xs',
  }[density];

  return (
    <AppLayout>
      <div className="space-y-3 flex flex-col h-[calc(100vh-160px)] md:h-[calc(100vh-128px)] min-h-0">
        {/* Page Title & Controls Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-border">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" /> City Pivot Matrix
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Geographical collection breakdown with unified freeze-panes and inline recovery pacing
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Density Selector */}
            <div className="hidden sm:flex items-center bg-muted/50 p-0.5 rounded-lg border border-border">
              {(['compact', 'comfortable', 'detailed'] as PivotDensity[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDensity(d)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md capitalize transition-colors ${
                    density === d
                      ? 'bg-card text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            <button
              onClick={() => exportBucketCityPivot(cityData, targets)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-xs"
            >
              <Download className="h-3.5 w-3.5" /> Export Excel
            </button>
          </div>
        </div>

        {/* Search & Sort Pill Strip */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by city name..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary shadow-xs"
            />
            {filterText && (
              <button
                onClick={() => setFilterText('')}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <button className="flex h-8 items-center gap-1.5 px-3 bg-card border border-border rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground shadow-xs">
                <Plus className="h-3.5 w-3.5" /> Add Column Sort
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="space-y-1">
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Select column to sort:</div>
                <input
                  type="text"
                  placeholder="Filter sort options..."
                  value={sortSearch}
                  onChange={(e) => setSortSearch(e.target.value)}
                  className="w-full px-2 py-1 text-xs border rounded bg-background mb-1"
                />
                {[
                  { key: 'globalRank', label: 'Rank' },
                  { key: 'city', label: 'City Name' },
                  { key: 'collection', label: 'Collection' },
                  { key: 'count', label: 'Total Cases' },
                  { key: 'paid', label: 'Paid Cases' },
                  { key: 'posPaidOnlyCount', label: 'POS Paid Count' },
                  { key: 'totalPOS', label: 'Total POS' },
                  { key: 'paidPOS', label: 'Paid POS' },
                  { key: 'target', label: 'Target Needed' },
                  { key: 'posPaidOnlyPOS', label: 'POS Paid POS' },
                  { key: 'pct', label: 'Recovery %' },
                ]
                  .filter(opt => opt.label.toLowerCase().includes(sortSearch.toLowerCase()))
                  .map(opt => (
                    <div
                      key={opt.key}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded cursor-pointer text-xs"
                      onClick={() => toggleSort(opt.key)}
                    >
                      <Checkbox className="pointer-events-none" checked={!!sortConfig.find(s => s.key === opt.key)} />
                      <span>{opt.label}</span>
                    </div>
                  ))}
              </div>
            </PopoverContent>
          </Popover>

          {sortConfig.map(sort => {
            const labels: Record<string, string> = {
              globalRank: 'Rank', city: 'City', collection: 'Collection', count: 'Count', paid: 'Paid',
              totalPOS: 'Total POS', paidPOS: 'Paid POS', pct: 'Total %', target: 'Needed',
              posPaidOnlyCount: 'POS Paid Count', posPaidOnlyPOS: 'POS Paid POS',
              dailyRequiredPOS: 'DRR'
            };
            return (
              <div key={sort.key} className="flex h-8 items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary px-2.5 rounded-lg text-xs font-bold uppercase tracking-wider">
                <span>{labels[sort.key] || sort.key}</span>
                <button onClick={() => toggleSort(sort.key)} className="hover:opacity-75">
                  {sort.direction === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => setSortConfig(prev => prev.filter(s => s.key !== sort.key))}
                  className="ml-0.5 hover:text-rose-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Single Enterprise Data Grid */}
        <div className="flex-1 min-h-0 bg-card border border-border/80 shadow-xs rounded-xl flex flex-col overflow-hidden relative">
          <div className="overflow-auto flex-1 scrollbar-thin ">
            <table className="w-full table-fixed min-w-[900px] text-xs">
              <colgroup>
                {columns.map(col => <col key={col.key} style={{ width: col.width, minWidth: col.minWidth }} />)}
              </colgroup>
              <thead className="bg-[#f8f9fc] dark:bg-[#0d0f14] shadow-[0_1px_2px_rgba(0,0,0,0.05)] sticky top-0 z-30 h-[40px]">
                <tr>
                  {columns.map(col => (
                    <th key={col.key} className={`px-3 py-2 font-bold text-muted-foreground uppercase tracking-wider border-b border-border/80 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {grouped.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-muted-foreground">
                      {filterText ? `No ` + "city" + ` matching "${filterText}".` : 'No portfolio records in current view.'}
                    </td>
                  </tr>
                ) : (
                  grouped.map(([bkt, items]) => {
                    const sub = items.reduce((acc, curr) => ({
                      collection: acc.collection + (curr.collection || 0),
                      count: acc.count + (curr.count || 0),
                      paid: acc.paid + (curr.paid || 0),
                      totalPOS: acc.totalPOS + (curr.totalPOS || 0),
                      paidPOS: acc.paidPOS + (curr.paidPOS || 0),
                      target: acc.target + (curr.target || 0),
                      dailyRequiredPOS: acc.dailyRequiredPOS + (curr.dailyRequiredPOS || 0),
                    }), { collection: 0, count: 0, paid: 0, totalPOS: 0, paidPOS: 0, target: 0, dailyRequiredPOS: 0 });
                    
                    const subPct = sub.totalPOS > 0 ? sub.paidPOS / sub.totalPOS : 0;
                    
                    return (
                      <React.Fragment key={bkt}>
                        {/* Sticky Bucket Subheader */}
                        <tr className="sticky top-[40px] z-20 bg-muted/95 backdrop-blur-md shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b border-border/60">
                          <td colSpan={2} className={`${cellPadding} font-bold text-foreground`}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-primary" />
                              Bucket {bkt}
                              <span className="text-muted-foreground font-mono font-medium ml-1">({items.length} Citys)</span>
                            </div>
                          </td>
                          <td className={`${cellPadding} text-right font-mono font-bold text-muted-foreground`}>{fmtCur(sub.collection)}</td>
                          <td className={`${cellPadding} text-right font-mono font-bold text-muted-foreground`}>{sub.count.toLocaleString()}</td>
                          <td className={`${cellPadding} text-right font-mono font-bold text-muted-foreground`}>{sub.paid.toLocaleString()}</td>
                          <td className={`${cellPadding} text-right font-mono font-bold text-muted-foreground`}>{fmtCur(sub.totalPOS)}</td>
                          <td className={`${cellPadding} text-right font-mono font-bold text-emerald-600 dark:text-emerald-400`}>{fmtCur(sub.paidPOS)}</td>
                          <td className={`${cellPadding} text-right font-mono font-bold text-rose-600 dark:text-rose-400`}>{fmtCur(sub.target)}</td>
                          <td className={`${cellPadding} text-right font-mono font-bold`}>
                            <HeatBar pct={subPct} showBar={false} showBadge={true} />
                          </td>
                        </tr>
                        
                        {/* Bucket Rows */}
                        {items.map((item, i) => {
                          const rowPct = item.totalPOS > 0 ? item.paidPOS / item.totalPOS : 0;
                          const isAchieved = item.paidPOS >= item.targetPOS;
                          return (
                            <tr key={i} className="hover:bg-muted/30 transition-colors group">
                              <td className={`${cellPadding} text-center font-mono text-muted-foreground`}>{item.globalRank}</td>
                              <td className={`${cellPadding}`}>
                                <span onClick={() => navigateToExplorer({ city: item.city, bucket: bkt })} className="cursor-pointer hover:text-primary hover:underline text-left font-semibold text-foreground">
                                  {item.city}
                                </span>
                              </td>
                              <td className={`${cellPadding} text-right font-mono font-semibold`}>{fmtCur(item.collection)}</td>
                              <td className={`${cellPadding} text-right font-mono tabular-nums text-muted-foreground`}>{item.count.toLocaleString()}</td>
                              <td className={`${cellPadding} text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold`}>{item.paid.toLocaleString()}</td>
                              <td className={`${cellPadding} text-right font-mono tabular-nums text-foreground`}>{fmtCur(item.totalPOS)}</td>
                              <td className={`${cellPadding} text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-bold`}>{fmtCur(item.paidPOS)}</td>
                              <td className={`${cellPadding} text-right font-mono tabular-nums`}>
                                {isAchieved ? (
                                  <span className="text-[10px] font-bold text-emerald-500">Achieved</span>
                                ) : (
                                  <div className="flex flex-col items-end leading-tight">
                                    <span className="font-bold text-rose-600 dark:text-rose-400">{fmtCur(item.target)}</span>
                                    {item.dailyRequiredPOS > 0 && <span className="text-[9px] text-amber-600 dark:text-amber-400">DRR: ₹{fmtCur(item.dailyRequiredPOS)}</span>}
                                  </div>
                                )}
                              </td>
                              <td className={`${cellPadding} text-right font-mono tabular-nums`}>
                                <HeatBar pct={rowPct} showBar={false} showBadge={true} />
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
              
              {/* Grand Total Footer */}
              {grouped.length > 0 && (
                <tfoot className="sticky bottom-0 z-30 bg-slate-900 dark:bg-[#070910] shadow-[0_-2px_10px_rgba(0,0,0,0.2)] border-t border-primary/40">
                  <tr>
                    <td className={`${cellPadding}`}></td>
                    <td className={`${cellPadding} font-extrabold uppercase text-xs tracking-wider text-primary cursor-pointer hover:underline`} onClick={() => navigateToExplorer({})}>Grand Total</td>
                    <td className={`${cellPadding} text-right font-mono font-bold text-emerald-400`}>{fmtCur(grandTotal.collection)}</td>
                    <td className={`${cellPadding} text-right font-mono font-bold text-slate-200`}>{grandTotal.count.toLocaleString()}</td>
                    <td className={`${cellPadding} text-right font-mono font-bold text-emerald-400`}>{grandTotal.paid.toLocaleString()}</td>
                    <td className={`${cellPadding} text-right font-mono font-bold text-slate-200`}>{fmtCur(grandTotal.totalPOS)}</td>
                    <td className={`${cellPadding} text-right font-mono font-bold text-emerald-400`}>{fmtCur(grandTotal.paidPOS)}</td>
                    <td className={`${cellPadding} text-right font-mono font-bold text-rose-400`}>
                      <div className="flex flex-col items-end leading-tight">
                        <span>{fmtCur(grandTotal.target)}</span>
                        <span className="text-[9px] text-amber-300 font-mono">DRR: ₹{fmtCur(grandTotal.dailyRequiredPOS)}</span>
                      </div>
                    </td>
                    <td className={`${cellPadding} text-right font-mono font-bold`}>
                      <HeatBar pct={grandPct} showBar={false} showBadge={true} />
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
