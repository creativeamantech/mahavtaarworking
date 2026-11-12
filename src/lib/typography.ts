/**
 * Mahavtaar Working typography scale.
 * Calm, readable hierarchy for dense collection and portfolio workflows.
 */
export const typo = {
  pageTitle: "font-sans font-semibold text-xl md:text-2xl tracking-tight text-foreground flex items-center gap-2.5",
  pageSubtitle: "font-sans text-xs md:text-sm text-muted-foreground mt-0.5",
  sectionTitle: "font-sans font-semibold text-sm md:text-base text-foreground tracking-tight",
  sectionSubtitle: "font-sans text-xs text-muted-foreground",
  labelCaps: "font-sans font-semibold text-[10px] md:text-[11px] tracking-wide text-muted-foreground",
  labelSubtle: "font-sans font-medium text-xs text-muted-foreground",
  dataHero: "font-sans font-bold text-2xl md:text-3xl tracking-tight tabular-nums",
  dataValue: "font-sans font-semibold text-xl md:text-2xl tracking-tight tabular-nums",
  dataMetric: "font-sans font-semibold text-base md:text-lg tabular-nums",
  dataBody: "font-sans text-xs md:text-sm tabular-nums",
  tableHeader: "font-sans text-[11px] font-semibold tracking-wide text-muted-foreground select-none",
  tableCell: "font-sans text-xs font-medium tabular-nums",
  caption: "font-sans text-[11px] text-muted-foreground",
  monoCode: "font-mono text-xs font-semibold tracking-tight",
} as const;
