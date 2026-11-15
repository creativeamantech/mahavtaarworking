import { LogOut, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useGoogleWorkspaceAuth } from "@/lib/googleWorkspaceAuth";

interface GoogleSignInButtonProps {
  onConnected?: () => void;
  compact?: boolean;
  className?: string;
}

export function GoogleSignInButton({
  onConnected,
  compact = false,
  className = "",
}: GoogleSignInButtonProps) {
  const { googleUser, isConnected, isLoggingIn, signIn, signOut } = useGoogleWorkspaceAuth();

  const handleSignIn = async () => {
    try {
      await signIn();
      toast.success("Connected to Google Drive & Google Sheets");
      onConnected?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed";
      toast.error(msg);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast.info("Disconnected Google Workspace session");
  };

  if (isConnected && googleUser) {
    return (
      <div
        className={`inline-flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs ${className}`}
      >
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="min-w-0 text-left">
          <span className="font-semibold text-foreground block truncate max-w-[180px]">
            {googleUser.displayName || googleUser.email || "Google Connected"}
          </span>
          {!compact && googleUser.email && (
            <span className="text-[10px] text-muted-foreground block truncate max-w-[180px]">
              {googleUser.email}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          title="Disconnect Google Workspace"
          className="ml-1 inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-destructive transition-colors"
        >
          <LogOut className="h-3 w-3" />
          <span>Disconnect</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleSignIn()}
      disabled={isLoggingIn}
      className={`gsi-material-button ${className}`}
    >
      <div className="gsi-material-button-state" />
      <div className="gsi-material-button-content-wrapper">
        <div className="gsi-material-button-icon">
          {isLoggingIn ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin text-muted-foreground" />
          ) : (
            <svg
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              style={{ display: "block" }}
              aria-hidden="true"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
              <path fill="none" d="M0 0h48v48H0z" />
            </svg>
          )}
        </div>
        <span className="gsi-material-button-contents">
          {isLoggingIn ? "Signing in..." : "Sign in with Google"}
        </span>
      </div>
    </button>
  );
}
