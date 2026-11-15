import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { MahavtaarLogoMark } from "@/components/MahavtaarLogo3D";

type ClientMod = typeof import("./LegacyClient");
const Ctx = createContext<ClientMod | null>(null);

function LoadingBrandMark() {
  return <MahavtaarLogoMark className="h-20 w-20 object-contain" alt="Mahavtaar Enterprises" />;
}

export function PageLoader() {
  return (
    <div className="mv-loader min-h-screen flex items-center justify-center px-6">
      <div className="flex flex-col items-center text-center">
        <div className="rounded-[26px] bg-white p-3 shadow-xl shadow-purple-950/10 ring-1 ring-white/70">
          <LoadingBrandMark />
        </div>
        <p className="mt-5 text-lg font-extrabold tracking-[.16em] text-slate-800">MAHAVTAAR</p>
        <p className="mt-1 text-[10px] font-bold tracking-[.38em] text-slate-500">WORKING</p>
        <div className="mt-6 h-1.5 w-40 overflow-hidden rounded-full bg-slate-200">
          <div className="mv-loader-progress h-full w-2/5 rounded-full bg-gradient-to-r from-[#81258c] via-[#0799cf] to-[#55a94f]" />
        </div>
        <p className="mt-3 text-xs font-medium tracking-wide text-slate-500">Loading your workspace…</p>
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
