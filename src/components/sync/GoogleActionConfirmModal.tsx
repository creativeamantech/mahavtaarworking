import { AlertTriangle, X } from "lucide-react";

interface GoogleActionConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  details?: string[];
  confirmLabel?: string;
  destructive?: boolean;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function GoogleActionConfirmModal({
  open,
  title,
  description,
  details = [],
  confirmLabel = "Confirm",
  destructive = false,
  isSubmitting = false,
  onConfirm,
  onCancel,
}: GoogleActionConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                destructive
                  ? "bg-destructive/15 text-destructive"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">{title}</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close confirmation dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {details.length > 0 && (
          <ul className="rounded-xl border border-border bg-muted/30 p-3 space-y-1 text-xs text-foreground">
            {details.map((item, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span className="truncate">{item}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="h-9 rounded-lg border border-border bg-card px-4 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`h-9 rounded-lg px-4 text-xs font-semibold text-white disabled:opacity-50 ${
              destructive
                ? "bg-destructive hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {isSubmitting ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
