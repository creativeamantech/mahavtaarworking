/**
 * Mahavtaar Working — semantic design tokens.
 * Class names remain presentation-only; business status values and calculations are unchanged.
 */

export const BRAND = {
  lotus: "#702878",
  lotusDeep: "#51205f",
  plum: "#43204f",
  indigo: "#39428a",
  cyan: "#168fa9",
  leaf: "#56845a",
  marigold: "#d5a72d",
  ivory: "#fbfaf7",
} as const;

export const THEME_TOKENS = {
  light: {
    background: "36 25% 98%",
    foreground: "258 26% 15%",
    card: "0 0% 100%",
    primary: "291 44% 31%",
    primaryForeground: "0 0% 100%",
    secondary: "246 28% 94%",
    accent: "190 58% 94%",
    border: "252 17% 88%",
    ring: "291 44% 42%",
  },
  dark: {
    background: "258 27% 9%",
    foreground: "36 22% 95%",
    card: "258 23% 13%",
    primary: "287 42% 67%",
    primaryForeground: "258 27% 10%",
    secondary: "258 18% 20%",
    accent: "190 35% 20%",
    border: "258 16% 25%",
    ring: "287 42% 67%",
  },
} as const;

type SemanticColor = { bg: string; text: string; border: string; hex: string };

export const BUCKET_COLORS: Record<string, SemanticColor> = {
  CURRENT: { bg: "bg-bucket-current/10 dark:bg-bucket-current/15", text: "text-bucket-current", border: "border-bucket-current/30", hex: "#56845a" },
  "1-30": { bg: "bg-bucket-1-30/10 dark:bg-bucket-1-30/15", text: "text-bucket-1-30", border: "border-bucket-1-30/30", hex: "#5264a8" },
  "31-60": { bg: "bg-bucket-31-60/10 dark:bg-bucket-31-60/15", text: "text-bucket-31-60", border: "border-bucket-31-60/30", hex: "#c18a28" },
  "61-90": { bg: "bg-bucket-61-90/10 dark:bg-bucket-61-90/15", text: "text-bucket-61-90", border: "border-bucket-61-90/30", hex: "#c66c35" },
  NPA: { bg: "bg-bucket-npa/10 dark:bg-bucket-npa/15", text: "text-bucket-npa", border: "border-bucket-npa/30", hex: "#bd4c5c" },
};

export const DISP_COLORS: Record<string, SemanticColor> = {
  Paid: { bg: "bg-disp-paid/15", text: "text-disp-paid", border: "border-disp-paid/30", hex: "#56845a" },
  Settled: { bg: "bg-disp-settled/15", text: "text-disp-settled", border: "border-disp-settled/30", hex: "#168f80" },
  PTP: { bg: "bg-disp-ptp/15", text: "text-disp-ptp", border: "border-disp-ptp/30", hex: "#5264a8" },
  RTP: { bg: "bg-disp-rtp/15", text: "text-disp-rtp", border: "border-disp-rtp/30", hex: "#c18a28" },
  RNR: { bg: "bg-disp-rnr/15", text: "text-disp-rnr", border: "border-disp-rnr/30", hex: "#727b8e" },
  NC: { bg: "bg-disp-nc/15", text: "text-disp-nc", border: "border-disp-nc/30", hex: "#bd4c5c" },
};

export const ROLE_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  ADMIN: { bg: "bg-role-admin/15 text-role-admin border-role-admin/30", text: "text-role-admin", label: "Administrator" },
  MANAGER: { bg: "bg-role-manager/15 text-role-manager border-role-manager/30", text: "text-role-manager", label: "Operations Manager" },
  EXECUTIVE: { bg: "bg-role-executive/15 text-role-executive border-role-executive/30", text: "text-role-executive", label: "Collection Executive" },
  VIEWER: { bg: "bg-role-viewer/15 text-role-viewer border-role-viewer/30", text: "text-role-viewer", label: "Auditor / Viewer" },
};

export const HEAT_COLORS = {
  cool: "bg-heat-cool/12 text-heat-cool",
  warm: "bg-heat-warm/12 text-heat-warm",
  hot: "bg-heat-hot/12 text-heat-hot",
  critical: "bg-heat-critical/12 text-heat-critical",
} as const;

export const CHART_SERIES = [
  "#702878", "#5264a8", "#168fa9", "#56845a", "#d5a72d", "#c66c35", "#bd4c5c", "#727b8e",
] as const;
