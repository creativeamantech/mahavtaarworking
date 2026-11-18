// @ts-nocheck
import { Fragment, useState, useMemo } from 'react';
import { useDataState } from '../contexts/DataContext';
import { useNavigate } from '@/lib/router-compat';
import { AppLayout } from '../components/layout/AppLayout';
import { useMediaQuery } from '../hooks/use-media-query';
import { calculateRow } from '../lib/calculations';
import { useWorkerPivot } from '../hooks/useWorkerPivot';
import { buildExecCityPivot, ExecCityPivotRow } from '../lib/pivots';
import { fmtCur, fmtPct, pctColor } from '../lib/formatters';
import { DollarSign, AlertCircle, Database, BarChart3, TrendingUp, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ComposedChart, Line } from 'recharts';
import { AgentLiveDashboard } from '../components/agent/AgentLiveDashboard';
import { BucketFilter } from '../components/BucketFilter';
import { SectionHeader } from '../components/ui/SectionHeader';
import { LoanRecord } from '../types/domain';

type ExecCityPivotItem = ExecCityPivotRow & { globalRank?: number };

interface BucketStats {
  collection: number;
  cases: number;
  pos: number;
  teamPaid: number;
  posPaidOnly: number;
  unpaid: number;
  paidPOS: number;
  posPaidOnlyPOS: number;
  unpaidPOS: number;
}

interface CityBucketStats {
  teamPaid: number;
  posPaidOnly: number;
  unpaid: number;
  paidPOS: number;
  posPaidOnlyPOS: number;
  unpaidPOS: number;
}

interface CityStats {
  cases: number;
  pos: number;
  teamPaid: number;
  posPaidOnly: number;
  unpaid: number;
  paidPOS: number;
  posPaidOnlyPOS: number;
  unpaidPOS: number;
  buckets: Record<string, CityBucketStats>;
  bands: Record<string, { cases: number; pos: number }>;
}

export default function ExecDashboard() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  
  const handleCellClick = (city: string, band: string) => {
    setSelectedCells(prev => {
      const next = new Set(prev);
      const id = `${city}:::${band}`;
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  const { records, isLoading, globalBucket, targets } = useDataState();

  const filteredRecords = useMemo(() => {
    if (!records) return [];
    if (globalBucket === 'ALL') return records;
    return records.filter((r: LoanRecord) => String(r.bom_bkt).trim().toUpperCase() === globalBucket);
  }, [records, globalBucket]);
  const teamPerfData = useMemo(() => buildExecCityPivot(filteredRecords, targets), [filteredRecords, targets]);
  const teamPerfGrouped = useMemo(() => {
    const groups: Record<number, ExecCityPivotItem[]> = {};
    teamPerfData.forEach(t => {
      const bktNum = Number(t.bkt) || 0;
      if (!groups[bktNum]) groups[bktNum] = [];
      groups[bktNum].push(t);
    });
    return Object.entries(groups).map(([bkt, items]) => {
      const sorted = items.sort((a, b) => b.collection - a.collection);
      const itemsWithRank = sorted.map((item, idx) => ({ ...item, globalRank: idx + 1 }));
      return [Number(bkt), itemsWithRank] as const;
    }).sort((a, b) => a[0] - b[0]);
  }, [teamPerfData]);
  const teamPerfGrandTotal = useMemo(() => {
    return {
      collection: teamPerfData.reduce((s, i) => s + i.collection, 0),
      count: teamPerfData.reduce((s, i) => s + i.count, 0),
      paid: teamPerfData.reduce((s, i) => s + i.paid, 0),
      totalPOS: teamPerfData.reduce((s, i) => s + i.totalPOS, 0),
      paidPOS: teamPerfData.reduce((s, i) => s + i.paidPOS, 0),
      posPaidOnlyCount: teamPerfData.reduce((s, i) => s + i.posPaidOnlyCount, 0),
      posPaidOnlyPOS: teamPerfData.reduce((s, i) => s + i.posPaidOnlyPOS, 0),
      target: teamPerfData.reduce((s, i) => s + i.target, 0),
      dailyRequiredPOS: teamPerfData.reduce((s, i) => s + (i.dailyRequiredPOS || 0), 0),
    };
  }, [teamPerfData]);

  const stats = useMemo(() => {
    let totalCollection = 0;
    let teamPaidPosSum = 0;
    let posPaidOnlyPosSum = 0;
    
    const byBucket: Record<string, BucketStats> = {};
    const byCity: Record<string, CityStats> = {};
    
    let smallCasesEMI = 0;
    let smallCasesPOS = 0;
    let totalSmallCases = 0;
    let smallCasesBoth = 0;
    
    filteredRecords.forEach((row: LoanRecord) => {
        const c = calculateRow(row);
        const bucket = String(row.bom_bkt || 'Unknown').trim();
        const city = String(row.city || row.City || 'Unknown').trim().toUpperCase();
        const dac = Number(row.dac ?? row.DAC) || 0;
        const pos = Number(row.principal_outstanding) || 0;
        const emi = Number(row.emi_amt) || 0;

        const isTeamPaid = c.teamPaid === 1;
        const isPosPaidOnly = (c.posCleared <= 0 && c.teamPaid !== 1);
        
        if (isTeamPaid || isPosPaidOnly) totalCollection += dac;
        if (isTeamPaid) teamPaidPosSum += pos;
        if (isPosPaidOnly) posPaidOnlyPosSum += pos;
        
        if (emi < 500) smallCasesEMI++;
        if (pos < 1000) smallCasesPOS++;
        if (emi < 500 || pos < 1000) {
            totalSmallCases++;
            if (emi < 500 && pos < 1000) smallCasesBoth++;
        }
        
        if (!byBucket[bucket]) byBucket[bucket] = { collection: 0, cases: 0, pos: 0, teamPaid: 0, posPaidOnly: 0, unpaid: 0, paidPOS: 0, posPaidOnlyPOS: 0, unpaidPOS: 0 };
        byBucket[bucket].cases++;
        byBucket[bucket].pos += pos;
        
        if (isTeamPaid) {
            byBucket[bucket].collection += dac;
            byBucket[bucket].teamPaid++;
            byBucket[bucket].paidPOS += pos;
        } else if (isPosPaidOnly) {
            byBucket[bucket].collection += dac;
            byBucket[bucket].posPaidOnly++;
            byBucket[bucket].posPaidOnlyPOS += pos;
        } else {
            byBucket[bucket].unpaid++;
            byBucket[bucket].unpaidPOS += pos;
        }
        
        if (!byCity[city]) {
            byCity[city] = { 
                cases: 0, pos: 0, teamPaid: 0, posPaidOnly: 0, unpaid: 0, 
                paidPOS: 0, posPaidOnlyPOS: 0, unpaidPOS: 0,
                buckets: {}, 
                bands: {} 
            };
        }
        byCity[city].cases++;
        byCity[city].pos += pos;
        
        if (isTeamPaid) {
            byCity[city].teamPaid++;
            byCity[city].paidPOS += pos;
        } else if (isPosPaidOnly) {
            byCity[city].posPaidOnly++;
            byCity[city].posPaidOnlyPOS += pos;
        } else {
            byCity[city].unpaid++;
            byCity[city].unpaidPOS += pos;
        }
        
        if (!byCity[city].buckets[bucket]) byCity[city].buckets[bucket] = { teamPaid: 0, posPaidOnly: 0, unpaid: 0, paidPOS: 0, posPaidOnlyPOS: 0, unpaidPOS: 0 };
        if (isTeamPaid) {
            byCity[city].buckets[bucket].teamPaid++;
            byCity[city].buckets[bucket].paidPOS += pos;
        } else if (isPosPaidOnly) {
            byCity[city].buckets[bucket].posPaidOnly++;
            byCity[city].buckets[bucket].posPaidOnlyPOS += pos;
        } else {
            byCity[city].buckets[bucket].unpaid++;
            byCity[city].buckets[bucket].unpaidPOS += pos;
        }
        
        let band = '< 1k';
        if (pos >= 1000 && pos < 10000) {
            const lower = Math.floor(pos / 1000);
            band = `${lower}k-${lower + 1}k`;
        } else if (pos >= 10000) {
            const lower = Math.floor(pos / 5000) * 5;
            band = `${lower}k-${lower + 5}k`;
        }
        if (!byCity[city].bands[band]) byCity[city].bands[band] = { cases: 0, pos: 0 };
        byCity[city].bands[band].cases++;
        byCity[city].bands[band].pos += pos;
    });
    
    const bucketData = Object.keys(byBucket).map(k => ({ bucket: k, ...byBucket[k] })).sort((a,b) => a.bucket.localeCompare(b.bucket));
    const cityData = Object.keys(byCity).map(k => ({ city: k, ...byCity[k] })).sort((a,b) => b.cases !== a.cases ? b.cases - a.cases : b.pos - a.pos);

    const allBands = new Set<string>();
    filteredRecords.forEach((row: LoanRecord) => {
        const pos = Number(row.principal_outstanding) || 0;
        if (pos < 1000) allBands.add('< 1k');
        else if (pos < 10000) {
            const lower = Math.floor(pos / 1000);
            allBands.add(`${lower}k-${lower + 1}k`);
        } else {
            const lower = Math.floor(pos / 5000) * 5;
            allBands.add(`${lower}k-${lower + 5}k`);
        }
    });
    
    const sortedBands = Array.from(allBands).sort((a, b) => {
        if (a === '< 1k') return 1;
        if (b === '< 1k') return -1;
        const valA = parseInt(a.split('k')[0]);
        const valB = parseInt(b.split('k')[0]);
        return valB - valA;
    });

    return { totalCollection, teamPaidPosSum, posPaidOnlyPosSum, bucketData, cityData, smallCasesEMI, smallCasesPOS, totalSmallCases, smallCasesBoth, sortedBands };
  }, [filteredRecords]);

  const selectionStats = useMemo(() => {
    let cases = 0;
    let pos = 0;
    selectedCells.forEach(id => {
      const [c, b] = id.split(':::');
      const cityRec = stats.cityData.find(x => x.city === c);
      if (cityRec && cityRec.bands[b]) {
        cases += cityRec.bands[b].cases;
        pos += cityRec.bands[b].pos;
      }
    });
    return { cases, pos };
  }, [selectedCells, stats.cityData]);

  const getBandRange = (band: string) => {
    if (band === '< 1k') return { min: 0, max: 999.99 };
    const parts = band.split('-');
    if (parts.length === 2) {
      const min = parseInt(parts[0].replace('k', '')) * 1000;
      const max = parseInt(parts[1].replace('k', '')) * 1000 - 0.01;
      return { min, max };
    }
    return null;
  };

  const navigateToExplorer = (filters: { city?: string, band?: string, bucket?: string, paid?: string }) => {
    const params = new URLSearchParams();
    if (globalBucket !== 'ALL') params.set('bucket', globalBucket);
    if (filters.bucket) params.set('bucket', filters.bucket);
    if (filters.city) params.set('city', filters.city);
    if (filters.paid) params.set('paid', filters.paid);
    if (filters.band) {
      const range = getBandRange(filters.band);
      if (range) {
        params.set('minPos', String(range.min));
        params.set('maxPos', String(range.max));
      }
    }
    navigate(`/explorer?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="mb-4"><BucketFilter /></div>
        <div className="flex h-[50vh] items-center justify-center text-sm text-muted-foreground font-medium">
          Loading dashboard metrics...
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mv-dashboard-page">
        <SectionHeader
          title="Executive Dashboard"
          subtitle="Live agent metrics, collection details, and geographical analytics"
          icon={BarChart3}
          badge={`${filteredRecords.length.toLocaleString()} cases`}
        />
        <div className="mb-5">
          <BucketFilter showCounts={true} />
        </div>

        <AgentLiveDashboard />

        {filteredRecords.length === 0 ? (
          <div className="my-8 p-8 border border-border rounded-xl bg-card text-center flex flex-col items-center justify-center space-y-3">
            <Database className="h-10 w-10 text-muted-foreground/40" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">No Portfolio Data Assigned</h3>
              <p className="text-xs text-muted-foreground max-w-md">
                There are no active loan records matched with your executive profile in the current view. Contact your manager or system administrator to allocate cases to your account.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="my-8 border-t border-border/70" />

            <SectionHeader
              title="Advanced Analytics"
              subtitle="Deep dive into collection, buckets, and geographical metrics"
              icon={TrendingUp}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="metric-kpi-card flex flex-col justify-between">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-500" /> Total Collection (DAC)
                </div>
                <div className="text-2xl font-bold font-tabular text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {fmtCur(stats.totalCollection)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border/60 font-tabular">
                  Paid POS: <strong className="text-foreground">{fmtCur(stats.teamPaidPosSum)}</strong>
                </div>
              </div>

              <div className="metric-kpi-card flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" /> Total Small Cases
                  </div>
                  <div className="text-2xl font-bold font-tabular text-amber-600 dark:text-amber-400 tracking-tight">
                    {stats.totalSmallCases.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    EMI &lt; ₹500 or POS &lt; ₹1k
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/60 flex justify-between font-tabular">
                  <span>EMI: <strong className="text-foreground">{(stats.smallCasesEMI - stats.smallCasesBoth).toLocaleString()}</strong></span>
                  <span>POS: <strong className="text-foreground">{(stats.smallCasesPOS - stats.smallCasesBoth).toLocaleString()}</strong></span>
                  <span>Both: <strong className="text-foreground">{stats.smallCasesBoth.toLocaleString()}</strong></span>
                </div>
              </div>

              <div className="metric-kpi-card flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    <Database className="h-3.5 w-3.5 text-rose-500" /> Total Outstanding (POS)
                  </div>
                  <div className="text-2xl font-bold font-tabular text-rose-600 dark:text-rose-400 tracking-tight">
                    {fmtCur(stats.bucketData.reduce((acc, b) => acc + b.pos, 0))}
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border/60">
                  Total principal across assigned cases
                </div>
              </div>

              <div className="metric-kpi-card flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    <TrendingUp className="h-3.5 w-3.5 text-primary" /> Total Cases Analyzed
                  </div>
                  <div className="text-2xl font-bold font-tabular text-primary tracking-tight">
                    {filteredRecords.length.toLocaleString()}
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border/60 font-tabular">
                  Buckets: <strong className="text-foreground">{stats.bucketData.length}</strong>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 mb-6">
              {/* Bucket Breakdown */}
              <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-border bg-muted/25">
                  <h3 className="font-semibold text-sm text-foreground">Bucket-wise Collections & POS</h3>
                </div>
                <div className="p-4 h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={stats.bucketData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/60" />
                      <XAxis dataKey="bucket" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis yAxisId="left" tickFormatter={(v) => `${v / 1000}k`} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v / 1000}k`} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        formatter={(value: number) => fmtCur(value)}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '10px', fontSize: '12px', color: 'hsl(var(--foreground))' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar yAxisId="left" dataKey="pos" name="Total POS" fill="#0D74B5" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="teamPaid" name="Team Paid Cases" fill="#55A94F" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="posPaidOnly" name="POS Paid Only Cases" fill="#81258C" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="collection" name="Collection (DAC)" stroke="#EF8424" strokeWidth={2.5} dot={{ r: 3.5 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto border-t border-border">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 text-muted-foreground text-[10px] uppercase tracking-wider border-b border-border">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold text-center w-12">S.No.</th>
                        <th className="px-4 py-2.5 font-semibold">Bucket</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Cases</th>
                        <th className="px-4 py-2.5 font-semibold text-right hidden sm:table-cell">POS Amount</th>
                        <th className="px-4 py-2.5 font-semibold text-right text-emerald-600 dark:text-emerald-400">Paid Count</th>
                        <th className="px-4 py-2.5 font-semibold text-right text-emerald-600 dark:text-emerald-400 hidden sm:table-cell">Paid POS</th>
                        <th className="px-4 py-2.5 font-semibold text-right text-sky-600 dark:text-sky-400">POS Paid Only</th>
                        <th className="px-4 py-2.5 font-semibold text-right text-sky-600 dark:text-sky-400 hidden sm:table-cell">POS Paid POS</th>
                        <th className="px-4 py-2.5 font-semibold text-right hidden sm:table-cell">Unpaid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {stats.bucketData.map((b, i) => (
                        <tr key={b.bucket} className="hover:bg-muted/35 transition-colors">
                          <td className="px-4 py-2.5 text-center font-tabular text-muted-foreground">{i + 1}</td>
                          <td className="px-4 py-2.5 font-semibold cursor-pointer hover:text-primary hover:underline" onClick={() => navigateToExplorer({ bucket: b.bucket })}>{b.bucket}</td>
                          <td className="px-4 py-2.5 text-right font-tabular cursor-pointer hover:text-primary" onClick={() => navigateToExplorer({ bucket: b.bucket })}>{b.cases.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right font-tabular cursor-pointer hover:text-primary hidden sm:table-cell" onClick={() => navigateToExplorer({ bucket: b.bucket })}>{fmtCur(b.pos)}</td>
                          <td className="px-4 py-2.5 text-right font-tabular text-emerald-600 dark:text-emerald-400 font-semibold cursor-pointer" onClick={() => navigateToExplorer({ bucket: b.bucket })}>{b.teamPaid.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right font-tabular text-emerald-600 dark:text-emerald-400 hidden sm:table-cell cursor-pointer" onClick={() => navigateToExplorer({ bucket: b.bucket })}>{fmtCur(b.paidPOS)}</td>
                          <td className="px-4 py-2.5 text-right font-tabular text-sky-600 dark:text-sky-400 font-medium cursor-pointer" onClick={() => navigateToExplorer({ bucket: b.bucket })}>{b.posPaidOnly.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right font-tabular text-sky-600 dark:text-sky-400 hidden sm:table-cell cursor-pointer" onClick={() => navigateToExplorer({ bucket: b.bucket })}>{fmtCur(b.posPaidOnlyPOS)}</td>
                          <td className="px-4 py-2.5 text-right font-tabular text-muted-foreground cursor-pointer hover:text-primary hidden sm:table-cell" onClick={() => navigateToExplorer({ bucket: b.bucket, paid: 'Unpaid' })}>{b.unpaid.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-[#1B1E35] text-white font-bold sticky bottom-0 z-10 cursor-pointer" onClick={() => navigateToExplorer({})}>
                      <tr>
                        <td className="px-4 py-2.5 text-center" />
                        <td className="px-4 py-2.5 text-sky-300 uppercase">Grand Total</td>
                        <td className="px-4 py-2.5 text-right font-tabular">{stats.bucketData.reduce((a, b) => a + b.cases, 0).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-tabular hidden sm:table-cell">{fmtCur(stats.bucketData.reduce((a, b) => a + b.pos, 0))}</td>
                        <td className="px-4 py-2.5 text-right font-tabular text-emerald-400">{stats.bucketData.reduce((a, b) => a + b.teamPaid, 0).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-tabular text-emerald-400 hidden sm:table-cell">{fmtCur(stats.bucketData.reduce((a, b) => a + b.paidPOS, 0))}</td>
                        <td className="px-4 py-2.5 text-right font-tabular text-sky-300">{stats.bucketData.reduce((a, b) => a + b.posPaidOnly, 0).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-tabular text-sky-300 hidden sm:table-cell">{fmtCur(stats.bucketData.reduce((a, b) => a + b.posPaidOnlyPOS, 0))}</td>
                        <td className="px-4 py-2.5 text-right font-tabular text-slate-300 hidden sm:table-cell" onClick={(e) => { e.stopPropagation(); navigateToExplorer({ paid: 'Unpaid' }); }}>{stats.bucketData.reduce((a, b) => a + b.unpaid, 0).toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="px-4 py-2.5 border-t border-border bg-muted/15 text-right">
                  <button
                    onClick={() => {
                      const csv = ['Bucket,Cases,POS Amount,Paid Count,Paid POS,POS Paid Only Count,POS Paid Only POS,Unpaid', ...stats.bucketData.map(b => `"${b.bucket}",${b.cases},${b.pos},${b.teamPaid},${b.paidPOS},${b.posPaidOnly},${b.posPaidOnlyPOS},${b.unpaid}`)].join('\n');
                      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'Bucket_Performance.csv'; a.click();
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold bg-card border border-border px-3 py-1.5 rounded-lg hover:bg-muted text-foreground transition-colors"
                  >
                    <Download className="h-3.5 w-3.5 text-muted-foreground" /> Export Data
                  </button>
                </div>
              </div>
            </div>

            <div className="mb-6">
              {/* City Top Level */}
              <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-border bg-muted/25">
                  <h3 className="font-semibold text-sm text-foreground">Top Cities & Bandwise Bifurcation</h3>
                </div>
                <div className="overflow-x-auto flex-1 h-[450px] scrollbar-thin">
                  <table className="w-full text-xs text-left whitespace-nowrap">
                    <thead className="bg-muted/85 text-muted-foreground text-[10px] uppercase tracking-wider sticky top-0 z-10 border-b border-border">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold text-center w-12">S.No.</th>
                        <th className="px-4 py-2.5 font-semibold">City</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Cases</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Total POS</th>
                        <th className="px-4 py-2.5 font-semibold text-center" colSpan={stats.sortedBands.length}>POS Bands (Cases)</th>
                      </tr>
                      <tr className="border-t border-border/50 text-[9px] bg-muted/95">
                        <th colSpan={4} />
                        {stats.sortedBands.map((band, idx) => (
                          <th key={band} className={`px-2 py-1 text-center font-semibold ${idx === 0 ? 'border-l border-border/40' : ''} ${idx === stats.sortedBands.length - 1 ? 'border-r border-border/40' : ''}`}>
                            {band}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {stats.cityData.slice(0, 50).map((c, i) => (
                        <tr key={c.city} className="hover:bg-muted/35 transition-colors">
                          <td className="px-4 py-2 text-center font-tabular text-muted-foreground">{i + 1}</td>
                          <td className="px-4 py-2 font-semibold cursor-pointer hover:text-primary hover:underline" onClick={() => navigateToExplorer({ city: c.city })}>{c.city}</td>
                          <td className="px-4 py-2 text-right font-tabular cursor-pointer hover:text-primary" onClick={() => navigateToExplorer({ city: c.city })}>{c.cases.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right font-tabular font-medium cursor-pointer hover:text-primary" onClick={() => navigateToExplorer({ city: c.city })}>{fmtCur(c.pos)}</td>
                          {stats.sortedBands.map((band, idx) => {
                            const cell = c.bands[band];
                            const val = cell ? cell.cases : 0;
                            const isSelected = selectedCells.has(`${c.city}:::${band}`);
                            return (
                              <td
                                key={band}
                                className={`px-2 py-2 text-center font-tabular cursor-pointer transition-colors ${idx === 0 ? 'border-l border-border/40' : ''} ${idx === stats.sortedBands.length - 1 ? 'border-r border-border/40' : ''} ${isSelected ? 'bg-primary text-primary-foreground font-bold' : 'hover:bg-primary/10 hover:text-primary'}`}
                                onClick={() => handleCellClick(c.city, band)}
                              >
                                {val > 0 ? val : '—'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-[#1B1E35] text-white font-bold sticky bottom-0 z-10 cursor-pointer" onClick={() => window.location.href = globalBucket === 'ALL' ? '/explorer' : `/explorer?bucket=${globalBucket}`}>
                      <tr>
                        <td className="px-4 py-2 text-center" />
                        <td className="px-4 py-2 text-sky-300 uppercase">Grand Total</td>
                        <td className="px-4 py-2 text-right font-tabular">{stats.cityData.reduce((a, c) => a + c.cases, 0).toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-tabular">{fmtCur(stats.cityData.reduce((a, c) => a + c.pos, 0))}</td>
                        {stats.sortedBands.map((band) => (
                          <td key={'ft' + band} className="px-2 py-2 text-center font-tabular hover:bg-white/10 hover:text-sky-300 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); navigateToExplorer({ band }); }}>
                            {stats.cityData.reduce((a, c) => a + (c.bands[band] ? c.bands[band].cases : 0), 0).toLocaleString()}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="px-4 py-2.5 border-t border-border bg-muted/15 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{stats.cityData.length > 50 ? `Showing top 50 of ${stats.cityData.length} cities` : `Showing all ${stats.cityData.length} cities`}</span>
                  <button
                    onClick={() => {
                      const csv = ['City,Cases,Total POS,' + stats.sortedBands.join(','), ...stats.cityData.map(c => `"${c.city}",${c.cases},${c.pos},${stats.sortedBands.map(b => c.bands[b] ? c.bands[b].cases : 0).join(',')}`)].join('\n');
                      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'City_Bandwise.csv'; a.click();
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold bg-card border border-border px-3 py-1.5 rounded-lg hover:bg-muted text-foreground transition-colors"
                  >
                    <Download className="h-3.5 w-3.5 text-muted-foreground" /> Export Full Data
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Performance-Based Paid Cases */}
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-8">
          <div className="px-4 py-3 border-b border-border bg-muted/25">
            <h3 className="font-semibold text-sm text-foreground">Performance-Based Paid Cases</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Detailed performance tracking against collection targets</p>
          </div>
          <div className="overflow-auto max-h-[600px] scrollbar-thin">
            <table className="w-full table-fixed border-collapse font-sans min-w-[1360px] text-xs">
              <colgroup>
                <col style={{ width: '60px' }} />
                <col style={{ width: '160px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '95px' }} />
                <col style={{ width: '95px' }} />
              </colgroup>
              <thead className="sticky top-0 z-30 bg-muted/90 backdrop-blur-xs border-b border-border text-muted-foreground uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-3 py-2.5 text-center w-12 font-semibold">Rank</th>
                  <th className="px-3 py-2.5 text-left font-semibold">City</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Collection</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Total Cases</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Paid Count</th>
                  <th className="px-3 py-2.5 text-right font-semibold">POS Paid Only</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Total POS</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Paid POS</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Needed / DRR</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Target Date</th>
                  <th className="px-3 py-2.5 text-right font-semibold">DRR</th>
                  <th className="px-3 py-2.5 text-right font-semibold">POS Paid Only Amt</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Actual %</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Recovery %</th>
                </tr>
              </thead>
              <tbody>
                {teamPerfGrouped.map(([bkt, items]) => {
                  const sub = {
                    collection: items.reduce((s: number, i: ExecCityPivotRow) => s + i.collection, 0),
                    count: items.reduce((s: number, i: ExecCityPivotRow) => s + i.count, 0),
                    paid: items.reduce((s: number, i: ExecCityPivotRow) => s + i.paid, 0),
                    totalPOS: items.reduce((s: number, i: ExecCityPivotRow) => s + i.totalPOS, 0),
                    paidPOS: items.reduce((s: number, i: ExecCityPivotRow) => s + i.paidPOS, 0),
                    posPaidOnlyCount: items.reduce((s: number, i: ExecCityPivotRow) => s + i.posPaidOnlyCount, 0),
                    posPaidOnlyPOS: items.reduce((s: number, i: ExecCityPivotRow) => s + i.posPaidOnlyPOS, 0),
                    target: items.reduce((s: number, i: ExecCityPivotRow) => s + i.target, 0),
                    dailyRequiredPOS: items.reduce((s: number, i: ExecCityPivotRow) => s + (i.dailyRequiredPOS || 0), 0),
                  };
                  const subActualPct = sub.totalPOS ? (sub.paidPOS + sub.posPaidOnlyPOS) / sub.totalPOS : 0;
                  const subRecoveryPct = sub.totalPOS ? sub.collection / sub.totalPOS : 0;
                  return (
                    <Fragment key={bkt}>
                      <tr className="bg-primary/10 border-b border-border">
                        <td colSpan={14} className="px-3 py-2 text-[11px] font-bold text-primary uppercase tracking-wider">BUCKET {bkt}</td>
                      </tr>
                      {items.map((item: ExecCityPivotItem) => (
                        <tr key={item.city} className="border-b border-border/70 transition-colors hover:bg-muted/35">
                          <td className="px-3 py-2 text-center font-semibold text-muted-foreground font-tabular">{item.globalRank}</td>
                          <td className="px-3 py-2 font-medium cursor-pointer hover:text-primary hover:underline" onClick={() => navigateToExplorer({ city: item.city })}>{item.city}</td>
                          <td className="px-3 py-2 text-right text-primary font-tabular font-semibold">{fmtCur(item.collection)}</td>
                          <td className="px-3 py-2 text-right font-tabular cursor-pointer hover:text-primary" onClick={() => navigateToExplorer({ city: item.city })}>{item.count}</td>
                          <td className="px-3 py-2 text-right font-tabular font-medium text-emerald-600 dark:text-emerald-400 cursor-pointer" onClick={() => navigateToExplorer({ city: item.city })}>{item.paid}</td>
                          <td className="px-3 py-2 text-right font-tabular font-medium text-sky-600 dark:text-sky-400 cursor-pointer" onClick={() => navigateToExplorer({ city: item.city })}>{item.posPaidOnlyCount}</td>
                          <td className="px-3 py-2 text-right font-tabular">{fmtCur(item.totalPOS)}</td>
                          <td className="px-3 py-2 text-right font-tabular text-emerald-600 dark:text-emerald-400 cursor-pointer" onClick={() => navigateToExplorer({ city: item.city })}>{fmtCur(item.paidPOS)}</td>
                          <td className="px-3 py-2 text-right font-tabular">{item.target <= 0 ? <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Achieved</span> : <span className="text-rose-600 dark:text-rose-400 font-bold">{fmtCur(item.target)}</span>}</td>
                          <td className="px-3 py-2 text-right text-xs text-muted-foreground font-tabular">{item.targetDate || "-"}</td>
                          <td className="px-3 py-2 text-right font-tabular font-bold text-amber-600 dark:text-amber-400">{fmtCur(item.dailyRequiredPOS || 0)}</td>
                          <td className="px-3 py-2 text-right font-tabular font-medium text-sky-600 dark:text-sky-400 cursor-pointer" onClick={() => navigateToExplorer({ city: item.city })}>{fmtCur(item.posPaidOnlyPOS)}</td>
                          <td className={`px-3 py-2 text-right font-tabular font-bold ${pctColor(item.actualPct ?? item.pct)}`}>{fmtPct(item.actualPct ?? item.pct)}</td>
                          <td className={`px-3 py-2 text-right font-tabular font-bold ${pctColor(item.recoveryPct ?? 0)}`}>{fmtPct(item.recoveryPct ?? 0)}</td>
                        </tr>
                      ))}
                      <tr className="border-b border-border bg-muted/25 font-semibold">
                        <td className="px-3 py-2 text-center" />
                        <td className="px-3 py-2 text-muted-foreground uppercase text-[11px] tracking-wider">Bucket {bkt} Total</td>
                        <td className="px-3 py-2 text-right font-tabular text-primary">{fmtCur(sub.collection)}</td>
                        <td className="px-3 py-2 text-right font-tabular">{sub.count}</td>
                        <td className="px-3 py-2 text-right font-tabular text-emerald-600 dark:text-emerald-400">{sub.paid}</td>
                        <td className="px-3 py-2 text-right font-tabular text-sky-600 dark:text-sky-400">{sub.posPaidOnlyCount}</td>
                        <td className="px-3 py-2 text-right font-tabular">{fmtCur(sub.totalPOS)}</td>
                        <td className="px-3 py-2 text-right font-tabular">{fmtCur(sub.paidPOS)}</td>
                        <td className="px-3 py-2 text-right font-tabular">{sub.target <= 0 ? <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Achieved</span> : <span className="text-rose-600 dark:text-rose-400 font-bold">{fmtCur(sub.target)}</span>}</td>
                        <td className="px-3 py-2 text-right text-xs text-muted-foreground">-</td>
                        <td className="px-3 py-2 text-right font-tabular font-bold text-amber-600 dark:text-amber-400">{fmtCur(sub.dailyRequiredPOS || 0)}</td>
                        <td className="px-3 py-2 text-right font-tabular text-sky-600 dark:text-sky-400">{fmtCur(sub.posPaidOnlyPOS)}</td>
                        <td className={`px-3 py-2 text-right font-tabular font-bold ${pctColor(subActualPct)}`}>{fmtPct(subActualPct)}</td>
                        <td className={`px-3 py-2 text-right font-tabular font-bold ${pctColor(subRecoveryPct)}`}>{fmtPct(subRecoveryPct)}</td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 z-20 bg-[#1B1E35] text-white cursor-pointer" onClick={() => navigateToExplorer({})}>
                <tr>
                  <td className="px-3 py-2.5 text-center" />
                  <td className="px-3 py-2.5 font-bold uppercase text-sky-300">Grand Total</td>
                  <td className="px-3 py-2.5 text-right text-sky-300 font-tabular font-bold">{fmtCur(teamPerfGrandTotal.collection)}</td>
                  <td className="px-3 py-2.5 text-right font-tabular">{teamPerfGrandTotal.count}</td>
                  <td className="px-3 py-2.5 text-right font-tabular text-emerald-400">{teamPerfGrandTotal.paid}</td>
                  <td className="px-3 py-2.5 text-right font-tabular text-sky-300">{teamPerfGrandTotal.posPaidOnlyCount}</td>
                  <td className="px-3 py-2.5 text-right font-tabular">{fmtCur(teamPerfGrandTotal.totalPOS)}</td>
                  <td className="px-3 py-2.5 text-right font-tabular text-emerald-400">{fmtCur(teamPerfGrandTotal.paidPOS)}</td>
                  <td className="px-3 py-2.5 text-right font-tabular text-rose-400 font-bold">{fmtCur(teamPerfGrandTotal.target)}</td>
                  <td className="px-3 py-2.5 text-right text-xs text-slate-300">-</td>
                  <td className="px-3 py-2.5 text-right font-tabular text-[11px] font-semibold text-amber-300">
                    {fmtCur(teamPerfGrandTotal.dailyRequiredPOS || 0)}/d
                  </td>
                  <td className="px-3 py-2.5 text-right font-tabular text-sky-300">{fmtCur(teamPerfGrandTotal.posPaidOnlyPOS)}</td>
                  <td className={"px-3 py-2.5 text-right font-tabular font-bold " + pctColor(teamPerfGrandTotal.totalPOS ? (teamPerfGrandTotal.paidPOS + teamPerfGrandTotal.posPaidOnlyPOS) / teamPerfGrandTotal.totalPOS : 0)}>
                    {fmtPct(teamPerfGrandTotal.totalPOS ? (teamPerfGrandTotal.paidPOS + teamPerfGrandTotal.posPaidOnlyPOS) / teamPerfGrandTotal.totalPOS : 0)}
                  </td>
                  <td className={"px-3 py-2.5 text-right font-tabular font-bold " + pctColor(teamPerfGrandTotal.totalPOS ? teamPerfGrandTotal.collection / teamPerfGrandTotal.totalPOS : 0)}>
                    {fmtPct(teamPerfGrandTotal.totalPOS ? teamPerfGrandTotal.collection / teamPerfGrandTotal.totalPOS : 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}