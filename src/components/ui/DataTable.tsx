import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, ChevronRight, X, Bookmark, Save, Trash2 } from 'lucide-react';
import { useMediaQuery } from '../../hooks/use-media-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { LoanRecord } from '../../types/domain';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './dropdown-menu';

export interface Column<T = any> {
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  render?: (value: any, row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface DataTableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  footer?: React.ReactNode;
  tableId?: string;
  virtualize?: boolean;
  maxHeight?: string;
}

interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

interface SortPreset {
  id: string;
  name: string;
  sorts: SortState[];
}

const HIDE_CLASS: Record<string, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

export function DataTable<T extends Record<string, any> = Record<string, any>>({ columns, data, pageSize = 50, onRowClick, rowClassName, footer, tableId, virtualize = false, maxHeight = '600px' }: DataTableProps<T>) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  
  const [sorts, setSorts] = useState<SortState[]>([]);
  const [presets, setPresets] = useState<SortPreset[]>(() => {
    if (!tableId) return [];
    try {
      const saved = localStorage.getItem(`dataTablePresets_${tableId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [page, setPage] = useState(0);

  useEffect(() => {
    if (tableId) {
      localStorage.setItem(`dataTablePresets_${tableId}`, JSON.stringify(presets));
    }
  }, [presets, tableId]);

  useEffect(() => {
    setPage(0);
  }, [sorts]);

  const sorted = useMemo(() => {
    if (sorts.length === 0) return data;
    return [...data].sort((a, b) => {
      for (const { key, dir } of sorts) {
        const av = a[key], bv = b[key];
        if (av == null && bv == null) continue;
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
        if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
  }, [data, sorts]);

  const parentRef = useRef<HTMLDivElement>(null);
  
  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

  const paged = virtualize ? sorted : sorted.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(data.length / pageSize);

  const virtualItems = rowVirtualizer.getVirtualItems();

  const toggleSort = (key: string, multi: boolean) => {
    setSorts(prev => {
      const existingIdx = prev.findIndex(s => s.key === key);
      let newSorts = [...prev];
      if (existingIdx >= 0) {
        if (prev[existingIdx].dir === 'asc') {
          newSorts[existingIdx] = { key, dir: 'desc' };
        } else {
          newSorts.splice(existingIdx, 1);
        }
      } else {
        if (!multi) newSorts = [];
        newSorts.push({ key, dir: 'asc' });
      }
      return newSorts;
    });
  };

  const handleSavePreset = () => {
    if (sorts.length === 0) return;
    const name = prompt('Enter a name for this sort preset:');
    if (name) {
      setPresets(prev => [...prev, { id: Date.now().toString(), name, sorts }]);
    }
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPresets(prev => prev.filter(p => p.id !== id));
  };

  const getSortIndex = (key: string) => sorts.findIndex(s => s.key === key);
  const getSortDir = (key: string) => sorts.find(s => s.key === key)?.dir;

  const renderRow = (row: Record<string, unknown>, i: number, isVirtual: boolean = false) => {
    const actualIndex = isVirtual ? i : (page * pageSize + i);
    return (
      <React.Fragment key={actualIndex}>
        <tr
          onClick={() => {
            if (isMobile && columns.some(c => c.hideBelow)) {
              setExpandedRow(expandedRow === actualIndex ? null : actualIndex);
            } else {
              onRowClick?.(row);
            }
          }}
          className={`border-b border-border transition-colors hover:bg-muted/50 group ${actualIndex % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'} ${(onRowClick || (isMobile && columns.some(c => c.hideBelow))) ? 'cursor-pointer' : ''} ${rowClassName?.(row) || ''}`}
        >
          {columns.map((col, cIdx) => (
            <td key={col.key} className={`whitespace-nowrap px-4 py-3 ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.hideBelow ? HIDE_CLASS[col.hideBelow] : ''}`}>
              {cIdx === 0 && isMobile && columns.some(c => c.hideBelow) && (
                <ChevronRight className={`inline-block w-4 h-4 mr-2 transition-transform ${expandedRow === actualIndex ? 'rotate-90' : ''}`} />
              )}
              {col.render ? col.render(row[col.key], row, actualIndex) : (row[col.key] ?? '—')}
            </td>
          ))}
        </tr>
        {expandedRow === actualIndex && isMobile && (
          <tr className="bg-muted/10 border-b border-border">
            <td colSpan={columns.length} className="px-4 py-3">
              <div className="flex flex-col gap-2 pl-6">
                {columns.filter(c => c.hideBelow).map(col => (
                  <div key={col.key} className="flex justify-between items-start border-b border-border/50 pb-2 last:border-0 last:pb-0">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{col.label}</span>
                    <span className="text-right text-xs">
                      {col.render ? col.render(row[col.key], row, actualIndex) : (row[col.key] ?? '—')}
                    </span>
                  </div>
                ))}
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="glass-panel flex flex-col">
      {tableId && (
        <div className="flex items-center justify-between p-3 border-b border-border bg-muted/20">
          <div className="text-xs font-medium text-muted-foreground flex flex-wrap items-center gap-2">
            {sorts.length > 0 ? (
              <>
                <span>Sorted by:</span>
                <div className="flex flex-wrap gap-1.5">
                  {sorts.map((s, i) => (
                    <span key={s.key} className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] uppercase font-bold">
                      {columns.find(c => c.key === s.key)?.label || s.key}
                      {s.dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {sorts.length > 1 && <span className="opacity-60 ml-0.5">{i + 1}</span>}
                    </span>
                  ))}
                  <button onClick={() => setSorts([])} className="hover:text-foreground transition-colors ml-1" title="Clear sort">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </>
            ) : <span>No sort applied (Hold Shift to multi-sort)</span>}
          </div>
          <div className="flex items-center gap-2 relative z-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider border border-border rounded-md hover:bg-muted/50 transition-colors">
                  <Bookmark className="h-3.5 w-3.5" /> Presets
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Sort Presets</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {presets.length > 0 ? (
                  presets.map(p => (
                    <DropdownMenuItem key={p.id} onClick={() => setSorts(p.sorts)} className="flex items-center justify-between group cursor-pointer">
                      <span className="truncate pr-2">{p.name}</span>
                      <button onClick={(e) => handleDeletePreset(p.id, e)} className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 p-1 rounded transition-all">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <div className="px-2 py-3 text-xs text-muted-foreground text-center italic">No presets saved</div>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSavePreset} disabled={sorts.length === 0} className="font-medium text-primary cursor-pointer">
                  <Save className="h-4 w-4 mr-2" /> Save Current Sort
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      <div 
        className="overflow-auto scrollbar-thin"
        ref={parentRef}
        style={{ maxHeight: virtualize ? maxHeight : undefined }}
      >
        <table className="w-full font-sans text-xs border-collapse relative">
          <thead className="sticky top-0 z-20 bg-muted/95 backdrop-blur shadow-xs">
            <tr className="border-b border-border">
              {columns.map(col => {
                const sIdx = getSortIndex(col.key);
                const sDir = getSortDir(col.key);
                return (
                  <th
                    key={col.key}
                    className={`whitespace-nowrap px-4 py-3 font-medium text-muted-foreground uppercase tracking-wider text-xs ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.sortable !== false ? 'cursor-pointer select-none hover:text-foreground' : ''} ${col.hideBelow ? HIDE_CLASS[col.hideBelow] : ''}`}
                    style={col.width ? { width: col.width } : undefined}
                    onClick={(e) => col.sortable !== false && toggleSort(col.key, e.shiftKey)}
                  >
                    <span className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'justify-end w-full' : ''}`}>
                      {col.label}
                      {sDir && (sDir === 'asc' ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />)}
                      {sDir && sorts.length > 1 && <span className="text-[9px] text-primary bg-primary/10 rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">{sIdx + 1}</span>}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-muted-foreground/60 italic font-medium">
                  No records found
                </td>
              </tr>
            ) : virtualize ? (
              <>
                {virtualItems.length > 0 && virtualItems[0].start > 0 && (
                  <tr style={{ height: `${virtualItems[0].start}px` }}>
                    <td colSpan={columns.length} style={{ padding: 0, border: 0 }} />
                  </tr>
                )}
                {virtualItems.map((virtualRow) => renderRow(sorted[virtualRow.index], virtualRow.index, true))}
                {virtualItems.length > 0 && virtualItems[virtualItems.length - 1].end < rowVirtualizer.getTotalSize() && (
                  <tr style={{ height: `${rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end}px` }}>
                    <td colSpan={columns.length} style={{ padding: 0, border: 0 }} />
                  </tr>
                )}
              </>
            ) : (
              paged.map((row, i) => renderRow(row, i, false))
            )}
          </tbody>
        </table>
      </div>
      {footer}
      {!virtualize && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          <span>Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, data.length)} of {data.length}</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="rounded-md border border-border px-3 py-1 font-sans text-xs font-bold uppercase tracking-wider hover:bg-muted/50 group hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors">Prev</button>
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="rounded-md border border-border px-3 py-1 font-sans text-xs font-bold uppercase tracking-wider hover:bg-muted/50 group hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors">Next</button>
          </div>
        </div>
      )}
      {virtualize && sorted.length > 0 && (
        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          <span>Showing all {sorted.length} records (Virtualized)</span>
        </div>
      )}
    </div>
  );
}
