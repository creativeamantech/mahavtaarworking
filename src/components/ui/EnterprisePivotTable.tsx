// @ts-nocheck
import React, { ReactNode } from "react";
import { ArrowUp, ArrowDown, Info } from "lucide-react";

export type PivotDensity = "compact" | "comfortable" | "detailed";

export interface PivotColumn<T = Record<string, unknown>> {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  minWidth?: number | string;
  width?: number | string;
  stickyLeft?: boolean;
  stickyLeftOffset?: number;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  render?: (row: T, index: number) => ReactNode;
  renderFooter?: () => ReactNode;
}

export interface SortItem {
  key: string;
  direction: "asc" | "desc";
}

interface EnterprisePivotTableProps<T> {
  columns: PivotColumn<T>[];
  data?: T[];
  sortConfig?: SortItem[];
  onSort?: (key: string) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  minTableWidth?: string;
  density?: PivotDensity;
  customBody?: ReactNode;
  customFooter?: ReactNode;
  id?: string;
}

export function EnterprisePivotTable<T>({
  columns,
  data = [],
  sortConfig = [],
  onSort,
  isLoading = false,
  emptyMessage = "No matching records found for the selected filters.",
  minTableWidth = "1120px",
  density = "comfortable",
  customBody,
  customFooter,
  id = "enterprise-pivot-grid",
}: EnterprisePivotTableProps<T>) {
  const densityCellPadding = {
    compact: "px-2.5 py-1.5 text-[11px]",
    comfortable: "px-3 py-2 text-xs",
    detailed: "px-3.5 py-2.5 text-xs",
  }[density];

  const densityHeaderPadding = {
    compact: "px-2.5 py-2 text-[10px]",
    comfortable: "px-3 py-2.5 text-[11px]",
    detailed: "px-3.5 py-3 text-xs",
  }[density];

  return (
    <div
      id={id}
      className="rounded-xl border border-border bg-card shadow-2xs flex flex-col flex-1 min-h-0 relative overflow-hidden"
    >
      <div className="overflow-auto flex-1 min-h-[380px] max-h-[calc(100vh-250px)] scrollbar-thin">
        <table className="w-full border-collapse font-sans" style={{ minWidth: minTableWidth }}>
          <colgroup>
            {columns.map((col) => (
              <col
                key={col.key}
                style={{
                  width: col.width,
                  minWidth: col.minWidth,
                }}
              />
            ))}
          </colgroup>

          <thead className="sticky top-0 z-30 bg-muted/95 dark:bg-card border-b border-border">
            <tr>
              {columns.map((col) => {
                const active = sortConfig.find((s) => s.key === col.key);
                const alignClass =
                  col.align === "right"
                    ? "text-right justify-end"
                    : col.align === "center"
                      ? "text-center justify-center"
                      : "text-left justify-start";

                const stickyStyle: React.CSSProperties = col.stickyLeft
                  ? {
                      position: "sticky",
                      left: col.stickyLeftOffset ?? 0,
                      zIndex: 35,
                    }
                  : {};

                return (
                  <th
                    key={col.key}
                    style={stickyStyle}
                    onClick={() => {
                      if (col.sortable !== false && onSort) {
                        onSort(col.key);
                      }
                    }}
                    className={`
                      ${densityHeaderPadding} select-none font-bold uppercase tracking-wider
                      border-b border-border transition-colors whitespace-nowrap bg-muted/95 dark:bg-card
                      ${col.sortable !== false ? "cursor-pointer hover:text-foreground" : "cursor-default"}
                      ${active ? "text-primary bg-primary/5" : "text-muted-foreground"}
                      ${col.headerClassName || ""}
                    `}
                  >
                    <div className={`inline-flex items-center gap-1.5 w-full ${alignClass}`}>
                      <span>{col.label}</span>
                      {active &&
                        (active.direction === "asc" ? (
                          <ArrowUp className="h-3 w-3 text-primary shrink-0" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-primary shrink-0" />
                        ))}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {customBody ? (
            customBody
          ) : (
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={`loading-${idx}`} className="border-b border-border/50 animate-pulse">
                    {columns.map((col) => (
                      <td key={col.key} className={densityCellPadding}>
                        <div className="h-4 bg-muted rounded w-4/5 my-1" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="py-16 text-center text-muted-foreground text-sm"
                  >
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                        <Info className="h-5 w-5" />
                      </div>
                      <p className="font-semibold text-foreground">{emptyMessage}</p>
                      <p className="text-xs text-muted-foreground">
                        Adjust your search or bucket filter above to view performance records.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((row, rowIdx) => (
                  <tr
                    key={
                      (row as Record<string, unknown>).id ||
                      (row as Record<string, unknown>).key ||
                      rowIdx
                    }
                    className="border-b border-border/50 hover:bg-primary/[0.035] transition-colors group"
                  >
                    {columns.map((col) => {
                      const stickyStyle: React.CSSProperties = col.stickyLeft
                        ? {
                            position: "sticky",
                            left: col.stickyLeftOffset ?? 0,
                            zIndex: 10,
                          }
                        : {};

                      const alignClass =
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                            ? "text-center"
                            : "text-left";

                      return (
                        <td
                          key={col.key}
                          style={stickyStyle}
                          className={`
                            ${densityCellPadding} ${alignClass} font-tabular
                            bg-card group-hover:bg-primary/[0.035] transition-colors
                            ${col.stickyLeft ? "shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]" : ""}
                            ${col.className || ""}
                          `}
                        >
                          {col.render
                            ? col.render(row, rowIdx)
                            : ((row as Record<string, unknown>)[col.key] ?? "—")}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          )}

          {customFooter ? (
            customFooter
          ) : (
            <tfoot className="sticky bottom-0 z-30 bg-[#1b1e35] dark:bg-[#0d101d] text-white font-bold shadow-[0_-3px_10px_rgba(0,0,0,0.16)] border-t-2 border-primary/50">
              <tr>
                {columns.map((col) => {
                  const stickyStyle: React.CSSProperties = col.stickyLeft
                    ? {
                        position: "sticky",
                        left: col.stickyLeftOffset ?? 0,
                        zIndex: 35,
                      }
                    : {};

                  const alignClass =
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                        ? "text-center"
                        : "text-left";

                  return (
                    <td
                      key={col.key}
                      style={stickyStyle}
                      className={`
                        px-3 py-3 ${alignClass} font-tabular bg-[#1b1e35] dark:bg-[#0d101d]
                        ${col.stickyLeft ? "shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]" : ""}
                      `}
                    >
                      {col.renderFooter ? col.renderFooter() : null}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
