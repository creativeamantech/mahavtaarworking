import { useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useAuth } from "../contexts/AuthContext";
import { Eye, EyeOff, CheckCircle2, ShieldCheck, LoaderCircle } from "lucide-react";
import { MahavtaarLogo3D } from "@/components/MahavtaarLogo3D";

const EXECUTIVE_NAMES = [
  "Aarti", "Admin", "Ankita", "Bharti", "Julee",
  "Pooja", "Shikha", "Sona", "Sunanda", "Vinita",
] as const;


export default function Login() {
  const [executiveName, setExecutiveName] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!executiveName || !pin || loading) return;
    setError("");
    setLoading(true);
    try {
      const user = await login(executiveName, pin);
      setPin("");
      navigate(user.role === "EXECUTIVE" ? "/exec-dashboard" : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mv-login min-h-screen w-full">
      <div className="mv-login-ribbon" />
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_.95fr]">
        <section className="mv-login-brand relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between">
          <div className="relative z-10 flex items-center gap-4">
            <div className="rounded-2xl bg-white p-2 shadow-lg"><MahavtaarLogo3D alt="Mahavtaar Enterprises" className="h-20 w-20" interactive={false} /></div>
            <div><div className="text-xl font-extrabold tracking-[.12em] text-white">MAHAVTAAR</div><div className="mt-1 text-xs font-semibold tracking-[.34em] text-white/70">WORKING</div></div>
          </div>
          <div className="relative z-10 max-w-xl py-14">
            <p className="mb-5 text-xs font-bold uppercase tracking-[.24em] text-amber-200">One workspace. Clear progress.</p>
            <h1 className="text-5xl font-extrabold leading-[1.12] tracking-tight text-white xl:text-6xl">Work smarter.<br />Stay connected.</h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-white/80">Your central workspace for collection operations, data entry and team coordination — designed to keep everyday work simple and focused.</p>
            <div className="mt-9 grid gap-4 text-sm font-medium text-white/90">
              {["Live workspace data", "Team and portfolio reports", "Secure server-side sessions", "Role-based access control"].map((feature) => (
                <div key={feature} className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-amber-200" />{feature}</div>
              ))}
            </div>
          </div>
          <p className="relative z-10 text-xs text-white/60">© {new Date().getFullYear()} Mahavtaar Working · All rights reserved</p>
          <div className="mv-orb mv-orb-one" /><div className="mv-orb mv-orb-two" />
        </section>

        <section className="flex min-h-screen items-center justify-center bg-white px-5 py-10 sm:px-8">
          <div className="w-full max-w-[420px]">
            <div className="mb-9 flex flex-col items-center text-center lg:hidden">
              <MahavtaarLogo3D alt="Mahavtaar Enterprises" className="h-16 w-16" interactive={false} />
              <div className="mt-3 text-lg font-extrabold tracking-[.12em] text-slate-900">MAHAVTAAR</div>
              <div className="mt-1 text-[10px] font-bold tracking-[.34em] text-slate-500">WORKING</div>
            </div>
            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-[.2em] text-[#81258c]">Welcome back</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">Sign in to continue</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Select your profile and enter your PIN to access your workspace.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="executive-name" className="mb-2 block text-sm font-semibold text-slate-700">Username</label>
                <select id="executive-name" required value={executiveName} onChange={(e) => setExecutiveName(e.target.value)} disabled={loading}
                  className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-[#0799cf] focus:bg-white focus:ring-4 focus:ring-[#0799cf]/10 disabled:opacity-60">
                  <option value="">Select your username</option>
                  {EXECUTIVE_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="login-pin" className="mb-2 block text-sm font-semibold text-slate-700">PIN</label>
                <div className="relative">
                  <input id="login-pin" type={showPin ? "text" : "password"} inputMode="numeric" autoComplete="current-password" value={pin}
                    onChange={(e) => setPin(e.target.value)} disabled={loading} required placeholder="Enter your PIN"
                    className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-12 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#0799cf] focus:bg-white focus:ring-4 focus:ring-[#0799cf]/10 disabled:opacity-60" />
                  <button type="button" onClick={() => setShowPin((s) => !s)} aria-label={showPin ? "Hide PIN" : "Show PIN"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-purple-50 hover:text-[#81258c]">
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-700">{error}</div>}
              <button type="submit" disabled={!executiveName || !pin || loading}
                className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#81258c] via-[#087fba] to-[#55a94f] px-4 text-sm font-bold tracking-wide text-white shadow-lg shadow-purple-900/15 transition hover:-translate-y-0.5 hover:shadow-xl disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50">
                {loading ? <><LoaderCircle className="h-5 w-5 animate-spin" /> Signing in…</> : <>Sign in <span aria-hidden="true">→</span></>}
              </button>
            </form>
            <div className="mt-7 flex items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-[#55a94f]" /> Protected workspace access</div>
            <p className="mt-3 text-center text-[11px] leading-5 text-slate-400">Access is provided by your administrator.<br />Never share your PIN with anyone.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
