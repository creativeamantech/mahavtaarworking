import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import { SyncProvider } from "@/contexts/SyncContext";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PermissionGate } from "@/components/PermissionGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Navigate } from "@/lib/router-compat";

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium tracking-wide">Loading application module...</p>
      </div>
    </div>
  );
}

/** The app is local-first (IndexedDB / browser storage), so it only renders after hydration. */
export function LegacyApp({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <PageLoader />;
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <AuthProvider>
        <DataProvider>
          <SyncProvider>
            <TooltipProvider>
              <Sonner />
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>{children}</Suspense>
              </ErrorBoundary>
            </TooltipProvider>
          </SyncProvider>
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

const homeFor = (role?: string) => (role === "EXECUTIVE" ? "/exec-dashboard" : "/dashboard");

export function ProtectedRoute({ children, view }: { children: ReactNode; view?: string }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (view)
    return (
      <PermissionGate view={view} fallback={<Navigate to={homeFor(user.role)} replace />}>
        {children}
      </PermissionGate>
    );
  return <>{children}</>;
}

export function LoginGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}

export function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? homeFor(user.role) : "/login"} replace />;
}
