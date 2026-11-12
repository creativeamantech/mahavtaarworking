import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

type ClientMod = typeof import("./LegacyClient");
const Ctx = createContext<ClientMod | null>(null);

function LoadingBrandMark() {
  return (
    <div className="relative h-20 w-20">
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="loadPurple" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#9b2495"/><stop offset="1" stopColor="#69228b"/></linearGradient>
          <linearGradient id="loadBlue" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#11b5df"/><stop offset="1" stopColor="#0876bb"/></linearGradient>
          <linearGradient id="loadGreen" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#8bc53f"/><stop offset="1" stopColor="#35a65b"/></linearGradient>
          <linearGradient id="loadOrange" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffc32b"/><stop offset="1" stopColor="#ef542c"/></linearGradient>
        </defs>
        <path d="M47 53 C22 38 20 13 29 5 C48 14 57 31 53 51Z" fill="url(#loadPurple)"/>
        <path d="M52 53 C49 28 58 11 70 8 C82 28 73 45 57 58Z" fill="url(#loadBlue)"/>
        <path d="M55 57 C68 34 83 34 94 39 C92 59 75 69 56 65Z" fill="url(#loadGreen)"/>
        <path d="M50 65 C67 59 82 65 91 78 C73 93 52 87 42 73Z" fill="url(#loadOrange)"/>
        <path d="M13 72 C23 91 49 98 73 87 C54 105 20 96 8 76Z" fill="#e84a37"/>
        <path d="M27 69 C28 54 36 45 48 43 C59 47 66 58 65 72 C58 81 39 84 27 69Z" fill="white" stroke="#f0b51e" strokeWidth="3"/>
        <path d="M37 70 C38 59 43 53 48 51 C54 55 58 62 58 71 C53 77 42 78 37 70Z" fill="none" stroke="#7c2b8b" strokeWidth="2.5"/>
        <path d="M22 76 Q48 91 73 76" fill="none" stroke="#0b9dc2" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    </div>
  );
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
