import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

type ClientMod = typeof import("./LegacyClient");
const Ctx = createContext<ClientMod | null>(null);

export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium tracking-wide">Loading application module...</p>
      </div>
    </div>
  );
}

/** The app is local-first (IndexedDB / browser storage), so it loads only in the browser. */
export function LegacyApp({ children }: { children: ReactNode }) {
  const [mod, setMod] = useState<ClientMod | null>(null);
  useEffect(() => {
    import("./LegacyClient").then(setMod);
  }, []);
  if (!mod) return <PageLoader />;
  const { LegacyProviders } = mod;
  return (
    <Ctx.Provider value={mod}>
      <LegacyProviders>{children}</LegacyProviders>
    </Ctx.Provider>
  );
}

function useMod() {
  return useContext(Ctx);
}

export function ProtectedRoute({ children, view }: { children: ReactNode; view?: string }) {
  const m = useMod();
  if (!m) return <PageLoader />;
  return <m.ProtectedRoute view={view}>{children}</m.ProtectedRoute>;
}

export function LoginGate({ children }: { children: ReactNode }) {
  const m = useMod();
  if (!m) return <PageLoader />;
  return <m.LoginGate>{children}</m.LoginGate>;
}

export function HomeRedirect() {
  const m = useMod();
  if (!m) return <PageLoader />;
  return <m.HomeRedirect />;
}

