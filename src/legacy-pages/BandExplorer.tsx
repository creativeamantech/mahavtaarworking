// @ts-nocheck
import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from '@/lib/router-compat';
import { AppLayout } from '../components/layout/AppLayout';
import { useDataState } from '../contexts/DataContext';
import { useNavigate } from '@/lib/router-compat';
import { fmtCur } from '../lib/formatters';
import { Search, Download, Plus, X, ArrowUp, ArrowDown, Filter, MapPin, Database, DollarSign, Activity, FileText, Settings2 } from 'lucide-react';
import { Checkbox } from '../components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Link } from '@/lib/router-compat';
import { Slider } from '../components/ui/slider';
import { BucketFilter } from '../components/BucketFilter';
import { SectionHeader } from '../components/ui/SectionHeader';

export default function BandExplorer() {
  const navigate = useNavigate();
  const { records, globalBucket, isLoading } = useDataState();

  const filteredRecords = useMemo(() => {
    if (!records) return [];
    if (globalBucket === 'ALL') return records;
    return records.filter((r: LoanRecord) => String(r.bom_bkt).trim().toUpperCase() === globalBucket);
  }, [records, globalBucket]);

  const dataWithBands = useMemo(() => {
    return filteredRecords.map((r: LoanRecord) => {
        return {
            ...r,
            _posVal: Number(r.principal_outstanding) || 0,
            _emiVal: Number(r.emi_amt) || 0,
            _aggr: r.agreementid || r.agreement_no || r.AGREEMENTNO || r.AGREEMENTID || '-',
            _name: r.customer_name || r.CUSTOMERNAME || r['Customer Name'] || r.CUSTOMER_NAME || '-',
            _city: (r.city || r.City || 'Unknown').trim().toUpperCase()
        };
    });
  }, [filteredRecords]);

  const [searchParams, setSearchParams] = useSearchParams();
  const absoluteMaxPos = useMemo(() => {
    let m = 50000;
    if (dataWithBands && dataWithBands.length > 0) {
      dataWithBands.forEach(r => {
        if (r._posVal > m) m = r._posVal;
      });
    }
    return Math.ceil(m / 5000) * 5000;
  }, [dataWithBands]);
  
  const minPos = Number(searchParams.get('minPos')) || 0;
  const maxPos = searchParams.has('maxPos') ? Number(searchParams.get('maxPos')) : absoluteMaxPos;
  const [tempMin, setTempMin] = useState<string>(String(minPos));
  const [tempMax, setTempMax] = useState<string>(String(searchParams.has('maxPos') ? maxPos : absoluteMaxPos));
  
  useEffect(() => {
    setTempMin(String(minPos));
    setTempMax(String(maxPos));
  }, [minPos, maxPos]);

  const [sortSearch, setSortSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc'|'desc'}[]>([{ key: 'city', direction: 'asc' }]);

  const handleApply = () => {
    const mn = Number(tempMin) || 0;
    const mx = Number(tempMax) || 0;
    const finalMin = Math.min(mn, mx);
    const finalMax = Math.max(mn, mx);
    if (mn > mx) {
        setTempMin(String(finalMin));
        setTempMax(String(finalMax));
    }
    const params = new URLSearchParams(searchParams);
    params.set('minPos', String(finalMin));
    params.set('maxPos', String(finalMax));
    setSearchParams(params, { replace: true });
  };


  useEffect(() => {
    const timer = setTimeout(() => {
      const mn = Number(tempMin) || 0;
      const mx = Number(tempMax) || 0;
      const finalMin = Math.min(mn, mx);
      const finalMax = Math.max(mn, mx);
      if (finalMin !== minPos || finalMax !== maxPos) {
        handleApply();
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [tempMin, tempMax, minPos, maxPos]);

  
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleApply();
  };

  const bandData = useMemo(() => {
     const filtered = dataWithBands.filter(r => r._posVal >= minPos && r._posVal <= maxPos);
     
     const cityCounts: Record<string, number> = {};
     filtered.forEach(r => {
        cityCounts[r._city] = (cityCounts[r._city] || 0) + 1;
     });

          return filtered.sort((a, b) => {
         for (const sort of sortConfig) {
             let comparison = 0;
             switch (sort.key) {
                case 'city_count':
                    comparison = (cityCounts[a._city] || 0) - (cityCounts[b._city] || 0);
                    if (comparison === 0) comparison = a._posVal - b._posVal;
                    break;
                case 'aggr':
                    comparison = (a._aggr || '').localeCompare(b._aggr || '');
                    break;
                case 'name':
                    comparison = (a._name || '').localeCompare(b._name || '');
                    break;
                case 'city':
                    comparison = (a._city || '').localeCompare(b._city || '');
                    break;
                case 'pos':
                case '_posVal':
                    comparison = a._posVal - b._posVal;
                    break;
                case 'emi':
                case '_emiVal':
                    comparison = a._emiVal - b._emiVal;
                    break;
             }
             if (comparison !== 0) {
                 return sort.direction === 'asc' ? comparison : -comparison;
             }
         }
         return 0;
     });
  }, [dataWithBands, minPos, maxPos, sortConfig]);

  const stats = useMemo(() => {
     const uniqueCities = new Set(bandData.map(r => r._city));
     const totalPos = bandData.reduce((sum, r) => sum + r._posVal, 0);
     return {
        count: bandData.length,
        citiesCount: uniqueCities.size,
        totalPos
     };
  }, [bandData]);

  const handleExport = () => {
     if (bandData.length === 0) return;
     const headers = ['Agreement Number', 'Customer Name', 'City', 'POS', 'EMI', 'Bucket'];
     const csv = [
        headers.join(','),
        ...bandData.map(r => [
            `"${r._aggr}"`,
            `"${r._name}"`,
            `"${r._city}"`,
            r._posVal,
            r._emiVal,
            `"${r.bom_bkt || ''}"`
        ].join(','))
     ].join('\n');
     const blob = new Blob([csv], { type: 'text/csv' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `Band_Export_${minPos}_to_${maxPos}.csv`;
     a.click();
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="mb-4"><BucketFilter /></div>
        <div className="flex h-[50vh] items-center justify-center text-sm text-muted-foreground font-medium">
          Loading bandwidth data...
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <SectionHeader
        title="Top Cities & Bandwidth Explorer"
        subtitle="Detailed bifurcation of cases by custom POS bandwidth range"
        icon={Activity}
        badge={`${stats.count.toLocaleString()} cases`}
        actions={
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Export Cases
          </button>
        }
      />

      {/* Filter Section */}
      <div className="mv-filter-bar mb-5 justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <Settings2 className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground whitespace-nowrap">Select Range:</span>
          <div className="flex items-center gap-3 w-full sm:w-[380px]">
            <span className="text-xs font-bold font-tabular text-muted-foreground min-w-[54px] text-right">{fmtCur(Number(tempMin))}</span>
            <Slider
              min={0}
              max={absoluteMaxPos}
              step={500}
              value={[Number(tempMin) || 0, Number(tempMax) || absoluteMaxPos]}
              onValueChange={(vals) => {
                setTempMin(String(vals[0]));
                setTempMax(String(vals[1]));
              }}
              className="flex-1 min-w-[140px]"
            />
            <span className="text-xs font-bold font-tabular text-muted-foreground min-w-[60px]">{fmtCur(Number(tempMax))}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex h-8 items-center gap-1.5 px-3 rounded-lg border border-border hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground uppercase tracking-wider bg-background transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add Sort
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="start">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Sort By Column</h4>
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search columns..."
                  className="w-full pl-6 pr-2 py-1 text-xs border border-border rounded bg-muted/20 outline-none focus:border-primary transition-colors"
                  value={sortSearch}
                  onChange={e => setSortSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1 max-h-64 overflow-y-auto no-scrollbar pr-2">
                {[
                  { key: 'aggr', label: 'Agreement Number' },
                  { key: 'name', label: 'Customer Name' },
                  { key: 'city', label: 'City' },
                  { key: '_posVal', label: 'Principal (POS)' },
                  { key: '_emiVal', label: 'EMI' }
                ].filter(opt => opt.label.toLowerCase().includes(sortSearch.toLowerCase())).map(opt => (
                  <div
                    key={opt.key}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded transition-colors cursor-pointer"
                    onClick={() => {
                      setSortConfig(prev => {
                        const exists = prev.find(s => s.key === opt.key);
                        if (exists) return prev.filter(s => s.key !== opt.key);
                        return [...prev, { key: opt.key, direction: 'asc' }];
                      });
                    }}
                  >
                    <Checkbox className="pointer-events-none" checked={!!sortConfig.find(s => s.key === opt.key)} />
                    <span className="text-xs truncate flex-1">{opt.label}</span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {sortConfig.map(sort => {
            const labels: Record<string, string> = { city: 'City', collection: 'Collection', count: 'Total Count', paidCount: 'Paid Count', totalPOS: 'Total POS', paidPOS: 'Paid POS', pct: 'Paid %', team: 'Team', exec: 'Executive', target: 'Target', ach: 'Achieved', _posVal: 'Principal (POS)', _emiVal: 'EMI', aggr: 'Agreement Number', name: 'Customer Name' };
            return (
              <div key={sort.key} className="flex h-8 items-center gap-1.5 bg-primary/10 border border-primary/20 px-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-primary">
                <span>{labels[sort.key] || sort.key}</span>
                <button onClick={() => setSortConfig(prev => prev.map(s => s.key === sort.key ? { ...s, direction: s.direction === 'asc' ? 'desc' : 'asc' } : s))} className="ml-0.5 hover:opacity-75">
                  {sort.direction === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => setSortConfig(prev => prev.filter(s => s.key !== sort.key))} className="ml-0.5 hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="metric-kpi-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1 text-[11px] font-semibold uppercase tracking-wider">
            <Database className="h-3.5 w-3.5 text-primary" /> Total Count (In Range)
          </div>
          <div className="text-2xl font-bold font-tabular">{stats.count.toLocaleString()}</div>
        </div>
        <div className="metric-kpi-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1 text-[11px] font-semibold uppercase tracking-wider">
            <DollarSign className="h-3.5 w-3.5 text-amber-500" /> Principal Outstanding
          </div>
          <div className="text-2xl font-bold font-tabular text-amber-600 dark:text-amber-400">{fmtCur(stats.totalPos)}</div>
        </div>
        <div className="metric-kpi-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1 text-[11px] font-semibold uppercase tracking-wider">
            <MapPin className="h-3.5 w-3.5 text-sky-500" /> Cities Involved
          </div>
          <div className="text-2xl font-bold font-tabular text-primary">{stats.citiesCount.toLocaleString()}</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/25 flex justify-between items-center gap-2">
          <h3 className="font-semibold flex items-center gap-2 text-sm text-foreground">
            <FileText className="h-4 w-4 text-primary" /> Actual Cases for Range <span className="font-tabular">{fmtCur(minPos)} – {fmtCur(maxPos)}</span>
          </h3>
          <span className="text-xs font-medium text-muted-foreground font-tabular">
            · {stats.count.toLocaleString()} records
          </span>
        </div>
        <div className="overflow-x-auto max-h-[600px] relative scrollbar-thin">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="text-[10px] uppercase tracking-wider sticky top-0 z-20 bg-muted/85 backdrop-blur-xs border-b border-border text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Agreement Number</th>
                <th className="px-4 py-2.5 font-semibold">Customer Name</th>
                <th className="px-4 py-2.5 font-semibold">City</th>
                <th className="px-4 py-2.5 font-semibold text-right">Principal (POS)</th>
                <th className="px-4 py-2.5 font-semibold text-right">EMI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {bandData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No cases found for this range.
                  </td>
                </tr>
              ) : (
                bandData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/35 transition-colors group cursor-pointer" onClick={() => { navigate(`/explorer?q=${encodeURIComponent(row._aggr)}`); }}>
                    <td className="px-4 py-2.5 font-medium font-tabular">
                      <Link to={`/explorer?q=${encodeURIComponent(row._aggr)}`} className="text-primary hover:underline transition-colors" onClick={(e) => e.stopPropagation()}>
                        {row._aggr}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 truncate max-w-[200px]">{row._name}</td>
                    <td className="px-4 py-2.5">{row._city}</td>
                    <td className="px-4 py-2.5 text-right font-semibold font-tabular text-foreground">{fmtCur(row._posVal)}</td>
                    <td className="px-4 py-2.5 text-right font-tabular text-muted-foreground">{fmtCur(row._emiVal)}</td>
                  </tr>
                ))
              )}
            </tbody>

            <tfoot className="bg-[#1B1E35] text-white font-bold sticky bottom-0 z-10 cursor-pointer" onClick={() => { navigate(`/explorer?minPos=${minPos}&maxPos=${maxPos}${globalBucket !== 'ALL' ? `&bucket=${globalBucket}` : ''}`); }}>
              <tr>
                <td colSpan={1} className="px-4 py-2.5 text-right sm:hidden text-sky-300">Total</td>
                <td colSpan={2} className="px-4 py-2.5 text-right md:hidden text-sky-300">Total</td>
                <td colSpan={3} className="px-4 py-2.5 text-right text-sky-300 uppercase">Grand Total (Click to view all)</td>
                <td className="px-4 py-2.5 text-right font-tabular text-amber-300">{fmtCur(stats.totalPos)}</td>
                <td className="px-4 py-2.5 text-right font-tabular text-slate-300">{fmtCur(bandData.reduce((sum, r) => sum + r._emiVal, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
