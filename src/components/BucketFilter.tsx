// @ts-nocheck
import { useDataState, useDataDispatch } from "../contexts/DataContext";
import { useMemo, useState, useRef, useEffect } from "react";
import { Filter, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Check, Layers } from "lucide-react";

interface BucketFilterProps {
  className?: string;
  showCounts?: boolean;
  compact?: boolean;
}

export function BucketFilter({
  className = "",
  showCounts = true,
  compact = false,
}: BucketFilterProps) {
  const { records, filteredRecords, globalBucket } = useDataState();
  const { setGlobalBucket } = useDataDispatch();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const { availableBuckets, bucketCounts, totalCount } = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    (records || []).forEach((r: LoanRecord) => {
      total++;
      if (r.bom_bkt !== undefined && r.bom_bkt !== null && String(r.bom_bkt).trim() !== "") {
        const b = String(r.bom_bkt).trim().toUpperCase();
        counts[b] = (counts[b] || 0) + 1;
      }
    });
    const bkts = Object.keys(counts).sort((a, b) => {
      const numA = Number(a);
      const numB = Number(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
    return { availableBuckets: bkts, bucketCounts: counts, totalCount: total };
  }, [records]);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [availableBuckets]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const offset = direction === "left" ? -180 : 180;
    scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  if (availableBuckets.length === 0) return null;

  return (
    <div
      className={`w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-1.5 shadow-2xs ${className}`}
    >
      <div className="relative flex-1 min-w-0 flex items-center">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll("left")}
            className="absolute left-0 z-10 hidden sm:flex items-center justify-center h-8 w-6 bg-gradient-to-r from-card via-card/90 to-transparent text-muted-foreground hover:text-foreground"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 w-full scroll-smooth"
        >
          <div className="flex items-center gap-1.5 pr-2 text-xs font-semibold text-muted-foreground shrink-0 select-none">
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Bucket</span>
          </div>

          <button
            type="button"
            onClick={() => setGlobalBucket("ALL")}
            className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors whitespace-nowrap ${
              globalBucket === "ALL"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/45 text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <span>All Buckets</span>
            {showCounts && (
              <span
                className={`text-[11px] font-tabular ${
                  globalBucket === "ALL" ? "opacity-90" : "opacity-75"
                }`}
              >
                · {totalCount.toLocaleString()}
              </span>
            )}
          </button>

          {availableBuckets.map((b) => {
            const isSelected = globalBucket === b;
            const count = bucketCounts[b] || 0;
            return (
              <button
                type="button"
                key={b}
                onClick={() => setGlobalBucket(b)}
                className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors whitespace-nowrap ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/45 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <span>Bkt {b}</span>
                {showCounts && (
                  <span
                    className={`text-[11px] font-tabular ${
                      isSelected ? "opacity-90" : "opacity-75"
                    }`}
                  >
                    · {count.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll("right")}
            className="absolute right-0 z-10 hidden sm:flex items-center justify-center h-8 w-6 bg-gradient-to-l from-card via-card/90 to-transparent text-muted-foreground hover:text-foreground"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {!compact && filteredRecords && (
        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground font-medium shrink-0 pl-2 border-l border-border whitespace-nowrap">
          <span>Active:</span>
          <span className="text-foreground font-semibold font-tabular">
            {filteredRecords.length.toLocaleString()}
          </span>
          <span className="text-muted-foreground/70 font-tabular">
            / {totalCount.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}

export function FloatingBucketFilter({ className = "" }: { className?: string }) {
  const { records, globalBucket } = useDataState();
  const { setGlobalBucket } = useDataDispatch();
  const [isExpanded, setIsExpanded] = useState(false);

  const { availableBuckets, bucketCounts, totalCount } = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    (records || []).forEach((r: LoanRecord) => {
      total++;
      if (r.bom_bkt !== undefined && r.bom_bkt !== null && String(r.bom_bkt).trim() !== "") {
        const b = String(r.bom_bkt).trim().toUpperCase();
        counts[b] = (counts[b] || 0) + 1;
      }
    });
    const bkts = Object.keys(counts).sort((a, b) => {
      const numA = Number(a);
      const numB = Number(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
    return { availableBuckets: bkts, bucketCounts: counts, totalCount: total };
  }, [records]);

  if (availableBuckets.length === 0) return null;

  const currentCount = globalBucket === "ALL" ? totalCount : bucketCounts[globalBucket] || 0;

  return (
    <aside
      aria-label="Bucket Filter Navigation"
      className={`fixed bottom-[74px] md:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[96vw] transition-all duration-200 ${className}`}
      style={{ pointerEvents: "auto" }}
    >
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-card/95 backdrop-blur-xl border border-border shadow-lg">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex items-center gap-2 pl-3 pr-2.5 py-1.5 text-xs font-semibold text-foreground hover:text-primary transition-colors rounded-lg select-none"
          title="Toggle bucket selection options"
        >
          <Filter className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-primary font-bold whitespace-nowrap">
            {globalBucket === "ALL" ? "All Buckets" : `Bucket ${globalBucket}`}
          </span>
          <span className="text-[11px] font-tabular text-muted-foreground">
            · {currentCount.toLocaleString()}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>

        {isExpanded && (
          <>
            <div className="h-4 w-px bg-border mx-0.5" />
            <div className="flex items-center gap-1 overflow-x-auto max-w-[62vw] sm:max-w-[70vw] md:max-w-none scrollbar-none py-0.5 px-1">
              <button
                type="button"
                onClick={() => {
                  setGlobalBucket("ALL");
                  setIsExpanded(false);
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1 shrink-0 ${
                  globalBucket === "ALL"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {globalBucket === "ALL" && <Check className="w-3 h-3" />}
                <span>All ({totalCount.toLocaleString()})</span>
              </button>

              {availableBuckets.map((b) => {
                const isSelected = globalBucket === b;
                const count = bucketCounts[b] || 0;
                return (
                  <button
                    type="button"
                    key={b}
                    onClick={() => {
                      setGlobalBucket(b);
                      setIsExpanded(false);
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1 shrink-0 ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    <span>Bkt {b}</span>
                    <span className="text-[11px] opacity-80 font-tabular">
                      ({count.toLocaleString()})
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
